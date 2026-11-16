import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.T148_NATIVE_CAPTURE;
if (!root) throw new Error('Set T148_NATIVE_CAPTURE to the read-only captured software root');
const prefix = 'dsh/node_modules/@deepseek-ai/';
const asset = prefix + 'dsh-web-frontend/dist/assets/';
function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Missing native extraction boundary: ' + start);
  return text.slice(a, b);
}
function expose(text, code) {
  const at = text.lastIndexOf('\t\treturn module.exports;');
  if (at < 0) throw new Error('Missing captured factory export boundary');
  return text.slice(0, at) + code + '\n' + text.slice(at);
}

export async function buildNative() {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const inputs = new Map();
  for (const row of manifest) {
    const bytes = await readFile(path.join(root, row.path));
    if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error('Captured source hash mismatch: ' + row.path);
    inputs.set(row.path, bytes.toString('utf8'));
  }
  const web = inputs.get(asset + 'index-BgUyXZcc.js');
  const cut = web.indexOf('const XZ="data-window-drag"');
  if (cut < 0) throw new Error('Missing pre-boot runtime boundary');
  // Exact current runtime declarations, including full native primitives. Do NOT boot the Host.
  const runtime = web.slice(0, cut) + '\nexport const runtime = YZ();\n';
  let renderer = inputs.get(prefix + 'dsh-client-ui-renderer/lib/client.js');
  renderer = expose(renderer, 'exports.__createSlotRenderer = createSlotRenderer;');
  let workspace = inputs.get(prefix + 'dsh-client-ui-workspace/lib/client.js');
  const icons = between(workspace, 'ctx.slots.inject("contextMenu.icon", function* () {', '\n\t\t\tctx.effect(() => ctx.contextMenus.register({\n\t\t\t\tid: "workspace.rename"');
  const actions = between(workspace, 'ctx.effect(() => ctx.contextMenus.register({\n\t\t\t\tid: "workspace.rename"', '\n\t\t\tconst browserInjected = () => ({');
  const open = between(workspace, 'openWorkspaceMenu: (workspaceId, path, displayTitle, point, mode) => {', '\n\t\t\t\tsettleWorkspaceAction:');
  workspace = expose(workspace, `exports.__ProjectRow = ProjectRow;
exports.__groupByWorkspace = groupByWorkspace;
exports.__dictionaries = { en, ru };
exports.__registerWorkspace = (ctx, requestWorkspaceAction) => { ${icons}\n${actions} };
exports.__openWorkspaceMenu = ctx => ({ ${open} }).openWorkspaceMenu;`);
  let openInApp = inputs.get(prefix + 'dsh-client-ui-open-in-app/lib/client.js');
  openInApp = expose(openInApp, 'exports.__registerContextMenus = registerContextMenus; exports.__dictionaries = { en, ru };');
  const clients = [renderer, inputs.get(prefix + 'dsh-client-ui-context-menu/lib/client.js'), workspace, openInApp, inputs.get(prefix + 'dsh-client-locale/lib/client.js')];
  const captured = 'export function loadCaptured(loader) { window.__ModuleLoader__ = loader;\n' + clients.join('\n') + '\n}\n';
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixture.js', import.meta.url))],
    bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', write: false,
    plugins: [{ name: 'captured-current-native', setup(build) {
      build.onResolve({ filter: /^captured-runtime$/ }, () => ({ path: 'runtime', namespace: 'captured' }));
      build.onResolve({ filter: /^captured-modules$/ }, () => ({ path: 'modules', namespace: 'captured' }));
      build.onLoad({ filter: /.*/, namespace: 'captured' }, args => ({ contents: args.path === 'runtime' ? runtime : captured, loader: 'js', resolveDir: path.join(root, asset) }));
      // Unused syntax-highlighter language chunks are never loaded by this seam.
      build.onResolve({ filter: /^\.\/langs\// }, args => ({ path: args.path, external: true }));
    } }],
  });
  return { js: result.outputFiles[0].text,
    css: [inputs.get(asset + 'vendor-DV2921Zo.css'), inputs.get(asset + 'index-lh_YM6sT.css')].join('\n'),
    manifest,
  };
}
