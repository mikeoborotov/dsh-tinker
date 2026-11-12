import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildFixture } from '../build-fixture.mjs';
import samples from '../image-fixtures.json' with { type:'json' };
import { PROFILE_STORAGE_KEY } from '../../src/profile-store.js';

// Source-shaped 0.2.2-rc.1 account DOM/Menu model, NOT installed-host acceptance.
// Modal/Button use the existing exact 0.2.0-rc.2 fixture. See profile-fixture.jsx.
let fixture, html;
const screenshots=process.env.WSP_PROFILE_SCREENSHOT_DIR;
const png='data:image/png;base64,'+samples.png.base64;
const trigger=page=>page.locator('[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-signed-out]');
const customName=page=>page.locator('[data-wsp-profile-name]');
const customImage=page=>page.locator('img[data-wsp-profile-avatar]');
const dialog=page=>page.getByRole('dialog');
const input=(page,language='en')=>dialog(page).getByRole('textbox',{name:language==='en'?'Profile name':'Имя профиля',exact:true});
const nativeMenu=page=>page.getByRole('menu').filter({has:page.getByRole('menuitem',{name:'Settings',exact:true})});
const storage=page=>page.evaluate(key=>localStorage.getItem(key),PROFILE_STORAGE_KEY);
const prefs=page=>page.evaluate(()=>window.profileFixture.preferences());
const errors=new WeakMap();

