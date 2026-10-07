import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const nativeRoot = fileURLToPath(new URL('./native-rc2/', import.meta.url));
const nativeEntry = fileURLToPath(new URL('./native-primitives.js', import.meta.url));
const clsxEntry = path.join(nativeRoot, 'vendor/clsx/src/index.js');

// Global sheets stay untransformed: scoping them as CSS Modules would break body theme aliases.
// These are the exact shell reset and relevant native theme sheets, in native theme order.
const baselineSheets = [
  'packages/client/web/src/base.css',
  'packages/client/ui-theme/src/styles/base.css',
  'packages/client/ui-theme/src/styles/corner-shape.css',
  'packages/client/ui-theme/src/styles/design-platform.css',
  'packages/client/ui-theme/src/styles/focus.css',
  'packages/client/ui-theme/src/styles/scrollbar.css',
  'packages/client/ui-theme/src/styles/gradient-shadow-text.css',
];
let baselinePromise;

function nativeBaseline() {
  baselinePromise ??= Promise.all(baselineSheets.map(async name =>
    `/* Exact native RC.2 baseline: ${name} */\n${await readFile(path.join(nativeRoot, name), 'utf8')}`,
  )).then(sheets => sheets.join('\n\n'));
  return baselinePromise;
}

/**
 * Bundle one offline browser fixture against the exact native Modal/Button implementation.
 * Native CSS Modules compile to a separate stylesheet; both returned strings must be mounted.
 * No host module loader, installed DSH checkout, network access, or additional UI dependency is needed.
 */
export async function buildFixture(entry = 'tests/fixture.jsx') {
  const [result, baseline] = await Promise.all([
    build({
      absWorkingDir: projectRoot,
      entryPoints: [path.resolve(projectRoot, entry)],
      outfile: path.join(projectRoot, 'tests/.fixture-memory.js'),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['chrome120', 'safari17'],
      jsx: 'automatic',
      // Native SidebarRoot receives these build-time substitutions in the host.
      define: {
        'process.env.DSH_CLIENT_VERSION': 'undefined',
        'process.env.DSH_CLIENT_COMMIT_HASH': 'undefined',
        'process.env.DSH_CLIENT_GIT_DIRTY': 'undefined',
      },
      loader: { '.css': 'local-css' },
      alias: {
        '@deepseek-ai/dsh-client-ui-primitives': nativeEntry,
        clsx: clsxEntry,
      },
      write: false,
    }),
    nativeBaseline(),
  ]);
  const javascript = result.outputFiles.filter(file => file.path.endsWith('.js'));
  if (javascript.length !== 1) throw new Error('Expected exactly one in-memory fixture JavaScript output');
  const modules = result.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text);
  return { js: javascript[0].text, css: [baseline, ...modules].join('\n\n') };
}
