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
async function mount(page,{language='en',dark=true,records={}}={}) {
  await page.route('https://settings.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="settings" style="width:620px;padding:24px 30px"></div><div id="overlay"></div><div id="marker"></div><div id="reference"></div></body></html>'}));
  await page.goto('https://settings.test/');await page.addStyleTag({content:fixture.css});
  await page.evaluate(({dark,records})=>{if(dark)document.body.setAttribute('data-ds-dark-theme','');for(const[key,value]of Object.entries(records))localStorage.setItem(key,value);},{dark,records});
  await page.addScriptTag({content:fixture.js});await page.evaluate(language=>window.settingsFixture.mount(language),language);await expect(panel(page).getByRole('heading',{name:'Tinker',exact:true})).toBeVisible();
}
const labels={en:['Workspace appearance','Profile appearance','Hide Deepseek Harness logo','In the model picker','Beside chats','Mark as unread'],ru:['Оформление Workspaces','Оформление профиля','Скрывать логотип Deepseek Harness','В выборе модели','Рядом с чатами','Метка непрочитанности']};
for(const language of ['en','ru'])test(`approved A grouped settings and exact metadata copy ${language}`,async({page},testInfo)=>{
  await mount(page,{language});await expect(panel(page).locator('.wsp-settings-description')).toHaveText((language==='en'?enMetadata:ruMetadata).meta.description);
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
  await page.evaluate(()=>window.settingsFixture.restoreWrites());await control.click();await expect(control).toHaveAttribute('aria-checked','false');await expect(panel(page).getByRole('alert')).toHaveCount(0);
});
test('profile write error disables its switch until the original profile retry path recovers',async({page})=>{
  await mount(page);await page.evaluate(key=>window.settingsFixture.failWrites(key),PROFILE_STORAGE_KEY);const control=panel(page).getByRole('switch',{name:'Profile appearance',exact:true});await control.click();
  await expect(control).toBeDisabled();await expect(control).toHaveAttribute('aria-checked','true');expect(await page.evaluate(key=>localStorage.getItem(key),PROFILE_STORAGE_KEY)).toBeNull();
  await page.evaluate(()=>window.settingsFixture.restoreWrites());await panel(page).getByRole('button',{name:'Retry reading saved settings',exact:true}).click();await expect(control).toBeEnabled();await control.click();await expect(control).toHaveAttribute('aria-checked','false');
});
test('healthy settings hide recovery; migration copy reveals collapsed limited-scope recovery without import',async({page})=>{
  const backup='{"version":1,"profiles":{},"bindings":{}}';await mount(page,{records:{[LEGACY_BACKUP_KEY]:backup}});
  const details=panel(page).locator('details');await expect(details).toHaveCount(1);expect(await details.getAttribute('open')).toBeNull();await expect(panel(page).getByRole('button',{name:'Save recovery copy',exact:true})).not.toBeVisible();
  await details.locator('summary').click();await expect(details).toContainText('five feature flags only');await expect(details).toContainText('Profile appearance and unread reminders');await expect(details).toContainText('No import is available');
  const download=page.waitForEvent('download');await details.getByRole('button',{name:'Save recovery copy',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toBe('tinker-recovery.json');expect(await readFile(await file.path(),'utf8')).toBe(backup);
});
test('healthy fresh settings do not invent a recovery/export panel',async({page})=>{await mount(page);await expect(panel(page).locator('details')).toHaveCount(0);await expect(panel(page).getByRole('button',{name:/recovery|import|export/i})).toHaveCount(0);});
test('corrupt shared data uses existing raw recovery/reset and preserves separate profile/unread records',async({page})=>{
  const profile=JSON.stringify({version:1,enabled:true,name:'Keep me',image:null}),unread=JSON.stringify({version:1,unread:{other:true}});
  await mount(page,{records:{[STORAGE_KEY]:'{invalid',[PROFILE_STORAGE_KEY]:profile,[UNREAD_STORAGE_KEY]:unread}});const details=panel(page).locator('details');await details.locator('summary').click();
  const download=page.waitForEvent('download');await details.getByRole('button',{name:'Save recovery copy',exact:true}).click();expect(await readFile(await(await download).path(),'utf8')).toBe('{invalid');
  page.once('dialog',dialog=>dialog.accept());await details.getByRole('button',{name:'Reset plugin settings',exact:true}).click();await expect(panel(page).locator('details')).toHaveCount(0);
  expect(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),[PROFILE_STORAGE_KEY,UNREAD_STORAGE_KEY])).toEqual([profile,unread]);
});
test('unread error retains its separate recovery download and retry/reset controls',async({page})=>{
  await mount(page,{records:{[UNREAD_STORAGE_KEY]:'{bad-unread'}});await expect(panel(page).getByRole('alert')).toContainText('Unread reminders could not be read');
  const download=page.waitForEvent('download');await panel(page).getByRole('button',{name:'Save recovery copy',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toBe('tinker-unread-recovery.json');expect(await readFile(await file.path(),'utf8')).toBe('{bad-unread');
  await expect(panel(page).getByRole('button',{name:'Retry reading saved settings',exact:true})).toBeVisible();await expect(panel(page).getByRole('button',{name:'Reset plugin settings',exact:true})).toBeVisible();
});