test.beforeAll(async()=>{[fixture,html]=await Promise.all([buildFixture('tests/profile-fixture.jsx'),readFile(new URL('../profile-fixture.html',import.meta.url),'utf8')]);if(screenshots)await mkdir(screenshots,{recursive:true});});
test.beforeEach(({page})=>{const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function attach(page,{dark=true,native={},seed}={}) {
  await page.addStyleTag({content:fixture.css});
  await page.evaluate(({dark,seed,key})=>{if(dark)document.body.setAttribute('data-ds-dark-theme','');if(seed)localStorage.setItem(key,JSON.stringify(seed));},{dark,seed,key:PROFILE_STORAGE_KEY});
  await page.addScriptTag({content:fixture.js});await page.evaluate(options=>window.profileFixture.mount(options),native);
  await expect(trigger(page).first()).toBeVisible();
}
async function setup(page,options={}) {
  await page.route('https://profile.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://profile.test/');await attach(page,options);
}
async function menu(page,language='en') {
  await trigger(page).first().click();
  await expect(page.getByRole('menuitem',{name:language==='en'?'Customize profile':'Настроить профиль',exact:true})).toBeVisible();
}
async function open(page,language='en') {
  await menu(page,language);await page.getByRole('menuitem',{name:language==='en'?'Customize profile':'Настроить профиль',exact:true}).click();
  await expect(dialog(page)).toBeVisible();await expect(page.getByRole('menu')).toHaveCount(0);
}
async function save(page,name,language='en') { await input(page,language).fill(name);await dialog(page).getByRole('button',{name:language==='en'?'Save':'Сохранить',exact:true}).click();await expect(dialog(page)).toHaveCount(0); }
async function transfer(page,extension='png') {
  const sample=samples[extension];
  return page.evaluateHandle(({sample,extension})=>{const value=new DataTransfer();value.items.add(new File([Uint8Array.from(atob(sample.base64),byte=>byte.charCodeAt(0))],'sample.'+extension,{type:sample.mime}));return value;},{sample,extension});
}
async function drop(page,target,extension='png') {
  const value=await transfer(page,extension);
  await target.dispatchEvent('dragenter',{dataTransfer:value});await target.dispatchEvent('dragover',{dataTransfer:value});await target.dispatchEvent('drop',{dataTransfer:value});await value.dispose();
}

// Native nodes and listeners stay authoritative: unknown ids would increment signout.
test('native actions/order/node identity survive an additive Customize item without accidental logout',async({page})=>{
  await setup(page);await trigger(page).click();
  await expect(page.getByRole('menuitem')).toHaveText(['SettingsCtrl+,','Feedback','Customize profile','Sign out']);
  await page.evaluate(()=>window.profileFixture.captureNodes());
  await page.evaluate(()=>window.profileFixture.save('Local Alice'));
  await expect(customName(page)).toHaveText('Local Alice');
  expect(await page.evaluate(()=>window.profileFixture.sameNodes())).toBe(true);
  await page.getByRole('menuitem',{name:'Customize profile',exact:true}).click();await expect(dialog(page)).toBeVisible();
  expect(await page.evaluate(()=>window.profileFixture.counters())).toEqual({settings:0,feedback:0,signout:0,signin:0});
  await page.keyboard.press('Escape');await expect(trigger(page)).toBeFocused();
  await menu(page);await page.getByRole('menuitem',{name:'Settings',exact:false}).click();
  await expect(page.locator('#settings [role="switch"]')).toHaveCount(6);
  await expect(page.locator('#settings input[type="file"],#settings [data-wsp-profile-avatar],#settings input[placeholder="Profile name"]')).toHaveCount(0);
  await expect(page.locator('#settings')).not.toContainText('Customize profile');
  await menu(page);await page.getByRole('menuitem',{name:'Feedback',exact:true}).click();
  await menu(page);await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();
  expect(await page.evaluate(()=>window.profileFixture.counters())).toEqual({settings:1,feedback:1,signout:1,signin:0});
});

test('current DOM rows share native keyboard walk, Enter/Tab activation, Escape and focus return',async({page})=>{
  await setup(page);await menu(page);
  await expect(page.getByRole('menuitem',{name:'Settings',exact:false})).toBeFocused();
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Sign out',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:'Settings',exact:false})).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'Feedback',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'Customize profile',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');await expect(input(page)).toBeFocused();await page.keyboard.press('Escape');await expect(trigger(page)).toBeFocused();
  await menu(page);await page.keyboard.press('End');await page.keyboard.press('ArrowUp');await page.keyboard.press('Tab');
  await expect(dialog(page)).toBeVisible();await page.keyboard.press('Escape');await expect(trigger(page)).toBeFocused();
  await menu(page);await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(trigger(page)).toBeFocused();
  expect((await page.evaluate(()=>window.profileFixture.counters())).signout).toBe(0);
});

test('native busy auth action cannot be bypassed by opening another editor',async({page})=>{
  await setup(page);await menu(page);await page.evaluate(()=>window.profileFixture.update({busy:true}));
  await expect(page.getByRole('menuitem',{name:'Sign out',exact:true})).toBeDisabled();await expect(page.getByRole('menuitem',{name:'Customize profile',exact:true})).toBeDisabled();
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Feedback',exact:true})).toBeFocused();
  await page.evaluate(()=>window.profileFixture.update({busy:false}));await page.getByRole('menuitem',{name:'Customize profile',exact:true}).click();await expect(dialog(page)).toBeVisible();expect((await page.evaluate(()=>window.profileFixture.counters())).signout).toBe(0);
});

test('name and independent normalized image survive reload; Cancel and staged reset do not write',async({page})=>{
  await setup(page);await open(page);
  await expect(input(page)).toHaveValue('Native Alice');
  await input(page).fill('Local Alice');
  const chooser=page.waitForEvent('filechooser');await dialog(page).getByRole('button',{name:'Choose a profile image',exact:true}).click();
  await (await chooser).setFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(samples.png.base64,'base64')});
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog(page)).toHaveCount(0);
  await expect(customName(page)).toHaveText('Local Alice');await expect(customImage(page)).toHaveAttribute('src',/^data:image\/png;base64,/);
  const durable=await storage(page);expect(JSON.parse(durable).image).toMatch(/^data:image\/png;base64,/);
  await page.reload();await attach(page);await expect(customName(page)).toHaveText('Local Alice');await expect(customImage(page)).toHaveAttribute('src',JSON.parse(durable).image);
  await open(page);await input(page).fill('Cancelled');await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();expect(await storage(page)).toBe(durable);
  await open(page);await dialog(page).getByRole('button',{name:'Reset to DeepSeek account details',exact:true}).click();await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();expect(await storage(page)).toBe(durable);
  await open(page);await dialog(page).getByRole('button',{name:'Reset to DeepSeek account details',exact:true}).click();await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(customName(page)).toHaveCount(0);await expect(customImage(page)).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_label')).toBeVisible();
  expect(await prefs(page)).toMatchObject({name:null,image:null,enabled:true,error:null});
});

