import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPECTED, DemoError, absoluteWindowsPath, isWithin, parseArgs, locations, assertWorkspacePath, browserLaunchOptions,
  caseInsensitiveEnv, demoEnvironment, isolationPatch, patchText, ownerMarker,
  assertOwnerMarker, preparedMarker, parseReady, allowDemoUrl, redactDiagnostic,
  rpcRequest, rpcValue, checkChangeResult, checkBundles, checkRuntimeRows, safeVisibleText,
  readTar, verifyDevManifest, verifyArchive, cliArguments, cliCarrier, ffmpegArguments, dismissOnboarding,
} from '../scripts/demo/workspace-icon.mjs';

// Pure tests only: fake paths/identities/tokens, in-memory buffers, no filesystem,
// subprocess, CLI, network, browser, package manager or bootstrap calls.
const fakeUser = 'C:\\Users\\DemoOperator';
const flags = [
  '--root', fakeUser + '\\AppData\\Local\\DSH-Tinker-Demo',
  '--program', fakeUser + '\\AppData\\Local\\Programs\\DSH-Tinker-Demo',
  '--node', 'C:\\Program Files\\nodejs\\node.exe',
  '--public-root', 'C:\\Users\\Public\\Documents\\TinkerDemo',
  '--out', fakeUser + '\\ai\\ai-dsh-tinker\\tasks\\T-185\\out',
];
const tools = ['--pnpm-node', fakeUser + '\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\node\\bin\\node.exe',
  '--pnpm-script', fakeUser + '\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\pnpm\\bin\\pnpm.mjs',
  '--ffmpeg', fakeUser + '\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Fake.FFmpeg\\bin\\ffmpeg.exe'];
const config = parseArgs(['--prepare-only', ...flags, ...tools]);
const l = locations(config);
const fakeToken = Buffer.alloc(32, 7).toString('base64url');
const origin = 'http://127.0.0.1:42001';
const readyLine = `${origin}/?token=${fakeToken}`;
const fail = code => error => error instanceof DemoError && error.code === code;
const changedFlag = (name, value) => flags.map((part, i) => flags[i - 1] === name ? value : part);
const validBundle = () => ({ name: EXPECTED.name, version: EXPECTED.version,
  installed: true, availability: 'profile', enabled: true,
  rows: [{ rowId: 'workspace-plus', moduleName: EXPECTED.name, entryId: 'demo-entry' }] });
const validRows = () => [
  { moduleName: EXPECTED.name, patchId: 'workspace-plus', enabled: true, fiberPhase: 'active' },
  { moduleName: '@deepseek-ai/dsh-agent-preset', patchId: 'preset-demo-icon', enabled: true, fiberPhase: 'active' },
  ...['demo-directory-picker-browse', 'demo-directory-picker-browse-ui'].map(patchId => ({ patchId, moduleName: patchId, enabled: true, fiberPhase: 'active' })),
];

