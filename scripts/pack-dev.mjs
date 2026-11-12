import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, mkdtemp, readdir, lstat, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { buildClient } from './build.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);
export const DEV_NAME = 'dsh-tinker-develop';
export const DEV_TITLE = 'Tinker (develop)';
export const PACKAGE_FILES = ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'client.js', 'cordis.patch.yml', 'icon.svg', 'index.js', 'locale/en.json', 'locale/ru.json', 'package.json'];
const inputFiles = ['package.json', 'package-lock.json', 'cordis.patch.yml', 'index.js', 'icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'locale/en.json', 'locale/ru.json'];
const preservedKeys = ['dsh-workspace-plus:v1', 'dsh-workspace-plus:v1:legacy-backup', 'dsh-workspace-plus:unread:v1', 'workspace-plus:unread-change'];
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const json = bytes => JSON.parse(bytes.toString('utf8'));
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');

async function regularFile(filename) {
  assert.ok((await lstat(filename)).isFile(), 'Only regular source files are accepted');
  return readFile(filename);
}

async function sourceSnapshot(root) {
  const names = [...inputFiles];
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative + '/' + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Source links are not accepted');
      if (entry.isDirectory()) await visit(name);
      else {
        assert.ok(/\.(?:js|jsx|json|css)$/.test(entry.name), 'Unexpected source file extension');
        names.push(name);
      }
    }
  }
  await visit('src');
  const files = new Map();
  for (const name of names.sort()) files.set(name, await regularFile(path.join(root, name)));
  // These are the tools actually executing, not an unrelated fixture's build scripts.
  for (const name of ['scripts/build.mjs', 'scripts/pack-dev.mjs']) files.set(name, await regularFile(path.join(projectRoot, name)));
  return files;
}

function snapshotHash(files) {
  const hash = createHash('sha256');
  for (const [name, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b, 'en'))) hash.update(name + '\0' + bytes.length + '\0').update(bytes);
  return hash.digest('hex');
}

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Expected exactly one staged title: ' + before);
  return source.replace(before, after);
}

// No shell, package-manager shim, dependency install, lifecycle script or registry lookup.
async function npmCommand(cli, args, cwd) {
  return execute(process.execPath, [cli, ...args], { cwd, windowsHide: true, timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
}

async function findNpmCli(explicit) {
  const candidates = explicit ? [explicit] : [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.join(path.dirname(process.execPath), '../node_modules/npm/bin/npm-cli.js'),
    ...(process.env.PATH ?? '').split(path.delimiter).flatMap(dir => [path.join(dir, 'node_modules/npm/bin/npm-cli.js'), path.join(dir, 'npm')]),
  ];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      const resolved = await realpath(candidate);
      if (path.basename(resolved) !== 'npm-cli.js') continue;
      const manifest = json(await regularFile(path.resolve(resolved, '../../package.json')));
      if (manifest.name === 'npm' && typeof manifest.version === 'string') return resolved;
    } catch { /* An unavailable candidate is not an instruction to install npm. */ }
  }
  throw new Error('A real npm CLI is required; pass --npm-cli <absolute path to npm/bin/npm-cli.js>.');
}

// Our allowlisted short paths require only regular ustar entries, never PAX or links.
export function readPackageTarball(bytes) {
  const tar = gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
  const files = new Map();
  let offset = 0;
  const text = bytes => bytes.toString('utf8').replace(/\0.*$/s, '');
  const octal = bytes => {
    const value = text(bytes).trim();
    assert.match(value, /^[0-7]+$/, 'Invalid tar numeric field');
    return Number.parseInt(value, 8);
  };
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      assert.ok(tar.length - offset >= 1024 && tar.subarray(offset).every(byte => byte === 0), 'Invalid tar end');
      assert.deepEqual([...files.keys()].sort(), PACKAGE_FILES, 'Unexpected npm payload');
      return files;
    }
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    assert.equal(octal(header.subarray(148, 156)), checksum, 'Invalid tar checksum');
    assert.ok(header[156] === 0 || header[156] === 48, 'Only regular tar entries are accepted');
    const prefix = text(header.subarray(345, 500));
    const name = (prefix ? prefix + '/' : '') + text(header.subarray(0, 100));
    assert.ok(name.startsWith('package/') && PACKAGE_FILES.includes(name.slice(8)), 'Unexpected tar path');
    assert.ok(!files.has(name.slice(8)), 'Duplicate tar entry');
    const size = octal(header.subarray(124, 136));
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length, 'Truncated tar entry');
    files.set(name.slice(8), Buffer.from(tar.subarray(offset + 512, offset + 512 + size)));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('Missing tar terminator');
}

