import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfilePreferences, PROFILE_STORAGE_KEY } from '../src/profile-store.js';
import { createPreferences, STORAGE_KEY, LEGACY_BACKUP_KEY, MAX_IMAGE_LENGTH } from '../src/store.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO/8AAAAASUVORK5CYII=';
const empty = { version: 1, enabled: true, name: null, image: null, error: null };
const envelope = (overrides = {}) => JSON.stringify({ version: 1, enabled: true, name: null, image: null, ...overrides });
class FakeStorage {
  data = new Map();
  reads = [];
  writes = [];
  readError = false;
  writeError = false;
  getItem(key) {
    this.reads.push(key);
    if (this.readError) throw new Error('Do not expose storage details');
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.writeError) throw new Error('Do not expose quota details');
    this.writes.push({ key, value });
    this.data.set(key, String(value));
  }
}
function throwsCode(fn, code) {
  assert.throws(fn, error => error.message === code && error.code === code);
}
function assertDurableFields(actual, expected) {
  for (const key of ['version', 'enabled', 'name', 'image']) assert.equal(actual[key], expected[key]);
}

test('profile defaults are immutable, own-key only and do not write on load/refresh/retry', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage), first = prefs.getSnapshot();
  assert.equal(PROFILE_STORAGE_KEY, 'dsh-tinker:profile-appearance:v1');
  assert.deepEqual(first, empty); assert.ok(Object.isFrozen(first));
  assert.throws(() => { first.name = 'changed'; }, TypeError);
  assert.equal(prefs.refresh(), first); assert.equal(prefs.retry(), first);
  assert.deepEqual(storage.reads, [PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY]);
  assert.equal(storage.writes.length, 0);
});

test('trimmed name and independent image/null overrides survive a restart', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  const draft = { name: '  Local name  ', image: null };
  prefs.save(draft); draft.name = 'caller mutation';
  assert.equal(prefs.getSnapshot().name, 'Local name');
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, name: 'Local name' });
  prefs.save({ name: null, image: PNG });
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, image: PNG });
  prefs.save({ name: 'Both', image: PNG });
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, name: 'Both', image: PNG });
  prefs.save({ name: ' \n\t ', image: '' });
  assert.deepEqual(prefs.getSnapshot(), empty);
  assert.deepEqual(Object.keys(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY))), ['version', 'enabled', 'name', 'image']);
});

test('successful writes precede snapshot publication; old snapshots and caller data stay isolated', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage), before = prefs.getSnapshot();
  let notices = 0;
  const unsubscribe = prefs.subscribe(() => {
    notices++;
    assert.deepEqual(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY)), {
      version: 1, enabled: prefs.getSnapshot().enabled, name: prefs.getSnapshot().name, image: prefs.getSnapshot().image,
    });
  });
  prefs.save({ name: 'A', image: PNG });
  assert.deepEqual(before, empty); assert.notEqual(prefs.getSnapshot(), before);
  assert.ok(Object.isFrozen(prefs.getSnapshot()));
  assert.throws(() => { prefs.getSnapshot().image = null; }, TypeError);
  unsubscribe(); prefs.toggle(false); assert.equal(notices, 1);
});

test('throwing subscribers cannot report a durable save as failure or prevent the next subscriber', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage); let notified = 0;
  prefs.subscribe(() => { throw new Error('Observer failed'); });
  prefs.subscribe(() => { notified++; assert.equal(prefs.getSnapshot().error, null); });
  assert.doesNotThrow(() => prefs.save({ name: 'Durable despite observer', image: PNG }));
  assert.equal(notified, 1); assert.equal(prefs.getSnapshot().error, null);
  assert.equal(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY)).name, 'Durable despite observer');
});

test('toggle retains custom values; reset clears only overrides and retains the current enabled value', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  prefs.save({ name: 'Keep', image: PNG }); prefs.toggle(false);
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, enabled: false, name: 'Keep', image: PNG });
  prefs.toggle(true); assert.equal(prefs.getSnapshot().image, PNG);
  prefs.toggle(false); prefs.reset();
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, enabled: false });
});

