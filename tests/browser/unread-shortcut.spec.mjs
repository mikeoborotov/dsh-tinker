import { test, expect } from '@playwright/test';
import { buildUnreadShortcutFixture } from '../unread-shortcut-fixture-build.mjs';
let fixture;
test.beforeAll(async()=>{fixture=await buildUnreadShortcutFixture();});
const errors=new WeakMap();
test.beforeEach(({page})=>{const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(async({page})=>{await page.evaluate(()=>window.unreadShortcutFixture?.dispose());expect(errors.get(page)).toEqual([]);});
async function mount(page,options={}){
  await page.route('https://unread-shortcut.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="app"></div><style>body{padding:24px}#draft{display:block;width:400px;height:100px;margin-bottom:30px}#hover{margin-top:20px}</style></body></html>'}));
  await page.goto('https://unread-shortcut.test/');await page.addStyleTag({content:fixture.css});await page.addScriptTag({content:fixture.js});
  await page.evaluate(options=>window.unreadShortcutFixture.mount(options),options);await expect(page.getByRole('textbox',{name:'Composer'})).toBeVisible();
}
const stats=page=>page.evaluate(()=>window.unreadShortcutFixture.stats());
const key=page=>page.keyboard.press('Control+Alt+u');
const menuitem=page=>page.getByRole('menuitem',{name:/Mark as unread/});

test('native dispatcher marks the current main Session once without changing draft, focus, model or mainView',async({page})=>{
  await mount(page);const before=await stats(page),composer=page.getByRole('textbox',{name:'Composer'});await composer.focus();await key(page);
  await expect.poll(async()=>(await stats(page)).unread).toEqual({main:true});
  await expect(composer).toBeFocused();await expect(composer).toHaveValue('Keep this unsent draft');
  expect((await stats(page)).sessions).toEqual(before.sessions);expect((await stats(page)).writes).toBe(1);expect((await stats(page)).events).toBe(1);
  await page.getByRole('button',{name:'Menu other'}).click();await menuitem(page).click();
  await expect.poll(async()=>(await stats(page)).unread).toEqual({main:true,other:true});expect((await stats(page)).sessions).toEqual(before.sessions);
});

test('legacy MenuItemButton hint tracks effective override, removal, reset and conflict live',async({page})=>{
  await mount(page);await page.getByRole('button',{name:'Menu other'}).click();
  await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');await expect(menuitem(page).locator('kbd')).toHaveText(['Ctrl','+','Alt','+','U']);
  await expect(menuitem(page).locator('svg')).toHaveAttribute('width','16');
  await page.evaluate(()=>window.unreadShortcutFixture.binding('override'));await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+Y');
  await page.evaluate(()=>window.unreadShortcutFixture.binding('unbind'));await expect(menuitem(page).locator('kbd')).toHaveCount(0);await expect(menuitem(page)).not.toHaveAttribute('aria-keyshortcuts');
  await page.evaluate(()=>window.unreadShortcutFixture.binding('reset'));await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');
  await page.screenshot({path:'test-results/unread-shortcuts/menu-hint.png'});
  await page.evaluate(()=>window.unreadShortcutFixture.binding('conflict'));await expect(menuitem(page).locator('kbd')).toHaveCount(0);await expect(menuitem(page)).not.toHaveAttribute('aria-keyshortcuts');
  await page.keyboard.press('Escape');await expect(page.locator('#hover svg')).toHaveAttribute('width','14');
});

for(const options of [{runtime:'desktop',platform:'windows'},{runtime:'desktop',platform:'linux'},{runtime:'web',platform:'windows'},{runtime:'web',platform:'linux'},{runtime:'desktop',platform:'macos'},{runtime:'web',platform:'macos'}])test(`explicit platform matrix ${options.runtime}:${options.platform}`,async({page})=>{
  await mount(page,options);await page.getByRole('textbox',{name:'Composer'}).focus();await key(page);
  const bound=options.platform==='windows'||options.platform==='linux'&&options.runtime==='desktop';
  if(bound)await expect.poll(async()=>(await stats(page)).writes).toBe(1);else expect((await stats(page)).writes).toBe(0);
  await page.getByRole('button',{name:'Menu other'}).click();
  if(bound)await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');else await expect(menuitem(page).locator('kbd')).toHaveCount(0);
  await menuitem(page).click();await expect.poll(async()=>(await stats(page)).unread.other).toBe(true);
});

