// Keep the v1 key so existing installations are migrated in place exactly once.
export const STORAGE_KEY = 'dsh-workspace-plus:v1';
export const LEGACY_BACKUP_KEY = STORAGE_KEY + ':legacy-backup';
export const DEFAULT_FEATURES = Object.freeze({ workspaces: true, composer: true, sessions: true, unread: true, branding: true });
export const MAX_SETTINGS_BYTES = 2 * 1024 * 1024;
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

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
function validateId(id) {
  if (!id.trim() || id.length > 200 || ['__proto__', 'prototype', 'constructor'].includes(id)) throw new Error('Invalid workspace ID');
}
function featuresOf(input) {
  const features = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(features)) if (typeof input?.[key] === 'boolean') features[key] = input[key];
  return Object.freeze(features);
}

export function validateSettings(input, iconIds) {
  if (!input || input.version !== 2) throw new Error('Unsupported settings version');
  if (!isRecord(input.appearances)) throw new Error('Invalid workspace appearances');
  // Never silently discard legacy fields in an incorrectly labelled v2 document.
  if (Object.hasOwn(input, 'profiles') || Object.hasOwn(input, 'bindings')) throw new Error('Legacy fields require version 1 migration');
  const appearances = Object.create(null);
  for (const [id, appearance] of Object.entries(input.appearances)) {
    validateId(id);
    appearances[id] = Object.freeze(validateAppearance(appearance, iconIds));
  }
  return { version: 2, appearances: Object.freeze(appearances), features: featuresOf(input.features) };
}

// This parser is only used at the backwards-read boundary, never as a current operating mechanism.
function migrateLegacy(input, iconIds) {
  if (!isRecord(input.profiles) || Object.keys(input.profiles).length > 100) throw new Error('Invalid legacy appearances');
  const saved = Object.create(null);
  for (const [name, appearance] of Object.entries(input.profiles)) {
    if (!name.trim() || name.length > 80 || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Invalid legacy appearance name');
    saved[name] = validateAppearance(appearance, iconIds);
  }
  const bindings = input.bindings ?? {};
  if (!isRecord(bindings)) throw new Error('Invalid legacy workspace bindings');
  const appearances = Object.create(null);
  for (const [id, name] of Object.entries(bindings)) {
    validateId(id);
    if (typeof name !== 'string' || !Object.hasOwn(saved, name)) throw new Error('Missing legacy workspace appearance');
    appearances[id] = { ...saved[name] }; // Every workspace gets an independent value, including formerly shared images.
  }
  return validateSettings({ version: 2, appearances, features: input.features }, iconIds);
}

function serialize(settings) {
  const raw = JSON.stringify(settings);
  if (new TextEncoder().encode(raw).length > MAX_SETTINGS_BYTES) throw new Error('Settings exceed 2 MB');
  return raw;
}

export function createPreferences(storage, iconIds) {
  const empty = () => validateSettings({ version: 2, appearances: {}, features: DEFAULT_FEATURES }, iconIds);
  function load() {
    let recoveryAvailable = false, fallback = empty();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const backup = storage.getItem(LEGACY_BACKUP_KEY);
      recoveryAvailable = backup !== null;
      if (raw === null) return Object.freeze({ ...empty(), error: null, recoveryAvailable });
      const input = JSON.parse(raw);
      let settings;
      if (input?.version === 1) {
        try {
          settings = migrateLegacy(input, iconIds);
          // Existing feature flags are already durable even if the new appearance records cannot be written.
          fallback = { ...fallback, features: settings.features };
          const migrated = serialize(settings);
          // Preserve ALL original bytes, including unused saved appearances, outside the active schema.
          // If either write fails, the original primary key is untouched and nothing is published.
          if (backup !== null && backup !== raw) throw new Error('A different pre-upgrade recovery copy already exists');
          if (backup === null) storage.setItem(LEGACY_BACKUP_KEY, raw);
          recoveryAvailable = true;
          storage.setItem(STORAGE_KEY, migrated);
        } catch (reason) { throw new Error('Saved appearances could not be migrated: ' + reason.message); }
      } else {
        settings = validateSettings(input, iconIds);
        serialize(settings);
      }
      return Object.freeze({ ...settings, error: null, recoveryAvailable });
    } catch (reason) { return Object.freeze({ ...fallback, error: reason.message, recoveryAvailable }); }
  }
  const state = createStore(load());
  function commit(next, recovery = false) {
    if (state.getSnapshot().error && !recovery) throw new Error('Saved settings are unavailable. Retry or save a recovery copy before resetting.');
    next = validateSettings(next, iconIds);
    const raw = serialize(next);
    storage.setItem(STORAGE_KEY, raw); // Publish only after a successful durable write.
    state.set(Object.freeze({ ...next, error: null, recoveryAvailable: state.getSnapshot().recoveryAvailable }));
  }
  return {
    getSnapshot: state.getSnapshot,
    subscribe: state.subscribe,
    appearance(id) { return state.getSnapshot().appearances[id]; },
    save(id, appearance) {
      validateId(id);
      const s = state.getSnapshot();
      commit({ ...s, appearances: { ...s.appearances, [id]: appearance } });
    },
    resetWorkspace(id) {
      validateId(id);
      const s = state.getSnapshot(), appearances = { ...s.appearances };
      delete appearances[id]; commit({ ...s, appearances });
    },
    toggle(key, enabled) {
      if (!Object.hasOwn(DEFAULT_FEATURES, key)) return;
      if (typeof enabled !== 'boolean') throw new Error('Invalid feature value');
      const s = state.getSnapshot(); commit({ ...s, features: { ...s.features, [key]: enabled } });
    },
    // Recovery only: there is deliberately no import, portable export or shared-profile API.
    backup() {
      return (state.getSnapshot().error ? storage.getItem(STORAGE_KEY) : storage.getItem(LEGACY_BACKUP_KEY))
        ?? storage.getItem(STORAGE_KEY) ?? '{}';
    },
    retry() { state.set(load()); },
    resetAll() { commit(empty(), true); },
  };
}