test('quota failures for every mutation preserve bytes and last durable fields without success publication', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  prefs.save({ name: 'Durable', image: PNG });
  const before = prefs.getSnapshot(), raw = storage.data.get(PROFILE_STORAGE_KEY), writes = storage.writes.length;
  storage.writeError = true;
  const published = []; prefs.subscribe(() => published.push(prefs.getSnapshot()));
  for (const operation of [() => prefs.save({ name: 'Lost', image: null }), () => prefs.reset(), () => prefs.toggle(false)]) {
    throwsCode(operation, 'profileWriteError');
    assertDurableFields(prefs.getSnapshot(), before);
    assert.equal(prefs.getSnapshot().error, 'profileWriteError');
    assert.equal(storage.data.get(PROFILE_STORAGE_KEY), raw);
  }
  assert.equal(storage.writes.length, writes);
  assert.equal(published.length, 1); assert.equal(published[0].error, 'profileWriteError');
  storage.writeError = false; prefs.retry(); assert.deepEqual(prefs.getSnapshot(), before);
  prefs.save({ name: 'Recovered', image: null }); assert.equal(prefs.getSnapshot().name, 'Recovered');
});

test('missing storage methods and read exceptions use stable codes, never write and can retry', () => {
  assert.equal(createProfilePreferences(undefined).getSnapshot().error, 'profileReadError');
  const storage = new FakeStorage(); storage.data.set(PROFILE_STORAGE_KEY, envelope({ name: 'Durable' })); storage.readError = true;
  const prefs = createProfilePreferences(storage);
  assert.equal(prefs.getSnapshot().error, 'profileReadError');
  for (const operation of [() => prefs.save({ name: 'No', image: null }), () => prefs.reset(), () => prefs.toggle(false)]) throwsCode(operation, 'profileReadError');
  assert.equal(storage.writes.length, 0);
  storage.readError = false; prefs.retry();
  assert.deepEqual(prefs.getSnapshot(), { ...empty, name: 'Durable' });
});

const corrupt = [
  ['bad JSON', '{bad', 'profileInvalidData'],
  ['empty bytes', '', 'profileInvalidData'],
  ['null document', 'null', 'profileInvalidData'],
  ['array document', '[]', 'profileInvalidData'],
  ['string document', '"string"', 'profileInvalidData'],
  ['unknown version', envelope({ version: 2, newField: 'keep' }), 'profileUnsupportedVersion'],
  ['missing field', '{"version":1,"enabled":true,"name":null}', 'profileInvalidData'],
  ['unknown field', envelope({ newField: 'keep' }), 'profileInvalidData'],
  ['unsafe proto field', envelope({ ['__proto__']: { enabled: false } }), 'profileInvalidData'],
  ['unsafe constructor field', envelope({ constructor: { prototype: {} } }), 'profileInvalidData'],
  ['bad name', envelope({ name: [] }), 'profileNameInvalid'],
  ['bad image', envelope({ image: 'https://invalid.example/picture.png' }), 'profileImageInvalid'],
  ['bad enabled', envelope({ enabled: 'false' }), 'profileEnabledInvalid'],
  ['too much input', ' '.repeat(MAX_IMAGE_LENGTH + 2049), 'profileInvalidData'],
];
for (const [label, raw, code] of corrupt) test(`corrupt/unsupported ${label} is preserved, including when reset is requested`, () => {
  const storage = new FakeStorage(); storage.data.set(PROFILE_STORAGE_KEY, raw);
  const prefs = createProfilePreferences(storage);
  assert.equal(prefs.getSnapshot().error, code);
  for (const operation of [() => prefs.save({ name: 'No overwrite', image: null }), () => prefs.reset(), () => prefs.toggle(false)]) throwsCode(operation, code);
  assert.equal(prefs.refresh().error, code); assert.equal(prefs.retry().error, code);
  assert.equal(storage.data.get(PROFILE_STORAGE_KEY), raw); assert.equal(storage.writes.length, 0);
});

