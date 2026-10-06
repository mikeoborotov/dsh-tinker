export const STORAGE_KEY = 'dsh-workspace-plus:v1';
export const DEFAULT_FEATURES = { workspaces: true, composer: true, sessions: true };
export const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_LENGTH = 180000;

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) {
      next = typeof next === 'function' ? next(state) : next;
      if (next === state) return;
      state = next;
      for (const fn of listeners) fn();
    },
  };
}

export function validateAppearance(value, iconIds) {
  if (!value || typeof value !== 'object') throw new Error('Invalid appearance');
  if (value.kind === 'icon' && iconIds.includes(value.icon) && /^#[0-9a-f]{6}$/i.test(value.color))
    return { kind: 'icon', icon: value.icon, color: value.color };
  if (value.kind === 'emoji' && typeof value.emoji === 'string' && value.emoji.length <= 32) {
    const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value.emoji.trim())];
    if (parts.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(parts[0].segment))
      return { kind: 'emoji', emoji: parts[0].segment };
  }
  if (value.kind === 'image' && typeof value.data === 'string' && value.data.length <= MAX_IMAGE_LENGTH
    && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.data))
    return { kind: 'image', data: value.data };
  throw new Error('Invalid icon, emoji, color or image');
}

export function validateProfile(input, iconIds, portable = false) {
  if (!input || input.version !== 1) throw new Error('Unsupported settings version');
  if (!input.profiles || typeof input.profiles !== 'object' || Array.isArray(input.profiles)) throw new Error('Invalid profiles');
  if (Object.keys(input.profiles).length > 100) throw new Error('Too many profiles');
  const profiles = Object.create(null);
  for (const [alias, appearance] of Object.entries(input.profiles)) {
    if (!alias.trim() || alias.length > 80 || ['__proto__', 'prototype', 'constructor'].includes(alias)) throw new Error('Invalid profile name');
    profiles[alias] = validateAppearance(appearance, iconIds);
  }
  const bindings = Object.create(null);
  if (!portable) {
    for (const [id, alias] of Object.entries(input.bindings ?? {})) {
      if (id.length <= 200 && Object.hasOwn(profiles, alias)) bindings[id] = alias;
    }
  }
  const features = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(features)) if (typeof input.features?.[key] === 'boolean') features[key] = input.features[key];
  return { version: 1, profiles, bindings, features };
}

export function createPreferences(storage, iconIds) {
  const empty = () => ({ version: 1, profiles: Object.create(null), bindings: Object.create(null), features: { ...DEFAULT_FEATURES } });
  let initial = empty(), error = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) initial = validateProfile(JSON.parse(raw), iconIds);
  } catch (e) { error = e.message; }
  const state = createStore({ ...initial, error });
  function commit(next) {
    if (state.getSnapshot().error) throw new Error('Stored settings could not be read. Export a backup and reset first.');
    next = validateProfile(next, iconIds);
    const raw = JSON.stringify(next);
    if (new TextEncoder().encode(raw).length > MAX_PROFILE_BYTES) throw new Error('Settings exceed 2 MB');
    storage.setItem(STORAGE_KEY, raw); // Publish only after a successful durable write.
    state.set({ ...next, error: null });
  }
  return {
    ...state,
    appearance(id) {
      const s = state.getSnapshot();
      return s.profiles[s.bindings[id]];
    },
    save(id, alias, appearance) {
      const s = state.getSnapshot();
      commit({ ...s, profiles: { ...s.profiles, [alias]: appearance }, bindings: { ...s.bindings, [id]: alias } });
    },
    resetWorkspace(id) {
      const s = state.getSnapshot(), bindings = { ...s.bindings };
      delete bindings[id]; commit({ ...s, bindings });
    },
    toggle(key, enabled) {
      if (!Object.hasOwn(DEFAULT_FEATURES, key)) return;
      const s = state.getSnapshot(); commit({ ...s, features: { ...s.features, [key]: enabled } });
    },
    export() {
      const s = state.getSnapshot();
      return JSON.stringify({ version: 1, profiles: s.profiles, features: s.features }, null, 2);
    },
    backup() { return storage.getItem(STORAGE_KEY) ?? '{}'; },
    resetAll() { storage.removeItem(STORAGE_KEY); state.set({ ...empty(), error: null }); },
    import(raw) {
      if (new TextEncoder().encode(raw).length > MAX_PROFILE_BYTES) throw new Error('Settings exceed 2 MB');
      const imported = validateProfile(JSON.parse(raw), iconIds, true);
      const s = state.getSnapshot();
      // Imported names never silently replace an existing profile shared by several Workspaces.
      const profiles = { ...s.profiles };
      for (const [alias, value] of Object.entries(imported.profiles)) {
        let name = alias, i = 2;
        while (Object.hasOwn(profiles, name) && JSON.stringify(profiles[name]) !== JSON.stringify(value)) name = alias.slice(0, 70) + ' (' + i++ + ')';
        profiles[name] = value;
      }
      commit({ ...s, profiles, features: imported.features });
    },
  };
}