test('unchanged native defaults and generic signed-in labels never become a local override',async({page})=>{
  await setup(page,{native:{generic:true}});await open(page);await expect(input(page)).toHaveValue('');await expect(input(page)).toHaveAttribute('placeholder','Profile name');
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();expect((await prefs(page)).name).toBeNull();
  await page.evaluate(()=>window.profileFixture.update({generic:false,name:'Fresh baseline'}));await open(page);await expect(input(page)).toHaveValue('Fresh baseline');
  await dialog(page).getByRole('button',{name:'Save',exact:true}).click();expect((await prefs(page)).name).toBeNull();await expect(customName(page)).toHaveCount(0);
});

test('disable restores latest native nodes and styles, retains saved values, and closes H',async({page})=>{
  await setup(page);await page.evaluate(()=>{document.querySelector('._5Qcc8a_label').style.display='inline';window.profileFixture.captureNodes();window.profileFixture.save('Local',null);});
  await expect(customName(page)).toHaveText('Local');await page.evaluate(()=>window.profileFixture.update({name:'Native latest',image:null}));
  await open(page);await page.evaluate(()=>window.profileFixture.toggle(false));await expect(dialog(page)).toHaveCount(0);
  await expect(customName(page)).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_label')).toHaveText('Native latest');await expect(trigger(page).locator('._5Qcc8a_label')).toBeVisible();
  // A flex item blockifies computed display:inline; its authored inline style must survive exactly.
  expect(await trigger(page).locator('._5Qcc8a_label').evaluate(element=>element.style.display)).toBe('inline');
  expect(await page.evaluate(()=>window.profileFixture.sameNodes())).toBe(true);expect((await prefs(page)).name).toBe('Local');
  await trigger(page).click();await expect(page.getByRole('menuitem')).toHaveCount(3);await page.keyboard.press('Escape');
  await page.evaluate(()=>window.profileFixture.toggle(true));await expect(customName(page)).toHaveText('Local');
});

test('signed out keeps native More/ellipsis and sign-in action; shared appearance returns after sign-in',async({page})=>{
  await setup(page);await page.evaluate(()=>window.profileFixture.save('Shared',null));await open(page);
  await page.evaluate(()=>window.profileFixture.update({signedIn:false}));await expect(dialog(page)).toHaveCount(0);await expect(customName(page)).toHaveCount(0);await expect(customImage(page)).toHaveCount(0);
  await expect(trigger(page).locator('._5Qcc8a_label')).toHaveText('More');await expect(trigger(page).locator('._5Qcc8a_avatar')).toHaveCount(0);
  await trigger(page).click();await expect(page.getByRole('menuitem')).toHaveCount(3);await page.getByRole('menuitem',{name:'Sign in',exact:true}).click();
  expect((await page.evaluate(()=>window.profileFixture.counters())).signin).toBe(1);
  await page.evaluate(()=>window.profileFixture.update({signedIn:true,name:'Other native account'}));await expect(customName(page)).toHaveText('Shared');
});

test('known collapsed launcher keeps custom avatar/menu but never projects a visible profile name',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:png},native:{wide:false}});
  await expect(customImage(page)).toBeVisible();await expect(customName(page)).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_label')).toHaveCount(0);
  await open(page);await expect(input(page)).toHaveValue('Local');await page.keyboard.press('Escape');
  await page.evaluate(()=>window.profileFixture.update({wide:true}));await expect(customName(page)).toHaveText('Local');
});

for(const failure of ['wrong','competing'])test(`${failure} popup fails closed without touching any native actions; a new valid opening recovers`,async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:png}});await expect(customName(page)).toHaveText('Local');
  await page.evaluate(failure=>window.profileFixture.update(failure==='wrong'?{menuKind:'wrong'}:{competing:true}),failure);
  await trigger(page).click();await expect(page.getByRole('menu')).toHaveCount(failure==='wrong'?1:2);await expect(page.locator('[data-wsp-profile-menu]')).toHaveCount(0);await expect(customName(page)).toHaveCount(0);await expect(customImage(page)).toHaveCount(0);
  expect((await page.evaluate(()=>window.profileFixture.counters())).signout).toBe(0);
  await page.keyboard.press('Escape');await page.evaluate(()=>window.profileFixture.update({menuKind:'native',competing:false}));await menu(page);await expect(customName(page)).toHaveText('Local');
});