test('corruption or read failure after a valid snapshot retains last fields and blocks stale overwrites', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  prefs.save({ name: 'Last valid', image: PNG }); const before = prefs.getSnapshot();
  storage.data.set(PROFILE_STORAGE_KEY, '{corrupt');
  throwsCode(() => prefs.toggle(false), 'profileInvalidData');
  assertDurableFields(prefs.getSnapshot(), before);
  assert.equal(storage.data.get(PROFILE_STORAGE_KEY), '{corrupt');
  storage.readError = true; prefs.refresh(); assertDurableFields(prefs.getSnapshot(), before);
  assert.equal(prefs.getSnapshot().error, 'profileReadError');
  storage.readError = false; storage.data.set(PROFILE_STORAGE_KEY, envelope({ enabled: false, name: 'External' }));
  prefs.retry(); assert.deepEqual(prefs.getSnapshot(), { ...empty, enabled: false, name: 'External' });
});

test('every mutation re-reads the latest own key so another window cannot lose overrides or enabled state', () => {
  const storage = new FakeStorage(), a = createProfilePreferences(storage), b = createProfilePreferences(storage);
  a.save({ name: 'Window A', image: PNG }); b.toggle(false);
  assert.deepEqual(b.getSnapshot(), { ...empty, enabled: false, name: 'Window A', image: PNG });
  a.save({ name: 'New A', image: PNG }); assert.equal(a.getSnapshot().enabled, false);
  b.toggle(true); a.reset(); assert.deepEqual(a.getSnapshot(), empty);
  b.save({ name: null, image: PNG }); assert.equal(b.getSnapshot().enabled, true);
});

test('refresh/retry reflects external edits/deletion without writes and keeps snapshot identity on unchanged reads', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage), initial = prefs.getSnapshot();
  storage.data.set(PROFILE_STORAGE_KEY, envelope({ name: 'External', image: PNG }));
  const next = prefs.refresh(); assert.notEqual(next, initial);
  assert.deepEqual(next, { ...empty, name: 'External', image: PNG });
  assert.equal(prefs.refresh(), next); assert.equal(prefs.retry(), next);
  storage.data.delete(PROFILE_STORAGE_KEY); assert.deepEqual(prefs.refresh(), empty);
  assert.equal(storage.writes.length, 0);
});

test('read normalization never rewrites existing valid bytes', () => {
  const storage = new FakeStorage(), raw = '{ "version": 1, "enabled": true, "name": "  Trim me  ", "image": "" }';
  storage.data.set(PROFILE_STORAGE_KEY, raw);
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, name: 'Trim me' });
  assert.equal(storage.data.get(PROFILE_STORAGE_KEY), raw); assert.equal(storage.writes.length, 0);
});

test('name validation accepts 80 trimmed code units and rejects unsafe types or oversized values without writes', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  prefs.save({ name: ' ' + 'a'.repeat(80) + ' ', image: null }); assert.equal(prefs.getSnapshot().name.length, 80);
  const before = storage.data.get(PROFILE_STORAGE_KEY);
  for (const name of ['a'.repeat(81), {}, [], 42, false, undefined, new String('name')]) {
    throwsCode(() => prefs.save({ name, image: null }), 'profileNameInvalid');
    assert.equal(storage.data.get(PROFILE_STORAGE_KEY), before);
  }
  // Names are text, not markup; neither persistence nor the React input interprets them as HTML.
  prefs.save({ name: '<script>text only</script>', image: null });
  assert.equal(prefs.getSnapshot().name, '<script>text only</script>');
});

