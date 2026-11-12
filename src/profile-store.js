import { MAX_IMAGE_LENGTH } from './store.js';

export const PROFILE_STORAGE_KEY = 'dsh-tinker:profile-appearance:v1';
const EMPTY = Object.freeze({ version: 1, enabled: true, name: null, image: null });
const ENVELOPE_KEYS = ['version', 'enabled', 'name', 'image'];
const DRAFT_KEYS = ['name', 'image'];
const ERROR_CODES = new Set(['profileInvalidData', 'profileUnsupportedVersion', 'profileReadError', 'profileWriteError', 'profileNameInvalid', 'profileImageInvalid', 'profileEnabledInvalid']);
function codeOf(reason) {
  try { if (ERROR_CODES.has(reason?.code)) return reason.code; } catch { /* Untrusted caller errors are never displayed. */ }
  return 'profileInvalidData';
}

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('profileInvalidData');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('profileInvalidData');
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) fail('profileInvalidData');
  // Do not execute caller getters or accept inherited/prototype fields as saved data.
  for (const key of keys) if (!Object.hasOwn(value, key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail('profileInvalidData');
}
function nameOf(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length > 80) fail('profileNameInvalid');
  return value.trim() || null;
}
function imageOf(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > MAX_IMAGE_LENGTH
    || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) fail('profileImageInvalid');
  let bytes;
  try {
    const encoded = value.slice(22);
    if (encoded.length % 4) fail('profileImageInvalid');
    bytes = atob(encoded);
    if (btoa(bytes) !== encoded) fail('profileImageInvalid');
  } catch { fail('profileImageInvalid'); }
  // New files are normalized by imageData. Also reject disguised SVG/URLs at the storage boundary.
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes.charCodeAt(i) === byte)
    || bytes.slice(12, 16) !== 'IHDR') fail('profileImageInvalid');
  return value;
}
function draftOf(input) {
  record(input, DRAFT_KEYS);
  return { name: nameOf(input.name), image: imageOf(input.image) };
}
function envelopeOf(input) {
  // An unknown version must never be rewritten as v1, including documents with new fields.
  if (input && typeof input === 'object') {
    const version = Object.getOwnPropertyDescriptor(input, 'version');
    if (version && Object.hasOwn(version, 'value') && version.value !== 1) fail('profileUnsupportedVersion');
  }
  record(input, ENVELOPE_KEYS);
  if (input.version !== 1) fail('profileUnsupportedVersion');
  if (typeof input.enabled !== 'boolean') fail('profileEnabledInvalid');
  return { version: 1, enabled: input.enabled, name: nameOf(input.name), image: imageOf(input.image) };
}

export function createProfilePreferences(storage) {
  const listeners = new Set();
  let snapshot = Object.freeze({ ...EMPTY, error: null });
  function publish(next, error = null) {
    const value = { version: next.version, enabled: next.enabled, name: next.name, image: next.image, error };
    if (Object.keys(value).every(key => value[key] === snapshot[key])) return snapshot;
    snapshot = Object.freeze(value);
    for (const listener of [...listeners]) {
      try { listener(); } catch { /* An observer cannot undo a durable write or prevent other observers. */ }
    }
    return snapshot;
  }
  function readLatest() {
    let raw;
    try { raw = storage.getItem(PROFILE_STORAGE_KEY); } catch { fail('profileReadError'); }
    if (raw === null) return EMPTY;
    if (typeof raw !== 'string' || raw.length > MAX_IMAGE_LENGTH + 2048) fail('profileInvalidData');
    let input;
    try { input = JSON.parse(raw); } catch { fail('profileInvalidData'); }
    return envelopeOf(input);
  }
  function refresh() {
    try { return publish(readLatest()); }
    catch (reason) { return publish(snapshot, codeOf(reason)); }
  }
  function mutate(change) {
    let next;
    try {
      // Always merge with the latest valid own key, not a potentially stale window snapshot.
      next = envelopeOf(change(readLatest()));
      try { storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next)); } catch { fail('profileWriteError'); }
    } catch (reason) {
      const code = codeOf(reason);
      publish(snapshot, code);
      fail(code);
    }
    // Never publish a new appearance before setItem succeeds.
    return publish(next);
  }
  refresh();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    save(input) { return mutate(latest => ({ ...latest, ...draftOf(input) })); },
    reset() { return mutate(latest => ({ ...latest, name: null, image: null })); },
    toggle(enabled) {
      return mutate(latest => {
        if (typeof enabled !== 'boolean') fail('profileEnabledInvalid');
        return { ...latest, enabled };
      });
    },
    refresh,
    retry: refresh,
  };
}