for(const guard of ['off','none','blank','modal','panel','prefsError','unreadError','terminal'])test(`explicit priority Desktop guard ${guard}`,async({page})=>{
  await mount(page,{runtime:'desktop'});await page.getByRole('textbox',{name:'Composer'}).focus();await page.evaluate(guard=>window.unreadShortcutFixture.guard(guard),guard);const before=await stats(page);await key(page);expect((await stats(page)).writes).toBe(before.writes);
});

test('actual DOM adapter protects IME, dead-key continuation, AltGraph and held-key repeat',async({page})=>{
  await mount(page);await page.getByRole('textbox',{name:'Composer'}).focus();
  await page.evaluate(()=>{
    const target=document.getElementById('draft');const fire=extra=>target.dispatchEvent(new KeyboardEvent('keydown',{key:'u',code:'KeyU',ctrlKey:true,altKey:true,bubbles:true,cancelable:true,...extra}));
    target.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));fire();target.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
    fire({key:'Dead'});fire();fire({repeat:true});
    const altgr=new KeyboardEvent('keydown',{key:'u',code:'KeyU',ctrlKey:true,altKey:true,bubbles:true,cancelable:true});Object.defineProperty(altgr,'getModifierState',{value:name=>name==='AltGraph'});target.dispatchEvent(altgr);
  });
  expect((await stats(page)).writes).toBe(0);await key(page);await expect.poll(async()=>(await stats(page)).writes).toBe(1);
});

test('an absent optional SDK leaves captured-row buttons working and attaches cleanly when provided',async({page})=>{
  await mount(page,{withoutSDK:true});expect((await stats(page)).commands).toBe(0);
  await page.getByRole('button',{name:'Menu other'}).click();await expect(menuitem(page).locator('kbd')).toHaveCount(0);await menuitem(page).click();
  await expect.poll(async()=>(await stats(page)).unread.other).toBe(true);
  await page.evaluate(()=>window.unreadShortcutFixture.reprovide());await expect.poll(async()=>(await stats(page)).commands).toBe(1);
  await page.getByRole('textbox',{name:'Composer'}).focus();await key(page);await expect.poll(async()=>(await stats(page)).unread.main).toBe(true);
});

test('feature disable and real Cordis withdraw/reprovide/remount leave no duplicate commands',async({page})=>{
  await mount(page);await page.evaluate(()=>window.unreadShortcutFixture.guard('off'));expect((await stats(page)).commands).toBe(0);
  await page.evaluate(()=>window.unreadShortcutFixture.guard('on'));await expect.poll(async()=>(await stats(page)).commands).toBe(1);
  await page.getByRole('button',{name:'Menu other'}).click();await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');
  await page.evaluate(()=>window.unreadShortcutFixture.withdraw());expect((await stats(page)).commands).toBe(0);await expect(menuitem(page).locator('kbd')).toHaveCount(0);
  await page.evaluate(()=>window.unreadShortcutFixture.reprovide());await expect.poll(async()=>(await stats(page)).commands).toBe(1);await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');
  await page.evaluate(()=>window.unreadShortcutFixture.remount());await expect.poll(async()=>(await stats(page)).commands).toBe(1);await expect(menuitem(page)).toHaveAttribute('aria-keyshortcuts','Control+Alt+U');
  await page.keyboard.press('Escape');
  await page.getByRole('textbox',{name:'Composer'}).focus();await key(page);await expect.poll(async()=>(await stats(page)).writes).toBe(1);
});

test('failed durable mark reports native Toast, then retry publishes exactly one successful event',async({page})=>{
  await mount(page);await page.evaluate(()=>window.unreadShortcutFixture.failWrites(true));await page.getByRole('textbox',{name:'Composer'}).focus();await key(page);
  await expect(page.getByRole('alert').filter({hasText:'Could not save the reminder.'})).toBeVisible();expect((await stats(page)).unread).toEqual({});expect((await stats(page)).writes).toBe(0);
  await expect(page.getByRole('alert').locator('svg')).toHaveAttribute('width','16');
  await page.evaluate(()=>window.unreadShortcutFixture.failWrites(false));await key(page);await expect.poll(async()=>(await stats(page)).unread).toEqual({main:true});
  expect((await stats(page)).writes).toBe(1); // failure feedback also emits the existing error event
  expect((await stats(page)).events).toBe(2);
});
