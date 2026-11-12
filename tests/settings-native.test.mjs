import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import enMetadata from '../locale/en.json' with { type:'json' };
import ruMetadata from '../locale/ru.json' with { type:'json' };
const rootPath=fileURLToPath(new URL('../',import.meta.url));
const source=await readFile(new URL('../src/client.jsx',import.meta.url),'utf8');
const registration=source.match(/ctx\.slots\.inject\('settings\.section\.icon',[\s\S]*?SettingsSectionIcon\)\);/)?.[0];
const result=await build({absWorkingDir:rootPath,stdin:{resolveDir:rootPath,contents:`
export { Context } from './tests/native-shortcuts-rc2/runtime/cordis.js';
export { SlotRegistry } from './tests/native-settings-rc2/packages/client/ui-renderer/src/client/registry.ts';
export { SettingsSectionIcon } from './src/settings-icon.jsx';
export { dictionaries } from './src/locales.js';
`},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',alias:{
  '@deepseek-ai/cordis':fileURLToPath(new URL('./native-shortcuts-rc2/runtime/cordis.js',import.meta.url)),
  '@deepseek-ai/cosmokit':fileURLToPath(new URL('./native-shortcuts-rc2/runtime/cosmokit.js',import.meta.url)),
  '@deepseek-ai/dsh-client-ui-slots':fileURLToPath(new URL('./native-settings-rc2/packages/client/ui-slots/src/index.ts',import.meta.url)),
}});
const {Context,SlotRegistry,SettingsSectionIcon,dictionaries}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const install=ctx=>Function('ctx','SettingsSectionIcon',registration)(ctx,SettingsSectionIcon);

test('exact native Switch and lower optional SlotRegistry fixture hashes stay portable',async()=>{
  const attributes=await readFile(new URL('../.gitattributes',import.meta.url),'utf8');
  assert.match(attributes,/^tests\/native-settings-rc2\/\*\* -text\s*$/m,'Preserve exact native fixture bytes on fresh Windows autocrlf checkouts');
  for(const [directory,manifest]of[['native-rc2/','switch-files.json'],['native-settings-rc2/','provenance.json']]){
    const base=new URL(directory,import.meta.url),data=JSON.parse(await readFile(new URL(manifest,base),'utf8'));
    for(const file of data.files){const bytes=await readFile(new URL(file.path,base));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  }
});
test('Settings description reuses plugin metadata and preserves pending profile Appearance copy',()=>{
  assert.equal(dictionaries.en.settingsDescription,enMetadata.meta.description);assert.equal(dictionaries.ru.settingsDescription,ruMetadata.meta.description);
  assert.equal(dictionaries.en.profileCustomize,'Appearance');assert.equal(dictionaries.ru.profileCustomize,'Оформление');
  assert.equal(dictionaries.en.profileDialogTitle,'DeepSeek Harness profile appearance');assert.equal(dictionaries.ru.profileDialogTitle,'Оформление профиля DeepSeek Harness');
});
test('production optional icon registration waits on the old SDK, renders current 16px owner props, and cleans up',async()=>{
  assert.ok(registration,'the production call must use the public optional icon inject path');
  const root=new Context(),key='settings.section.icon';
  try{
    await root.plugin(ctx=>{new SlotRegistry(ctx);});
    const frame=await root.plugin({inject:['slots'],apply(ctx){ctx.slots.register({name:'root',children:{'settings.section':{kind:'list',scope:'root'},'fixture.icon-owner':{kind:'single',scope:'root'}}},()=>null);}});
    const section=await root.plugin({inject:['slots'],apply(ctx){ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'workspace-plus',order:80,label:'Tinker'},()=>null));}});
    let owner=await root.plugin({inject:['slots'],apply:install});
    assert.equal(root.slots.spec(key),undefined);assert.equal(root.slots.entries('settings.section').length,1);
    const declare=()=>root.plugin({inject:['slots'],apply(ctx){ctx.slots.register({name:'fixture.icon-owner',children:{[key]:{kind:'list',scope:'root',inline:true}}},()=>null);}});
    let shell=await declare();await settle();let entries=root.slots.entries(key);assert.equal(entries.length,1);assert.equal(entries[0].options.id,'workspace-plus');
    const icon=entries[0].component({size:16,active:true});assert.equal(icon.type,'svg');assert.equal(icon.props.width,16);assert.equal(icon.props.height,16);assert.equal(icon.props.stroke,'currentColor');assert.equal(icon.props['aria-hidden'],'true');
    await shell.dispose();await settle();assert.equal(root.slots.spec(key),undefined);assert.equal(root.slots.entries('settings.section').length,1);
    shell=await declare();await settle();assert.equal(root.slots.entries(key).length,1);
    await owner.dispose();await settle();assert.equal(root.slots.entries(key).length,0);
    owner=await root.plugin({inject:['slots'],apply:install});await settle();assert.equal(root.slots.entries(key).length,1);await owner.dispose();await shell.dispose();
    const waiting=await root.plugin({inject:['slots'],apply:install});await waiting.dispose();shell=await declare();await settle();assert.equal(root.slots.entries(key).length,0);
    await shell.dispose();await section.dispose();await frame.dispose();
  }finally{await root.fiber.dispose();}
});
