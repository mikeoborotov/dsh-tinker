import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createPreferences, STORAGE_KEY, LEGACY_BACKUP_KEY } from '../src/store.js';
import { createUnreadStore, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT } from '../src/unread.js';

const file = name => new URL('../' + name, import.meta.url);
const read = name => readFile(file(name), 'utf8');
const json = async name => JSON.parse(await read(name));

test('public package, lock, patch and compiled factory share the Tinker identity and exports', async () => {
  const pkg = await json('package.json'), lock = await json('package-lock.json');
  assert.equal(pkg.name, 'dsh-tinker');
  assert.equal(pkg.version, '0.1.5');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(pkg.repository.url, 'https://github.com/mikeoborotov/dsh-tinker.git');
  const patch = await read(pkg.dsh.bundle.patch);
  assert.match(patch, /^\s+- id: workspace-plus\s*$/m); // Persistent host instance, not the module name.
  assert.match(patch, /^\s+name: dsh-tinker\s*$/m);
  for (const target of Object.values(pkg.exports).filter(target => !target.includes('*'))) await access(file(target));
  for (const language of ['en', 'ru']) {
    assert.equal((await json('locale/' + language + '.json')).meta.title, 'Tinker');
    assert.equal(pkg.exports['./locale/*.json'], './locale/*.json');
  }
  assert.equal(typeof (await import(file(pkg.exports['.']))).apply, 'function');

  let registration;
  const client = await read(pkg.exports['./client']);
  runInNewContext(client, { window: { __ModuleLoader__: { load(value) {
    assert.equal(registration, undefined, 'register exactly one factory');
    registration = value;
  } } } });
  assert.equal(registration.id, pkg.name);
  const require = createRequire(import.meta.url), externals = new Set();
  const exports = registration.factory(name => {
    externals.add(name);
    if (name === 'react') return require(name);
    assert.equal(name, '@deepseek-ai/dsh-client-ui-primitives');
    return {}; // Host UI components are not rendered in this Node identity check.
  });
  assert.deepEqual(Object.keys(exports).sort(), ['apply', 'inject']);
  assert.equal(typeof exports.apply, 'function');
  assert.deepEqual(Array.from(exports.inject), ['slots', 'locale', 'sessions', 'workspaces', 'modelDirectories', 'remote', 'remote.session']);
  assert.deepEqual([...externals].sort(), ['@deepseek-ai/dsh-client-ui-primitives', 'react']);
  for (const value of [STORAGE_KEY, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT]) assert.ok(client.includes(value));
  assert.match(client, /label: "Tinker"/);
  assert.doesNotMatch(client, /Workspace Plus/);
});

test('rebranding preserves literal legacy data keys, workspace/session IDs and the unread lock contract', async () => {
  assert.equal(STORAGE_KEY, 'dsh-workspace-plus:v1');
  assert.equal(LEGACY_BACKUP_KEY, 'dsh-workspace-plus:v1:legacy-backup');
  assert.equal(UNREAD_STORAGE_KEY, 'dsh-workspace-plus:unread:v1');
  assert.equal(UNREAD_CHANGE_EVENT, 'workspace-plus:unread-change');
  const appearance = { kind: 'emoji', emoji: '💻' }, backup = '{"original":"bytes retained"}';
  const raw = JSON.stringify({ version: 2, appearances: { 'native-workspace-123': appearance }, features: { composer: false } });
  const data = new Map([
    [STORAGE_KEY, raw], [LEGACY_BACKUP_KEY, backup],
    [UNREAD_STORAGE_KEY, JSON.stringify({ version: 1, unread: { 'native-session-123': true } })],
  ]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const prefs = createPreferences(storage, ['folder']);
  assert.equal(prefs.getSnapshot().error, null);
  assert.deepEqual(prefs.appearance('native-workspace-123'), appearance);
  assert.equal(prefs.getSnapshot().features.composer, false);
  assert.equal(storage.getItem(STORAGE_KEY), raw, 'reading current settings must not rewrite data');
  const locks = [];
  const reminders = createUnreadStore(storage, { locks: { request(name, fn) { locks.push(name); return fn(); } } });
  assert.equal(reminders.isUnread('native-session-123'), true);
  await reminders.markUnread('native-session-456');
  assert.deepEqual(locks, ['dsh-workspace-plus:unread:v1']);
  assert.deepEqual(Object.keys(reminders.getSnapshot().unread).sort(), ['native-session-123', 'native-session-456']);
  assert.equal(storage.getItem(LEGACY_BACKUP_KEY), backup);
  assert.deepEqual([...data.keys()].sort(), [STORAGE_KEY, LEGACY_BACKUP_KEY, UNREAD_STORAGE_KEY].sort());
});
