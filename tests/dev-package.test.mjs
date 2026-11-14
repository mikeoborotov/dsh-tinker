import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, readdir, realpath, rm, access, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync, gunzipSync } from 'node:zlib';
import { packDev, readPackageTarball, verifyDevPackage, DEV_NAME, DEV_TITLE, PACKAGE_FILES } from '../scripts/pack-dev.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(projectRoot, name));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const require = createRequire(import.meta.url);
const fixtureReadme = Buffer.from([
  '# Tinker',
  '',
  '![Tinker icon](./icon.svg)',
  '',
  'Personal interface features for DeepSeek Harness. Настройки остаются локальными.',
  '',
  '## Installation',
  '',
  '```sh',
  'npm install dsh-tinker',
  '```',
  '',
  'Enable the installed plugin to open its settings and choose the features you need.',
  '',
  '## Features',
  '',
  '- Customize workspace names, colors and icons.',
  '- Track unread sessions and recover local settings when a backup is available.',
  '',
  '## License',
  '',
  'See [LICENSE](./LICENSE) and [third-party notices](./THIRD_PARTY_NOTICES.md).',
  '',
].join('\r\n'));
const source = marker => `import React from 'react';
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import icons from './workspace-icons.json';
const STORAGE_KEY = 'dsh-workspace-plus:v1';
const LEGACY_BACKUP_KEY = STORAGE_KEY + ':legacy-backup';
const UNREAD_STORAGE_KEY = 'dsh-workspace-plus:unread:v1';
const UNREAD_CHANGE_EVENT = 'workspace-plus:unread-change';
export const inject = ['slots'];
export function apply(ctx) {
  ctx.slots.register({ name: 'settings.section', id: 'workspace-plus', label: 'Tinker' }, () => <h2>Tinker</h2>);
  return [Modal, icons.length, ${JSON.stringify(marker)}, STORAGE_KEY, LEGACY_BACKUP_KEY, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT];
}\n`;

async function fixture(run) {
  const parent = await realpath(tmpdir());
  const owner = await mkdtemp(path.join(parent, 'tinker packaging fixture '));
  const root = path.join(owner, 'source');
  const temporaryParent = path.join(owner, 'staging');
  try {
    await mkdir(root);
    await mkdir(temporaryParent);
    await mkdir(path.join(root, 'src'));
    await mkdir(path.join(root, 'locale'));
    for (const name of ['package-lock.json', 'cordis.patch.yml', 'index.js', 'icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'locale/en.json', 'locale/ru.json']) await writeFile(path.join(root, name), await read(name));
    const manifest = JSON.parse(await read('package.json'));
    manifest.scripts = { prepack: 'node -e "require(\'fs\').writeFileSync(\'LIFECYCLE_RAN\',\'bad\');process.exit(73)"' };
    await writeFile(path.join(root, 'package.json'), JSON.stringify(manifest));
    await writeFile(path.join(root, 'src/client.jsx'), source('fresh-source-A'));
    await writeFile(path.join(root, 'src/workspace-icons.json'), 'STALE_GENERATED_ICONS');
    await writeFile(path.join(root, 'client.js'), 'STALE_CLIENT_MUST_NEVER_BE_PACKED');
    await writeFile(path.join(root, '.env'), 'DO_NOT_COPY_OR_READ=fixture-only\n');
    await writeFile(path.join(root, 'README.md'), fixtureReadme);
    await run(root, temporaryParent);
  } finally {
    assert.ok(path.isAbsolute(owner) && path.dirname(owner) === parent && path.basename(owner).startsWith('tinker packaging fixture '));
    assert.equal(await realpath(owner), owner);
    await rm(owner, { recursive: true, force: true });
  }
}

async function tree(root, relative = '') {
  const files = new Map();
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (relative === '' && entry.name === 'dist') continue;
    const name = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) for (const row of await tree(root, name)) files.set(...row);
    else files.set(name, sha256(await readFile(path.join(root, name))));
  }
  return files;
}

// This is the actual staging parent for this fixture, never the shared OS temp inventory.
const ownedTemps = async temporaryParent => (await readdir(temporaryParent)).sort();

function withRegistration(client) {
  let registration;
  runInNewContext(client, { window: { __ModuleLoader__: { load(value) {
    assert.equal(registration, undefined);
    registration = value;
  } } } });
  const requests = [];
  const exports = registration.factory(name => {
    requests.push(name);
    if (name === 'react') return require('react');
    assert.equal(name, '@deepseek-ai/dsh-client-ui-primitives');
    return {};
  });
  return { registration, exports, requests };
}