test('preexisting foreign popup is never adopted and native popup remains unchanged on ambiguity',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:null}});
  await page.evaluate(()=>{const foreign=document.createElement('div');foreign.id='foreign-menu';foreign.className='fixture-other-menu';foreign.setAttribute('role','menu');foreign.innerHTML='<button role="menuitem">Existing foreign action</button>';document.body.append(foreign);});
  await trigger(page).click();await expect(page.getByRole('menu')).toHaveCount(2);await expect(page.locator('[data-wsp-profile-menu]')).toHaveCount(0);await expect(customName(page)).toHaveCount(0);
  await expect(page.locator('#foreign-menu')).toHaveText('Existing foreign action');expect((await page.evaluate(()=>window.profileFixture.counters())).signout).toBe(0);
  await page.keyboard.press('Escape');await page.evaluate(()=>document.getElementById('foreign-menu').remove());await menu(page);await expect(customName(page)).toHaveText('Local');
});

test('removing a focused owned menu row restores a keyboard anchor for native actions',async({page})=>{
  await setup(page);await menu(page);await page.keyboard.press('End');await page.keyboard.press('ArrowUp');await expect(page.getByRole('menuitem',{name:'Customize profile',exact:true})).toBeFocused();
  await page.evaluate(()=>window.profileFixture.toggle(false));await expect(page.getByRole('menuitem')).toHaveCount(3);await expect(trigger(page)).toBeFocused();
  await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:'Settings',exact:false})).toBeFocused();await page.keyboard.press('Escape');await expect(trigger(page)).toBeFocused();
});

test('local image error immediately reveals the current replaced native IMG, not the stale original SVG',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:png}});await expect(customImage(page)).toBeVisible();
  await page.evaluate(image=>window.profileFixture.update({image}),png);
  const native=trigger(page).locator('._5Qcc8a_avatar>img:not([data-wsp-profile-owned])');await expect(native).toHaveCount(1);await expect(native).toHaveAttribute('data-wsp-profile-native-hidden',/./);
  await expect.poll(()=>native.evaluate(element=>element.naturalWidth)).toBeGreaterThan(0);
  await native.evaluate(element=>{window.currentNativePicture=element;window.currentNativeStyle=element.getAttribute('style');});
  await customImage(page).dispatchEvent('error');
  expect(await native.evaluate(element=>({same:element===window.currentNativePicture,style:element.getAttribute('style')===window.currentNativeStyle,hidden:element.hasAttribute('data-wsp-profile-native-hidden'),own:element.parentElement.querySelectorAll('[data-wsp-profile-avatar]').length}))).toEqual({same:true,style:true,hidden:false,own:0});
  await expect(native).toBeVisible();await expect(customName(page)).toHaveText('Local');
});

test('failed local image returns to native avatar and is not retried on unrelated native mutations',async({page})=>{
  const broken='data:image/png;base64,'+Buffer.from(samples.png.base64,'base64').subarray(0,33).toString('base64');
  await setup(page,{seed:{version:1,enabled:true,name:null,image:broken}});
  await expect(customImage(page)).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_avatar>svg')).toBeVisible();
  await page.evaluate(()=>window.profileFixture.update({name:'Fresh after image error'}));await expect(trigger(page).locator('._5Qcc8a_label')).toHaveText('Fresh after image error');
  await expect(customImage(page)).toHaveCount(0);await expect(trigger(page).locator('[data-wsp-profile-native-hidden]')).toHaveCount(0);
});

test('unknown source classes and multiple launchers restore native projection instead of guessing',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:png}});await expect(customName(page)).toHaveText('Local');
  await page.evaluate(()=>window.profileFixture.update({known:false}));await expect(customName(page)).toHaveCount(0);await expect(customImage(page)).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_label')).toBeVisible();
  await page.evaluate(()=>window.profileFixture.update({known:true}));await expect(customName(page)).toHaveText('Local');
  await page.evaluate(()=>window.profileFixture.update({duplicate:true}));await expect(trigger(page)).toHaveCount(2);await expect(customName(page)).toHaveCount(0);
  await page.evaluate(()=>window.profileFixture.update({duplicate:false}));await expect(customName(page)).toHaveText('Local');
});

