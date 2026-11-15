#!/usr/bin/env node
/**
 * Real installed-Host capture, not a fixture. Review this source before preparation.
 * Windows only. All executable arguments are absolute paths; nothing is installed
 * except the pinned local dev tarball. No bootstrap, I/O or dependency import at import.
 * --prepare-only creates owned roots/config and runs only a builtin Node preflight.
 * --check reads only. --run requires the prepared fingerprint and existing tools.
 * Windows ACLs on the private root must be independently reviewed before --run.
 */
import * as fs from 'node:fs/promises';
import { constants as FC } from 'node:fs';
import { win32 as path } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export const EXPECTED = Object.freeze({
  tool: 'dsh-tinker-workspace-icon', schema: 1, hostVersion: '0.2.2-rc.1',
  name: 'dsh-tinker-develop', version: '0.1.5-develop.sab5eaee9fe44',
  archiveSha256: '1ef988ace37b01e2cccd37c1f61a8c790c3018335e3f696495bf348f782eff1f',
  archiveBytes: 200495,
  clientSha256: 'd7d42eba666563cdc02cd1b0b8027338a7f5d1ed423d662f72cd733900a4cc97',
  binSha256: 'b6640801a5a65aae9f53ca21bcce3b2ea28bd9e9554c939c1ff7c4448d91fa18',
  manifestSha256: '3e14837ceb3bbc0ba419ed08e9b5ba164338369b1268b93c3c25d89f7b1c9953',
  browserExecutable: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
const OWNER = '.workspace-icon-owner.json';
const PAYLOAD = Object.freeze(['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'client.js',
  'cordis.patch.yml', 'icon.svg', 'index.js', 'locale/en.json', 'locale/ru.json', 'package.json'].sort());
const BUILTIN_PRESETS = Object.freeze(['preset-standard', 'preset-ptc', 'preset-cordis', 'preset-minimal']);
const HASH = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export class DemoError extends Error {
  constructor(code) { super(code); this.name = 'DemoError'; this.code = code; }
}
function requireThat(condition, code) { if (!condition) throw new DemoError(code); }

// Fail before URL/path-bearing strings can become public exception messages.
export function redactDiagnostic(value) {
  return { code: value instanceof DemoError && /^[a-z][a-z0-9-]{0,63}$/.test(value.code)
    ? value.code : 'unexpected-error' };
}
export function absoluteWindowsPath(value) {
  requireThat(typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value), 'absolute-path-required');
  requireThat(!/[\x00-\x1f<>"|?*]/.test(value) && !value.slice(2).includes(':'), 'unsafe-path');
  const parts = value.slice(3).split(/[\\/]/);
  requireThat(parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p)), 'unsafe-path');
  requireThat(!parts.some(p => p.toLowerCase() === '.env'), 'env-path-forbidden');
  return path.normalize(value);
}
export function isWithin(candidate, root) {
  const a = absoluteWindowsPath(candidate).toLowerCase();
  const b = absoluteWindowsPath(root).toLowerCase();
  return a === b || a.startsWith(b + '\\');
}
/** The caller must obtain expectedCanonical from the existing owned directory's
 * realpath first. Pure comparison cannot discover filesystem links by itself.
 */
export function assertWorkspacePath(actual, expectedCanonical) {
  let value, expected;
  try { value = absoluteWindowsPath(actual); expected = absoluteWindowsPath(expectedCanonical); }
  catch { throw new DemoError('workspace-path-invalid'); }
  requireThat(value.toLowerCase() === expected.toLowerCase(), 'workspace-path-mismatch');
  return value;
}
export function parseArgs(argv) {
  const modes = new Set(['--prepare-only', '--run', '--check']);
  const names = new Set(['--root', '--program', '--node', '--public-root', '--out', '--ffmpeg', '--pnpm-node', '--pnpm-script']);
  const values = Object.create(null);
  let mode;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (modes.has(flag)) { requireThat(!mode, 'one-mode-required'); mode = flag.slice(2); continue; }
    requireThat(names.has(flag) && !Object.hasOwn(values, flag), 'unknown-or-duplicate-argument');
    requireThat(typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--'), 'argument-value-required');
    values[flag] = absoluteWindowsPath(argv[++i]);
  }
  requireThat(mode, 'one-mode-required');
  for (const key of ['--root', '--program', '--node', '--public-root', '--out']) requireThat(values[key], 'required-argument');
  const config = { mode, root: values['--root'], program: values['--program'], node: values['--node'],
    publicRoot: values['--public-root'], out: values['--out'], ffmpeg: values['--ffmpeg'] ?? null,
    pnpmNode: values['--pnpm-node'] ?? null, pnpmScript: values['--pnpm-script'] ?? null };
  const match = config.root.match(/^(C:\\Users\\[^\\]+)\\AppData\\Local\\DSH-Tinker-Demo$/i);
  requireThat(match && !/^C:\\Users\\(Public|Default)$/i.test(match[1]), 'private-root-required');
  const user = match[1];
  const equalPath = (a, b) => a.toLowerCase() === b.toLowerCase();
  requireThat(equalPath(config.program, path.join(user, 'AppData/Local/Programs/DSH-Tinker-Demo')), 'program-prefix-required');
  requireThat(equalPath(config.node, 'C:\\Program Files\\nodejs\\node.exe'), 'system-node-required');
  requireThat(equalPath(config.publicRoot, 'C:\\Users\\Public\\Documents\\TinkerDemo'), 'public-root-required');
  requireThat(equalPath(config.out, path.join(user, 'ai/ai-dsh-tinker/tasks/T-185/out')), 'task-output-required');
  requireThat(Boolean(config.pnpmNode) === Boolean(config.pnpmScript), 'pnpm-pair-required');
  if (config.pnpmNode) {
    const tools = path.join(user, '.dsh/dsh-runtimes/dsh-primary-runtime/dependencies');
    requireThat(equalPath(config.pnpmNode, path.join(tools, 'node/bin/node.exe'))
      && equalPath(config.pnpmScript, path.join(tools, 'pnpm/bin/pnpm.mjs')), 'existing-pnpm-pair-required');
  }
  if (config.ffmpeg) requireThat(isWithin(config.ffmpeg, path.join(user, 'AppData/Local/Microsoft/WinGet/Packages'))
    && /\\bin\\ffmpeg\.exe$/i.test(config.ffmpeg), 'existing-ffmpeg-required');
  return Object.freeze(config);
}
export function locations(config) {
  const user = config.root.match(/^(C:\\Users\\[^\\]+)\\/i)?.[1];
  requireThat(user, 'private-root-required');
  const repo = path.join(user, 'code/personal/dsh-tinker');
  return Object.freeze({ repo, home: path.join(config.root, 'home'), agents: path.join(config.root, 'agents'),
    osHome: path.join(config.root, 'oshome'), temp: path.join(config.root, 'temp'),
    cwd: path.join(config.publicRoot, 'cwd'), workspace: path.join(config.publicRoot, 'DemoLab'),
    documents: path.join(config.publicRoot, 'documents'), private: path.join(config.root, 'private'),
    media: path.join(config.root, 'media'), runs: path.join(config.root, 'runs'),
    pm: path.join(config.root, 'package-manager'), patch: path.join(config.root, 'isolation.patch.yml'),
    prepared: path.join(config.root, 'prepared.json'),
    bin: path.join(config.program, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
    preset: path.join(config.program, 'node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml'),
    archive: path.join(repo, `dist/develop/${EXPECTED.version}/${EXPECTED.name}-${EXPECTED.version}.tgz`),
  });
}
export function caseInsensitiveEnv(entries) {
  const env = Object.create(null);
  for (const [name, value] of entries) {
    const key = name.toUpperCase();
    requireThat(/^[A-Z_][A-Z0-9_]*$/.test(key) && !Object.hasOwn(env, key), 'duplicate-environment-key');
    requireThat(typeof value === 'string' && !value.includes('\0'), 'invalid-environment-value');
    env[key] = value;
  }
  return env;
}
export function demoEnvironment(config, packageManager = false) {
  const l = locations(config), h = l.osHome;
  const entries = [
    ['SYSTEMROOT', 'C:\\Windows'], ['WINDIR', 'C:\\Windows'], ['COMSPEC', 'C:\\Windows\\System32\\cmd.exe'],
    ['PATH', ['C:\\Program Files\\nodejs', 'C:\\Windows\\System32', 'C:\\Windows',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0'].join(';')], ['PATHEXT', '.COM;.EXE;.BAT;.CMD'],
    ['USERPROFILE', h], ['HOME', h], ['HOMEDRIVE', 'C:'], ['HOMEPATH', h.slice(2)],
    ['APPDATA', path.join(h, 'AppData/Roaming')], ['LOCALAPPDATA', path.join(h, 'AppData/Local')],
    ['TEMP', l.temp], ['TMP', l.temp], ['TMPDIR', l.temp], ['DSH_HOME', l.home], ['DSH_AGENTS_HOME', l.agents],
    ['DSH_TELEMETRY_DISABLED', '1'], ['XDG_CONFIG_HOME', path.join(h, '.config')],
    ['XDG_DATA_HOME', path.join(h, '.local/share')], ['XDG_CACHE_HOME', path.join(h, '.cache')],
    ['XDG_STATE_HOME', path.join(h, '.local/state')], ['XDG_RUNTIME_DIR', path.join(h, '.runtime')],
    ['NARB_NATIVE_CACHE_DIR', path.join(config.root, 'native-cache')], ['LANG', 'en_US.UTF-8'], ['TZ', 'UTC'],
    // These are ALWAYS present, including the carrier's own environment. Native
    // automatic compatibility repair may invoke install without our CLI suffix.
    ['NPM_CONFIG_USERCONFIG', path.join(l.pm, 'user.npmrc')], ['NPM_CONFIG_GLOBALCONFIG', path.join(l.pm, 'global.npmrc')],
    ['NPM_CONFIG_CACHE', path.join(l.pm, 'cache')], ['NPM_CONFIG_OFFLINE', 'true'], ['NPM_CONFIG_IGNORE_SCRIPTS', 'true'],
    ['NPM_CONFIG_IGNORE_PNPMFILE', 'true'], ['PNPM_CONFIG_OFFLINE', 'true'], ['PNPM_CONFIG_IGNORE_SCRIPTS', 'true'],
    ['PNPM_CONFIG_IGNORE_PNPMFILE', 'true'], ['PNPM_CONFIG_CACHE_DIR', path.join(l.pm, 'cache')],
    ['PNPM_CONFIG_STORE_DIR', path.join(l.pm, 'store')], ['PNPM_CONFIG_STATE_DIR', path.join(l.pm, 'state')],
    ['PNPM_CONFIG_GLOBAL_DIR', path.join(l.pm, 'global')], ['PNPM_CONFIG_GLOBAL_BIN_DIR', path.join(l.pm, 'pnpm-home')],
    ['NPM_CONFIG_AUDIT', 'false'], ['NPM_CONFIG_FUND', 'false'], ['NPM_CONFIG_UPDATE_NOTIFIER', 'false'],
    ['NPM_CONFIG_SAVE_EXACT', 'true'], ['NPM_CONFIG_REGISTRY', 'http://127.0.0.1:9'],
    ['PNPM_CONFIG_REGISTRY', 'http://127.0.0.1:9'],
    ['PNPM_HOME', path.join(l.pm, 'pnpm-home')], ['COREPACK_HOME', path.join(l.pm, 'corepack')],
    ['COREPACK_ENABLE_NETWORK', '0'], ['COREPACK_ENABLE_DOWNLOAD_PROMPT', '0'],
    ['GIT_CONFIG_GLOBAL', path.join(l.pm, 'gitconfig')], ['GIT_CONFIG_SYSTEM', path.join(l.pm, 'gitconfig')],
    ['GIT_CONFIG_NOSYSTEM', '1'], ['GIT_CONFIG_COUNT', '0'], ['GIT_TERMINAL_PROMPT', '0'],
  ];
  // Kept as an explicit API mode for callers/tests; both modes deliberately have
  // the same fail-closed package-manager policy rather than a weaker boot mode.
  requireThat(typeof packageManager === 'boolean', 'environment-mode-invalid');
  return Object.freeze(caseInsensitiveEnv(entries));
}
export function browserLaunchOptions(config) {
  return { executablePath: EXPECTED.browserExecutable, headless: true, env: demoEnvironment(config),
    host: '127.0.0.1', port: 0, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] };
}
export function isolationPatch(config) {
  const l = locations(config);
  return [
    { id: 'workspace-controller', config: { documentsDirectory: l.documents.replaceAll('\\', '/'), documentsLookupTimeoutMs: 10000 } },
    { id: 'directory-picker', disabled: true },
    { insert: [ { id: 'demo-directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' },
      { id: 'demo-directory-picker-browse-ui', name: '@deepseek-ai/dsh-client-ui-directory-picker-browse' } ] },
    ...['open-in-app', 'ui-open-in-app', 'agent-instructions', 'skill-filesystem'].map(id => ({ id, disabled: true })),
    { id: 'spill-local', config: { root: path.join(l.temp, 'spill').replaceAll('\\', '/'), cleanupPeriodDays: 0 } },
    // Registry eagerly activates ALL presets, not only the selected one. Preserve
    // real native blank-session UI without mounting any persona, tool or discovery.
    ...BUILTIN_PRESETS.map(id => ({ id, disabled: true })),
    { id: 'agent-preset-registry', config: { default: 'demo-icon' } },
    { insert: [{ id: 'preset-demo-icon', name: '@deepseek-ai/dsh-agent-preset',
      config: { id: 'demo-icon', order: 1, plugins: [] } }] },
  ];
}
export function patchText(config) {
  // JSON is valid YAML and makes whole-config replacement/injection unambiguous.
  return JSON.stringify(isolationPatch(config), null, 2) + '\n';
}
export function ownerMarker(config, role) {
  requireThat(['private', 'public', 'output'].includes(role), 'invalid-owner-role');
  return { schema: EXPECTED.schema, tool: EXPECTED.tool, role,
    root: config.root, publicRoot: config.publicRoot, out: config.out, program: config.program, node: config.node,
    ffmpeg: config.ffmpeg, pnpmNode: config.pnpmNode, pnpmScript: config.pnpmScript,
    browserExecutable: EXPECTED.browserExecutable, archiveSha256: EXPECTED.archiveSha256 };
}
export function assertOwnerMarker(actual, config, role) {
  requireThat(same(actual, ownerMarker(config, role)), 'unowned-or-mismatched-root');
  return true;
}
export function preparedMarker(config, source) {
  return { ...ownerMarker(config, 'private'), patchSha256: HASH(patchText(config, source)),
    presetSha256: HASH(source), envSha256: HASH(JSON.stringify(demoEnvironment(config))),
    pmEnvSha256: HASH(JSON.stringify(demoEnvironment(config, true))), nodeVersion: 'v24.18.0' };
}
export function parseReady(text) {
  requireThat(typeof text === 'string' && text.length <= 16 * 1024 * 1024, 'ready-log-limit');
  const lines = text.split(/\r?\n/).slice(0, -1); // incomplete file tail is not readiness
  const candidates = lines.filter(line => /^dsh web: https?:/.test(line));
  if (!candidates.length) return null;
  requireThat(candidates.length === 1, 'ambiguous-readiness');
  const match = candidates[0].match(/^dsh web: (http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/\?token=([A-Za-z0-9_-]{43}))$/);
  requireThat(match && Number(match[2]) <= 65535 && Number(match[2]) !== 59656, 'unsafe-readiness');
  requireThat(Buffer.from(match[3], 'base64url').toString('base64url') === match[3], 'unsafe-readiness');
  const url = new URL(match[1]);
  return { origin: url.origin, port: Number(match[2]), authenticatedUrl: match[1] };
}
export function allowDemoUrl(value, origin, websocket = false) {
  try {
    const base = new URL(origin), url = new URL(value);
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port || base.port === '59656'
      || base.pathname !== '/' || base.search || base.hash || base.username || base.password) return false;
    return url.protocol === (websocket ? 'ws:' : 'http:') && url.hostname === base.hostname && url.port === base.port
      && !url.username && !url.password && !url.hash && (!websocket || url.pathname === '/api/remote.mux');
  } catch { return false; }
}
export function safeVisibleText(text) {
  return typeof text === 'string' && !/\b[A-Z]:[\\/]|[?&]token=|\b(?:set-cookie|authorization:\s*bearer)\b/i.test(text);
}
export function rpcRequest(method, args, rpcId) {
  requireThat(/^(workspace\/(create|rename)|settings\/update|pluginManager\/(listBundles|listPlugins|setBundleEnabled))$/.test(method), 'rpc-method-forbidden');
  requireThat(typeof rpcId === 'string' && /^demo-[a-z0-9-]+$/.test(rpcId), 'rpc-id-invalid');
  return { type: 'client-request', rpcId, method, payload: { args } };
}
export function rpcValue(envelope, rpcId) {
  requireThat(envelope?.type === 'server-response' && envelope.rpcId === rpcId && envelope.result?.ok === true, 'rpc-rejected');
  return envelope.result.value;
}
export function checkChangeResult(value) {
  requireThat(value && !value.error && !value.pendingBuilds?.length && !value.approvedBuilds?.length
    && (!value.packageResult || value.packageResult.exitCode === 0)
    && (!value.bundle || value.bundle === EXPECTED.name)
    && (!value.version || value.version === EXPECTED.version)
    && (!value.target || value.target === EXPECTED.name) && value.enabled !== false
    && ['applied', 'restart-required'].includes(value.application), 'plugin-change-rejected');
  return value.application;
}
export function checkBundles(bundles, mounted = false) {
  requireThat(Array.isArray(bundles), 'bundle-list-invalid');
  requireThat(!bundles.some(b => /(?:tinker|workspace-plus)/i.test(b.name) && b.name !== EXPECTED.name), 'foreign-tinker-present');
  const selected = bundles.filter(b => b.name === EXPECTED.name);
  requireThat(selected.length === 1, 'dev-bundle-missing');
  const b = selected[0];
  requireThat(b.installed && b.version === EXPECTED.version && b.availability === 'profile' && !b.error,
    'dev-bundle-invalid');
  requireThat(b.rows?.length === 1 && b.rows[0].rowId === 'workspace-plus'
    && b.rows[0].moduleName === EXPECTED.name, 'dev-bundle-row-invalid');
  if (mounted) requireThat(b.enabled && b.rows[0].entryId, 'dev-bundle-not-mounted');
  return b;
}
export function checkRuntimeRows(rows) {
  requireThat(Array.isArray(rows), 'plugin-rows-invalid');
  const dev = rows.filter(row => row.moduleName === EXPECTED.name);
  requireThat(dev.length === 1 && dev[0].patchId === 'workspace-plus' && dev[0].enabled
    && dev[0].fiberPhase === 'active' && !dev[0].diagnostic, 'dev-runtime-not-active');
  const disabled = ['directory-picker', 'open-in-app', 'ui-open-in-app', 'agent-instructions', 'skill-filesystem', ...BUILTIN_PRESETS];
  requireThat(rows.filter(row => disabled.includes(row.patchId)).every(row => !row.enabled), 'isolation-row-active');
  requireThat(rows.some(row => row.patchId === 'preset-demo-icon' && row.enabled && row.fiberPhase === 'active'), 'demo-preset-not-active');
  requireThat(!rows.some(row => /@deepseek-ai\/dsh-(agent-instructions|skill-filesystem)$/.test(row.moduleName) && row.enabled), 'nested-discovery-active');
  for (const id of ['demo-directory-picker-browse', 'demo-directory-picker-browse-ui']) {
    requireThat(rows.some(row => row.patchId === id && row.enabled && row.fiberPhase === 'active'), 'browse-picker-not-active');
  }
  requireThat(!rows.some(row => /(?:tinker|workspace-plus)/i.test(row.moduleName)
    && row.moduleName !== EXPECTED.name && row.enabled), 'foreign-runtime-active');
  return true;
}
export function readTar(bytes) {
  const files = new Map();
  const text = bytes => bytes.toString('utf8').replace(/\0.*$/s, '');
  const octal = bytes => { const s = text(bytes).trim(); requireThat(/^[0-7]+$/.test(s), 'tar-number-invalid'); return parseInt(s, 8); };
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      requireThat(bytes.length - offset >= 1024 && bytes.subarray(offset).every(byte => byte === 0), 'tar-end-invalid');
      requireThat(same([...files.keys()].sort(), PAYLOAD), 'tar-members-invalid');
      return files;
    }
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    requireThat(octal(header.subarray(148, 156)) === checksum, 'tar-checksum-invalid');
    requireThat(header[156] === 0 || header[156] === 48, 'tar-link-forbidden');
    const prefix = text(header.subarray(345, 500));
    const name = (prefix ? prefix + '/' : '') + text(header.subarray(0, 100));
    requireThat(name.startsWith('package/') && PAYLOAD.includes(name.slice(8)) && !files.has(name.slice(8)), 'tar-path-invalid');
    const size = octal(header.subarray(124, 136));
    requireThat(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= bytes.length, 'tar-truncated');
    files.set(name.slice(8), Buffer.from(bytes.subarray(offset + 512, offset + 512 + size)));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new DemoError('tar-end-missing');
}
export function verifyDevManifest(manifest) {
  requireThat(manifest?.name === EXPECTED.name && manifest.version === EXPECTED.version && manifest.private === true,
    'archive-identity-invalid');
  for (const field of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies',
    'bundledDependencies', 'bundleDependencies']) requireThat(manifest[field] === undefined, 'archive-executable-dependencies');
  requireThat(manifest.dsh?.bundle?.patch === './cordis.patch.yml' && manifest.dsh?.client?.platform === 'web', 'archive-contract-invalid');
  return true;
}
export function verifyArchive(bytes) {
  requireThat(bytes.length === EXPECTED.archiveBytes && HASH(bytes) === EXPECTED.archiveSha256, 'archive-integrity-mismatch');
  const files = readTar(gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }));
  verifyDevManifest(JSON.parse(files.get('package.json').toString('utf8')));
  requireThat(HASH(files.get('client.js')) === EXPECTED.clientSha256, 'archive-client-mismatch');
  requireThat(files.get('cordis.patch.yml').toString('utf8') === '- insert:\n    - id: workspace-plus\n      name: dsh-tinker-develop\n      config: {}\n', 'archive-row-mismatch');
  requireThat(/\bid:\s*["']dsh-tinker-develop["']/.test(files.get('client.js').toString('utf8')), 'archive-factory-mismatch');
  return files;
}
export function cliArguments(config, install = false) {
  return install ? ['plugin', '--profile', 'web', 'add', locations(config).archive, '--offline', '--ignore-scripts']
    : ['--profile', 'web', '--patch', locations(config).patch, '--host', '127.0.0.1', '--port', '0', '--no-open'];
}
export function cliCarrier(config, argv) {
  const bin = locations(config).bin;
  const url = 'file:///' + bin.replaceAll('\\', '/').split('/').map((part, i) => i === 0 ? part : encodeURIComponent(part)).join('/');
  const options = config.pnpmNode ? { packageManager: { command: config.pnpmNode,
    args: [config.pnpmScript, '--offline', '--ignore-scripts', '--ignore-pnpmfile'], env: demoEnvironment(config, true) } } : {};
  return ['--input-type=module', '-e',
    `process.argv=${JSON.stringify([config.node, bin, ...argv])};\nconst {runCli}=await import(${JSON.stringify(url)});\nawait runCli(${JSON.stringify(options)});`];
}
export function ffmpegArguments(frames, output) {
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-framerate', '12', '-i', path.join(frames, 'frame-%04d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', output];
}

// Everything below is reached only by explicit main(). No filesystem/bootstrap in exports above.
async function exists(file) { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function plainPath(file, allowed = [], mayBeMissing = false) {
  const target = absoluteWindowsPath(file);
  const parsed = path.parse(target);
  let current = parsed.root;
  for (const part of target.slice(parsed.root.length).split('\\')) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); } catch (error) {
      if (mayBeMissing && error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      const real = await fs.realpath(current);
      requireThat(allowed.some(root => isWithin(real, root)), 'reparse-path-forbidden');
    }
  }
  const real = await fs.realpath(target);
  requireThat(allowed.length ? allowed.some(root => isWithin(real, root)) : real.toLowerCase() === target.toLowerCase(), 'canonical-path-mismatch');
}
async function regularFile(file, roots) {
  await plainPath(file, roots);
  const stat = await fs.stat(file);
  requireThat(stat.isFile(), 'regular-file-required');
}
async function ownedWorkspacePath(config) {
  const workspace = locations(config).workspace;
  await plainPath(workspace, [config.publicRoot]);
  requireThat((await fs.stat(workspace)).isDirectory(), 'workspace-directory-required');
  const canonical = await fs.realpath(workspace);
  // An in-root junction/alias is not enough: require this exact owned directory.
  assertWorkspacePath(canonical, workspace);
  return canonical;
}
async function ownedRoot(config, role, create) {
  const root = { private: config.root, public: config.publicRoot, output: config.out }[role];
  await plainPath(path.dirname(root));
  if (!(await exists(root))) {
    requireThat(create, 'prepared-root-missing');
    await fs.mkdir(root, { mode: 0o700 });
    await fs.writeFile(path.join(root, OWNER), JSON.stringify(ownerMarker(config, role), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  await plainPath(root); // even an empty existing root without our exact marker is refused
  const marker = path.join(root, OWNER);
  const stat = await fs.lstat(marker);
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'owner-marker-invalid');
  assertOwnerMarker(JSON.parse(await fs.readFile(marker, 'utf8')), config, role);
}
async function ensureDirectory(dir, roots) {
  await plainPath(dir, roots, true);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await plainPath(dir, roots);
  requireThat((await fs.stat(dir)).isDirectory(), 'directory-required');
}
async function exactFile(file, text, create) {
  if (!(await exists(file))) {
    requireThat(create, 'prepared-file-missing');
    await fs.writeFile(file, text, { flag: 'wx', mode: 0o600 });
  }
  const stat = await fs.lstat(file);
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'prepared-file-invalid');
  requireThat(await fs.readFile(file, 'utf8') === text, 'prepared-file-mismatch');
}
async function inspectTree(root, approved) {
  // Do not follow junctions. Validate their destination, then leave package links alone.
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    requireThat(item.name.toLowerCase() !== '.env', 'env-file-forbidden');
    const file = path.join(root, item.name), stat = await fs.lstat(file);
    if (stat.isSymbolicLink()) {
      const real = await fs.realpath(file);
      requireThat(approved.some(base => isWithin(real, base)), 'reparse-path-forbidden');
    } else if (stat.isDirectory()) await inspectTree(file, approved);
  }
}
async function software(config) {
  const l = locations(config);
  await plainPath(config.program);
  const manifestFile = path.join(config.program, 'node_modules/@deepseek-ai/dsh/package.json');
  for (const [file, hash] of [[manifestFile, EXPECTED.manifestSha256], [l.bin, EXPECTED.binSha256]]) {
    await regularFile(file, [config.program]);
    requireThat(HASH(await fs.readFile(file)) === hash, 'installed-cli-drift');
  }
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  requireThat(manifest.name === '@deepseek-ai/dsh' && manifest.version === EXPECTED.hostVersion, 'installed-cli-identity');
  await regularFile(config.node, [path.dirname(config.node)]);
  await regularFile(EXPECTED.browserExecutable, []); // plainPath rejects browser/ancestor aliases
  for (const dir of ['C:\\Windows\\System32', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0']) await plainPath(dir);
  for (const name of ['dsh-host-directory-picker-browse', 'dsh-client-ui-directory-picker-browse']) {
    const folder = path.join(config.program, 'node_modules/@deepseek-ai', name);
    await regularFile(path.join(folder, 'lib/index.js'), [config.program]);
    const pkg = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8'));
    requireThat(pkg.name === '@deepseek-ai/' + name && pkg.version === EXPECTED.hostVersion, 'browse-picker-missing');
  }
  if (config.pnpmNode) for (const file of [config.pnpmNode, config.pnpmScript]) await regularFile(file, [path.dirname(file)]);
  if (config.ffmpeg) await regularFile(config.ffmpeg, [path.dirname(config.ffmpeg)]);
  const web = path.join(config.program, 'node_modules/@deepseek-ai/dsh-web-app');
  const webManifest = JSON.parse(await fs.readFile(path.join(web, 'package.json'), 'utf8'));
  requireThat(same(webManifest.dsh?.bundle?.patch, ['./cordis.patch.yml', './presets/standard.patch.yml',
    './presets/ptc.patch.yml', './presets/minimal.patch.yml', './presets/cordis.patch.yml']), 'installed-presets-changed');
  const sources = [];
  for (const id of BUILTIN_PRESETS) {
    const file = path.join(web, 'presets', id.slice(7) + '.patch.yml');
    await regularFile(file, [config.program]);
    const text = await fs.readFile(file, 'utf8');
    requireThat(text.includes('- id: ' + id) && text.includes("name: '@deepseek-ai/dsh-agent-preset'"), 'installed-preset-identity');
    sources.push(text);
  }
  // Fingerprint all four eagerly activated declarations, not just standard.
  const preset = JSON.stringify(sources);
  await regularFile(l.archive, [l.repo]);
  const payload = verifyArchive(await fs.readFile(l.archive));
  return { preset, payload };
}
async function validatePrepared(config) {
  const l = locations(config);
  for (const role of ['private', 'public', 'output']) await ownedRoot(config, role, false);
  const actual = await software(config);
  await exactFile(l.patch, patchText(config, actual.preset), false);
  await exactFile(l.prepared, JSON.stringify(preparedMarker(config, actual.preset), null, 2) + '\n', false);
  for (const file of ['user.npmrc', 'global.npmrc', 'gitconfig']) await exactFile(path.join(l.pm, file), '', false);
  for (const root of [config.root, config.publicRoot]) await inspectTree(root, [config.root, config.publicRoot, config.program]);
  for (const dir of [l.home, l.agents, l.osHome, l.temp, l.private, l.media, l.runs, l.pm]) await plainPath(dir, [config.root]);
  for (const dir of [l.cwd, l.workspace, l.documents]) await plainPath(dir, [config.publicRoot]);
  await ownedWorkspacePath(config);
  requireThat((await fs.readdir(l.cwd)).length === 0, 'cwd-not-empty');
  return actual;
}
function interrupted(state) { requireThat(!state.abort.signal.aborted, 'interrupted'); }
async function waitUntil(check, state, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (true) {
    interrupted(state);
    const result = await check();
    if (result) return result;
    requireThat(Date.now() < deadline, 'operation-timeout');
    await delay(100, undefined, { signal: state.abort.signal }).catch(() => { throw new DemoError('interrupted'); });
  }
}
async function spawnPrivate(command, args, config, state, label, env = demoEnvironment(config)) {
  const l = locations(config), id = label + '-' + randomUUID();
  await plainPath(l.private, [config.root]);
  const stdoutPath = path.join(l.private, id + '.stdout.log'), stderrPath = path.join(l.private, id + '.stderr.log');
  const out = await fs.open(stdoutPath, 'wx', 0o600);
  let err;
  try {
    err = await fs.open(stderrPath, 'wx', 0o600);
    const child = spawn(command, args, { cwd: l.cwd, env, shell: false, windowsHide: true,
      stdio: ['ignore', out.fd, err.fd] });
    const record = { child, stdoutPath, stderrPath, settled: false, status: null };
    record.done = new Promise(resolve => {
      child.once('error', () => { record.settled = true; record.status = -1; resolve(-1); });
      child.once('exit', code => { record.settled = true; record.status = code ?? -1; resolve(record.status); });
    });
    state.children.add(record);
    return record;
  } finally { await out.close(); if (err) await err.close(); }
}
async function finished(record, state, timeout = 120000) {
  await waitUntil(() => record.settled, state, timeout);
  requireThat(record.status === 0, 'child-process-failed');
}
async function stopOwnChild(record, config, state) {
  if (record.settled) return;
  // Windows SIGTERM does not terminate descendants. Taskkill is scoped exclusively
  // to our still-live ChildProcess; no discovered/global PID or image-name kill.
  const killer = await spawnPrivate('C:\\Windows\\System32\\taskkill.exe',
    ['/PID', String(record.child.pid), '/T', '/F'], config, state, 'stop-own-child');
  const deadline = Date.now() + 15000;
  while ((!record.settled || !killer.settled) && Date.now() < deadline) await delay(50);
  if (!killer.settled) killer.child.kill();
  requireThat(record.settled, 'owned-child-stop-failed');
}
async function builtinPreflight(config, state) {
  const l = locations(config), env = demoEnvironment(config);
  const expected = { home: l.osHome, temp: l.temp, cwd: l.cwd, env };
  const code = `const os=require('node:os'),fs=require('node:fs');const x=${JSON.stringify(expected)};
const eq=(a,b)=>a.toLowerCase()===b.toLowerCase();
const checks={node:process.version==='v24.18.0',home:eq(os.homedir(),x.home),temp:eq(os.tmpdir(),x.temp),cwd:eq(process.cwd(),x.cwd),
keys:JSON.stringify(Object.keys(process.env).map(k=>k.toUpperCase()).sort())===JSON.stringify(Object.keys(x.env).sort()),
values:Object.entries(x.env).every(([k,v])=>process.env[k]===v),empty:fs.readdirSync(x.cwd).length===0,
noEnv:![x.cwd,x.env.DSH_HOME].some(p=>fs.existsSync(require('node:path').join(p,'.env')))};
process.stdout.write(JSON.stringify(checks));if(!Object.values(checks).every(Boolean))process.exitCode=1;`;
  const record = await spawnPrivate(config.node, ['-e', code], config, state, 'preflight');
  await finished(record, state, 15000);
  const checks = JSON.parse(await fs.readFile(record.stdoutPath, 'utf8'));
  requireThat(Object.keys(checks).length === 8 && Object.values(checks).every(value => value === true), 'environment-preflight-failed');
  return checks;
}
async function prepare(config, state) {
  const l = locations(config);
  const actual = await software(config); // no creation if software/immutable archive gate fails
  for (const role of ['private', 'public', 'output']) await ownedRoot(config, role, true);
  state.owned = true;
  const env = demoEnvironment(config), pm = demoEnvironment(config, true);
  const dirs = [l.home, l.agents, l.osHome, l.temp, l.private, l.media, l.runs, l.pm, l.cwd, l.workspace, l.documents,
    path.join(l.temp, 'spill'), env.APPDATA, env.LOCALAPPDATA, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME,
    env.XDG_CACHE_HOME, env.XDG_STATE_HOME, env.XDG_RUNTIME_DIR, env.NARB_NATIVE_CACHE_DIR,
    pm.NPM_CONFIG_CACHE, pm.PNPM_HOME, pm.COREPACK_HOME, pm.PNPM_CONFIG_STORE_DIR,
    pm.PNPM_CONFIG_STATE_DIR, pm.PNPM_CONFIG_GLOBAL_DIR];
  for (const dir of dirs) await ensureDirectory(dir, [config.root, config.publicRoot]);
  await ownedWorkspacePath(config);
  state.privateReady = true;
  for (const root of [config.root, config.publicRoot]) await inspectTree(root, [config.root, config.publicRoot, config.program]);
  requireThat((await fs.readdir(l.cwd)).length === 0, 'cwd-not-empty');
  await exactFile(l.patch, patchText(config, actual.preset), true); // MUST precede every CLI invocation
  for (const name of ['user.npmrc', 'global.npmrc', 'gitconfig']) await exactFile(path.join(l.pm, name), '', true);
  await builtinPreflight(config, state);
  await exactFile(l.prepared, JSON.stringify(preparedMarker(config, actual.preset), null, 2) + '\n', true);
  state.emit({ phase: 'prepared', environment: true, patch: true, aclReviewRequired: true, root: config.root });
}
async function claimRun(config) {
  const l = locations(config);
  const names = (await fs.readdir(l.runs)).filter(name => /^run-[0-9]{6}$/.test(name)).sort();
  const last = names.at(-1);
  if (last) {
    const report = path.join(l.runs, last, 'finished.json');
    requireThat(await exists(report), 'previous-run-unfinished');
    requireThat(JSON.parse(await fs.readFile(report, 'utf8')).childrenStopped === true, 'previous-run-not-stopped');
  }
  const number = last ? Number(last.slice(4)) + 1 : 1;
  requireThat(number < 1000000, 'run-limit');
  const name = 'run-' + String(number).padStart(6, '0'), dir = path.join(l.runs, name);
  await fs.mkdir(dir, { mode: 0o700 }); // exclusive, persistent lease; never delete another run's data
  const media = path.join(l.media, name);
  await fs.mkdir(media, { mode: 0o700 });
  return { dir, media, name };
}
async function verifyInstalledPayload(config, payload) {
  const folder = path.join(locations(config).home, 'profiles/web/node_modules', EXPECTED.name);
  if (!(await exists(path.join(folder, 'package.json')))) return false;
  for (const [name, bytes] of payload) {
    const file = path.join(folder, name);
    await regularFile(file, [config.root]);
    requireThat(HASH(await fs.readFile(file)) === HASH(bytes), 'installed-dev-payload-mismatch');
  }
  return true;
}
async function startHost(config, state) {
  state.emit({ phase: 'host-start' });
  const host = await spawnPrivate(config.node, cliCarrier(config, cliArguments(config)), config, state, 'host');
  const ready = await waitUntil(async () => {
    requireThat(!host.settled, 'host-exited-before-ready');
    requireThat((await fs.stat(host.stdoutPath)).size <= 16 * 1024 * 1024, 'ready-log-limit');
    return parseReady(await fs.readFile(host.stdoutPath, 'utf8'));
  }, state, 90000);
  // Verify the announcement belongs to this child, not another listener.
  const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const code = `$ErrorActionPreference='Stop';$x=@(Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort ${ready.port});if($x.Count -eq 1 -and $x[0].OwningProcess -eq ${host.child.pid}){[Console]::Write('true')}else{exit 2}`;
  const owner = await spawnPrivate(ps, ['-NoProfile', '-NonInteractive', '-Command', code], config, state, 'listener-owner');
  await finished(owner, state, 20000);
  requireThat(await fs.readFile(owner.stdoutPath, 'utf8') === 'true', 'listener-owner-mismatch');
  state.emit({ phase: 'host-ready', origin: ready.origin, ownListener: true });
  return { host, ready };
}
async function bounded(promise, milliseconds) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DemoError('operation-timeout')), milliseconds);
  })]); } finally { clearTimeout(timer); }
}
async function closeBrowser(state) {
  const browser = state.browser, server = state.browserServer;
  state.browser = null; state.browserServer = null;
  let failure;
  if (browser) try { await bounded(browser.close(), 10000); } catch (error) { failure = error; }
  if (server) try { await bounded(server.close(), 10000); } catch (error) { failure ??= error; }
  if (failure) throw new DemoError('browser-close-failed'); // own ChildProcess fallback is in finally
}
async function browserContext(config, state, origin) {
  // Lazy import: pure tests and --prepare-only never load Playwright. A fresh
  // Playwright-protocol server gives a PUBLIC process handle for bounded cleanup;
  // this is not CDP and never attaches to an existing browser/user-data profile.
  await regularFile(EXPECTED.browserExecutable, []); // recheck immediately before launch; no channel fallback
  const { chromium } = await import('playwright');
  state.browserServer = await chromium.launchServer(browserLaunchOptions(config));
  const child = state.browserServer.process();
  const record = { child, settled: child.exitCode !== null, status: child.exitCode };
  child.once('error', () => { record.settled = true; record.status = -1; });
  child.once('exit', code => { record.settled = true; record.status = code; });
  state.children.add(record);
  const endpoint = state.browserServer.wsEndpoint(), endpointUrl = new URL(endpoint);
  requireThat(endpointUrl.protocol === 'ws:' && endpointUrl.hostname === '127.0.0.1'
    && endpointUrl.port && endpointUrl.port !== '59656', 'browser-control-origin-invalid');
  state.browser = await chromium.connect(endpoint, { timeout: 15000 });
  state.browserVersion = state.browser.version(); // private capture proof only
  const context = await state.browser.newContext({ locale: 'en-US', colorScheme: 'dark',
    viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false });
  context.setDefaultTimeout(12000);
  const diagnostic = kind => { state.diagnostics.push({ kind }); };
  await context.route('**/*', async route => {
    try {
      if (allowDemoUrl(route.request().url(), origin)) await route.continue();
      else { state.networkViolation = true; diagnostic('blocked-origin'); await route.abort('blockedbyclient'); }
    } catch { state.networkViolation = true; diagnostic('route-error'); }
  });
  await context.routeWebSocket(/.*/, socket => {
    try {
      if (allowDemoUrl(socket.url(), origin, true)) socket.connectToServer();
      else { state.networkViolation = true; diagnostic('blocked-websocket'); socket.close(); }
    } catch { state.networkViolation = true; diagnostic('websocket-route-error'); }
  });
  context.on('page', page => {
    page.on('console', message => { if (message.type() === 'error') diagnostic('console-error'); });
    page.on('pageerror', () => diagnostic('page-error'));
    page.on('requestfailed', () => diagnostic('request-failed'));
  });
  return context;
}
async function handshake(context, ready) {
  requireThat(allowDemoUrl(ready.authenticatedUrl, ready.origin), 'handshake-origin-invalid');
  const response = await context.request.get(ready.authenticatedUrl, { maxRedirects: 0, timeout: 15000 });
  requireThat(response.status() === 303 && response.headers().location === './', 'handshake-rejected');
  await response.dispose();
  const root = await context.request.get(ready.origin + '/', { maxRedirects: 0, timeout: 15000 });
  requireThat(root.status() === 200 && (root.headers()['content-type'] ?? '').includes('text/html'), 'handshake-cookie-failed');
  await root.dispose(); // HTML never executes here; workspace is seeded before any page mount
}
async function rpc(context, origin, method, args = {}) {
  const id = 'demo-' + randomUUID(), request = rpcRequest(method, args, id);
  const target = origin + '/api/' + method;
  requireThat(allowDemoUrl(target, origin), 'rpc-origin-invalid');
  const response = await context.request.post(target, { data: request, maxRedirects: 0, timeout: 20000,
    headers: { Origin: origin } });
  try {
    requireThat(response.status() === 200, 'rpc-http-rejected');
    return rpcValue(await response.json(), id);
  } finally { await response.dispose(); }
}
export async function dismissOnboarding(page) {
  // Only source-verified cancellation actions, never a generic dialog/button click.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const dialogs = page.getByRole('dialog');
    const notice = page.getByRole('dialog', { name: 'Preview Notice', exact: true });
    if (await notice.isVisible()) {
      await notice.getByRole('button', { name: 'Continue', exact: true }).click();
      await notice.waitFor({ state: 'hidden', timeout: 12000 });
      continue;
    }
    const account = dialogs.filter({ has: page.getByRole('button', { name: 'Sign in', exact: true }) });
    if (await account.count() === 1 && await account.isVisible()) {
      await account.getByRole('button', { name: 'Close', exact: true }).click(); continue;
    }
    const later = dialogs.getByRole('button', { name: 'Configure later', exact: true });
    if (await later.count() === 1 && await later.isVisible()) { await later.click(); continue; }
    if (await dialogs.count() === 0) { await page.waitForTimeout(200); if (await dialogs.count() === 0) return; }
    await page.waitForTimeout(100);
  }
  throw new DemoError('onboarding-not-dismissable');
}
function assertCleanPage(page, origin) {
  requireThat(page.url() === origin + '/', 'page-url-not-clean');
}
async function capture(page, workspaceId, origin, run, config, state) {
  const row = page.locator('[data-row-key=' + JSON.stringify('workspace:' + workspaceId) + ']');
  await row.waitFor({ state: 'visible' });
  requireThat(await row.getAttribute('role') === 'treeitem', 'workspace-row-invalid');
  requireThat(await row.locator('.wsp-workspace-icon').count() === 0, 'initial-icon-not-native');
  requireThat(await page.evaluate(() => localStorage.getItem('dsh-workspace-plus:v1')) === null, 'browser-prefs-not-fresh');
  await page.mouse.move(900, 700);
  const frame = async name => {
    assertCleanPage(page, origin); requireThat(!state.networkViolation, 'browser-origin-violation');
    requireThat(safeVisibleText(await page.locator('body').innerText()), 'sensitive-visible-content');
    await page.screenshot({ path: path.join(run.media, name), fullPage: false, animations: 'allow' });
  };
  await frame('before.png');
  let recording = true, frameError;
  const started = Date.now();
  const recorder = (async () => {
    let n = 0;
    while (recording) {
      const name = 'frame-' + String(n++).padStart(4, '0') + '.png';
      await frame(name);
      await delay(Math.max(0, started + n * (1000 / 12) - Date.now()));
    }
    return n;
  })().catch(error => { frameError = error; });
  const holdUntil = async milliseconds => {
    interrupted(state);
    const remaining = started + milliseconds - Date.now();
    if (remaining > 0) await delay(remaining, undefined, { signal: state.abort.signal });
    if (frameError) throw frameError;
  };
  try {
    await holdUntil(800);
    await row.hover(); // immediate click, never an idle >800ms title hover
    const menu = row.getByRole('button', { name: 'Workspace actions for Demo Lab', exact: true });
    await menu.click();
    await waitUntil(async () => await menu.getAttribute('aria-expanded') === 'true', state, 3000);
    const appearance = page.getByRole('menuitem', { name: 'Appearance', exact: true });
    await appearance.waitFor({ state: 'visible' });
    requireThat(await appearance.getAttribute('data-wsp-menu') === workspaceId, 'appearance-owner-mismatch');
    await holdUntil(1600);
    await appearance.click();
    const dialog = page.getByRole('dialog', { name: 'Workspace appearance', exact: true });
    await dialog.waitFor({ state: 'visible' });
    await holdUntil(2500);
    await dialog.getByRole('button', { name: 'Icon', exact: true }).click();
    await dialog.getByRole('searchbox', { name: 'Search icons', exact: true }).fill('code');
    const code = dialog.locator('.wsp-choice-grid').getByRole('button', { name: 'code', exact: true });
    await code.click();
    const green = dialog.getByRole('button', { name: '#22a06b', exact: true });
    await green.click();
    const selectedSvg = await code.locator('svg').innerHTML();
    requireThat(await code.getAttribute('aria-pressed') === 'true' && await green.getAttribute('aria-pressed') === 'true', 'editor-choice-not-selected');
    const preview = dialog.locator('.wsp-list-preview');
    requireThat((await preview.innerText()).includes('Demo Lab'), 'editor-preview-missing');
    await page.mouse.move(900, 700);
    await holdUntil(3900);
    await frame('editor.png');
    await holdUntil(4800);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const icon = row.locator('.wsp-workspace-icon');
    await icon.waitFor({ state: 'visible' });
    requireThat(await icon.locator('svg').count() === 1, 'row-icon-svg-missing');
    requireThat(await icon.locator('svg').innerHTML() === selectedSvg, 'row-code-icon-mismatch');
    requireThat(await icon.evaluate(element => getComputedStyle(element).color) === 'rgb(34, 160, 107)', 'row-icon-color-mismatch');
    const prefs = await page.evaluate(() => {
      const value = JSON.parse(localStorage.getItem('dsh-workspace-plus:v1'));
      return { version: value?.version, appearances: value?.appearances };
    });
    requireThat(prefs?.version === 2 && same(Object.keys(prefs.appearances ?? {}), [workspaceId])
      && same(prefs.appearances[workspaceId], { kind: 'icon', icon: 'code', color: '#22a06b' }), 'saved-demo-preference-mismatch');
    await page.mouse.move(900, 700);
    await holdUntil(5500);
    await frame('final.png'); // full-size proof, intentionally private, not a thumbnail
    await holdUntil(7500);
  } finally { recording = false; await recorder; }
  if (frameError) throw frameError;
  const frames = (await fs.readdir(run.media)).filter(name => /^frame-[0-9]{4}\.png$/.test(name)).length;
  const duration = frames / 12;
  requireThat(duration >= 6 && duration <= 8.5, 'capture-cadence-too-slow');
  requireThat(!state.networkViolation && !state.diagnostics.some(item => ['page-error', 'console-error', 'request-failed'].includes(item.kind)), 'browser-diagnostics-failed');
  const gif = path.join(run.media, 'workspace-icon.gif');
  const encoder = await spawnPrivate(config.ffmpeg, ffmpegArguments(run.media, gif), config, state, 'ffmpeg');
  await finished(encoder, state, 60000);
  requireThat((await fs.stat(gif)).size > 0 && (await fs.stat(gif)).size <= 10 * 1024 * 1024, 'gif-size-invalid');
  return { png: path.join(run.media, 'editor.png'), gif, frames, duration };
}
async function runCapture(config, state) {
  requireThat(config.ffmpeg && config.pnpmNode && config.pnpmScript, 'run-tools-required');
  const actual = await validatePrepared(config), l = locations(config);
  state.owned = true;
  for (const name of ['workspace-icon.png', 'workspace-icon.gif']) requireThat(!(await exists(path.join(config.out, name))), 'output-already-exists');
  const run = await claimRun(config); state.run = run;
  // Clean the controller's own environment before importing third-party code. There
  // are no ambient DEBUG, browser/profile overrides, keys, proxies or loaders here.
  process.env = demoEnvironment(config);
  process.chdir(l.cwd);
  await builtinPreflight(config, state);
  if (!(await verifyInstalledPayload(config, actual.payload))) {
    state.emit({ phase: 'install-pinned-local-dev' });
    const installer = await spawnPrivate(config.node, cliCarrier(config, cliArguments(config, true)), config, state, 'install', demoEnvironment(config, true));
    await finished(installer, state, 180000);
    requireThat(await verifyInstalledPayload(config, actual.payload), 'dev-install-missing');
  }
  let { host, ready } = await startHost(config, state);
  let context = await browserContext(config, state, ready.origin);
  await handshake(context, ready);
  let bundle = checkBundles(await rpc(context, ready.origin, 'pluginManager/listBundles'));
  if (!bundle.enabled) {
    const result = checkChangeResult(await rpc(context, ready.origin, 'pluginManager/setBundleEnabled', { name: EXPECTED.name, enabled: true }));
    if (result === 'restart-required') {
      await closeBrowser(state);
      await stopOwnChild(host, config, state);
      ({ host, ready } = await startHost(config, state));
      context = await browserContext(config, state, ready.origin);
      await handshake(context, ready);
    }
  }
  checkBundles(await rpc(context, ready.origin, 'pluginManager/listBundles'), true);
  checkRuntimeRows(await rpc(context, ready.origin, 'pluginManager/listPlugins'));
  const workspacePath = await ownedWorkspacePath(config);
  const created = await rpc(context, ready.origin, 'workspace/create', { request: { path: workspacePath } });
  const id = created?.workspace?.workspaceId;
  requireThat(typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id), 'workspace-create-invalid');
  assertWorkspacePath(created.workspace.path, workspacePath);
  const renamed = await rpc(context, ready.origin, 'workspace/rename', { request: { workspaceId: id, title: 'Demo Lab' } });
  requireThat(renamed?.workspace?.workspaceId === id && renamed.workspace.title === 'Demo Lab', 'workspace-rename-invalid');
  assertWorkspacePath(renamed.workspace.path, workspacePath);
  await rpc(context, ready.origin, 'settings/update', { ns: 'ui-theme', patch: { preference: 'dark' } });
  await rpc(context, ready.origin, 'settings/update', { ns: 'locale', patch: { preference: 'en' } });
  assertWorkspacePath(await ownedWorkspacePath(config), workspacePath); // still the same real directory before HTML mount
  const page = await context.newPage();
  await page.goto(ready.origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  assertCleanPage(page, ready.origin);
  await dismissOnboarding(page);
  const captured = await capture(page, id, ready.origin, run, config, state);
  await fs.writeFile(path.join(run.dir, 'capture.json'), JSON.stringify({ schema: 1, origin: ready.origin,
    archiveSha256: EXPECTED.archiveSha256, frames: captured.frames, duration: captured.duration,
    dimensions: [1024, 768], localDemoPreference: true, nativeRowChanged: true,
    browser: { executable: EXPECTED.browserExecutable, version: state.browserVersion },
    privateEditor: captured.png, privateFinal: path.join(run.media, 'final.png') }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  // No output replacement or recursive cleanup. Raw frames/logs remain private.
  await fs.copyFile(captured.png, path.join(config.out, 'workspace-icon.png'), FC.COPYFILE_EXCL);
  await fs.copyFile(captured.gif, path.join(config.out, 'workspace-icon.gif'), FC.COPYFILE_EXCL);
  state.result = { phase: 'captured', png: path.join(config.out, 'workspace-icon.png'), gif: path.join(config.out, 'workspace-icon.gif'),
    nativeRowChanged: true, localDemoPreference: true, visualReviewRequired: true };
}
export async function main(argv = process.argv.slice(2)) {
  const publicWrite = process.stdout.write.bind(process.stdout);
  const state = { children: new Set(), browser: null, browserServer: null, abort: new AbortController(), owned: false, privateReady: false,
    diagnostics: [], networkViolation: false, phase: 'arguments', run: null,
    emit(value) { publicWrite(JSON.stringify(value) + '\n'); } };
  let config, failure, rawLog;
  const onSignal = () => state.abort.abort();
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  try {
    config = parseArgs(argv);
    requireThat(process.platform === 'win32', 'windows-only');
    requireThat(fileURLToPath(import.meta.url).toLowerCase() === path.join(locations(config).repo, 'scripts/demo/workspace-icon.mjs').toLowerCase(), 'controller-location-mismatch');
    state.phase = config.mode;
    if (config.mode === 'prepare-only') await prepare(config, state);
    else if (config.mode === 'check') {
      await validatePrepared(config);
      state.emit({ phase: 'checked', prepared: true, readonly: true, aclReviewRequired: true });
    } else {
      // Suppress any dependency's accidental console/debug output before it can
      // reach the saved public stream. Only state.emit uses that stream.
      for (const role of ['private', 'public', 'output']) await ownedRoot(config, role, false);
      state.owned = true;
      await plainPath(locations(config).private, [config.root]);
      state.privateReady = true;
      rawLog = await fs.open(path.join(locations(config).private, 'controller-' + randomUUID() + '.log'), 'wx', 0o600);
      state.savedStdout = process.stdout.write; state.savedStderr = process.stderr.write;
      const privateWrite = (chunk, encoding, callback) => {
        const cb = typeof encoding === 'function' ? encoding : callback;
        rawLog.write(typeof chunk === 'string' ? chunk : Buffer.from(chunk)).then(() => cb?.(), () => cb?.());
        return true;
      };
      process.stdout.write = privateWrite; process.stderr.write = privateWrite;
      await runCapture(config, state);
    }
  } catch (error) { failure = error; }
  finally {
    try { await closeBrowser(state); } catch (error) { failure ??= error; }
    if (config) for (const record of [...state.children].reverse()) {
      try { await stopOwnChild(record, config, state); } catch (error) { failure ??= error; }
    }
    if (state.privateReady && config) {
      try {
        if (failure) await fs.writeFile(path.join(locations(config).private, 'error-' + randomUUID() + '.log'),
          failure instanceof Error ? failure.stack ?? failure.message : String(failure), { flag: 'wx', mode: 0o600 });
        if (state.run) {
          await fs.writeFile(path.join(state.run.dir, 'diagnostics.json'), JSON.stringify(state.diagnostics) + '\n', { flag: 'wx', mode: 0o600 });
          await fs.writeFile(path.join(state.run.dir, 'finished.json'), JSON.stringify({ ok: !failure, childrenStopped: [...state.children].every(c => c.settled),
            code: failure ? redactDiagnostic(failure).code : null }) + '\n', { flag: 'wx', mode: 0o600 });
        }
      } catch { failure ??= new DemoError('private-report-failed'); }
    }
    if (rawLog) {
      process.stdout.write = state.savedStdout; process.stderr.write = state.savedStderr;
      try { await rawLog.close(); } catch { failure ??= new DemoError('private-log-close-failed'); }
    }
    process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
  }
  if (failure) { state.emit({ phase: state.phase, ...redactDiagnostic(failure), ok: false }); return 1; }
  if (state.result) state.emit(state.result);
  return 0;
}
if (import.meta.main) {
  try { process.exitCode = await main(); }
  catch {
    // Last-resort boundary: never let a finalizer print a raw error/stack/URL.
    process.stdout.write('{"phase":"controller","code":"controller-finalization-failed","ok":false}\n');
    process.exitCode = 1;
  }
}
