import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { nativeAliases } from './unread-shortcut-native.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildUnreadShortcutFixture() {
  const result=await build({absWorkingDir:root,entryPoints:['tests/unread-shortcut-fixture.jsx'],outfile:path.join(root,'test-results/unread-shortcuts/fixture.js'),bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',target:['chrome120','safari17'],loader:{'.css':'local-css'},alias:{
    ...nativeAliases,
    '@deepseek-ai/dsh-client-ui-primitives':path.join(root,'tests/unread-shortcut-primitives.js'),
    '@deepseek-ai/cosmokit':path.join(root,'tests/native-shortcuts-rc2/runtime/cosmokit.js'),
    clsx:path.join(root,'tests/native-rc2/vendor/clsx/src/index.js'),
  }});
  const sheets=['web/src/base.css',...['base','corner-shape','design-platform','focus','scrollbar','gradient-shadow-text'].map(name=>`ui-theme/src/styles/${name}.css`)];
  const baseline=await Promise.all(sheets.map(name=>readFile(path.join(root,'tests/native-rc2/packages/client',name),'utf8')));
  return {js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:[...baseline,...result.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text)].join('\n')};
}