test('import exposes pure functions without invoking bootstrap', () => {
  assert.equal(typeof parseArgs, 'function');
  assert.equal(EXPECTED.name, 'dsh-tinker-develop');
  assert.equal(EXPECTED.archiveSha256.length, 64);
});
test('arguments require exactly one explicit mode', () => {
  for (const mode of ['--prepare-only', '--run', '--check']) assert.equal(parseArgs([mode, ...flags]).mode, mode.slice(2));
  assert.throws(() => parseArgs(flags), fail('one-mode-required'));
  assert.throws(() => parseArgs(['--run', '--check', ...flags]), fail('one-mode-required'));
  assert.throws(() => parseArgs(['--run', '--run', ...flags]), fail('one-mode-required'));
});
test('arguments reject unknown, duplicate and valueless options', () => {
  assert.throws(() => parseArgs(['--run', ...flags, '--port', '59656']), fail('unknown-or-duplicate-argument'));
  assert.throws(() => parseArgs(['--run', ...flags, '--node', config.node]), fail('unknown-or-duplicate-argument'));
  assert.throws(() => parseArgs(['--run', ...flags, '--ffmpeg']), fail('argument-value-required'));
  assert.throws(() => parseArgs(['--run', ...flags.slice(2)]), fail('required-argument'));
});
test('absolute paths normalize separators but reject traversal and namespace tricks', () => {
  assert.equal(absoluteWindowsPath('C:/Program Files/nodejs/node.exe'), config.node);
  for (const input of ['relative', '~/demo', '\\\\server\\share', '\\\\?\\C:\\demo', 'C:relative',
    'C:\\demo\\..\\target', 'C:\\demo\\.\\target', 'C:\\demo\\file:stream', 'C:\\demo\\trailing.',
    'C:\\demo\\trailing ', 'C:\\demo\\\\target', 'C:\\demo\\nul\0text']) assert.throws(() => absoluteWindowsPath(input));
});
test('absolute paths reject case-insensitive .env targets', () => {
  assert.throws(() => absoluteWindowsPath('C:\\demo\\.EnV'), fail('env-path-forbidden'));
});
test('path containment is case-insensitive and component bounded', () => {
  assert.equal(isWithin('c:\\DEMO\\child', 'C:\\demo'), true);
  assert.equal(isWithin('C:\\demo', 'c:\\DEMO'), true);
  assert.equal(isWithin('C:\\demo-other\\child', 'C:\\demo'), false);
});
test('workspace response path must equal the exact canonical owned directory case-insensitively', () => {
  assert.equal(assertWorkspacePath(l.workspace, l.workspace), l.workspace);
  assert.equal(assertWorkspacePath(l.workspace.toLowerCase().replaceAll('\\', '/'), l.workspace).toLowerCase(), l.workspace.toLowerCase());
});
test('workspace response path rejects missing, false and non-path DTO values', () => {
  for (const actual of [undefined, null, false, 0, {}, [], '', 'DemoLab', 'C:DemoLab']) {
    assert.throws(() => assertWorkspacePath(actual, l.workspace), fail('workspace-path-invalid'));
  }
  assert.throws(() => assertWorkspacePath(l.workspace, false), fail('workspace-path-invalid'));
});
test('workspace response path rejects outside roots, sibling prefixes and child directories', () => {
  for (const actual of [fakeUser + '\\Documents\\DemoLab', config.root + '\\DemoLab',
    'D:\\Users\\Public\\Documents\\TinkerDemo\\DemoLab', l.workspace + '-other', l.workspace + '\\child']) {
    assert.throws(() => assertWorkspacePath(actual, l.workspace), fail('workspace-path-mismatch'));
  }
});
test('workspace response path rejects traversal even when normalization would reach the expected path', () => {
  for (const actual of [config.publicRoot + '\\other\\..\\DemoLab', l.workspace + '\\.', l.workspace + '\\..\\DemoLab',
    l.workspace + ':stream', l.workspace + '\\', l.workspace.replace('DemoLab', 'DemoLab.')]) {
    assert.throws(() => assertWorkspacePath(actual, l.workspace), fail('workspace-path-invalid'));
  }
});
test('workspace canonical path rejects junction aliases, short-name aliases and device namespaces', () => {
  // Filesystem realpath is checked at runtime; pure comparison refuses an alias
  // returned by that check rather than merely accepting same-root containment.
  for (const alias of [config.publicRoot + '\\DemoLab-junction', config.publicRoot + '\\DEMOLA~1']) {
    assert.throws(() => assertWorkspacePath(alias, l.workspace), fail('workspace-path-mismatch'));
  }
  assert.throws(() => assertWorkspacePath('\\\\?\\' + l.workspace, l.workspace), fail('workspace-path-invalid'));
});
test('Edge launch pins the verified absolute executable without channel or environment discovery', () => {
  const options = browserLaunchOptions(config);
  assert.equal(EXPECTED.browserExecutable, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
  assert.equal(options.executablePath, EXPECTED.browserExecutable);
  assert.equal(Object.hasOwn(options, 'channel'), false);
  assert.equal(options.host, '127.0.0.1'); assert.equal(options.port, 0);
  assert.deepEqual(options.env, demoEnvironment(config));
  assert.equal(options.env.PROGRAMFILES, undefined); assert.equal(options.env['PROGRAMFILES(X86)'], undefined);
  assert.equal(ownerMarker(config, 'private').browserExecutable, EXPECTED.browserExecutable);
});
test('private root and program cannot be production or arbitrary prefixes', () => {
  for (const root of ['C:\\Users\\Public\\AppData\\Local\\DSH-Tinker-Demo', 'C:\\Users\\DemoOperator\\.dsh',
    'C:\\temp\\DSH-Tinker-Demo']) assert.throws(() => parseArgs(['--check', ...changedFlag('--root', root)]));
  assert.throws(() => parseArgs(['--check', ...changedFlag('--program', 'C:\\Program Files\\DeepSeek Harness')]), fail('program-prefix-required'));
});
test('node must be explicit existing system executable, not a shim or directory', () => {
  for (const node of ['C:\\node.exe', 'C:\\Program Files\\nodejs', 'C:\\Program Files\\nodejs\\dsh.cmd']) {
    assert.throws(() => parseArgs(['--check', ...changedFlag('--node', node)]), fail('system-node-required'));
  }
});
test('workspace/public cwd and output cannot use a personal workspace', () => {
  assert.throws(() => parseArgs(['--check', ...changedFlag('--public-root', fakeUser + '\\Documents\\TinkerDemo')]), fail('public-root-required'));
  assert.throws(() => parseArgs(['--check', ...changedFlag('--out', fakeUser + '\\code\\personal\\dsh-tinker')]), fail('task-output-required'));
  assert.ok(l.cwd.startsWith('C:\\Users\\Public\\'));
  assert.ok(l.workspace.startsWith('C:\\Users\\Public\\'));
  assert.ok(!l.workspace.includes('DemoOperator'));
});
test('pnpm is an optional indivisible pair of already installed bundled paths', () => {
  assert.equal(parseArgs(['--check', ...flags]).pnpmNode, null);
  assert.throws(() => parseArgs(['--check', ...flags, ...tools.slice(0, 2)]), fail('pnpm-pair-required'));
  const wrong = tools.slice(0, 4); wrong[1] = 'C:\\tools\\node.exe';
  assert.throws(() => parseArgs(['--check', ...flags, ...wrong]), fail('existing-pnpm-pair-required'));
});
test('ffmpeg must be explicitly selected installed encoder, never PATH lookup', () => {
  assert.equal(config.ffmpeg.endsWith('ffmpeg.exe'), true);
  assert.throws(() => parseArgs(['--check', ...flags, '--ffmpeg', 'C:\\tools\\ffmpeg.exe']), fail('existing-ffmpeg-required'));
});
test('environment canonicalizes casing and rejects duplicate names and invalid values', () => {
  const env = caseInsensitiveEnv([['Path', 'controlled'], ['Home', 'private']]);
  assert.equal(Object.getPrototypeOf(env), null);
  assert.deepEqual(Object.keys(env), ['PATH', 'HOME']);
  assert.throws(() => caseInsensitiveEnv([['Path', 'a'], ['PATH', 'b']]), fail('duplicate-environment-key'));
  assert.throws(() => caseInsensitiveEnv([['BAD=NAME', 'x']]), fail('duplicate-environment-key'));
  assert.throws(() => caseInsensitiveEnv([['HOME', 'bad\0value']]), fail('invalid-environment-value'));
});
test('environment contains explicit independent DSH and OS homes', () => {
  const env = demoEnvironment(config);
  for (const key of ['HOME', 'USERPROFILE']) assert.equal(env[key], l.osHome);
  assert.equal(env.DSH_HOME, l.home); assert.equal(env.DSH_AGENTS_HOME, l.agents);
  assert.equal(env.HOMEDRIVE + env.HOMEPATH, l.osHome);
  assert.notEqual(env.DSH_HOME, env.DSH_AGENTS_HOME);
  assert.equal(env.DSH_TELEMETRY_DISABLED, '1');
});
test('all cache/AppData/temp/XDG locations stay private', () => {
  const env = demoEnvironment(config);
  for (const key of ['APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
    'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'XDG_RUNTIME_DIR', 'NARB_NATIVE_CACHE_DIR']) assert.equal(isWithin(env[key], config.root), true, key);
  assert.equal(env.TEMP, env.TMP); assert.equal(env.TMP, env.TMPDIR);
});
test('fresh environment omits credentials, loaders, ambient profiles and browser debug', () => {
  const env = demoEnvironment(config);
  for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'AWS_PROFILE', 'GOOGLE_APPLICATION_CREDENTIALS', 'AZURE_CLIENT_SECRET',
    'SSH_AUTH_SOCK', 'HTTP_PROXY', 'HTTPS_PROXY', 'NODE_OPTIONS', 'NODE_PATH', 'PSModulePath', 'BASH_ENV',
    'DSH_SESSION_ID', 'DSH_WEB_URL', 'DSH_PROFILE', 'DEBUG', 'PWDEBUG', 'PLAYWRIGHT_BROWSERS_PATH']) assert.equal(env[key], undefined, key);
  assert.equal(env.PATH, 'C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0');
  assert.equal(Object.isFrozen(env), true);
});
test('offline/script/pnpmfile defenses persist even in boot and repair environments', () => {
  for (const mode of [false, true]) {
    const env = demoEnvironment(config, mode);
    for (const key of ['PNPM_CONFIG_OFFLINE', 'PNPM_CONFIG_IGNORE_SCRIPTS', 'PNPM_CONFIG_IGNORE_PNPMFILE',
      'NPM_CONFIG_OFFLINE', 'NPM_CONFIG_IGNORE_SCRIPTS', 'NPM_CONFIG_IGNORE_PNPMFILE']) assert.equal(env[key], 'true', key);
    assert.equal(env.COREPACK_ENABLE_NETWORK, '0'); assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
    assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  }
});
test('npm/pnpm/Corepack/Git config and cache roots are all private', () => {
  const env = demoEnvironment(config, true);
  for (const key of ['NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_GLOBALCONFIG', 'NPM_CONFIG_CACHE', 'PNPM_HOME',
    'PNPM_CONFIG_STORE_DIR', 'PNPM_CONFIG_STATE_DIR', 'PNPM_CONFIG_CACHE_DIR', 'PNPM_CONFIG_GLOBAL_DIR',
    'COREPACK_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM']) assert.equal(isWithin(env[key], config.root), true, key);
  assert.equal(env.PNPM_CONFIG_REGISTRY, 'http://127.0.0.1:9');
});
test('patch overrides Windows Known Folder policy with full replacement config', () => {
  const row = isolationPatch(config).find(row => row.id === 'workspace-controller');
  assert.deepEqual(row.config, { documentsDirectory: 'C:/Users/Public/Documents/TinkerDemo/documents', documentsLookupTimeoutMs: 10000 });
  assert.deepEqual(JSON.parse(patchText(config)), isolationPatch(config));
});
test('patch removes native picker and supplies both required browse faces', () => {
  const rows = isolationPatch(config);
  assert.equal(rows.find(row => row.id === 'directory-picker').disabled, true);
  const inserts = rows.flatMap(row => row.insert ?? []);
  assert.equal(inserts.filter(row => row.name === '@deepseek-ai/dsh-host-directory-picker-browse').length, 1);
  assert.equal(inserts.filter(row => row.name === '@deepseek-ai/dsh-client-ui-directory-picker-browse').length, 1);
});
test('patch disables open-in-app and global discovery, and eliminates spill sweep', () => {
  const rows = isolationPatch(config);
  for (const id of ['open-in-app', 'ui-open-in-app', 'agent-instructions', 'skill-filesystem']) assert.equal(rows.find(row => row.id === id).disabled, true);
  assert.deepEqual(rows.find(row => row.id === 'spill-local').config,
    { root: config.root.replaceAll('\\', '/') + '/temp/spill', cleanupPeriodDays: 0 });
});
test('ALL eagerly activated built-in presets are disabled, not only standard', () => {
  const rows = isolationPatch(config);
  for (const id of ['preset-standard', 'preset-ptc', 'preset-cordis', 'preset-minimal']) assert.equal(rows.find(row => row.id === id).disabled, true);
});
test('owned empty preset preserves native New Session without nested discovery or tools', () => {
  const rows = isolationPatch(config);
  assert.deepEqual(rows.find(row => row.id === 'agent-preset-registry').config, { default: 'demo-icon' });
  const preset = rows.flatMap(row => row.insert ?? []).find(row => row.id === 'preset-demo-icon');
  assert.deepEqual(preset, { id: 'preset-demo-icon', name: '@deepseek-ai/dsh-agent-preset', config: { id: 'demo-icon', order: 1, plugins: [] } });
  assert.equal(rows.flatMap(row => row.insert ?? []).some(row => /instructions|skill-filesystem|tool-|persona/.test(row.name)), false);
});
test('patch config replacement does not accidentally retain old nested preset plugins', () => {
  const before = { id: 'agent-preset-registry', config: { default: 'standard', selectedDefault: 'standard', unexpected: true } };
  const patch = isolationPatch(config).find(row => row.id === before.id);
  const after = { ...before, ...patch }; // actual loader replaces fields wholesale
  assert.deepEqual(after.config, { default: 'demo-icon' });
});
test('owner markers are role-bound, root-bound and reject adoption', () => {
  for (const role of ['private', 'public', 'output']) assert.equal(assertOwnerMarker(ownerMarker(config, role), config, role), true);
  assert.throws(() => assertOwnerMarker(null, config, 'private'), fail('unowned-or-mismatched-root'));
  assert.throws(() => assertOwnerMarker(ownerMarker(config, 'public'), config, 'private'), fail('unowned-or-mismatched-root'));
  assert.throws(() => assertOwnerMarker({ ...ownerMarker(config, 'private'), root: 'C:\\other' }, config, 'private'), fail('unowned-or-mismatched-root'));
});
test('prepared fingerprint is mode-independent but binds patch, software sources and tools', () => {
  const run = parseArgs(['--run', ...flags, ...tools]);
  assert.deepEqual(preparedMarker(config, 'fake-installed-source'), preparedMarker(run, 'fake-installed-source'));
  assert.notDeepEqual(preparedMarker(config, 'source-a'), preparedMarker(config, 'source-b'));
  assert.throws(() => assertOwnerMarker(ownerMarker(config, 'private'), parseArgs(['--check', ...flags]), 'private'));
});
test('ready parser accepts only complete native announcement and returns clean origin', () => {
  assert.equal(parseReady('booting\n'), null);
  assert.equal(parseReady('dsh web: ' + readyLine), null);
  const ready = parseReady('booting\ndsh web: ' + readyLine + '\r\n');
  assert.equal(ready.origin, origin); assert.equal(ready.port, 42001);
  assert.equal(ready.authenticatedUrl, readyLine);
});
test('ready parser rejects working GUI, wildcard, hostname, credentials and ambiguous lines', () => {
  for (const url of [readyLine.replace('42001', '59656'), readyLine.replace('127.0.0.1', '0.0.0.0'),
    readyLine.replace('127.0.0.1', 'localhost'), readyLine.replace('127.0.0.1', 'user:pass@127.0.0.1'),
    readyLine.replace('42001', '0'), readyLine.replace('42001', '65536'), readyLine.replace('http:', 'https:')]) {
    assert.throws(() => parseReady('dsh web: ' + url + '\n'), fail('unsafe-readiness'));
  }
  assert.throws(() => parseReady(`dsh web: ${readyLine}\ndsh web: ${readyLine}\n`), fail('ambiguous-readiness'));
});
test('ready parser refuses token extras, path, fragment and noncanonical token encodings', () => {
  for (const url of [readyLine + '&token=' + fakeToken, readyLine + '&other=x', readyLine + '#fragment',
    readyLine.replace('/?token=', '/other?token='), readyLine + '=', readyLine.replace(fakeToken, 'x'),
    readyLine.replace(fakeToken, 'A'.repeat(42) + 'B')]) assert.throws(() => parseReady('dsh web: ' + url + '\n'), fail('unsafe-readiness'));
});
test('browser HTTP guard accepts only verified numeric-loopback demo origin', () => {
  assert.equal(allowDemoUrl(origin + '/api/workspace/create', origin), true);
  for (const url of ['http://127.0.0.1:59656/', 'https://example.invalid/', 'http://localhost:42001/',
    'file:///C:/secret', origin + '@evil.invalid/', origin + '/#fragment']) assert.equal(allowDemoUrl(url, origin), false);
  assert.equal(allowDemoUrl(origin + '/', 'http://127.0.0.1:59656'), false);
});
test('browser WebSocket guard permits only native mux on the same origin', () => {
  assert.equal(allowDemoUrl('ws://127.0.0.1:42001/api/remote.mux', origin, true), true);
  for (const url of ['ws://127.0.0.1:59656/api/remote.mux', 'wss://127.0.0.1:42001/api/remote.mux',
    'ws://127.0.0.1:42001/api/other', 'ws://localhost:42001/api/remote.mux']) assert.equal(allowDemoUrl(url, origin, true), false);
});
test('redaction never exposes raw errors, URLs, tokens, cookies or stacks', () => {
  const raw = new Error('token=' + fakeToken + ' Cookie=fake ' + readyLine + ' ' + config.root);
  assert.deepEqual(redactDiagnostic(raw), { code: 'unexpected-error' });
  assert.deepEqual(redactDiagnostic(new DemoError('rpc-rejected')), { code: 'rpc-rejected' });
  assert.deepEqual(redactDiagnostic(new DemoError(readyLine)), { code: 'unexpected-error' });
  assert.deepEqual(redactDiagnostic({ code: 'rpc-rejected', message: fakeToken }), { code: 'unexpected-error' });
});
test('frame text guard rejects absolute paths and auth surfaces instead of hiding UI', () => {
  assert.equal(safeVisibleText('Demo Lab New Session Workspace appearance Preview in workspace list'), true);
  for (const text of ['C:\\Users\\Public\\Documents\\TinkerDemo', 'c:/Users/DemoOperator/private',
    'http://127.0.0.1:42001/?token=fake', 'Set-Cookie: fake', 'Authorization: Bearer fake']) assert.equal(safeVisibleText(text), false);
});
test('RPC uses actual named-argument envelope and matches response identity', () => {
  const request = rpcRequest('workspace/create', { request: { path: l.workspace } }, 'demo-test');
  assert.deepEqual(request, { type: 'client-request', rpcId: 'demo-test', method: 'workspace/create', payload: { args: { request: { path: l.workspace } } } });
  assert.deepEqual(rpcValue({ type: 'server-response', rpcId: 'demo-test', result: { ok: true, value: { created: true } } }, 'demo-test'), { created: true });
  assert.throws(() => rpcValue({ type: 'server-response', rpcId: 'other', result: { ok: true } }, 'demo-test'), fail('rpc-rejected'));
  assert.throws(() => rpcValue({ type: 'server-response', rpcId: 'demo-test', result: { ok: false, error: { message: fakeToken } } }, 'demo-test'), fail('rpc-rejected'));
});
test('RPC allowlist forbids prompts, account login, installs and version exemptions', () => {
  for (const method of ['session/prompt', 'session/create', 'account/startSignIn', 'pluginManager/installBundle',
    'pluginManager/setVersionExemption', '../working/profile']) assert.throws(() => rpcRequest(method, {}, 'demo-test'), fail('rpc-method-forbidden'));
});
test('plugin change gate accepts applied/restart-required but no approvals or failures', () => {
  for (const application of ['applied', 'restart-required']) assert.equal(checkChangeResult({ application }), application);
  for (const value of [{ application: 'failed' }, { application: 'overridden' }, { application: 'applied', error: {} },
    { application: 'applied', pendingBuilds: ['fake-build'] }, { application: 'applied', approvedBuilds: ['fake-build'] },
    { application: 'applied', packageResult: { exitCode: 1 } }, { application: 'applied', bundle: 'dsh-tinker' }]) {
    assert.throws(() => checkChangeResult(value), fail('plugin-change-rejected'));
  }
});
test('bundle gate rejects stable/legacy Tinker, wrong version, module or missing mount', () => {
  assert.equal(checkBundles([validBundle()], true).name, EXPECTED.name);
  assert.throws(() => checkBundles([validBundle(), { name: 'dsh-tinker', enabled: false }]), fail('foreign-tinker-present'));
  assert.throws(() => checkBundles([{ ...validBundle(), version: 'wrong' }]), fail('dev-bundle-invalid'));
  assert.throws(() => checkBundles([{ ...validBundle(), rows: [{ rowId: 'workspace-plus', moduleName: 'dsh-tinker' }] }]), fail('dev-bundle-row-invalid'));
  assert.throws(() => checkBundles([{ ...validBundle(), enabled: false }], true), fail('dev-bundle-not-mounted'));
});
test('runtime gate demands actual active dev row, browse faces and owned preset', () => {
  assert.equal(checkRuntimeRows(validRows()), true);
  assert.throws(() => checkRuntimeRows(validRows().filter(row => row.patchId !== 'preset-demo-icon')), fail('demo-preset-not-active'));
  assert.throws(() => checkRuntimeRows(validRows().map(row => row.moduleName === EXPECTED.name ? { ...row, fiberPhase: 'failed' } : row)), fail('dev-runtime-not-active'));
  assert.throws(() => checkRuntimeRows([...validRows(), { moduleName: '@deepseek-ai/dsh-agent-instructions', enabled: true }]), fail('nested-discovery-active'));
});
test('dev manifest gate excludes stable identity, scripts and dependency resolution', () => {
  const manifest = { name: EXPECTED.name, version: EXPECTED.version, private: true,
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } } };
  assert.equal(verifyDevManifest(manifest), true);
  assert.throws(() => verifyDevManifest({ ...manifest, name: 'dsh-tinker' }), fail('archive-identity-invalid'));
  for (const field of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies']) {
    assert.throws(() => verifyDevManifest({ ...manifest, [field]: {} }), fail('archive-executable-dependencies'));
  }
});
test('archive gate checks pinned digest before any decompression or inspection', () => {
  assert.throws(() => verifyArchive(Buffer.from('not a tarball')), fail('archive-integrity-mismatch'));
  assert.throws(() => readTar(Buffer.alloc(1024)), fail('tar-members-invalid'));
  assert.throws(() => readTar(Buffer.alloc(511)), fail('tar-end-missing'));
  assert.throws(() => readTar(Buffer.alloc(512, 65)), fail('tar-number-invalid'));
});
test('CLI boot arguments pin profile, patch, loopback, random port and no browser handoff', () => {
  assert.deepEqual(cliArguments(config), ['--profile', 'web', '--patch', l.patch, '--host', '127.0.0.1', '--port', '0', '--no-open']);
  assert.ok(!cliArguments(config).some(arg => /59656|from-default-profile|desktop|prompt/i.test(arg)));
});
test('CLI install uses only the pinned absolute tarball offline without scripts', () => {
  assert.deepEqual(cliArguments(config, true), ['plugin', '--profile', 'web', 'add', l.archive, '--offline', '--ignore-scripts']);
  assert.ok(l.archive.includes(EXPECTED.version));
});
test('public CLI carrier passes command/args/env and persistent repair defenses', () => {
  const args = cliCarrier(config, cliArguments(config, true));
  assert.deepEqual(args.slice(0, 2), ['--input-type=module', '-e']);
  const code = args[2];
  assert.ok(code.includes('const {runCli}=await import('));
  assert.ok(code.includes('process.argv='));
  assert.ok(code.includes('"command":')); assert.ok(!code.includes('"executable":'));
  assert.ok(code.includes('--ignore-pnpmfile')); assert.ok(code.includes('PNPM_CONFIG_OFFLINE'));
  assert.ok(code.includes('file:///C:/Users/DemoOperator/AppData/Local/Programs/DSH-Tinker-Demo/'));
  assert.ok(!code.includes(fakeToken));
});
test('FFmpeg uses an argument array, palette filter, no shell and no overwrite', () => {
  const frames = config.root + '\\media\\run-000001', gif = frames + '\\workspace-icon.gif';
  const args = ffmpegArguments(frames, gif);
  assert.ok(args.includes('-n')); assert.ok(args.includes('-nostdin')); assert.ok(!args.includes('-y'));
  assert.equal(args[args.indexOf('-framerate') + 1], '12');
  assert.ok(args.includes('[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a'));
  assert.equal(args.at(-1), gif);
});