export function verifyDevPackage(files, version) {
  assert.deepEqual([...files.keys()].sort(), PACKAGE_FILES);
  const manifest = json(files.get('package.json'));
  assert.equal(manifest.name, DEV_NAME);
  assert.equal(manifest.version, version);
  assert.equal(manifest.private, true);
  for (const field of ['scripts', 'devDependencies', 'dependencies', 'optionalDependencies', 'bundledDependencies']) assert.equal(manifest[field], undefined, 'Dev artifact must not carry ' + field);
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.deepEqual(manifest.exports, { '.': './index.js', './client': './client.js', './package.json': './package.json', './locale/*.json': './locale/*.json' });
  assert.equal(files.get('cordis.patch.yml').toString(), '- insert:\n    - id: workspace-plus\n      name: ' + DEV_NAME + '\n      config: {}\n');
  for (const language of ['en', 'ru']) assert.equal(json(files.get('locale/' + language + '.json')).meta.title, DEV_TITLE);
  const client = files.get('client.js').toString();
  let registration;
  runInNewContext(client, { window: { __ModuleLoader__: { load(value) {
    assert.equal(registration, undefined, 'Register exactly one factory');
    registration = value;
  } } } }, { timeout: 1000 });
  assert.equal(registration?.id, manifest.name);
  assert.equal(typeof registration.factory, 'function');
  assert.match(client, /label: "Tinker \(develop\)"/);
  assert.ok(client.split(DEV_TITLE).length >= 3, 'Both staged Settings titles must be compiled');
  // esbuild preserves the backup key as STORAGE_KEY + ":legacy-backup", not one literal.
  // Accept only known string declarations/concatenation, without executing the factory or apply.
  const factorySource = Function.prototype.toString.call(registration.factory);
  const names = ['STORAGE_KEY', 'LEGACY_BACKUP_KEY', 'UNREAD_STORAGE_KEY', 'UNREAD_CHANGE_EVENT'];
  const values = new Map();
  for (const [i, name] of names.entries()) {
    const declarations = [...factorySource.matchAll(new RegExp('^\\s*var ' + name + ' = ([^\\r\\n]+);$', 'gm'))];
    assert.equal(declarations.length, 1, 'Missing or ambiguous historical data contract: ' + name);
    const expression = declarations[0][1].match(/^(?:(STORAGE_KEY) \+ )?("(?:[^"\\\r\n]|\\.)*")$/);
    assert.ok(expression && (!expression[1] || name === 'LEGACY_BACKUP_KEY'), 'Unsupported historical data contract expression: ' + name);
    const value = (expression[1] ? values.get(expression[1]) : '') + JSON.parse(expression[2]);
    assert.equal(value, preservedKeys[i], 'Changed historical data contract: ' + name);
    values.set(name, value);
  }
  return manifest;
}

async function gitSource(root) {
  try {
    const options = { windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 };
    const commit = (await execute('git', ['-C', root, 'rev-parse', 'HEAD'], options)).stdout.trim();
    assert.match(commit, /^[a-f0-9]{40}$/);
    const dirty = (await execute('git', ['-C', root, 'status', '--porcelain'], options)).stdout.length > 0;
    return { commit, dirty };
  } catch { return { commit: null, dirty: null }; }
}