test('dev tgz is a fresh real npm package with matching metadata, factory, locale, hashes and no source writes', { timeout: 120_000 }, async () => fixture(async (root, temporaryParent) => {
  const before = await tree(root), temporaryBefore = await ownedTemps(temporaryParent);
  const readme = await readFile(path.join(root, 'README.md'));
  const result = await packDev({ sourceRoot: root, temporaryParent });
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
  await assert.rejects(access(path.join(root, 'LIFECYCLE_RAN')));
  const bytes = await readFile(result.tarball);
  assert.equal(sha256(bytes), result.sha256);
  const files = readPackageTarball(bytes);
  const manifest = verifyDevPackage(files, result.version);
  assert.equal(manifest.name, DEV_NAME);
  assert.match(result.version, /^0\.1\.5-develop\.s[a-f0-9]{12}$/);
  const stable = JSON.parse(await read('package.json'));
  for (const key of ['engines', 'exports', 'files', 'dsh', 'repository', 'icon', 'license']) assert.deepEqual(manifest[key], stable[key]);
  assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'))).name, 'dsh-tinker');
  assert.equal(JSON.parse(await readFile(path.join(root, 'package-lock.json'))).name, 'dsh-tinker');
  const client = files.get('client.js').toString();
  assert.doesNotMatch(client, /STALE_CLIENT|STALE_GENERATED_ICONS|DO_NOT_COPY_OR_READ/);
  assert.match(client, /fresh-source-A/);
  assert.deepEqual(files.get('README.md'), readme, 'Pack the full source README without a prologue or transformations');
  assert.equal(sha256(files.get('README.md')), sha256(readme));
  const { registration, exports, requests } = withRegistration(client);
  assert.equal(registration.id, DEV_NAME);
  assert.deepEqual(Object.keys(exports).sort(), ['apply', 'inject']);
  assert.deepEqual(Array.from(exports.inject), ['slots']);
  assert.deepEqual(requests.sort(), ['@deepseek-ai/dsh-client-ui-primitives', 'react']);
  let slot, Heading;
  const data = exports.apply({ slots: { register(options, component) { slot = options; Heading = component; } } });
  assert.equal(slot.id, 'workspace-plus');
  assert.equal(slot.label, DEV_TITLE);
  assert.equal(Heading().type, 'h2');
  assert.equal(Heading().props.children, DEV_TITLE);
  assert.equal(data[1], 36);
  const provenance = JSON.parse(await readFile(result.provenance));
  assert.equal(provenance.source.commit, null);
  assert.equal(provenance.source.snapshotSha256.slice(0, 12), result.version.split('.s')[1]);
  assert.equal(provenance.tools.node, process.versions.node);
  assert.equal(provenance.tools.esbuild, '0.28.2');
  assert.match(provenance.tools.npm, /^\d+\.\d+\.\d+$/);
  assert.equal(provenance.archive.sha256, sha256(bytes));
  assert.equal(provenance.archive.integrity, 'sha512-' + createHash('sha512').update(bytes).digest('base64'));
  assert.deepEqual(provenance.files['README.md'], { bytes: readme.length, sha256: sha256(readme) });
  for (const [name, content] of files) assert.deepEqual(provenance.files[name], { bytes: content.length, sha256: sha256(content) });
  assert.deepEqual(Object.keys(provenance.files).sort(), PACKAGE_FILES);
  assert.ok(!JSON.stringify(provenance).includes(root));
  assert.ok(!JSON.stringify(provenance).includes(projectRoot));

  // Tampered archives and payloads fail independently of npm's own report.
  const changed = new Map(files);
  changed.set('locale/ru.json', Buffer.from('{"meta":{"title":"Tinker"}}'));
  assert.throws(() => verifyDevPackage(changed, result.version));
  const tar = gunzipSync(bytes);
  const badChecksum = Buffer.from(tar); badChecksum[0] ^= 1;
  assert.throws(() => readPackageTarball(gzipSync(badChecksum)), /checksum/);
  const link = Buffer.from(tar); link[156] = 50;
  link.fill(32, 148, 156);
  const sum = link.subarray(0, 512).reduce((total, byte) => total + byte, 0);
  link.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  assert.throws(() => readPackageTarball(gzipSync(link)), /regular tar/);

  // A second pack must compile the new source, not reuse the previous output.
  await writeFile(path.join(root, 'src/client.jsx'), source('fresh-source-B'));
  const beforeSecond = await tree(root);
  const second = await packDev({ sourceRoot: root, temporaryParent });
  assert.deepEqual(await tree(root), beforeSecond);
  assert.notEqual(second.version, result.version);
  assert.notEqual(second.sha256, result.sha256);
  const secondClient = readPackageTarball(await readFile(second.tarball)).get('client.js').toString();
  assert.match(secondClient, /fresh-source-B/);
  assert.doesNotMatch(secondClient, /fresh-source-A|STALE_CLIENT/);
  assert.equal(sha256(await readFile(result.tarball)), result.sha256, 'The previous archive must remain untouched');
}));

