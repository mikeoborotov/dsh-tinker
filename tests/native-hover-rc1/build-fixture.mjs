import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('../../',import.meta.url));
const primitives=fileURLToPath(new URL('./primitives.js',import.meta.url));
const workspace=fileURLToPath(new URL('./workspace.js',import.meta.url));
const clsx=fileURLToPath(new URL('../native-rc2/vendor/clsx/src/index.js',import.meta.url));
export async function buildHoverFixture(entry='tests/diagnostics/t149/fixture.jsx') {
  const provenance=JSON.parse(await readFile(new URL('./provenance.json',import.meta.url),'utf8'));
  for(const[name,expected]of Object.entries(provenance.sliceHashes)){
    const content=await readFile(new URL(name,import.meta.url));
    if(createHash('sha256').update(content).digest('hex')!==expected)throw new Error(`Native RC.1 slice changed: ${name}`);
  }
  const result=await build({absWorkingDir:project,entryPoints:[entry],outfile:'tests/.unread-hover-memory.js',bundle:true,format:'iife',platform:'browser',target:['chrome120','safari17'],jsx:'automatic',write:false,loader:{'.css':'local-css'},alias:{'@deepseek-ai/dsh-client-ui-primitives':primitives,'t149-primitives':primitives,'t149-workspace':workspace,clsx}});
  const base=await readFile(new URL('./baseline.css',import.meta.url),'utf8');
  return {js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:[base,...result.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text)].join('\n'),provenance};
}
