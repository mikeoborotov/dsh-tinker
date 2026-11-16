import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('./native-shortcuts-rc2/',import.meta.url);
async function verify(url,bytes,hash){const data=await readFile(url);assert.equal(data.length,bytes);assert.equal(createHash('sha256').update(data).digest('hex'),hash);}
test('vendored lower-bound SDK, current Cordis runtime and original licenses keep exact offline hashes',async()=>{
  const upstream=JSON.parse(await readFile(new URL('provenance.json',root),'utf8'));
  assert.equal(upstream.commit,'639ed015397290b3745d163aafe02ffee4aa3f84');
  for(const file of upstream.files)await verify(new URL(file.path,root),file.bytes,file.sha256);
  const runtime=JSON.parse(await readFile(new URL('runtime/provenance.json',root),'utf8'));
  for(const file of runtime.files){const name=file.entry.split('/').at(-3);await verify(new URL(`runtime/${name}.js`,root),file.bytes,file.sha256);}
  const licenses=JSON.parse(await readFile(new URL('runtime/license-provenance.json',root),'utf8'));
  for(const file of licenses)await verify(new URL(`runtime/${file.path}`,root),file.bytes,file.sha256);
});
