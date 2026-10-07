import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
let fixture;
test.beforeAll(async()=>{ fixture=await buildFixture(); });
async function mount(page) {
 await page.addStyleTag({content:fixture.css});await page.addScriptTag({content:fixture.js});await page.evaluate(()=>window.fixture.mount());
}
test.beforeEach(async({page})=>{
 await page.route('http://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><body>
 <div data-row-key="workspace:w1" role="treeitem"><span><svg width="18" height="18"><path/></svg></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div>
 <div data-row-key="session:s1" role="treeitem"><span id="status"><i>working</i></span><span>First</span><span>1m</span></div>
 <div data-row-key="session:s2" role="treeitem"><span></span><span>Second</span><span>2m</span></div>
 <div id="toolbar"><div><button aria-haspopup="menu" aria-busy="false" title="Model"><svg width="16" height="16"><path/></svg><span>Model</span></button></div><div id="marker"></div></div>
 <div id="overlay"></div><div id="settings"></div>
 </body></html>`}));
 await page.goto('http://fixture.test/');await mount(page);
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
 await page.evaluate(()=>window.fixture.prefs().save('w1',{kind:'emoji',emoji:'💻'}));
 // A fresh preference object writes durable data; the running instance receives a storage event on other windows, tested on restart here.
 await page.reload();await mount(page);
 await expect(page.locator('.wsp-workspace-icon')).toHaveText('💻');
 await page.evaluate(()=>window.fixture.dispose());
 await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
 await expect(page.locator('[data-row-key="workspace:w1"] > span > svg').first()).not.toHaveCSS('display','none');
 await expect(page.locator('#toolbar button > svg')).not.toHaveCSS('display','none');
 await expect(page.locator('#status')).toHaveText('working');
});
test('menu is added only after its own workspace trigger; UI responds to keyboard',async({page})=>{
 await page.locator('#menu-anchor').click();
 await page.evaluate(()=>{const m=document.createElement('div');m.setAttribute('role','menu');m.innerHTML='<div role="presentation"><div><button class="native-item" role="menuitem"><span class="native-icon"><svg/></span><span class="native-label">Rename</span></button></div><div><button class="native-item danger" role="menuitem"><span class="native-icon"><svg/></span><span class="native-label">Delete</span></button></div></div>';document.body.append(m);});
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

test('global plugin effect applies workspace icons above prompt independently of model logos',async({page})=>{
 await page.evaluate(()=>{const root=document.createElement('div');root.setAttribute('data-conversation-content','');root.setAttribute('data-conversation-session','s1');root.innerHTML='<div><button id="hero-workspace" aria-haspopup="menu" aria-expanded="false"><svg/><span>Infra</span><svg class="chevron"/></button><div data-slot="conversation.hero.workspace"></div></div>';document.body.append(root);});
 await page.locator('#wsp-workspace').selectOption('w1');await page.getByRole('button',{name:'emoji',exact:true}).click();await page.locator('#wsp-emoji').fill('🏠');await page.getByRole('button',{name:'save',exact:true}).click();
 await expect(page.locator('#hero-workspace .wsp-workspace-picker-icon')).toHaveText('🏠');await expect(page.locator('.wsp-workspace-icon')).toHaveText('🏠');
 await page.getByRole('switch',{name:'composer',exact:true}).click();await expect(page.locator('#hero-workspace .wsp-workspace-picker-icon')).toHaveText('🏠');
 await page.getByRole('switch',{name:'workspaces',exact:true}).click();await expect(page.locator('#hero-workspace .wsp-workspace-picker-icon')).toHaveCount(0);await expect(page.locator('#hero-workspace>svg').first()).not.toHaveCSS('display','none');
 await page.evaluate(()=>window.fixture.dispose());await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
});

test('composer feature switch also removes logos from the open model list',async({page})=>{
 await page.locator('#toolbar button').evaluate(el=>{el.setAttribute('aria-expanded','true');el.setAttribute('aria-controls','fixture-menu');});
 await page.evaluate(()=>{const m=document.createElement('div');m.id='fixture-menu';m.setAttribute('role','menu');m.innerHTML='<section role="group" data-menu-group><div data-menu-group-heading>ChatGPT</div><button role="menuitemradio" title="Sol"><span>Sol</span></button></section>';document.body.append(m);});
 await expect(page.locator('.wsp-model-menu-icon')).toHaveAttribute('data-vendor','OpenAI');
 await page.getByRole('switch',{name:'composer',exact:true}).click();await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(0);
 await page.getByRole('switch',{name:'composer',exact:true}).click();await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(1);
 await page.evaluate(()=>window.fixture.dispose());await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
});