test('README-only edits get a new immutable archive and provenance while unchanged README reuses the same artifacts', { timeout: 180_000 }, async () => fixture(async (root, temporaryParent) => {
  const before = await tree(root), temporaryBefore = await ownedTemps(temporaryParent);
  const first = await packDev({ sourceRoot: root, temporaryParent });
  const firstArchive = await readFile(first.tarball), firstSidecar = await readFile(first.provenance);
  const firstFiles = readPackageTarball(firstArchive), firstProvenance = JSON.parse(firstSidecar);
  assert.deepEqual(firstFiles.get('README.md'), fixtureReadme);
  assert.deepEqual(await tree(root), before);

  const updatedReadme = Buffer.concat([fixtureReadme, Buffer.from('\r\n## Preview update\r\n\r\nOnly the README changed. Полный текст сохранён.\r\n')]);
  await writeFile(path.join(root, 'README.md'), updatedReadme);
  const beforeSecond = await tree(root);
  assert.deepEqual([...beforeSecond].filter(([name, hash]) => hash !== before.get(name)).map(([name]) => name), ['README.md']);
  const second = await packDev({ sourceRoot: root, temporaryParent });
  const secondArchive = await readFile(second.tarball), secondSidecar = await readFile(second.provenance);
  const secondFiles = readPackageTarball(secondArchive), secondProvenance = JSON.parse(secondSidecar);
  assert.notEqual(second.version, first.version);
  assert.notEqual(second.tarball, first.tarball);
  assert.notEqual(second.provenance, first.provenance);
  assert.notEqual(second.sha256, first.sha256);
  assert.notEqual(secondProvenance.source.snapshotSha256, firstProvenance.source.snapshotSha256);
  assert.notEqual(secondProvenance.files['README.md'].sha256, firstProvenance.files['README.md'].sha256);
  assert.equal(firstProvenance.source.snapshotSha256.slice(0, 12), first.version.split('.s')[1]);
  assert.equal(secondProvenance.source.snapshotSha256.slice(0, 12), second.version.split('.s')[1]);
  assert.deepEqual(secondFiles.get('README.md'), updatedReadme);
  assert.deepEqual(firstProvenance.files['README.md'], { bytes: fixtureReadme.length, sha256: sha256(fixtureReadme) });
  assert.deepEqual(secondProvenance.files['README.md'], { bytes: updatedReadme.length, sha256: sha256(updatedReadme) });
  assert.equal(firstProvenance.archive.sha256, sha256(firstArchive));
  assert.equal(secondProvenance.archive.sha256, sha256(secondArchive));
  for (const name of PACKAGE_FILES.filter(name => name !== 'README.md' && name !== 'package.json')) assert.deepEqual(secondFiles.get(name), firstFiles.get(name), 'README-only edit must not change ' + name);
  assert.deepEqual(await tree(root), beforeSecond);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);

  const repeated = await packDev({ sourceRoot: root, temporaryParent });
  assert.deepEqual(repeated, second);
  assert.deepEqual(await readFile(first.tarball), firstArchive, 'The previous archive must remain byte-identical');
  assert.deepEqual(await readFile(first.provenance), firstSidecar, 'The previous sidecar must remain byte-identical');
  assert.deepEqual(await readFile(second.tarball), secondArchive, 'Unchanged input must not replace the archive');
  assert.deepEqual(await readFile(second.provenance), secondSidecar, 'Unchanged input must not replace the sidecar');
  assert.deepEqual((await readdir(path.join(root, 'dist/develop'))).sort(), [first.version, second.version].sort());
  assert.deepEqual(await tree(root), beforeSecond);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
}));

test('a missing README fails before output without a substitute or leftover staging', { timeout: 60_000 }, async () => fixture(async (root, temporaryParent) => {
  const parent = await realpath(tmpdir()), owner = path.dirname(root), readme = path.join(root, 'README.md');
  assert.ok(path.isAbsolute(owner) && path.dirname(owner) === parent && path.basename(owner).startsWith('tinker packaging fixture '), 'Delete only inside an owned temporary fixture');
  assert.equal(await realpath(owner), owner);
  assert.equal(root, path.join(owner, 'source'));
  assert.equal(await realpath(root), root);
  assert.ok(path.isAbsolute(readme) && path.dirname(readme) === root && path.basename(readme) === 'README.md');
  assert.equal(await realpath(readme), readme, 'Refuse redirected README deletion');
  await rm(readme);
  const before = await tree(root), temporaryBefore = await ownedTemps(temporaryParent);
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent }), { code: 'ENOENT', path: readme });
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
  await assert.rejects(access(readme), { code: 'ENOENT' });
  await assert.rejects(access(path.join(root, 'dist')), { code: 'ENOENT' });
}));