async function removeOwnedDirectory(directory, expectedParent, prefix) {
  assert.ok(path.isAbsolute(directory) && path.dirname(directory) === expectedParent && path.basename(directory).startsWith(prefix), 'Refuse cleanup outside owned directory');
  assert.equal(await realpath(directory), directory, 'Refuse redirected cleanup');
  await rm(directory, { recursive: true, force: true });
}

async function safeOutputParent(root, create = false) {
  const directories = [root, path.join(root, 'dist'), path.join(root, 'dist/develop')];
  async function check(directory) {
    const entry = await lstat(directory);
    assert.ok(entry.isDirectory() && !entry.isSymbolicLink(), 'Refuse redirected output directory');
    assert.equal(await realpath(directory), directory, 'Refuse redirected output directory');
  }
  // Validate the entire existing chain before creating even the first missing component.
  let missing = directories.length;
  for (let i = 0; i < directories.length; i++) {
    try { await check(directories[i]); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing = i;
      break;
    }
  }
  if (create) for (let i = missing; i < directories.length; i++) {
    assert.ok(i > 0, 'Source root must already exist');
    await check(directories[i - 1]);
    try { await mkdir(directories[i]); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await check(directories[i]);
  }
  return directories.at(-1);
}

export async function packDev({ sourceRoot = projectRoot, npmCli, temporaryParent = tmpdir() } = {}) {
  sourceRoot = await realpath(sourceRoot);
  await safeOutputParent(sourceRoot);
  const snapshot = await sourceSnapshot(sourceRoot);
  assert.equal(snapshotHash(await sourceSnapshot(sourceRoot)), snapshotHash(snapshot), 'Source changed while taking the snapshot; retry once editing is finished');
  const sourceHash = snapshotHash(snapshot);
  const sourceManifest = json(snapshot.get('package.json'));
  assert.equal(sourceManifest.name, 'dsh-tinker');
  assert.match(sourceManifest.version, /^\d+\.\d+\.\d+$/);
  const version = sourceManifest.version + '-develop.s' + sourceHash.slice(0, 12);
  const manifest = { ...sourceManifest, name: DEV_NAME, version, private: true };
  for (const field of ['scripts', 'devDependencies']) delete manifest[field];
  // New runtime dependencies require an explicit packaging/compatibility review.
  for (const field of ['dependencies', 'optionalDependencies', 'bundledDependencies']) assert.equal(manifest[field], undefined);
  assert.match(snapshot.get('cordis.patch.yml').toString(), /^- insert:\r?\n    - id: workspace-plus\r?\n      name: dsh-tinker\r?\n      config: \{\}\r?\n?$/);
  const cli = await findNpmCli(npmCli);
  const npmVersion = (await npmCommand(cli, ['--version'], sourceRoot)).stdout.trim();
  assert.match(npmVersion, /^\d+\.\d+\.\d+$/);
  assert.ok(path.isAbsolute(temporaryParent), 'Staging parent must be an absolute existing directory');
  temporaryParent = await realpath(temporaryParent);
  const relativeParent = path.relative(sourceRoot, temporaryParent);
  assert.ok(relativeParent === '..' || relativeParent.startsWith('..' + path.sep) || path.isAbsolute(relativeParent), 'Staging parent must be outside the source root');
  const temporary = await mkdtemp(path.join(temporaryParent, DEV_NAME + '-'));
  try {
    const stage = path.join(temporary, 'package');
    await mkdir(stage);
    for (const [name, bytes] of snapshot) {
      if (name.startsWith('scripts/') || name === 'package-lock.json' || name === 'src/workspace-icons.json') continue;
      const target = path.join(stage, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    await writeFile(path.join(stage, 'package.json'), jsonBytes(manifest));
    await writeFile(path.join(stage, 'cordis.patch.yml'), '- insert:\n    - id: workspace-plus\n      name: ' + DEV_NAME + '\n      config: {}\n');
    for (const language of ['en', 'ru']) {
      const locale = json(snapshot.get('locale/' + language + '.json'));
      locale.meta.title = DEV_TITLE;
      await writeFile(path.join(stage, 'locale', language + '.json'), jsonBytes(locale));
    }
    let entry = snapshot.get('src/client.jsx').toString();
    entry = replaceOnce(entry, '<h2>Tinker</h2>', '<h2>' + DEV_TITLE + '</h2>');
    entry = replaceOnce(entry, "label: 'Tinker'", "label: '" + DEV_TITLE + "'");
    await writeFile(path.join(stage, 'src/client.jsx'), entry);
    await writeFile(path.join(stage, 'README.md'), '# ' + DEV_TITLE + '\n\nLocal development artifact of dsh-tinker. Not published to npm.\n\nInstall only on explicit request, with the bundle disabled. Disable the stable Tinker bundle before enabling this one; never enable both. Historical settings are shared.\n\nVersion: ' + version + '\n');
    const build = await buildClient({ root: stage, moduleId: DEV_NAME });
    const expected = new Map(await Promise.all(PACKAGE_FILES.map(async name => [name, await regularFile(path.join(stage, name))])));
    verifyDevPackage(expected, version);
    const packed = path.join(temporary, 'packed');
    await mkdir(packed);
    const result = JSON.parse((await npmCommand(cli, ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', packed], stage)).stdout);
    assert.equal(result.length, 1, 'Expected one npm tarball');
    const report = result[0];
    const filename = DEV_NAME + '-' + version + '.tgz';
    assert.equal(report.filename, filename);
    assert.equal(report.name, DEV_NAME);
    assert.equal(report.version, version);
    const bytes = await regularFile(path.join(packed, filename));
    const files = readPackageTarball(bytes);
    verifyDevPackage(files, version);
    for (const [name, content] of files) assert.deepEqual(content, expected.get(name), 'Packed bytes differ from the verified build: ' + name);
    const integrity = 'sha512-' + digest(bytes, 'sha512', 'base64');
    assert.equal(report.integrity, integrity);
    assert.equal(report.shasum, digest(bytes, 'sha1'));
    assert.equal(report.size, bytes.length);
    assert.deepEqual(report.files.map(file => file.path).sort(), PACKAGE_FILES);
    const provenance = {
      format: 1, name: DEV_NAME, version,
      source: { ...await gitSource(sourceRoot), snapshotSha256: sourceHash },
      tools: { node: process.versions.node, npm: npmVersion, esbuild: build.esbuild },
      files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, content]) => [name, { bytes: content.length, sha256: digest(content) }])),
      archive: { filename, bytes: bytes.length, sha256: digest(bytes), integrity },
    };
    const outputParent = await safeOutputParent(sourceRoot, true);
    const output = path.join(outputParent, version);
    const outputs = new Map([[filename, bytes], [filename + '.provenance.json', jsonBytes(provenance)]]);
    let created = false;
    try {
      await mkdir(output);
      created = true;
      for (const [name, content] of outputs) await writeFile(path.join(output, name), content, { flag: 'wx' });
    } catch (error) {
      if (created) {
        await removeOwnedDirectory(output, outputParent, version);
        throw error;
      }
      if (error.code !== 'EEXIST') throw error;
      assert.equal(await realpath(output), output, 'Refuse redirected artifact directory');
      assert.deepEqual((await readdir(output)).sort(), [...outputs.keys()].sort(), 'Refuse stale output directory');
      for (const [name, content] of outputs) assert.deepEqual(await regularFile(path.join(output, name)), content, 'Refuse to overwrite an existing artifact');
    }
    return { name: DEV_NAME, version, tarball: path.join(output, filename), provenance: path.join(output, filename + '.provenance.json'), sha256: provenance.archive.sha256 };
  } finally {
    await removeOwnedDirectory(temporary, temporaryParent, DEV_NAME + '-');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 2 && args[0] === '--npm-cli' && path.isAbsolute(args[1]), 'Usage: node scripts/pack-dev.mjs [--npm-cli <absolute npm-cli.js>]');
  const result = await packDev({ npmCli: args[1] });
  console.log(JSON.stringify({ ...result, tarball: path.relative(process.cwd(), result.tarball), provenance: path.relative(process.cwd(), result.provenance) }, null, 2));
}
