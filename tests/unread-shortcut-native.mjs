import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const host = fileURLToPath(new URL('./unread-shortcut-host.js', import.meta.url));
export const nativeAliases = {
  '@deepseek-ai/dsh-client-store': host,
  '@deepseek-ai/dsh-util-crypto': host,
  '@deepseek-ai/dsh-util-values': host,
};
export async function nativeCordis() {
  const result = await build({ absWorkingDir: root, entryPoints: ['tests/native-shortcuts-rc2/runtime/cordis.js'], bundle: true, write: false, format: 'esm', platform: 'node', alias: {
    '@deepseek-ai/cosmokit': fileURLToPath(new URL('./native-shortcuts-rc2/runtime/cosmokit.js', import.meta.url)),
  } });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
export async function nativeSDK() {
  const result = await build({ absWorkingDir: root, stdin: { contents: `
    export { ShortcutRegistry } from './tests/native-shortcuts-rc2/packages/client/shortcuts/src/client/registry.ts';
    export { initialShortcutConfig, parseShortcutDefinitions } from './tests/native-shortcuts-rc2/packages/client/shortcuts/src/protocol.ts';
  `, resolveDir: root }, bundle: true, write: false, format: 'esm', platform: 'node', alias: nativeAliases });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
