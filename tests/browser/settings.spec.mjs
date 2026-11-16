import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
import { readFile } from 'node:fs/promises';
import enMetadata from '../../locale/en.json' with { type:'json' };
import ruMetadata from '../../locale/ru.json' with { type:'json' };
import { STORAGE_KEY, LEGACY_BACKUP_KEY } from '../../src/store.js';
import { PROFILE_STORAGE_KEY } from '../../src/profile-store.js';
import { UNREAD_STORAGE_KEY } from '../../src/unread.js';
let fixture;
test.beforeAll(async()=>{fixture=await buildFixture('tests/settings-fixture.jsx');});
const errors=new WeakMap();
test.beforeEach(({page})=>{const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
const panel=page=>page.locator('#settings');
const tabs={en:{features:'Features',recovery:'Recovery',label:'Tinker settings'},ru:{features:'Функции',recovery:'Восстановление',label:'Настройки Tinker'}};
const tab=(page,name,language='en')=>panel(page).getByRole('tab',{name:tabs[language][name],exact:true});
const tabpanel=(page,name,language='en')=>panel(page).getByRole('tabpanel',{name:tabs[language][name],exact:true,includeHidden:true});
const sharedRecovery=page=>panel(page).locator('.wsp-settings-recovery');
const unreadRecovery=page=>panel(page).locator('.wsp-settings-unread-recovery');
const records=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])));
async function expectDownload(page,scope,filename,raw) {
  const download=page.waitForEvent('download');await scope.getByRole('button',{name:'Save recovery copy',exact:true}).click();const file=await download;
  expect(file.suggestedFilename()).toBe(filename);expect(await readFile(await file.path())).toEqual(Buffer.from(raw,'utf8'));
}
const sharedResetConfirm='Reset all Tinker settings? Save a recovery copy first.';
const unreadResetConfirm='Remove only manual unread reminders? Appearance and chats will not change.';
async function resetRecovery(page,scope,confirmMessage,accept=true) {
  const confirmation=page.waitForEvent('dialog').then(async dialog=>{const message=dialog.message();if(accept)await dialog.accept();else await dialog.dismiss();return message;});
  await scope.getByRole('button',{name:'Reset plugin settings',exact:true}).click();expect(await confirmation).toBe(confirmMessage);
}
async function expectSelected(page,name,language='en') {
  const other=name==='features'?'recovery':'features';
  await expect(tab(page,name,language)).toHaveAttribute('aria-selected','true');await expect(tab(page,name,language)).toHaveAttribute('tabindex','0');
  await expect(tab(page,other,language)).toHaveAttribute('aria-selected','false');await expect(tab(page,other,language)).toHaveAttribute('tabindex','-1');
  await expect(tabpanel(page,name,language)).toBeVisible();await expect(tabpanel(page,name,language)).toHaveJSProperty('hidden',false);
  await expect(tabpanel(page,other,language)).toBeHidden();await expect(tabpanel(page,other,language)).toHaveJSProperty('hidden',true);
}
async function mount(page,{language='en',dark=true,records={},trackStorage=false}={}) {
  await page.route('https://settings.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="settings" style="width:620px;padding:24px 30px"></div><div id="overlay"></div><div id="marker"></div><div id="reference"></div></body></html>'}));
  await page.goto('https://settings.test/');await page.addStyleTag({content:fixture.css});
  await page.evaluate(({dark,records,trackStorage})=>{
    if(dark)document.body.setAttribute('data-ds-dark-theme','');for(const[key,value]of Object.entries(records))localStorage.setItem(key,value);
    if(trackStorage){window.settingsStorageWrites=[];for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){if(this===localStorage)window.settingsStorageWrites.push({method,args});return original.apply(this,args);};}}
  },{dark,records,trackStorage});
  await page.addScriptTag({content:fixture.js});await page.evaluate(language=>window.settingsFixture.mount(language),language);await expect(panel(page).getByRole('heading',{name:'Tinker',exact:true})).toBeVisible();
}
const labels={en:['Workspace appearance','Profile appearance','Hide Deepseek Harness logo','In the model picker','Beside chats','Mark as unread'],ru:['Оформление Workspaces','Оформление профиля','Скрывать логотип Deepseek Harness','В выборе модели','Рядом с чатами','Метка непрочитанности']};
for(const language of ['en','ru'])test(`approved A grouped settings without metadata description ${language}`,async({page},testInfo)=>{
  await mount(page,{language});await expect(panel(page).locator('.wsp-settings-description')).toHaveCount(0);for(const metadata of [enMetadata,ruMetadata])await expect(panel(page)).not.toContainText(metadata.meta.description);
  const list=panel(page).getByRole('tablist',{name:tabs[language].label,exact:true});await expect(list.getByRole('tab')).toHaveText([tabs[language].features,tabs[language].recovery]);await expect(list).toHaveClass(/\bwsp-settings-tabs\b/);
  await expect(panel(page).locator('.wsp-settings-tabpanel')).toHaveCount(2);await expectSelected(page,'features',language);await expect(panel(page).locator('details,summary')).toHaveCount(0);
  for(const name of ['features','recovery']) {
    const control=tab(page,name,language),target=tabpanel(page,name,language);await expect(control).toHaveClass(/\bwsp-settings-tab\b/);await expect(control).toHaveJSProperty('tagName','BUTTON');await expect(control).toHaveAttribute('type','button');
    const id=await control.getAttribute('id'),targetId=await target.getAttribute('id');expect(id).toBeTruthy();expect(targetId).toBeTruthy();await expect(control).toHaveAttribute('aria-controls',targetId);await expect(target).toHaveAttribute('aria-labelledby',id);await expect(target).toHaveAttribute('tabindex','0');
  }
  const groups=panel(page).locator('.wsp-settings-group');await expect(groups).toHaveCount(3);
  await expect(groups.locator('h3')).toHaveText(language==='en'?['Appearance','AI model logos','Chats']:['Оформление','Логотипы моделей ИИ','Чаты']);
  for(const[index,count]of[3,2,1].entries())await expect(groups.nth(index).getByRole('switch')).toHaveCount(count);
  await expect(panel(page).getByRole('switch')).toHaveCount(6);
  for(const name of labels[language])await expect(panel(page).getByRole('switch',{name,exact:true})).toHaveAttribute('aria-checked','true');
  const descriptions=await panel(page).locator('.wsp-settings-feature-description').allTextContents();expect(descriptions).toHaveLength(6);expect(descriptions.every(text=>text.length>0&&!text.endsWith('.'))).toBe(true);
  if(language==='en')expect(descriptions).toEqual(['Adds "Appearance" option to set custom workspace icons','Adds "Appearance" option to set local profile name and picture','Keep navigation without the sidebar brand','Show logos in the selector and model list','Show the selected model logo beside each chat in left sidebar','Keep a reminder until the chat is reopened']);
  await expect(panel(page).getByRole('combobox')).toHaveCount(0);await expect(panel(page).getByRole('button',{name:/Import|Export|Save$/})).toHaveCount(0);
  await expect(panel(page)).not.toContainText(/prototype|demo only|6\/6|Compatible with/i);
  await panel(page).screenshot({path:testInfo.outputPath(`settings-${language}.png`)});
  await tab(page,'recovery',language).click();await expectSelected(page,'recovery',language);await expect(panel(page).getByRole('switch')).toHaveCount(0);
  await expect(panel(page).locator('.wsp-settings-description')).toHaveCount(0);for(const metadata of [enMetadata,ruMetadata])await expect(panel(page)).not.toContainText(metadata.meta.description);
  await expect(sharedRecovery(page).getByRole('heading',{level:3})).toHaveText(language==='en'?'Advanced: recovery copy':'Дополнительно: копия для восстановления');
  const copy=language==='en'?['A limited recovery copy, not a full backup','Includes Workspace appearance and five feature flags only. Profile appearance and unread reminders are separate and are not included.','Copy may contain data saved before an update. No import is available.']:['Копия для восстановления, не полный бэкап','Только оформление Workspaces и пять флагов функций. Оформление профиля и метки непрочитанности хранятся отдельно и в копию не входят.','Копия может содержать данные, сохранённые до обновления. Импорта нет.'];
  expect((await sharedRecovery(page).locator('p').allTextContents()).slice(0,3)).toEqual(copy);for(let index=0;index<3;index++)await expect(sharedRecovery(page).locator('p').nth(index)).toBeVisible();
  await expect(sharedRecovery(page).getByText(language==='en'?'No recovery copy is available.':'Копия для восстановления недоступна.',{exact:true})).toBeVisible();
  await expect(sharedRecovery(page).getByRole('button')).toHaveCount(0);await expect(unreadRecovery(page)).toHaveCount(0);await expect(tabpanel(page,'features',language).getByRole('switch',{includeHidden:true})).toHaveCount(6);await panel(page).screenshot({path:testInfo.outputPath(`settings-recovery-${language}.png`)});
});
for(const language of ['en','ru'])test(`settings tabs expose stable ARIA relationships and full keyboard navigation ${language}`,async({page})=>{
  await mount(page,{language,records:{[LEGACY_BACKUP_KEY]:'{"version":1,"profiles":{},"bindings":{}}'},trackStorage:true});const before=await records(page);
  const list=panel(page).getByRole('tablist',{name:tabs[language].label,exact:true});
  const relations=await list.getByRole('tab').evaluateAll(nodes=>nodes.map(node=>{const target=document.getElementById(node.getAttribute('aria-controls'));return {id:node.id,controls:node.getAttribute('aria-controls'),role:target?.getAttribute('role'),labelledby:target?.getAttribute('aria-labelledby'),tabindex:target?.getAttribute('tabindex')};}));
  expect(new Set(relations.flatMap(({id,controls})=>[id,controls])).size).toBe(4);for(const relation of relations){expect(relation.id).toBeTruthy();expect(relation.controls).toBeTruthy();expect(relation.role).toBe('tabpanel');expect(relation.labelledby).toBe(relation.id);expect(relation.tabindex).toBe('0');}
  await tab(page,'features',language).focus();await page.keyboard.press('Tab');await expect(tabpanel(page,'features',language)).toBeFocused();await page.keyboard.press('Tab');await expect(panel(page).getByRole('switch').first()).toBeFocused();
  await tab(page,'features',language).focus();await page.keyboard.press('ArrowRight');await expectSelected(page,'recovery',language);await expect(tab(page,'recovery',language)).toBeFocused();
  await page.keyboard.press('Tab');await expect(tabpanel(page,'recovery',language)).toBeFocused();await page.keyboard.press('Tab');await expect(sharedRecovery(page).getByRole('button',{name:language==='en'?'Save recovery copy':'Сохранить копию для восстановления',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(tabpanel(page,'recovery',language)).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(tab(page,'recovery',language)).toBeFocused();
  for(const[key,name]of[['ArrowRight','features'],['ArrowLeft','recovery'],['ArrowLeft','features'],['End','recovery'],['Home','features']]){await page.keyboard.press(key);await expectSelected(page,name,language);await expect(tab(page,name,language)).toBeFocused();}
  await tab(page,'recovery',language).focus();await page.keyboard.press('Enter');await expectSelected(page,'recovery',language);await expect(tab(page,'recovery',language)).toBeFocused();
  await tab(page,'features',language).focus();await page.keyboard.press('Space');await expectSelected(page,'features',language);await expect(tab(page,'features',language)).toBeFocused();
  expect(await records(page)).toEqual(before);expect(await page.evaluate(()=>window.settingsStorageWrites)).toEqual([]);
});
for(const scenario of ['fresh','current','legacy'])test(`tab navigation and locale rerender never mutate storage or repeat migration (${scenario})`,async({page})=>{
  const legacy='{"version":1,"profiles":{"saved":{"kind":"emoji","emoji":"📚"}},"bindings":{"w1":"saved"},"features":{"composer":false}}';
  const seed=scenario==='fresh'?{}:{[STORAGE_KEY]:scenario==='legacy'?legacy:'{"version":2,"appearances":{"w1":{"kind":"emoji","emoji":"📚"}},"features":{"composer":false}}',[PROFILE_STORAGE_KEY]:'{"version":1,"enabled":false,"name":"Keep me","image":null}',[UNREAD_STORAGE_KEY]:'{"version":1,"unread":{"other":true}}','unrelated-preference':'keep exact bytes',...(scenario==='current'?{[LEGACY_BACKUP_KEY]:'old raw recovery bytes'}:{})};
  await mount(page,{records:seed,trackStorage:true});const before=await records(page),writes=await page.evaluate(()=>window.settingsStorageWrites),ids=await panel(page).getByRole('tab').evaluateAll(nodes=>nodes.map(node=>({id:node.id,controls:node.getAttribute('aria-controls'),labelledby:document.getElementById(node.getAttribute('aria-controls'))?.getAttribute('aria-labelledby')}))),switches=await panel(page).getByRole('switch').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-checked')));
  if(scenario==='legacy'){expect(JSON.parse(before[STORAGE_KEY]).version).toBe(2);expect(before[LEGACY_BACKUP_KEY]).toBe(legacy);expect(writes.map(({method,args})=>[method,args[0]])).toEqual([['setItem',LEGACY_BACKUP_KEY],['setItem',STORAGE_KEY]]);}else{expect(writes).toEqual([]);expect(before).toEqual(seed);}
  await tab(page,'recovery').click();await page.keyboard.press('ArrowLeft');await page.keyboard.press('End');await expectSelected(page,'recovery');
  await page.evaluate(()=>window.fixture.setLanguage('ru'));await expectSelected(page,'recovery','ru');await expect(panel(page).getByRole('tablist',{name:tabs.ru.label,exact:true})).toBeVisible();
  expect(await panel(page).getByRole('tab').evaluateAll(nodes=>nodes.map(node=>({id:node.id,controls:node.getAttribute('aria-controls'),labelledby:document.getElementById(node.getAttribute('aria-controls'))?.getAttribute('aria-labelledby')})))).toEqual(ids);
  await tab(page,'features','ru').click();expect(await panel(page).getByRole('switch').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-checked')))).toEqual(switches);
  await tab(page,'recovery','ru').click();await page.evaluate(()=>window.fixture.rerenderSettings());await expectSelected(page,'recovery','ru');
  expect(await records(page)).toEqual(before);expect(await page.evaluate(()=>window.settingsStorageWrites)).toEqual(writes);
  await mount(page,{trackStorage:true});await expectSelected(page,'features');expect(await records(page)).toEqual(before);expect(await page.evaluate(()=>window.settingsStorageWrites)).toEqual([]);
});
for(const dark of [true,false])test(`native Switch geometry and styling are not polluted ${dark?'dark':'light'}`,async({page})=>{
  await mount(page,{dark});const control=panel(page).getByRole('switch').first(),reference=page.getByRole('switch',{name:'Native reference',exact:true});
  const styles=node=>{const s=getComputedStyle(node),thumb=getComputedStyle(node.firstElementChild);return {width:s.width,height:s.height,padding:s.padding,border:s.border,borderRadius:s.borderRadius,background:s.backgroundColor,thumbWidth:thumb.width,thumbHeight:thumb.height,thumbBackground:thumb.backgroundColor,transform:thumb.transform};};
  await expect(control).toHaveCSS('width','36px');await expect(control).toHaveCSS('height','20px');await expect(control.locator('span')).toHaveCount(1);
  expect(await control.evaluate(styles)).toEqual(await reference.evaluate(styles));await control.hover();expect(await control.evaluate(styles)).toEqual(await reference.evaluate(styles));
  await control.focus();await page.keyboard.press('Space');await expect(control).toHaveAttribute('aria-checked','false');await expect(control).toBeFocused();
  await reference.click();await expect(reference).toHaveAttribute('aria-checked','false');await expect(control.locator('span')).toHaveCSS('transform','none');await expect(reference.locator('span')).toHaveCSS('transform','none');expect(await control.evaluate(styles)).toEqual(await reference.evaluate(styles));
  await control.focus();await page.keyboard.press('Enter');await expect(control).toHaveAttribute('aria-checked','true');
});
test('Workspace entry is absent from Settings; controls persist through their original independent stores',async({page})=>{
  await mount(page);await expect(panel(page).locator('#wsp-workspace')).toHaveCount(0);await expect(panel(page).getByRole('combobox')).toHaveCount(0);
  for(const name of labels.en)await panel(page).getByRole('switch',{name,exact:true}).click();
  const records=await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),[STORAGE_KEY,PROFILE_STORAGE_KEY,UNREAD_STORAGE_KEY]);
  expect(JSON.parse(records[0]).features).toEqual({workspaces:false,composer:false,sessions:false,unread:false,branding:false});expect(JSON.parse(records[1]).enabled).toBe(false);expect(records[2]).toBeNull();
  await page.reload();await page.addStyleTag({content:fixture.css});await page.addScriptTag({content:fixture.js});await page.evaluate(()=>window.settingsFixture.mount());
  for(const name of labels.en)await expect(panel(page).getByRole('switch',{name,exact:true})).toHaveAttribute('aria-checked','false');
});
test('failed shared preference write leaves the native controlled switch and saved bytes unchanged; retry works',async({page})=>{
  await mount(page);await page.evaluate(key=>window.settingsFixture.failWrites(key),STORAGE_KEY);const control=panel(page).getByRole('switch',{name:'Workspace appearance',exact:true});await control.click();
  await expect(control).toHaveAttribute('aria-checked','true');await expect(panel(page).getByRole('alert')).toContainText('fixture quota');expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBeNull();
  await tab(page,'recovery').click();await expect(panel(page).getByRole('alert')).toContainText('fixture quota');await expect(panel(page).getByRole('alert')).toBeVisible();await expect(sharedRecovery(page).getByRole('button')).toHaveCount(0);
  await tab(page,'features').click();await expect(control).toHaveAttribute('aria-checked','true');expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBeNull();
  await page.evaluate(()=>window.settingsFixture.restoreWrites());await control.click();await expect(control).toHaveAttribute('aria-checked','false');await expect(panel(page).getByRole('alert')).toHaveCount(0);
});
test('profile write error disables its switch until the original profile retry path recovers',async({page})=>{
  await mount(page);await page.evaluate(key=>window.settingsFixture.failWrites(key),PROFILE_STORAGE_KEY);const control=panel(page).getByRole('switch',{name:'Profile appearance',exact:true});await control.click();
  await expect(control).toBeDisabled();await expect(control).toHaveAttribute('aria-checked','true');expect(await page.evaluate(key=>localStorage.getItem(key),PROFILE_STORAGE_KEY)).toBeNull();
  const retry=tabpanel(page,'features').getByRole('button',{name:'Retry reading saved settings',exact:true});await expect(retry).toBeVisible();
  await tab(page,'recovery').click();await expect(retry).toBeHidden();await expect(panel(page).getByRole('button',{name:'Retry reading saved settings',exact:true})).toHaveCount(0);await expect(panel(page).getByRole('alert')).toContainText('Profile appearance could not be saved');
  await tab(page,'features').click();await page.evaluate(()=>window.settingsFixture.restoreWrites());await retry.click();await expect(control).toBeEnabled();await control.click();await expect(control).toHaveAttribute('aria-checked','false');
});
test('legacy recovery copy is immediately expanded in Recovery with its original bytes and no import',async({page})=>{
  const backup=' {"version":1,"profiles":{},"bindings":{}}\r\n';await mount(page,{records:{[LEGACY_BACKUP_KEY]:backup}});const before=await records(page);
  await expectSelected(page,'features');await expect(sharedRecovery(page)).toBeHidden();await expect(panel(page).getByRole('button',{name:'Save recovery copy',exact:true})).not.toBeVisible();
  await tab(page,'recovery').click();await expectSelected(page,'recovery');await expect(panel(page).locator('details,summary')).toHaveCount(0);
  const recovery=sharedRecovery(page);await expect(recovery.getByRole('heading',{level:3})).toHaveText('Advanced: recovery copy');await expect(recovery).toContainText('five feature flags only');await expect(recovery).toContainText('Profile appearance and unread reminders');await expect(recovery).toContainText('No import is available');
  for(let index=0;index<3;index++)await expect(recovery.locator('p').nth(index)).toBeVisible();await expect(recovery.getByRole('button')).toHaveCount(1);await expect(recovery.getByText('No recovery copy is available.',{exact:true})).toHaveCount(0);
  await expectDownload(page,recovery,'tinker-recovery.json',backup);expect(await records(page)).toEqual(before);await expect(unreadRecovery(page)).toHaveCount(0);await expect(panel(page).getByRole('button',{name:/import|export/i})).toHaveCount(0);
});
for(const scenario of ['fresh','current'])test(`healthy ${scenario} settings expose empty Recovery without save/reset/import/export`,async({page})=>{
  const seed=scenario==='fresh'?{}:{[STORAGE_KEY]:'{"version":2,"appearances":{},"features":{"composer":false}}'};await mount(page,{records:seed});
  await expectSelected(page,'features');await tab(page,'recovery').click();await expectSelected(page,'recovery');await expect(sharedRecovery(page).getByText('No recovery copy is available.',{exact:true})).toBeVisible();
  await expect(sharedRecovery(page).getByRole('heading',{level:3})).toHaveText('Advanced: recovery copy');await expect(panel(page).locator('details,summary,input[type=file]')).toHaveCount(0);await expect(tabpanel(page,'recovery').getByRole('button')).toHaveCount(0);await expect(unreadRecovery(page)).toHaveCount(0);
  expect(await records(page)).toEqual(seed);
});
test('profile read error and its retry remain in Features, not Recovery',async({page})=>{
  const raw='{bad-profile';await mount(page,{records:{[PROFILE_STORAGE_KEY]:raw}});const before=await records(page),features=tabpanel(page,'features'),retry=features.getByRole('button',{name:'Retry reading saved settings',exact:true});
  await expect(features.getByRole('alert')).toContainText('Saved profile appearance is invalid');await expect(retry).toBeVisible();await expect(features.getByRole('switch',{name:'Profile appearance',exact:true})).toBeDisabled();
  await tab(page,'recovery').click();await expect(panel(page).getByRole('alert')).toHaveCount(0);await expect(panel(page).getByRole('button',{name:'Retry reading saved settings',exact:true})).toHaveCount(0);await expect(sharedRecovery(page).getByRole('button')).toHaveCount(0);expect(await records(page)).toEqual(before);
  const valid='{"version":1,"enabled":false,"name":"Keep me","image":null}';await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROFILE_STORAGE_KEY,value:valid});await tab(page,'features').click();await retry.click();
  await expect(features.getByRole('alert')).toHaveCount(0);await expect(features.getByRole('switch',{name:'Profile appearance',exact:true})).toBeEnabled();await expect(features.getByRole('switch',{name:'Profile appearance',exact:true})).toHaveAttribute('aria-checked','false');expect(await records(page)).toEqual({[PROFILE_STORAGE_KEY]:valid});
});
test('corrupt shared data uses existing raw recovery/reset and preserves separate profile/unread records',async({page})=>{
  const profile=JSON.stringify({version:1,enabled:true,name:'Keep me',image:null}),unread=JSON.stringify({version:1,unread:{other:true}}),raw='{invalid';
  await mount(page,{records:{[STORAGE_KEY]:raw,[PROFILE_STORAGE_KEY]:profile,[UNREAD_STORAGE_KEY]:unread}});const before=await records(page);await expect(panel(page).getByRole('alert')).toBeVisible();
  await tab(page,'recovery').click();const recovery=sharedRecovery(page);await expect(panel(page).getByRole('alert')).toBeVisible();await expect(recovery.getByRole('button')).toHaveCount(3);await expect(unreadRecovery(page)).toHaveCount(0);await expectDownload(page,recovery,'tinker-recovery.json',raw);
  await recovery.getByRole('button',{name:'Retry reading saved settings',exact:true}).click();expect(await records(page)).toEqual(before);
  await resetRecovery(page,recovery,sharedResetConfirm,false);expect(await records(page)).toEqual(before);await resetRecovery(page,recovery,sharedResetConfirm);
  await expectSelected(page,'recovery');await expect(panel(page).getByRole('alert')).toHaveCount(0);await expect(recovery.getByRole('button')).toHaveCount(0);await expect(recovery.getByText('No recovery copy is available.',{exact:true})).toBeVisible();await expect(panel(page).locator('details,summary')).toHaveCount(0);
  const after=await records(page);expect(after[PROFILE_STORAGE_KEY]).toBe(profile);expect(after[UNREAD_STORAGE_KEY]).toBe(unread);expect(after[LEGACY_BACKUP_KEY]).toBeUndefined();expect(JSON.parse(after[STORAGE_KEY])).toEqual({version:2,appearances:{},features:{workspaces:true,composer:true,sessions:true,unread:true,branding:true}});
});
test('unread error retains its separate recovery download and retry/reset controls',async({page})=>{
  const shared='{"version":2,"appearances":{},"features":{"composer":false}}',profile='{"version":1,"enabled":false,"name":"Keep me","image":null}',raw='{bad-unread';
  await mount(page,{records:{[STORAGE_KEY]:shared,[PROFILE_STORAGE_KEY]:profile,[UNREAD_STORAGE_KEY]:raw}});const before=await records(page);await expect(panel(page).getByRole('alert')).toContainText('Unread reminders could not be read');await expect(unreadRecovery(page)).toBeHidden();
  await tab(page,'recovery').click();const recovery=unreadRecovery(page);await expect(panel(page).getByRole('alert')).toContainText('Unread reminders could not be read');await expect(panel(page).getByRole('alert')).toBeVisible();await expect(sharedRecovery(page).getByRole('button')).toHaveCount(0);await expectDownload(page,recovery,'tinker-unread-recovery.json',raw);
  await expect(recovery.getByRole('button',{name:'Retry reading saved settings',exact:true})).toBeVisible();await expect(recovery.getByRole('button',{name:'Reset plugin settings',exact:true})).toBeVisible();await recovery.getByRole('button',{name:'Retry reading saved settings',exact:true}).click();expect(await records(page)).toEqual(before);
  await resetRecovery(page,recovery,unreadResetConfirm,false);expect(await records(page)).toEqual(before);await resetRecovery(page,recovery,unreadResetConfirm);await expect(recovery).toHaveCount(0);await expect(panel(page).getByRole('alert')).toHaveCount(0);expect(await records(page)).toEqual({[STORAGE_KEY]:shared,[PROFILE_STORAGE_KEY]:profile});
});
test('combined shared and unread corruption keeps scoped downloads, retries and resets independent',async({page},testInfo)=>{
  const shared='\r\n{bad-shared: "сохранить"}\n',unread=' {bad-unread\r\n',legacy='old recovery bytes\r\n',profile='{"version":1,"enabled":false,"name":"Keep me","image":null}';
  await mount(page,{records:{[STORAGE_KEY]:shared,[UNREAD_STORAGE_KEY]:unread,[LEGACY_BACKUP_KEY]:legacy,[PROFILE_STORAGE_KEY]:profile}});const before=await records(page),alerts=panel(page).getByRole('alert');await expect(alerts).toHaveCount(2);const messages=await alerts.allTextContents();
  await tab(page,'recovery').click();await expect(alerts).toHaveText(messages);for(let index=0;index<2;index++)await expect(alerts.nth(index)).toBeVisible();const sharedControls=sharedRecovery(page),unreadControls=unreadRecovery(page);
  await expect(sharedControls).toHaveCount(1);await expect(unreadControls).toHaveCount(1);await expect(sharedControls.getByRole('button')).toHaveCount(3);await expect(unreadControls.getByRole('button')).toHaveCount(3);
  const unreadHeading=unreadControls.getByRole('heading',{name:'Unread reminders',level:3,exact:true});await expect(unreadHeading).toBeVisible();const headingId=await unreadHeading.getAttribute('id');expect(headingId).toBeTruthy();await expect(unreadControls).toHaveAttribute('aria-labelledby',headingId);await panel(page).screenshot({path:testInfo.outputPath('settings-combined-recovery-en.png')});
  await page.evaluate(()=>window.fixture.setLanguage('ru'));await expectSelected(page,'recovery','ru');const ruHeading=unreadControls.getByRole('heading',{name:'Метки непрочитанности',level:3,exact:true});await expect(ruHeading).toBeVisible();await expect(ruHeading).toHaveAttribute('id',headingId);await panel(page).screenshot({path:testInfo.outputPath('settings-combined-recovery-ru.png')});
  await page.evaluate(()=>window.fixture.setLanguage('en'));await expectSelected(page,'recovery');await expect(alerts).toHaveText(messages);
  await expectDownload(page,sharedControls,'tinker-recovery.json',shared);await expectDownload(page,unreadControls,'tinker-unread-recovery.json',unread);expect(await records(page)).toEqual(before);
  for(const controls of [sharedControls,unreadControls])await controls.getByRole('button',{name:'Retry reading saved settings',exact:true}).click();expect(await records(page)).toEqual(before);await expect(alerts).toHaveText(messages);
  await resetRecovery(page,sharedControls,sharedResetConfirm,false);expect(await records(page)).toEqual(before);await resetRecovery(page,sharedControls,sharedResetConfirm);await expect(alerts).toHaveCount(1);await expect(alerts).toContainText('Unread reminders could not be read');await expect(sharedControls.getByRole('button')).toHaveCount(1);await expect(unreadControls.getByRole('button')).toHaveCount(3);
  const afterShared=await records(page);expect(afterShared[UNREAD_STORAGE_KEY]).toBe(unread);expect(afterShared[PROFILE_STORAGE_KEY]).toBe(profile);expect(afterShared[LEGACY_BACKUP_KEY]).toBe(legacy);expect(JSON.parse(afterShared[STORAGE_KEY])).toEqual({version:2,appearances:{},features:{workspaces:true,composer:true,sessions:true,unread:true,branding:true}});
  await expectDownload(page,sharedControls,'tinker-recovery.json',legacy);await expectDownload(page,unreadControls,'tinker-unread-recovery.json',unread);await resetRecovery(page,unreadControls,unreadResetConfirm,false);expect(await records(page)).toEqual(afterShared);await resetRecovery(page,unreadControls,unreadResetConfirm);await expect(unreadControls).toHaveCount(0);await expect(alerts).toHaveCount(0);
  const afterUnread={...afterShared};delete afterUnread[UNREAD_STORAGE_KEY];expect(await records(page)).toEqual(afterUnread);
});