test('native image/text replacements and menu remounts stay native; disconnect/remount/disposal close stale editor',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Local',image:png}});await expect(customName(page)).toHaveText('Local');
  await page.evaluate(image=>window.profileFixture.update({name:'Fresh native',image}),png);
  await menu(page);await page.evaluate(()=>window.profileFixture.update({menuRemount:1}));await expect(page.getByRole('menuitem',{name:'Customize profile',exact:true})).toHaveCount(1);
  await page.getByRole('menuitem',{name:'Customize profile',exact:true}).click();await expect(dialog(page)).toBeVisible();
  await page.evaluate(()=>window.profileFixture.update({remount:1}));await expect(dialog(page)).toHaveCount(0);await expect(customName(page)).toHaveText('Local');
  await open(page);await page.evaluate(()=>window.profileFixture.update({mounted:false}));await expect(dialog(page)).toHaveCount(0);await expect(customName(page)).toHaveCount(0);
  await page.evaluate(()=>window.profileFixture.update({mounted:true}));await expect(customName(page)).toHaveText('Local');await menu(page);
  await page.evaluate(()=>window.profileFixture.disposePlugin());await expect(page.locator('[data-wsp-profile-owned],[data-wsp-profile-native-hidden]')).toHaveCount(0);await expect(trigger(page).locator('._5Qcc8a_label')).toHaveText('Fresh native');await expect(trigger(page).locator('._5Qcc8a_label')).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveCount(3);await expect(page.locator('style[data-wsp-owned]')).toHaveCount(0);
});

test('pending native close cannot reopen H after disable or plugin disposal',async({page})=>{
  await setup(page,{native:{delayClose:150}});await menu(page);await page.getByRole('menuitem',{name:'Customize profile',exact:true}).click();await page.evaluate(()=>window.profileFixture.toggle(false));
  await expect(page.getByRole('menu')).toHaveCount(0);await expect(dialog(page)).toHaveCount(0);
  await page.evaluate(()=>window.profileFixture.toggle(true));await menu(page);await page.getByRole('menuitem',{name:'Customize profile',exact:true}).click();await page.evaluate(()=>window.profileFixture.disposePlugin());
  await expect(page.getByRole('menu')).toHaveCount(0);await expect(dialog(page)).toHaveCount(0);expect((await page.evaluate(()=>window.profileFixture.counters())).signout).toBe(0);
});

test('RU native/menu translation updates while open and settings contains one toggle only',async({page})=>{
  await setup(page);await menu(page);await page.evaluate(()=>window.profileFixture.language('ru'));
  await expect(page.getByRole('menuitem')).toHaveText(['НастройкиCtrl+,','Обратная связь','Настроить профиль','Выйти']);
  await page.getByRole('menuitem',{name:'Настроить профиль',exact:true}).click();await expect(input(page,'ru')).toBeVisible();await expect(input(page,'ru')).toHaveAttribute('placeholder','Имя профиля');await page.keyboard.press('Escape');
  await menu(page,'ru');await page.getByRole('menuitem',{name:'Настройки',exact:false}).click();await expect(page.locator('#settings [role="switch"]')).toHaveCount(6);await expect(page.locator('#settings')).not.toContainText('Настроить профиль');
});

test('two same-origin windows observe saved appearance and disable through actual storage events',async({page,context})=>{
  await setup(page);const other=await context.newPage();const otherErrors=[];other.on('pageerror',error=>otherErrors.push(error.message));
  try{
    await setup(other);await open(page);await save(page,'Shared in both');await expect(customName(other)).toHaveText('Shared in both');
    await open(other);await save(other,'Updated elsewhere');await expect(customName(page)).toHaveText('Updated elsewhere');
    await page.evaluate(()=>window.profileFixture.toggle(false));await expect(customName(other)).toHaveCount(0);expect((await prefs(other)).enabled).toBe(false);expect(otherErrors).toEqual([]);
  }finally{await other.close();}
});

