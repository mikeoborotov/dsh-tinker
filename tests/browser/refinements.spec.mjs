import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
let fixture;
test.beforeAll(async () => { fixture = await buildFixture(); });
// Native RC.2 Rows.module.css/Menu.module.css geometry, including the title's own margin.
const nativeCSS = `body{margin:0;font-family:Arial;font-size:16px}
.sessionRow{display:flex;align-items:center;height:32px;gap:0;padding:0 8px;width:280px}.slot{flex:none;width:16px;height:20px;display:inline-flex;align-items:center;justify-content:center}.slot i{width:16px;height:16px}.sessionRow .title{flex:1;min-width:0;margin:0 6px 0 4px;font-size:14px;line-height:20px}.time{flex:none;font-size:10px;line-height:16px}
.native-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;font-size:13px;line-height:20px;color:black;text-align:left;cursor:pointer}.native-item:hover:not(:disabled),.native-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);outline:none}.native-icon{display:inline-flex;flex:none;width:14px;height:14px;align-items:center;justify-content:center;color:gray}.native-icon svg{width:14px;height:14px}.native-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.danger{color:red}`;
test.beforeEach(async ({page}) => {
 await page.route('http://fixture.test/**', r => r.fulfill({contentType:'text/html', body:`<!doctype html><html><head><style>${nativeCSS}</style></head><body>
 <div data-row-key="workspace:w1" role="treeitem"><span><svg width="18" height="18"><path/></svg></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div>
 <div class="sessionRow" data-row-key="session:s1" role="treeitem"><span class="slot" id="status"><i></i></span><span class="title">First</span><span class="time">1m</span></div>
 <div id="toolbar"><div><button aria-haspopup="menu" aria-busy="false" title="Model"><svg/><span>Model</span></button></div><div id="marker"></div></div><div id="overlay"></div><div id="settings"></div></body></html>`}));
 await page.goto('http://fixture.test/'); await page.addStyleTag({content:fixture.css}); await page.addScriptTag({content:fixture.js}); await page.evaluate(() => window.fixture.mount());
 await expect(page.locator('.wsp-session-icon')).toHaveCount(1);
});
async function geometry(page) { return page.evaluate(() => { const rect = s => {const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}; return {status:rect('#status'),icon:rect('.wsp-session-icon'),title:rect('.title'),time:rect('.time')}; }); }
test('session logo has balanced gaps without moving status, title or time', async ({page}) => {
 const g = await geometry(page);
 expect(g.icon.x-g.status.right).toBe(5); expect(g.title.x-g.icon.right).toBe(5);
 expect(g.status.x).toBe(8); expect(g.title.x).toBe(52);
 const title = g.title.x, time = g.time.x;
 await page.evaluate(() => document.querySelector('#status').innerHTML='<i aria-label="Completed"></i>');
 expect((await geometry(page)).title.x).toBe(title); expect((await geometry(page)).time.x).toBe(time);
});
async function openMenu(page) {
 await page.locator('#menu-anchor').click();
 await page.evaluate(() => { const m=document.createElement('div');m.setAttribute('role','menu');m.innerHTML='<div role="presentation"><div class="native-wrap"><button class="native-item" role="menuitem"><span class="native-icon"><svg/></span><span class="native-label">Rename</span></button></div><div class="native-wrap"><button class="native-item danger" role="menuitem"><span class="native-icon"><svg/></span><span class="native-label">Delete</span></button></div></div>';document.body.append(m); });
 await expect(page.getByRole('menuitem',{name:'Appearance',exact:true})).toBeVisible();
}
test('Appearance sits between Rename and Delete inside the native viewport', async ({page}) => {
 await openMenu(page); await expect(page.getByRole('menuitem')).toHaveText(['Rename','Appearance','Delete']);
 const same = await page.evaluate(() => {const b=document.querySelector('[data-wsp-menu]'),r=document.querySelector('.native-item');return b.parentElement.parentElement===r.parentElement.parentElement;});expect(same).toBe(true);
});
test('Appearance uses the native row typography, hover, radius and brush icon', async ({page}) => {
 await openMenu(page); const button=page.getByRole('menuitem',{name:'Appearance',exact:true});
 await expect(button.locator('svg')).toHaveCount(1);
 const metrics = async locator => locator.evaluate(el => {const c=getComputedStyle(el);return ['fontFamily','fontSize','lineHeight','borderRadius','padding','gap','minHeight'].map(k=>c[k]);});
 expect(await metrics(button)).toEqual(await metrics(page.getByRole('menuitem',{name:'Rename',exact:true})));
 await page.getByRole('menuitem',{name:'Rename',exact:true}).hover();
  const nativeHover=await page.getByRole('menuitem',{name:'Rename',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor);
  await button.hover();await expect(button).toHaveCSS('background-color',nativeHover);
 await button.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