test('derived historical backup key is accepted but an altered suffix is rejected', { timeout: 60_000 }, async () => fixture(async (root, temporaryParent) => {
  const result = await packDev({ sourceRoot: root, temporaryParent });
  const files = readPackageTarball(await readFile(result.tarball));
  const client = files.get('client.js').toString();
  const declaration = 'var LEGACY_BACKUP_KEY = STORAGE_KEY + ":legacy-backup";';
  assert.ok(client.includes(declaration), 'Exercise the actual non-minified esbuild representation');
  assert.ok(!client.includes('dsh-workspace-plus:v1:legacy-backup'), 'The complete key is not a compiled literal');
  assert.equal(verifyDevPackage(files, result.version).name, DEV_NAME);
  const changed = new Map(files);
  changed.set('client.js', Buffer.from(client.replace(declaration, 'var LEGACY_BACKUP_KEY = STORAGE_KEY + ":changed-backup";') + '\n// dsh-workspace-plus:v1:legacy-backup\n'));
  assert.throws(() => verifyDevPackage(changed, result.version), /historical data contract/);
}));

test('title drift and broken source fail without output or leftover staging', { timeout: 60_000 }, async () => fixture(async (root, temporaryParent) => {
  const temporaryBefore = await ownedTemps(temporaryParent);
  await writeFile(path.join(root, 'src/client.jsx'), source('bad').replace('<h2>Tinker</h2>', '<h2>Unexpected</h2>'));
  const before = await tree(root);
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent }), /exactly one staged title/);
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
  await assert.rejects(access(path.join(root, 'dist')));
  await writeFile(path.join(root, 'src/client.jsx'), source('bad') + '\ninvalid syntax !!!');
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent }), /Build failed/);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
  await assert.rejects(access(path.join(root, 'dist')));
}));

test('output failures never replace an existing archive or leave success artifacts', { timeout: 120_000 }, async () => fixture(async (root, temporaryParent) => {
  const before = await tree(root), temporaryBefore = await ownedTemps(temporaryParent);
  const result = await packDev({ sourceRoot: root, temporaryParent });
  await writeFile(result.tarball, 'existing archive must not be overwritten');
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent }), /overwrite an existing artifact/);
  assert.equal(await readFile(result.tarball, 'utf8'), 'existing archive must not be overwritten');
  assert.deepEqual(await tree(root), before);
  assert.deepEqual(await ownedTemps(temporaryParent), temporaryBefore);
}));

test('redirected dist is rejected before creating any directory outside the source root', { timeout: 60_000 }, async () => fixture(async (root, temporaryParent) => {
  const outside = path.join(path.dirname(root), path.basename(root) + '-outside-output');
  await mkdir(outside);
  try {
    await symlink(outside, path.join(root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(packDev({ sourceRoot: root, temporaryParent }), /Refuse redirected output directory/);
    assert.deepEqual(await readdir(outside), [], 'Must not create outside-output/develop through dist');
  } finally {
    assert.ok(path.isAbsolute(outside) && path.dirname(outside) === path.dirname(root) && path.basename(outside) === path.basename(root) + '-outside-output');
    assert.equal(await realpath(outside), outside);
    await rm(outside, { recursive: true, force: true });
  }
}));

test('staging uses a private parent outside the source root and leaves unrelated directories alone', { timeout: 60_000 }, async () => fixture(async (root, temporaryParent) => {
  const unrelated = path.join(temporaryParent, DEV_NAME + '-unrelated');
  await mkdir(unrelated);
  const before = await ownedTemps(temporaryParent);
  await packDev({ sourceRoot: root, temporaryParent });
  assert.deepEqual(await ownedTemps(temporaryParent), before);
  const sourceBefore = await tree(root);
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent: path.join(root, 'src') }), /outside the source root/);
  assert.deepEqual(await tree(root), sourceBefore);
  assert.deepEqual(await ownedTemps(temporaryParent), before);
}));

test('pnpm shims are not accepted as an npm CLI and never trigger installation', { timeout: 30_000 }, async () => fixture(async (root, temporaryParent) => {
  const shim = path.join(root, 'pnpm.cjs');
  await writeFile(shim, "throw new Error('must never execute pnpm');\n");
  const before = await tree(root);
  await assert.rejects(packDev({ sourceRoot: root, temporaryParent, npmCli: shim }), /real npm CLI/);
  assert.deepEqual(await tree(root), before);
  await assert.rejects(access(path.join(root, 'dist')));
}));