test('image validation requires self-contained canonical PNG data, bounded by the existing image limit', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage);
  prefs.save({ name: null, image: PNG }); const before = storage.data.get(PROFILE_STORAGE_KEY);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>';
  for (const image of ['file:///desktop/avatar.png', 'https://invalid.example/a.png', 'javascript:bad()',
    'data:image/svg+xml;base64,' + btoa(svg), 'data:image/png;base64,' + btoa(svg), 'data:image/png;base64,AAAA',
    PNG + '\n', PNG.replace('base64,', 'base64, '), PNG.replace('png', 'jpeg'), PNG.slice(0, -1),
    'data:image/png;base64,' + 'A'.repeat(MAX_IMAGE_LENGTH), {}, [], true, undefined]) {
    throwsCode(() => prefs.save({ name: null, image }), 'profileImageInvalid');
    assert.equal(storage.data.get(PROFILE_STORAGE_KEY), before);
  }
  const bytes = atob(PNG.slice(22)), nearLimit = 'data:image/png;base64,' + btoa(bytes.padEnd(Math.floor((MAX_IMAGE_LENGTH - 22) / 4) * 3, '\0'));
  assert.ok(nearLimit.length <= MAX_IMAGE_LENGTH); prefs.save({ name: null, image: nearLimit });
  assert.equal(prefs.getSnapshot().image, nearLimit);
});

test('save rejects inherited values, getters, symbols, extra fields and prototype pollution without invoking getters', () => {
  const storage = new FakeStorage(), prefs = createProfilePreferences(storage); let getterCalled = false;
  const getter = { image: null }; Object.defineProperty(getter, 'name', { enumerable: true, get() { getterCalled = true; return 'No'; } });
  for (const input of [undefined, null, [], { name: null }, { image: null },
    Object.create({ name: 'inherited', image: null }), { name: null, image: null, extra: true },
    { name: null, image: null, [Symbol('extra')]: true }, getter,
    JSON.parse('{"name":null,"image":null,"__proto__":{"polluted":true}}')]) throwsCode(() => prefs.save(input), 'profileInvalidData');
  assert.equal(getterCalled, false); assert.equal({}.polluted, undefined); assert.equal(storage.writes.length, 0);
  const safeNullPrototype = Object.assign(Object.create(null), { name: 'Safe', image: null });
  prefs.save(safeNullPrototype); assert.equal(prefs.getSnapshot().name, 'Safe');
  for (const enabled of ['false', 0, null, undefined, {}]) throwsCode(() => prefs.toggle(enabled), 'profileEnabledInvalid');
});

test('profile operations never read or modify legacy keys; the old writer never touches the profile key', () => {
  const storage = new FakeStorage(), legacy = '{"version":2,"appearances":{},"features":{"branding":false}}';
  storage.data.set(STORAGE_KEY, legacy); storage.data.set(LEGACY_BACKUP_KEY, 'original backup'); storage.data.set('unrelated-key', 'keep');
  const prefs = createProfilePreferences(storage);
  prefs.save({ name: 'Independent', image: PNG }); prefs.toggle(false); prefs.reset(); prefs.refresh(); prefs.retry();
  assert.ok(storage.reads.every(key => key === PROFILE_STORAGE_KEY));
  assert.ok(storage.writes.every(({ key }) => key === PROFILE_STORAGE_KEY));
  assert.equal(storage.data.get(STORAGE_KEY), legacy); assert.equal(storage.data.get(LEGACY_BACKUP_KEY), 'original backup');
  assert.equal(storage.data.get('unrelated-key'), 'keep');
  prefs.save({ name: 'Protected', image: PNG }); const profileRaw = storage.data.get(PROFILE_STORAGE_KEY);
  const old = createPreferences(storage, ['folder']);
  old.save('workspace', { kind: 'icon', icon: 'folder', color: '#123456' }); old.toggle('branding', true); old.resetWorkspace('workspace');
  assert.equal(storage.data.get(PROFILE_STORAGE_KEY), profileRaw);
  assert.deepEqual(createProfilePreferences(storage).getSnapshot(), { ...empty, enabled: false, name: 'Protected', image: PNG });
});
