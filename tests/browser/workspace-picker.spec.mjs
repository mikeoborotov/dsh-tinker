import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let fixture;
test.beforeAll(async()=>{fixture=(await build({entryPoints:['tests/workspace-picker-fixture.js'],bundle:true,format:'iife',platform:'browser',write:false})).outputFiles[0].text;});
test.beforeEach(async({page})=>{
 await page.route('http://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>.native-icon{width:14px;height:14px;display:inline-flex}#chip{display:flex;align-items:center;gap:6px}#chip>svg:first-child{width:16px;height:16px}#chip>svg:last-child{width:12px;height:12px}</style></head><body>
 <div data-conversation-content data-conversation-session="s1"><div data-conversation-region="composer"><div><button id="chip" aria-haspopup="menu" aria-expanded="false"><svg class="folder"/><span id="chip-label">Duplicate</span><svg class="chevron"/></button><div data-slot="conversation.hero.workspace" style="display:contents"></div><div data-slot="conversation.hero.agentPreset"></div></div><div data-composer-card><textarea></textarea></div></div></div></body></html>`}));
 await page.goto('http://fixture.test/');await page.addScriptTag({content:fixture});await page.evaluate(()=>{window.fixture.prefs.save('w1','one',{kind:'emoji',emoji:'💻'});window.fixture.prefs.save('w2','two',{kind:'emoji',emoji:'🏠'});window.fixture.prefs.save('w3','three',{kind:'icon',icon:'code',color:'#22a06b'});window.fixture.mount();});
});
const chipIcon = page => page.locator('#chip .wsp-workspace-picker-icon');
test('native new-chat trigger uses authoritative membership, not duplicate caption',async({page})=>{
 await expect(chipIcon(page)).toHaveText('💻');await expect(page.locator('#chip>.folder')).toHaveCSS('display','none');await expect(page.locator('#chip>.chevron')).not.toHaveCSS('display','none');
 await page.evaluate(()=>window.fixture.confirm('w2'));await expect(chipIcon(page)).toHaveText('🏠');
});
test('all appearance kinds, reset and switch restore both trigger and open list',async({page})=>{
 await page.evaluate(()=>window.fixture.prefs.save('w1','one',{kind:'icon',icon:'code',color:'#4176e6'}));await expect(chipIcon(page).locator('svg')).toHaveCount(1);await expect(chipIcon(page)).toHaveCSS('color','rgb(65, 118, 230)');
 await page.evaluate(()=>window.fixture.prefs.save('w1','one',{kind:'image',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1kAAAAASUVORK5CYII='}));await expect(chipIcon(page).locator('img')).toHaveCount(1);
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);await expect(page.locator('#pick-menu .wsp-workspace-picker-icon img')).toHaveCount(1);
 await page.evaluate(()=>window.fixture.prefs.toggle('workspaces',false));await expect(page.locator('.wsp-workspace-picker-icon')).toHaveCount(0);await expect(page.locator('#chip>.folder')).not.toHaveCSS('display','none');
 await page.evaluate(()=>window.fixture.prefs.toggle('workspaces',true));await expect(page.locator('.wsp-workspace-picker-icon')).toHaveCount(4);
 await page.evaluate(()=>window.fixture.prefs.resetWorkspace('w1'));await expect(chipIcon(page)).toHaveCount(0);await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(2);
});
test('guarded native list order distinguishes duplicate captions; Add and checks untouched',async({page})=>{
 await page.locator('#chip').click();const rows=page.locator('#pick-menu > div[role="presentation"]').first().getByRole('menuitem');
 await expect(rows.nth(0).locator('.wsp-workspace-picker-icon')).toHaveText('💻');await expect(rows.nth(1).locator('.wsp-workspace-picker-icon')).toHaveText('🏠');await expect(rows.nth(2).locator('.wsp-workspace-picker-icon svg')).toHaveCount(1);
 await expect(page.getByRole('menuitem',{name:'Add workspace'}).locator('[data-wsp-owned]')).toHaveCount(0);for(let i=0;i<3;i++)await expect(rows.nth(i).locator(':scope > .check')).not.toHaveCSS('display','none');
});
test('pending selection shows native folder until new-session membership confirms',async({page})=>{
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);
 await page.locator('#pick-menu > div[role="presentation"]').first().getByRole('menuitem').nth(1).click();
 await expect(chipIcon(page)).toHaveCount(0);await expect(page.locator('#chip>.folder')).not.toHaveCSS('display','none');
 // A reopened menu is not confirmation: duplicate labels must not bring back the old icon.
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);await expect(chipIcon(page)).toHaveCount(0);
 await page.evaluate(()=>window.fixture.closeMenu());
 await page.evaluate(()=>window.fixture.confirm('w2','s2'));await expect(chipIcon(page)).toHaveText('🏠');
});
test('native prompt request opens the same decorated picker without a chip click',async({page})=>{
 await page.evaluate(()=>{document.querySelector('[data-conversation-content]').removeAttribute('data-conversation-session');window.fixture.requestWorkspace();});
 await expect(page.locator('#chip')).toHaveAttribute('aria-expanded','true');await expect(chipIcon(page)).toHaveCount(0);await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);
});
test('localized default title matches trigger and list',async({page})=>{
 await page.evaluate(()=>window.fixture.confirm('w3'));await expect(chipIcon(page).locator('svg')).toHaveCount(1);await expect(page.locator('#chip-label')).toHaveText('Default project');
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);
});
test('cold start, orphan, loading and incompatible list keep native glyphs',async({page})=>{
 await page.evaluate(()=>document.querySelector('[data-conversation-content]').removeAttribute('data-conversation-session'));await expect(chipIcon(page)).toHaveCount(0);
 await page.evaluate(()=>document.querySelector('[data-conversation-content]').setAttribute('data-conversation-session','missing'));await expect(chipIcon(page)).toHaveCount(0);
 await page.evaluate(()=>{window.fixture.confirm('w1');window.fixture.list.set({...window.fixture.list.getSnapshot(),phase:'pending'});});await expect(chipIcon(page)).toHaveCount(0);
 await page.evaluate(()=>window.fixture.list.set({...window.fixture.list.getSnapshot(),phase:'ready'}));await expect(chipIcon(page)).toHaveText('💻');
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);
 await page.locator('#pick-menu .native-label').first().evaluate(el=>el.textContent='Unexpected filter');await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(0);
});
test('unrelated menus cannot be decorated; replacement and disposal restore native',async({page})=>{
 await page.evaluate(()=>{const m=document.createElement('div');m.setAttribute('role','menu');m.innerHTML='<button role="menuitem">Other</button>';document.body.append(m);});await expect(page.locator('[role="menu"] [data-wsp-owned]')).toHaveCount(0);
 await page.locator('#chip>.folder').evaluate(el=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('folder');el.replaceWith(svg);});await expect(chipIcon(page)).toHaveText('💻');await expect(chipIcon(page)).toHaveCount(1);
 await page.locator('#chip').click();await expect(page.locator('#pick-menu .wsp-workspace-picker-icon')).toHaveCount(3);await page.evaluate(()=>window.fixture.dispose());await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);await expect(page.locator('#chip>.folder')).not.toHaveCSS('display','none');
});
