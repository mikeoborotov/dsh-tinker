import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
let fixture;
test.beforeAll(async()=>{ fixture=(await build({entryPoints:['tests/fixture.jsx'],bundle:true,format:'iife',platform:'browser',write:false})).outputFiles[0].text; });
test.beforeEach(async({page})=>{
 await page.route('http://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><body>
 <div data-row-key="workspace:w1" role="treeitem"><span><svg width="18" height="18"><path/></svg></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div>
 <div data-row-key="session:s1" role="treeitem"><span id="status"><i>working</i></span><span>First</span><span>1m</span></div>
 <div data-row-key="session:s2" role="treeitem"><span></span><span>Second</span><span>2m</span></div>
 <div id="toolbar"><div><button aria-haspopup="menu" aria-busy="false" title="Model"><svg width="16" height="16"><path/></svg><span>Model</span></button></div><div id="marker"></div></div>
 <div id="overlay"></div><div id="settings"></div>
 </body></html>`}));
 await page.goto('http://fixture.test/');await page.addScriptTag({content:fixture});await page.evaluate(()=>window.fixture.mount());
});
test('routed models and subscription aliases resolve by lab',async({page})=>{
 const values=await page.evaluate(()=>[['openai-codex','sol'],['openrouter','anthropic/claude'],['openrouter','deepseek/deepseek-v4.1'],['unknown','mystery']].map(([provider,model])=>window.fixture.vendorOf({provider,model})));
 expect(values).toEqual(['openai','anthropic','deepseek',null]);
});
test('selected model changes both places immediately, native status remains',async({page})=>{
 await expect(page.locator('[data-row-key="session:s1"] .wsp-session-icon')).toHaveAttribute('title','DeepSeek');
 await page.evaluate(()=>window.fixture.change({provider:'openai-codex',model:'sol'}));
 await expect(page.locator('[data-row-key="session:s1"] .wsp-session-icon')).toHaveAttribute('title','OpenAI');
 await expect(page.locator('#status')).toHaveText('working');
 await expect(page.locator('.wsp-composer-icon')).toHaveCount(2);
 await expect(page.locator('#toolbar button > svg')).toHaveCSS('display','none');
 const same=await page.evaluate(()=>document.querySelector('.wsp-composer-icon').innerHTML===document.querySelector('[data-row-key="session:s1"] .wsp-session-icon').innerHTML);expect(same).toBe(true);
 await expect(page.locator('[data-row-key="session:s2"] .wsp-session-icon')).toHaveAttribute('title','OpenAI');
 expect(await page.evaluate(()=>window.fixture.refreshes())).toBe(1);
});
test('workspace appearance reset and disposal restore native UI',async({page})=>{
 await page.evaluate(()=>window.fixture.prefs().save('w1','infra',{kind:'emoji',emoji:'💻'}));
 // A fresh preference object writes durable data; the running instance receives a storage event on other windows, tested on restart here.
 await page.reload();await page.addScriptTag({content:fixture});await page.evaluate(()=>window.fixture.mount());
 await expect(page.locator('.wsp-workspace-icon')).toHaveText('💻');
 await page.evaluate(()=>window.fixture.dispose());
 await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
 await expect(page.locator('[data-row-key="workspace:w1"] > span > svg').first()).not.toHaveCSS('display','none');
 await expect(page.locator('#toolbar button > svg')).not.toHaveCSS('display','none');
 await expect(page.locator('#status')).toHaveText('working');
});
test('menu is added only after its own workspace trigger; UI responds to keyboard',async({page})=>{
 await page.locator('#menu-anchor').click();
 await page.evaluate(()=>{const m=document.createElement('div');m.setAttribute('role','menu');m.innerHTML='<button role="menuitem">Rename</button><button role="menuitem">Delete</button>';document.body.append(m);});
 await expect(page.getByRole('menuitem',{name:'Appearance'})).toBeVisible();
 await page.getByRole('menuitem',{name:'Appearance'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('all feature switches remove their changes and can re-enable them',async({page})=>{
 await expect(page.locator('.wsp-session-icon')).toHaveCount(2);
 await page.getByRole('switch',{name:'sessions',exact:true}).click();await expect(page.locator('.wsp-session-icon')).toHaveCount(0);
 await page.getByRole('switch',{name:'composer',exact:true}).click();await expect(page.locator('.wsp-composer-icon')).toHaveCount(0);
 await expect(page.locator('#toolbar button > svg')).not.toHaveCSS('display','none');
 await page.getByRole('switch',{name:'sessions',exact:true}).click();await expect(page.locator('.wsp-session-icon')).toHaveCount(2);
});
test('class-backed workspace store renders dialog and persists an emoji',async({page})=>{
 await page.locator('#wsp-workspace').selectOption('w1');await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'emoji',exact:true}).click();await page.locator('#wsp-emoji').fill('🏠');
 await expect(page.getByRole('textbox',{name:'color'})).toHaveCount(0);
 await page.getByRole('button',{name:'save',exact:true}).click();await expect(page.locator('.wsp-workspace-icon')).toHaveText('🏠');
});
test('unsupported workspace markup is left unchanged',async({page})=>{
 await page.evaluate(()=>{const row=document.createElement('div');row.setAttribute('role','treeitem');row.dataset.rowKey='workspace:changed';row.innerHTML='<button>Changed UI</button>';document.body.append(row);});
 await expect(page.locator('[data-row-key="workspace:changed"]')).toHaveText('Changed UI');
 await expect(page.locator('[data-row-key="workspace:changed"] [data-wsp-owned]')).toHaveCount(0);
});