for(const edited of ['name','image'])test(`concurrent open editors preserve the other window's independent ${edited==='name'?'image':'name'} field`,async({page,context})=>{
  await setup(page);const other=await context.newPage();const otherErrors=[];other.on('pageerror',error=>otherErrors.push(error.message));
  try{
    await setup(other);await open(page);await open(other);
    if(edited==='name'){
      await dialog(other).locator('input[type="file"]').setInputFiles({name:'other.png',mimeType:'image/png',buffer:Buffer.from(samples.png.base64,'base64')});
      await dialog(other).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog(other)).toHaveCount(0);
      const latestImage=JSON.parse(await storage(other)).image;expect(latestImage).toMatch(/^data:image\/png;base64,/);await expect(customImage(page)).toHaveAttribute('src',latestImage);
      await save(page,'Name from first editor');
      expect(JSON.parse(await storage(page))).toMatchObject({name:'Name from first editor',image:latestImage});
    }else{
      await save(other,'Name from other editor');await expect(customName(page)).toHaveText('Name from other editor');
      await dialog(page).locator('input[type="file"]').setInputFiles({name:'first.png',mimeType:'image/png',buffer:Buffer.from(samples.png.base64,'base64')});
      await dialog(page).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog(page)).toHaveCount(0);
      const durable=JSON.parse(await storage(page));expect(durable.image).toMatch(/^data:image\/png;base64,/);expect(durable.name).toBe('Name from other editor');
    }
    expect(otherErrors).toEqual([]);
  }finally{await other.close();}
});

test('avatar file drop accepts raster, rejects SVG/outside targets and cancelled decoding cannot leak into reopened H',async({page})=>{
  await setup(page);await open(page);
  // The drop target is the avatar control, not the entire editor/modal.
  const target=dialog(page).locator('.wsp-profile-portrait');
  await drop(page,dialog(page),'png');await dialog(page).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog(page)).toHaveCount(0);expect((await prefs(page)).image).toBeNull();await open(page);
  await dialog(page).locator('input[type="file"]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>throw 1</script></svg>')});
  await expect(dialog(page).getByRole('alert')).toBeVisible();expect((await prefs(page)).image).toBeNull();
  await drop(page,target,'png');await dialog(page).getByRole('button',{name:'Save',exact:true}).click();await expect(customImage(page)).toHaveAttribute('src',/^data:image\/png;base64,/);
  const durable=await storage(page);await open(page);await page.evaluate(()=>window.profileFixture.holdDecode());
  await dialog(page).locator('input[type="file"]').setInputFiles({name:'slow.png',mimeType:'image/png',buffer:Buffer.from(samples.png.base64,'base64')});
  await expect.poll(()=>page.evaluate(()=>window.profileFixture.pendingDecodes())).toBe(1);await page.keyboard.press('Escape');await page.evaluate(()=>window.profileFixture.releaseDecode());
  await open(page);await expect(input(page)).toHaveValue('Native Alice');await page.keyboard.press('Escape');expect(await storage(page)).toBe(durable);
});

test('quota failure keeps H draft/error and last durable projection; retry can save without false success',async({page})=>{
  await setup(page,{seed:{version:1,enabled:true,name:'Durable',image:null}});await expect(customName(page)).toHaveText('Durable');const durable=await storage(page);
  await open(page);await input(page).fill('Unsaved');await page.evaluate(()=>window.profileFixture.failWrites());await dialog(page).getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog(page)).toBeVisible();await expect(input(page)).toHaveValue('Unsaved');await expect(dialog(page).getByRole('alert')).toBeVisible();await expect(customName(page)).toHaveText('Durable');expect(await storage(page)).toBe(durable);
  await page.evaluate(()=>window.profileFixture.failWrites(false));await dialog(page).getByRole('button',{name:'Retry reading profile appearance',exact:true}).click();await expect(input(page)).toHaveValue('Unsaved');await dialog(page).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog(page)).toHaveCount(0);await expect(customName(page)).toHaveText('Unsaved');
});

for(const language of ['en','ru'])for(const dark of [true,false])test(`H screenshot ${language} ${dark?'dark':'light'} uses one editor`,async({page},testInfo)=>{
  await setup(page,{dark,native:{language}});await open(page,language);await expect(input(page,language)).toBeVisible();
  const output=name=>screenshots?join(screenshots,name):testInfo.outputPath(name);
  await dialog(page).screenshot({path:output(`profile-H-${language}-${dark?'dark':'light'}.png`),animations:'disabled'});
  await page.keyboard.press('Escape');if(language==='en'&&dark){await menu(page);await nativeMenu(page).screenshot({path:output('profile-menu.png'),animations:'disabled'});}
});