/** Synthetic locator seam for the ACTUAL exported dismissal loop, not Host/media
 * acceptance. Matches installed WelcomeNotice: Continue dispatches async ack,
 * status=saving disables the still-visible button, ack then unmounts the notice.
 * A virtual acknowledgement tick replaces server latency; no timers/I/O/browser.
 */
function noticePage({ acknowledgeBeforeClickResolves = false } = {}) {
  const state = { status: 'ready', visible: true, continueClicks: 0, acknowledgements: 0,
    transitions: ['ready'] };
  let finishAcknowledgement;
  const acknowledgement = new Promise(resolve => {
    finishAcknowledgement = () => {
      if (state.status !== 'saving') return;
      state.status = 'acknowledged'; state.visible = false; state.acknowledgements++;
      state.transitions.push('acknowledged-hidden'); resolve();
    };
  });
  const acknowledgementTick = async () => {
    await Promise.resolve(); // async ack completion, independent of click dispatch
    finishAcknowledgement();
    await acknowledgement;
  };
  const absent = { count: async () => 0, isVisible: async () => false };
  const continueButton = {
    async click() {
      state.continueClicks++;
      if (state.status === 'saving') {
        // Playwright auto-waits for enabled, but acknowledgement unmounts this
        // locator rather than re-enabling it. Collapse that timeout to one tick.
        await acknowledgementTick();
        throw new Error('locator.click: Timeout 12000ms exceeded. Continue disabled while saving; element was detached from the DOM.');
      }
      assert.equal(state.status, 'ready', 'Continue must not be clicked after acknowledgement');
      assert.equal(state.visible, true);
      state.status = 'saving'; state.transitions.push('saving-disabled');
      if (acknowledgeBeforeClickResolves) await acknowledgementTick();
      // Like the native onClick, returning does not await the async ack by default.
    },
  };
  const notice = {
    isVisible: async () => state.visible,
    getByRole(role, options) {
      assert.equal(role, 'button'); assert.deepEqual(options, { name: 'Continue', exact: true });
      return continueButton;
    },
    async waitFor(options) {
      assert.equal(options.state, 'hidden');
      if (state.visible) await acknowledgementTick();
      assert.equal(state.visible, false);
    },
  };
  const dialogs = {
    count: async () => state.visible ? 1 : 0,
    filter: () => absent,
    getByRole(role, options) {
      assert.equal(role, 'button'); assert.deepEqual(options, { name: 'Configure later', exact: true });
      return absent;
    },
  };
  return { state, page: {
    getByRole(role, options) {
      if (role === 'dialog' && options === undefined) return dialogs;
      if (role === 'dialog') {
        assert.deepEqual(options, { name: 'Preview Notice', exact: true }); return notice;
      }
      assert.equal(role, 'button'); assert.deepEqual(options, { name: 'Sign in', exact: true });
      return absent;
    },
    async waitForTimeout() { if (state.status === 'saving') await acknowledgementTick(); },
  } };
}

test('onboarding acknowledgement stays saving after click dispatch: complete without a second Continue click', async () => {
  const fake = noticePage();
  let failure;
  await dismissOnboarding(fake.page).catch(error => { failure = error; });
  assert.deepEqual(fake.state.transitions, ['ready', 'saving-disabled', 'acknowledged-hidden']);
  assert.equal(fake.state.acknowledgements, 1);
  assert.deepEqual({ completed: !failure, continueClicks: fake.state.continueClicks },
    { completed: true, continueClicks: 1 }, failure?.message);
});

test('onboarding acknowledgement already hidden before click resolves: fast counterfactual completes once', async () => {
  const fake = noticePage({ acknowledgeBeforeClickResolves: true });
  await dismissOnboarding(fake.page);
  assert.equal(fake.state.visible, false);
  assert.deepEqual(fake.state.transitions, ['ready', 'saving-disabled', 'acknowledged-hidden']);
  assert.equal(fake.state.acknowledgements, 1);
  assert.equal(fake.state.continueClicks, 1);
});
