import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
import { readFile } from 'node:fs/promises';
let workspace,profile,callee,profileHTML;
test.beforeAll(async()=>{[workspace,profile,callee,profileHTML]=await Promise.all([
  buildFixture('tests/workspace-menu-fixture.jsx'),buildFixture('tests/profile-fixture.jsx'),buildFixture('tests/appearance-menu-callee-fixture.js'),readFile(new URL('../profile-fixture.html',import.meta.url),'utf8'),
]);});
const pageErrors=new WeakMap();
test.beforeEach(({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function mountWorkspace(page,options={}){
  await page.route('**/*',route=>route.abort());await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({content:workspace.css});await page.addScriptTag({content:workspace.js});await page.evaluate(options=>window.workspaceMenuFixture.mount(options),options);
  await expect(page.locator('#workspace-trigger-w1')).toBeVisible();
}
async function openWorkspace(page){await page.locator('#workspace-trigger-w1').click();await expect(page.getByRole('menu')).toBeVisible();}
async function captureNative(page){await page.evaluate(()=>{
  window.workspaceMenuFixture.captureNative();const menu=document.querySelector('[role="menu"]'),remove=[...menu.querySelectorAll('button[role="menuitem"]')].find(button=>button.textContent==='Delete workspace');
  const sep=menu.querySelector('[role="separator"]');window.refineNative={remove,wrapper:remove.parentElement,icon:remove.firstElementChild,glyph:remove.querySelector('svg'),sep,parent:sep?.parentElement,html:sep?.outerHTML};
});}
async function rawOrder(page){return page.evaluate(()=>[...document.querySelector('[role="menu"] > [role="presentation"]').children].map(node=>node.getAttribute('role')==='separator'?'separator':node.hasAttribute('data-slot')?'content':node.querySelector('button')?.textContent));}
async function expectNativeUnchanged(page){expect(await page.evaluate(()=>{
  const ref=window.refineNative,menu=document.querySelector('[role="menu"]'),remove=[...menu.querySelectorAll('button[role="menuitem"]')].find(button=>button.textContent==='Delete workspace');
  return {deleteSame:remove===ref.remove,wrapperSame:remove.parentElement===ref.wrapper,iconSame:remove.firstElementChild===ref.icon,glyphSame:remove.querySelector('svg')===ref.glyph,sepSame:menu.querySelector('[role="separator"]')===ref.sep,sepParent:ref.sep?.parentElement===ref.parent,sepHTML:ref.sep?.outerHTML===ref.html};
})).toEqual({deleteSame:true,wrapperSame:true,iconSame:true,glyphSame:true,sepSame:true,sepParent:true,sepHTML:true});}

for(const [lang,copy] of Object.entries({
  en:['Rename','Appearance','Show in folder','Delete workspace'],
  ru:['Переименовать','Оформление','Показать в папке','Удалить рабочую область'],
}))test(`T165 native adapter order and owned identity remain stable in ${lang}`,async({page})=>{
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mountWorkspace(page,{lang});await openWorkspace(page);await page.evaluate(()=>window.workspaceMenuFixture.captureNative());await page.clock.runFor(64);
  const wanted=[...copy.slice(0,3),'separator',copy[3],'content'];expect(await rawOrder(page)).toEqual(wanted);
  await expect(page.locator('[data-wsp-menu="w1"][data-wsp-owned]')).toHaveCount(1);
  await expect(page.locator('[data-wsp-menu-wrapper="w1"][data-wsp-owned]')).toHaveCount(1);
  const nativeLabels=[copy[0],copy[2],copy[3]];
  expect(await page.evaluate(()=>window.workspaceMenuFixture.nativeIdentity())).toEqual(nativeLabels.map(label=>({label,connected:true,sameWrapper:true})));
  expect(await page.evaluate(()=>window.workspaceMenuFixture.nativeIconIdentity())).toEqual(nativeLabels.map(label=>({label,sameIcon:true,sameOutlet:true,sameGlyph:true,connected:true})));
  expect(await page.evaluate(()=>window.workspaceMenuFixture.nativeContentIdentity())).toEqual({same:true,connected:true,children:0});
  await page.evaluate(()=>{window.t165Own=document.querySelector('[data-wsp-menu]');window.workspaceMenuFixture.setWorkspaces(['w1','w2']);});await page.clock.runFor(200);
  expect(await rawOrder(page)).toEqual(wanted);expect(await page.evaluate(()=>document.querySelector('[data-wsp-menu]')===window.t165Own)).toBe(true);
  await page.evaluate(()=>window.workspaceMenuFixture.toggle(false));await page.clock.runFor(64);await expect(page.locator('[data-wsp-menu], [data-wsp-menu-wrapper]')).toHaveCount(0);
  await page.evaluate(()=>window.workspaceMenuFixture.toggle(true));await page.clock.runFor(64);await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.keyboard.press('Escape');await openWorkspace(page);await page.clock.runFor(64);expect(await rawOrder(page)).toEqual(wanted);await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  const other=lang==='en'?'ru':'en';await page.evaluate(lang=>window.workspaceMenuFixture.configure({lang}),other);
  await expect(page.getByRole('menuitem',{name:other==='en'?'Rename':'Переименовать',exact:true})).toHaveCount(1);
  await page.evaluate(()=>document.dispatchEvent(new Event('scroll',{bubbles:true})));await page.clock.runFor(64);
  expect(await rawOrder(page)).toEqual(other==='en'?['Rename','Appearance','Show in folder','separator','Delete workspace','content']:['Переименовать','Оформление','Показать в папке','separator','Удалить рабочую область','content']);
  expect((await page.evaluate(()=>window.workspaceMenuFixture.snapshot())).calls).toEqual({});
});

for(const reveal of [true,false])test(`Appearance immediately follows Rename before the untouched native separator, reveal=${reveal}`,async({page})=>{
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mountWorkspace(page,{reveal});await openWorkspace(page);await captureNative(page);await page.clock.runFor(64);
  const wanted=['Rename','Appearance',...(reveal?['Show in folder']:[]),'separator','Delete workspace','content'];
  expect(await rawOrder(page)).toEqual(wanted);await expectNativeUnchanged(page);
  await page.evaluate(()=>window.workspaceMenuFixture.setWorkspaces(['w1','w2']));await page.clock.runFor(200);expect(await rawOrder(page)).toEqual(wanted);await expectNativeUnchanged(page);
  await page.getByRole('menuitem',{name:'Delete workspace',exact:true}).locator('svg').click();expect((await page.evaluate(()=>window.workspaceMenuFixture.snapshot())).calls).toEqual({'w1:delete':1});
});

test('owned row in the old after-separator position is repaired without moving native nodes',async({page})=>{
  await mountWorkspace(page);await openWorkspace(page);await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);await captureNative(page);
  await page.evaluate(()=>{const own=document.querySelector('[data-wsp-menu]').parentElement;window.refineNative.wrapper.before(own);window.workspaceMenuFixture.setWorkspaces(['w1','w2']);});
  await expect.poll(()=>rawOrder(page)).toEqual(['Rename','Appearance','Show in folder','separator','Delete workspace','content']);await expectNativeUnchanged(page);
});

test('known dynamic contribution preserves anchor and nodes; unknown content relinquishes only owned row',async({page})=>{
  await mountWorkspace(page,{reveal:false});await openWorkspace(page);await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);await captureNative(page);
  await page.evaluate(()=>window.workspaceMenuFixture.configure({reveal:true}));
  await expect.poll(()=>rawOrder(page)).toEqual(['Rename','Appearance','Show in folder','separator','Delete workspace','content']);await expectNativeUnchanged(page);
  await page.evaluate(()=>window.workspaceMenuFixture.configure({content:true}));await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);await expectNativeUnchanged(page);
});

