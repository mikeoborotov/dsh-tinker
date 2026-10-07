import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreferences, validateSettings, validateAppearance, STORAGE_KEY, LEGACY_BACKUP_KEY, DEFAULT_FEATURES } from '../src/store.js';
const ids = ['folder', 'code'];
const icon = { kind: 'icon', icon: 'code', color: '#4176e6' };
const emoji = { kind: 'emoji', emoji: '👨‍👩‍👧‍👦' };
const image = { kind: 'image', data: 'data:image/png;base64,AAAA' };
function memory() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function legacy(storage, profiles = { shared: icon }, bindings = { one: 'shared', two: 'shared' }, features = { composer: false }) {
  const raw = JSON.stringify({ version: 1, profiles, bindings, features }); storage.setItem(STORAGE_KEY, raw); return raw;
}

test('workspace appearances survive restart without names, profiles, bindings or transfer APIs', () => {
  const storage = memory(), p = createPreferences(storage, ids);
  p.save('one', icon); p.save('two', emoji);
  const next = createPreferences(storage, ids), stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.deepEqual(next.appearance('one'), icon); assert.deepEqual(next.appearance('two'), emoji);
  assert.equal(stored.version, 2); assert.equal(stored.profiles, undefined); assert.equal(stored.bindings, undefined);
  assert.equal(p.import, undefined); assert.equal(p.export, undefined); assert.equal(p.set, undefined);
  assert.throws(() => p.save('one', 'obsolete-name', icon));
});

test('v1 migration durably backs up original bytes and independently clones all bound appearance kinds', () => {
  const storage = memory();
  const raw = legacy(storage, { icon, emoji, image, unused: { kind: 'emoji', emoji: '💻' } },
    { one: 'icon', two: 'icon', three: 'emoji', four: 'emoji', five: 'image', six: 'image' },
    { workspaces: false, composer: false, sessions: false, unread: false, branding: false });
  const p = createPreferences(storage, ids), snapshot = p.getSnapshot();
  assert.equal(snapshot.error, null); assert.equal(snapshot.recoveryAvailable, true);
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), raw); assert.equal(p.backup(), raw);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 2);
  assert.deepEqual(snapshot.features, { workspaces: false, composer: false, sessions: false, unread: false, branding: false });
  for (const [a, b, value] of [['one', 'two', icon], ['three', 'four', emoji], ['five', 'six', image]]) {
    assert.deepEqual(p.appearance(a), value); assert.deepEqual(p.appearance(b), value);
    assert.notEqual(p.appearance(a), p.appearance(b));
  }
  p.save('one', emoji); assert.deepEqual(p.appearance('two'), icon);
  p.resetWorkspace('three'); assert.deepEqual(p.appearance('four'), emoji);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).profiles, undefined);
  assert.equal(JSON.parse(storage.getItem(LEGACY_BACKUP_KEY)).profiles.unused.emoji, '💻');
});

test('v1 migration happens once and v2 restart does not write or recreate a backup', () => {
  const storage = memory(); legacy(storage); createPreferences(storage, ids);
  const before = storage.getItem(STORAGE_KEY), backup = storage.getItem(LEGACY_BACKUP_KEY);
  storage.setItem = () => { throw new Error('Read-only storage'); };
  const next = createPreferences(storage, ids);
  assert.equal(next.getSnapshot().error, null); assert.deepEqual(next.appearance('one'), icon);
  assert.equal(storage.getItem(STORAGE_KEY), before); assert.equal(storage.getItem(LEGACY_BACKUP_KEY), backup);
});

for (const failAt of [LEGACY_BACKUP_KEY, STORAGE_KEY]) test(`migration failure at ${failAt} keeps old bytes and publishes no partial appearances`, () => {
  const storage = memory(), raw = legacy(storage), set = storage.setItem;
  storage.setItem = (key, value) => { if (key === failAt) throw new Error('quota'); set(key, value); };
  const p = createPreferences(storage, ids);
  assert.match(p.getSnapshot().error, /could not be migrated: quota/);
  assert.equal(p.getSnapshot().features.composer, false);
  assert.equal(p.appearance('one'), undefined); assert.equal(storage.getItem(STORAGE_KEY), raw); assert.equal(p.backup(), raw);
  assert.throws(() => p.save('new', emoji)); assert.throws(() => p.toggle('sessions', false));
  storage.setItem = set; p.retry(); assert.equal(p.getSnapshot().error, null); assert.deepEqual(p.appearance('one'), icon);
});

test('migration refuses to overwrite a different original recovery copy', () => {
  const storage = memory(), raw = legacy(storage); storage.setItem(LEGACY_BACKUP_KEY, 'older original');
  const p = createPreferences(storage, ids);
  assert.match(p.getSnapshot().error, /different pre-upgrade recovery copy/);
  assert.equal(storage.getItem(STORAGE_KEY), raw); assert.equal(storage.getItem(LEGACY_BACKUP_KEY), 'older original');
});