for(const options of [{inline:true,separator:true},{inline:false,separator:false}])test('controlled callee preserves inline/no-separator fallback '+JSON.stringify(options),async({page})=>{
  await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:callee.js});await page.evaluate(options=>window.appearanceCallee.mount(options),options);
  const result=await page.evaluate(()=>window.appearanceCallee.check());expect(result).toMatchObject({order:['Rename','Appearance','Delete workspace'],owned:true,same:true,separatorSame:true});
  if(options.inline)expect(result.inlineOrder).toEqual(['separator','menuitem']);
  await page.getByRole('menuitem',{name:'Rename',exact:true}).click();await page.getByRole('menuitem',{name:'Delete workspace',exact:true}).click();await page.getByRole('menuitem',{name:'Appearance',exact:true}).click();
  expect((await page.evaluate(()=>window.appearanceCallee.check())).calls).toEqual({rename:1,delete:1,appearance:1});
});

test('same accepted Workspace brush artwork renders in Profile at 16px without changing native account icons',async({page,context})=>{
  await mountWorkspace(page);await openWorkspace(page);await expect(page.locator('[data-wsp-menu] svg')).toHaveCount(1);
  const workspaceSVG=await page.locator('[data-wsp-menu] svg').evaluate(svg=>svg.outerHTML);
  await page.getByRole('menu').screenshot({path:'test-results/appearance-refinements/workspace-menu.png'});
  const other=await context.newPage();const otherErrors=[];other.on('pageerror',error=>otherErrors.push(error.message));
  try{
    await other.route('https://appearance-profile.test/**',route=>route.fulfill({contentType:'text/html',body:profileHTML}));await other.goto('https://appearance-profile.test/');await other.addStyleTag({content:profile.css});await other.addScriptTag({content:profile.js});await other.evaluate(()=>window.profileFixture.mount());
    const trigger=other.locator('[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-signed-out]');await trigger.click();
    const icon=other.locator('[data-wsp-profile-menu] [data-wsp-profile-icon] svg');await expect(icon).toBeVisible();
    await other.evaluate(()=>{window.profileFixture.captureNodes();window.refineProfileIcons=[...document.querySelectorAll('[role="menu"] button:not([data-wsp-owned]) > span:first-child > svg')];});
    expect(await icon.evaluate(svg=>svg.outerHTML)).toBe(workspaceSVG);
    await expect(icon).toHaveCSS('width','16px');await expect(icon).toHaveCSS('height','16px');await expect(icon).toHaveAttribute('viewBox','0 0 24 24');await expect(icon).toHaveAttribute('stroke-width','1.5');await expect(icon).toHaveAttribute('aria-hidden','true');
    await other.getByRole('menu').screenshot({path:'test-results/appearance-refinements/profile-menu.png'});
    await other.evaluate(()=>window.profileFixture.update({name:'Fresh native name'}));await expect(trigger.locator('._5Qcc8a_label')).toHaveText('Fresh native name');
    expect(await other.evaluate(()=>window.profileFixture.sameNodes())).toBe(true);
    expect(await other.evaluate(()=>window.refineProfileIcons.every((svg,index)=>svg.isConnected&&document.querySelectorAll('[role="menu"] button:not([data-wsp-owned]) > span:first-child > svg')[index]===svg))).toBe(true);
    await other.keyboard.press('End');await other.keyboard.press('ArrowUp');await expect(other.getByRole('menuitem',{name:'Appearance',exact:true})).toBeFocused();await other.keyboard.press('Enter');await expect(other.getByRole('dialog')).toBeVisible();await other.keyboard.press('Escape');await expect(trigger).toBeFocused();
    await trigger.click();await other.getByRole('menuitem',{name:'Feedback',exact:true}).click();expect(await other.evaluate(()=>window.profileFixture.counters())).toEqual({settings:0,feedback:1,signout:0,signin:0});
    expect(otherErrors).toEqual([]);
  }finally{await other.close();}
});