test('expanded v1 images above 2 MB fail without modifying original storage or backup', () => {
  const storage = memory(), largeImage = { kind: 'image', data: 'data:image/png;base64,' + 'A'.repeat(100000) };
  const raw = legacy(storage, { shared: largeImage }, Object.fromEntries(Array.from({ length: 24 }, (_, i) => ['workspace' + i, 'shared'])));
  const p = createPreferences(storage, ids);
  assert.match(p.getSnapshot().error, /Settings exceed 2 MB/); assert.equal(p.appearance('workspace0'), undefined);
  assert.equal(storage.getItem(STORAGE_KEY), raw); assert.equal(storage.getItem(LEGACY_BACKUP_KEY), null);
});

test('durable write precedes subscriber publication and mutable caller values cannot change saved state', () => {
  const storage = memory(), p = createPreferences(storage, ids), value = { ...icon };
  p.subscribe(() => assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).appearances.one, p.appearance('one')));
  p.save('one', value); value.color = '#ffffff'; assert.deepEqual(p.appearance('one'), icon);
  assert.throws(() => { p.appearance('one').color = '#ffffff'; });
  assert.throws(() => { p.getSnapshot().appearances.one = emoji; });
});

test('quota failures for save, workspace reset, feature toggle and explicit recovery reset preserve bytes and state', () => {
  const storage = memory(), p = createPreferences(storage, ids); p.save('one', emoji);
  const before = p.getSnapshot(), raw = storage.getItem(STORAGE_KEY); let notifications = 0;
  p.subscribe(() => notifications++); storage.setItem = () => { throw new Error('quota'); };
  for (const operation of [() => p.save('one', icon), () => p.resetWorkspace('one'), () => p.toggle('unread', false), () => p.resetAll()]) {
    assert.throws(operation, /quota/); assert.equal(p.getSnapshot(), before); assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
  assert.equal(notifications, 0);
});

test('settings size limit preserves last durable workspace when the next save exceeds 2 MB', () => {
  const storage = memory(), p = createPreferences(storage, ids), value = { kind: 'image', data: 'data:image/png;base64,' + 'A'.repeat(100000) };
  for (let i = 0; i < 20; i++) p.save('w' + i, value);
  const before = p.getSnapshot(), raw = storage.getItem(STORAGE_KEY);
  assert.throws(() => p.save('overflow', value), /Settings exceed 2 MB/);
  assert.equal(p.getSnapshot(), before); assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('unsafe images, invalid emoji/colors, prototype IDs and unsupported schemas are rejected', () => {
  for (const value of [{ kind: 'image', data: 'https://attacker/image.png' }, { kind: 'image', data: 'data:image/svg+xml;base64,AAAA' }, { kind: 'emoji', emoji: '<script>' }, { kind: 'icon', icon: 'code', color: 'red; background: url(https://bad)' }])
    assert.throws(() => validateSettings({ version: 2, appearances: { bad: value } }, ids));
  assert.deepEqual(validateAppearance(emoji, ids), emoji);
  assert.throws(() => validateSettings(JSON.parse('{"version":2,"appearances":{"__proto__":{"kind":"icon","icon":"code","color":"#4176e6"}}}'), ids));
  for (const value of [{ version: 999, appearances: {} }, { version: 2, appearances: [] }, { version: 2, appearances: {}, profiles: {} }, { version: 2, appearances: {}, bindings: {} }])
    assert.throws(() => validateSettings(value, ids));
});

for (const raw of ['{"version":999}', '{bad JSON', '', JSON.stringify({ version: 1, profiles: { shared: icon }, bindings: { one: 'missing' } }), JSON.stringify({ version: 1, profiles: { shared: icon }, bindings: [] })])
  test(`invalid storage is preserved for recovery: ${raw.slice(0, 35)}`, () => {
    const storage = memory(); storage.setItem(STORAGE_KEY, raw); const p = createPreferences(storage, ids);
    assert.ok(p.getSnapshot().error); assert.equal(p.backup(), raw); assert.throws(() => p.save('one', icon));
    assert.equal(storage.getItem(STORAGE_KEY), raw); p.resetAll(); p.save('one', icon); assert.deepEqual(p.appearance('one'), icon);
  });

test('read errors do not trigger any write, and retry can recover without clearing saved bytes', () => {
  const storage = memory(), raw = legacy(storage), get = storage.getItem, set = storage.setItem; let writes = 0;
  storage.getItem = () => { throw new Error('storage unavailable'); }; storage.setItem = () => { writes++; };
  const p = createPreferences(storage, ids); assert.match(p.getSnapshot().error, /storage unavailable/); assert.equal(writes, 0);
  storage.getItem = get; storage.setItem = set; assert.equal(get(STORAGE_KEY), raw);
  p.retry(); assert.equal(p.getSnapshot().error, null); assert.deepEqual(p.appearance('one'), icon);
});

test('all five feature defaults survive missing legacy values and independent toggles', () => {
  const storage = memory(); legacy(storage); const p = createPreferences(storage, ids);
  assert.deepEqual(p.getSnapshot().features, { ...DEFAULT_FEATURES, composer: false });
  for (const key of Object.keys(DEFAULT_FEATURES)) p.toggle(key, false);
  assert.deepEqual(createPreferences(storage, ids).getSnapshot().features, Object.fromEntries(Object.keys(DEFAULT_FEATURES).map(key => [key, false])));
  assert.throws(() => p.toggle('unread', 'false'), /Invalid feature value/);
});
