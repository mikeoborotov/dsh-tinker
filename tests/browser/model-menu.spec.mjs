import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { CSS } from '../../src/styles.js';
let code;
test.beforeAll(async()=>{code=(await build({entryPoints:['src/model-menu.js'],bundle:true,platform:'browser',format:'iife',globalName:'MenuIcons',write:false})).outputFiles[0].text;});
const catalog = [
 {id:'openai-codex',name:'ChatGPT',models:[{id:'gpt-6.1-sol',name:'Sol'},{id:'gpt-6-astra',name:'Astra'}]},
 {id:'deepseek-account',name:'DeepSeek Account',models:[{id:'deepseek-v4.1',name:'DeepSeek-V41-Flash'}]},
 {id:'router',name:'Router',models:[{id:'anthropic/claude-opus',name:'Claude'},{id:'google/gemini-pro',name:'Gemini'},{id:'mystery',name:'Unknown'}]},
];
function codexSection(provider, labels) {return `<section class="codexModelSelectGroup" role="group" aria-labelledby="picker-${provider}"><div class="codexModelSelectGroupTitle" id="picker-${provider}">${provider}</div>${labels.map(label=>`<button class="codexModelSelectOption" role="menuitemradio" aria-checked="false"><span class="codexModelSelectOptionCopy"><span class="codexModelSelectOptionName">${label}</span><span class="codexModelSelectOptionDescription">Details</span></span><span class="codexModelSelectCheck"><svg width="16" height="16" data-check/></span></button>`).join('')}</section>`;}
function nativeSection(name, labels) {return `<section role="group" data-menu-group aria-labelledby="heading-${name}"><span data-menu-group-start></span><div id="heading-${name}" data-menu-group-heading>${name}</div>${labels.map((label,i)=>`<button role="menuitemradio" title="${label}" aria-checked="false" id="model-${name}-${i}"><span><span>${label}</span></span><span data-status><svg width="16" height="16"/></span></button>`).join('')}</section>`;}
// Contract-only DOM projection of published dsh-codex-subscription 3.2.8.
// lib/client.js SHA256 ece5930c881554cd620a0f44a55517dd653dc43c29598a28b927ed0982bfe8b4:
// option/group helpers and model-only .codexModelSelectGroups[role=menu] container.
// This is not a full Codex mount; event handlers below are explicitly synthetic.
function currentCodexSection(name, labels, attributes='') {
 return `<section role="group" aria-label="${name}" ${attributes}><div class="codexModelSelectGroupTitle">${name}</div>${labels.map(label=>`<button type="button" class="codexModelSelectOption" role="menuitemradio" aria-checked="false"><span class="codexModelSelectOptionCopy"><span class="codexModelSelectOptionName">${label}</span></span><span class="codexModelSelectCheck"></span></button>`).join('')}</section>`;
}
function currentCodexPane(sections) {return `<div class="codexModelSelectGroups scrollable" role="menu" aria-label="Models">${sections}</div>`;}
async function setupCurrentCodex(page, sections, groups=catalog) {await setup(page,'codex',sections,groups,{role:'group',class:'codexModelSelectMenu'});}
const menuVendors=page=>page.locator('#picker-menu .wsp-model-menu-icon').evaluateAll(items=>items.map(el=>el.dataset.vendor));
async function setup(page, kind, sections='', groups=catalog, menuAttributes={}) {
 await page.setContent(`<div id="toolbar"><div class="${kind==='codex'?'codexModelSelect':''}"><button id="trigger" ${kind==='codex'?'class="codexModelSelectTrigger"':'aria-busy="false"'} aria-haspopup="menu" title="Sol" aria-expanded="true" aria-controls="picker-menu">${kind==='codex'?'<span class="codexModelSelectLabel">Sol</span>':'<svg width="16" height="16"/>'}</button></div><span id="marker"></span></div><div id="unrelated" role="menu">${nativeSection('Other',['Sol'])}</div>`);
 await page.addScriptTag({content:code});await page.addStyleTag({content:CSS+'button[role=menuitemradio]{display:flex;align-items:center;gap:8px}'});
 await page.evaluate(({groups,sections,menuAttributes})=>{
  const listeners=new Set();let state={groups};
  window.dir={getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},set(groups){state={groups};for(const fn of listeners)fn()}};
  const menu=document.createElement('div');menu.id='picker-menu';menu.setAttribute('role','menu');for(const [key,value] of Object.entries(menuAttributes))menu.setAttribute(key,value);menu.innerHTML=sections;document.body.append(menu);window.nativeMenuBefore=menu.outerHTML;
  window.nativeMenuRows=[...menu.querySelectorAll('button')];window.syntheticClicks=0;window.nativeMenuRows[0]?.addEventListener('click',()=>window.syntheticClicks++);
  window.cleanup=MenuIcons.attachModelMenuIcons(document.querySelector('#marker'),dir);
 },{groups,sections,menuAttributes});
}
test('subscription list has logos for subscription/API/routed models; checkmarks and actions survive',async({page})=>{
 await setup(page,'codex',codexSection('openai-codex',['Sol','Astra'])+codexSection('deepseek-account',['DeepSeek-V41-Flash'])+codexSection('router',['Claude','Gemini','Unknown']));
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(6);
 expect(await page.locator('#picker-menu .wsp-model-menu-icon').evaluateAll(items=>items.map(el=>el.dataset.vendor))).toEqual(['OpenAI','OpenAI','DeepSeek','Anthropic','Google','AI']);
 await expect(page.locator('[data-check]:visible')).toHaveCount(6);await expect(page.locator('#unrelated .wsp-model-menu-icon')).toHaveCount(0);
 await page.evaluate(()=>{window.clicked=0;document.querySelector('.codexModelSelectOption').onclick=()=>window.clicked++;});
 await page.locator('.codexModelSelectOption').first().click();expect(await page.evaluate(()=>clicked)).toBe(1);
});
test('native portaled list supports search/reordering and keeps status cells',async({page})=>{
 await setup(page,'native',nativeSection('Router',['Gemini','Claude']));
 expect(await page.locator('#picker-menu .wsp-model-menu-icon').evaluateAll(items=>items.map(el=>el.dataset.vendor))).toEqual(['Google','Anthropic']);
 await page.locator('#picker-menu').evaluate(el=>{el.querySelector('button[title="Gemini"]').remove();});
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(1);await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveAttribute('data-vendor','Anthropic');
 await expect(page.locator('#picker-menu [data-status] svg')).toBeVisible();
 await page.locator('#picker-menu').evaluate(el=>{el.querySelector('button').title='Gemini';el.querySelector('button > span > span').textContent='Gemini';});
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveAttribute('data-vendor','Google');
});
test('duplicate names use their provider group; ambiguous native headings get a neutral logo',async({page})=>{
 const groups=[{id:'openai-codex',name:'Same',models:[{id:'gpt-6.1',name:'Default'}]},{id:'router',name:'Same',models:[{id:'anthropic/claude',name:'Default'}]}];
 await setup(page,'codex',codexSection('openai-codex',['Default'])+codexSection('router',['Default']),groups);
 expect(await page.locator('#picker-menu .wsp-model-menu-icon').evaluateAll(items=>items.map(el=>el.dataset.vendor))).toEqual(['OpenAI','Anthropic']);
 await page.evaluate(()=>cleanup());await setup(page,'native',nativeSection('Same',['Default']),groups);
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveAttribute('data-vendor','AI');
});
test('effort, speed and verbosity options never receive model logos',async({page})=>{
 await setup(page,'codex',codexSection('openai-codex',['Sol'])+'<div role="menu"><button class="codexModelSelectOption" role="menuitemradio"><span class="codexModelSelectOptionName">High</span></button></div>');
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(1);await expect(page.getByRole('menuitemradio',{name:'High'}).locator('.wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu').evaluate(el=>el.innerHTML='<button role="menuitemradio" title="High">High</button>');
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
});
test('late portal, catalog refresh, close/reopen and disposal work',async({page})=>{
 await setup(page,'native','');
 await page.evaluate(()=>document.querySelector('#picker-menu').remove());
 await page.evaluate(html=>{const menu=document.createElement('div');menu.id='picker-menu';menu.setAttribute('role','menu');menu.innerHTML=html;document.body.append(menu);},nativeSection('ChatGPT',['Sol']));
 await expect(page.locator('.wsp-model-menu-icon')).toHaveAttribute('data-vendor','OpenAI');
 await page.evaluate(()=>dir.set([{id:'openai-codex',name:'ChatGPT',models:[{id:'anthropic/claude',name:'Sol'}]}]));
 await expect(page.locator('.wsp-model-menu-icon')).toHaveAttribute('data-vendor','Anthropic');
 await page.locator('#trigger').evaluate(el=>el.setAttribute('aria-expanded','false'));await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#trigger').evaluate(el=>el.setAttribute('aria-expanded','true'));await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(1);
 await page.evaluate(()=>cleanup());await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu button').evaluate(el=>el.setAttribute('title','Unknown'));await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(0);
});

test('current Codex grouped model pane keeps correct vendors and native DOM',async({page},testInfo)=>{
 const sections=catalog.map(group=>currentCodexSection(group.name,group.models.map(model=>model.name))).join('');
 await setupCurrentCodex(page,currentCodexPane(sections));
 expect(await menuVendors(page)).toEqual(['OpenAI','OpenAI','DeepSeek','Anthropic','Google','AI']);
 await expect(page.locator('#picker-menu .wsp-model-menu-icon svg')).toHaveCount(6);
 expect(await page.locator('#picker-menu').evaluate(menu=>{const clone=menu.cloneNode(true);clone.querySelectorAll('[data-wsp-owned]').forEach(node=>node.remove());return clone.outerHTML===window.nativeMenuBefore;})).toBe(true);
 expect(await page.locator('#picker-menu').evaluate(menu=>window.nativeMenuRows.every((node,index)=>node===menu.querySelectorAll('button')[index]))).toBe(true);
 await page.locator('#picker-menu button').first().click();expect(await page.evaluate(()=>window.syntheticClicks)).toBe(1);
 await expect(page.locator('#unrelated .wsp-model-menu-icon')).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('current-codex-model-logos.png')});
});
test('current Codex other panes cannot borrow a model name or provider heading',async({page})=>{
 // Even known model names/provider labels are not model groups outside the model-only container.
 for(const pane of ['effort','speed','verbosity']) {
  await setupCurrentCodex(page,`<div class="codex-${pane}" role="menu">${currentCodexSection('ChatGPT',['Sol'])}</div>`);
  await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
  await page.evaluate(()=>window.cleanup());
 }
});
test('current Codex unknown, localized and duplicate provider identities remain neutral',async({page})=>{
 const groups=[{id:'openai-codex',name:'Same',models:[{id:'gpt-6.1',name:'Default'},{id:'gpt-6.1-sol',name:'Sol'}]},{id:'router',name:'Same',models:[{id:'anthropic/claude',name:'Default'}]}];
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('Same',['Default'])+currentCodexSection('Unknown heading',['Sol'])+currentCodexSection('未知提供商',['Sol'])),groups);
 expect(await menuVendors(page)).toEqual(['AI','AI','AI']);
});
test('Codex legacy heading identity wins over new labels and stale IDs stay neutral',async({page})=>{
 const groups=[{id:'openai-codex',name:'ChatGPT',models:[{id:'gpt-6.1',name:'Default'}]},{id:'router',name:'Router',models:[{id:'anthropic/claude',name:'Default'}]}];
 const legacy=codexSection('openai-codex',['Default']).replace('role="group"','role="group" aria-label="Router"');
 const stale=currentCodexSection('Router',['Default'],'aria-labelledby="picker-unknown-provider"');
 const empty=currentCodexSection('Router',['Default'],'aria-labelledby=""');
 const missing=currentCodexSection('Router',['Default'],'class="codexModelSelectGroup"');
 await setupCurrentCodex(page,legacy+currentCodexPane(stale+empty+missing),groups);
 expect(await menuVendors(page)).toEqual(['OpenAI','AI','AI','AI']);
});
test('current Codex duplicate model names resolve only within an unambiguous provider',async({page})=>{
 const groups=[{id:'openai-codex',name:'ChatGPT',models:[{id:'gpt-6.1',name:'Default'}]},{id:'router',name:'Router',models:[{id:'anthropic/claude',name:'Default'}]},{id:'mixed',name:'Mixed',models:[{id:'anthropic/claude',name:'Same'},{id:'google/gemini',name:'Same'}]}];
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('ChatGPT',['Default'])+currentCodexSection('Router',['Default'])+currentCodexSection('Mixed',['Same'])),groups);
 expect(await menuVendors(page)).toEqual(['OpenAI','Anthropic','AI']);
});
test('current Codex requires the model root, direct container and provider heading',async({page})=>{
 const pane=currentCodexPane(currentCodexSection('ChatGPT',['Sol']));
 for(const sections of [pane,`<div>${pane}</div>`,currentCodexPane(currentCodexSection('ChatGPT',['Sol']).replace('<div class="codexModelSelectGroupTitle">ChatGPT</div>',''))]) {
  const role=sections===pane?'menu':'group';
  await setup(page,'codex',sections,catalog,{role,class:'codexModelSelectMenu'});
  await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);await page.evaluate(()=>window.cleanup());
 }
});
test('current Codex reacts to provider identity and model pane attribute changes',async({page})=>{
 const groups=[{id:'openai-codex',name:'ChatGPT',models:[{id:'gpt-6.1',name:'Default'}]},{id:'router',name:'Router',models:[{id:'anthropic/claude',name:'Default'}]}];
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('ChatGPT',['Default'])),groups);
 expect(await menuVendors(page)).toEqual(['OpenAI']);
 await page.locator('#picker-menu section').evaluate(el=>el.setAttribute('aria-label','Router'));
 await expect.poll(()=>menuVendors(page)).toEqual(['AI']);
 await page.locator('.codexModelSelectGroupTitle').evaluate(el=>el.firstChild.textContent='Router');
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.locator('#picker-menu').evaluate(el=>el.setAttribute('role','menu'));
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu').evaluate(el=>el.setAttribute('role','group'));
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.locator('#picker-menu .codexModelSelectGroups').evaluate(el=>el.className='otherPane');
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu .otherPane').evaluate(el=>el.className='codexModelSelectGroups');
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.locator('#picker-menu').evaluate(el=>el.className='otherMenu');
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu').evaluate(el=>el.className='codexModelSelectMenu');
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.locator('#picker-menu .codexModelSelectGroups').evaluate(el=>el.setAttribute('role','group'));
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu .codexModelSelectGroups').evaluate(el=>el.setAttribute('role','menu'));
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.evaluate(()=>window.dir.set([{id:'router',name:'Router',models:[{id:'google/gemini',name:'Default'}]}]));
 await expect.poll(()=>menuVendors(page)).toEqual(['Google']);
});
test('current Codex filtering, reorder and disposal leave synthetic native content intact',async({page})=>{
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('Router',['Claude','Gemini'])));
 expect(await menuVendors(page)).toEqual(['Anthropic','Google']);
 await page.locator('#picker-menu section').evaluate(section=>section.append(section.querySelector('button')));
 await expect.poll(()=>menuVendors(page)).toEqual(['Google','Anthropic']);
 await page.locator('#picker-menu button').first().evaluate(el=>el.hidden=true);
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic']);
 await page.locator('#picker-menu button').first().evaluate(el=>el.hidden=false);
 await expect.poll(()=>menuVendors(page)).toEqual(['Google','Anthropic']);
 await page.locator('.codexModelSelectOptionName').first().evaluate(el=>el.firstChild.textContent='Claude');
 await expect.poll(()=>menuVendors(page)).toEqual(['Anthropic','Anthropic']);
 const before=await page.locator('#picker-menu').evaluate(menu=>{const clone=menu.cloneNode(true);clone.querySelectorAll('[data-wsp-owned]').forEach(node=>node.remove());return clone.outerHTML;});
 await page.evaluate(()=>window.cleanup());await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 expect(await page.locator('#picker-menu').evaluate(menu=>menu.outerHTML)).toBe(before);
 await page.locator('.codexModelSelectOptionName').first().evaluate(el=>el.textContent='Gemini');
 await page.evaluate(()=>window.dir.set([]));await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
});
test('current Codex contract never leaks into another controller or menu',async({page})=>{
 const pane=currentCodexPane(currentCodexSection('ChatGPT',['Sol']));
 await setup(page,'native',pane,catalog,{role:'group',class:'codexModelSelectMenu'});
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.evaluate(()=>window.cleanup());await setupCurrentCodex(page,pane);
 expect(await menuVendors(page)).toEqual(['OpenAI']);
 await page.evaluate(html=>{const foreign=document.createElement('div');foreign.id='foreign-model-menu';foreign.className='codexModelSelectMenu';foreign.setAttribute('role','group');foreign.innerHTML=html;document.body.append(foreign);},pane);
 await expect(page.locator('#foreign-model-menu .wsp-model-menu-icon')).toHaveCount(0);
});
test('current Codex hidden sections are cleaned while disabled model rows retain logos',async({page})=>{
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('ChatGPT',['Sol','Astra'])));
 expect(await menuVendors(page)).toEqual(['OpenAI','OpenAI']);
 await page.locator('#picker-menu button').last().evaluate(el=>el.disabled=true);
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(2);
 await page.locator('#picker-menu section').evaluate(el=>el.hidden=true);
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#picker-menu section').evaluate(el=>el.hidden=false);
 await expect.poll(()=>menuVendors(page)).toEqual(['OpenAI','OpenAI']);
});
test('current Codex late menu, close and reopen retain scoped ownership',async({page})=>{
 await setupCurrentCodex(page,currentCodexPane(currentCodexSection('ChatGPT',['Sol'])));
 expect(await menuVendors(page)).toEqual(['OpenAI']);
 await page.locator('#picker-menu').evaluate(menu=>menu.remove());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(html=>{const menu=document.createElement('div');menu.id='picker-menu';menu.className='codexModelSelectMenu';menu.setAttribute('role','group');menu.innerHTML=html;document.body.append(menu);},currentCodexPane(currentCodexSection('Router',['Gemini'])));
 await expect.poll(()=>menuVendors(page)).toEqual(['Google']);
 await page.locator('#trigger').evaluate(el=>el.setAttribute('aria-expanded','false'));
 await expect(page.locator('#picker-menu .wsp-model-menu-icon')).toHaveCount(0);
 await page.locator('#trigger').evaluate(el=>el.setAttribute('aria-expanded','true'));
 await expect.poll(()=>menuVendors(page)).toEqual(['Google']);
 await expect(page.locator('#unrelated .wsp-model-menu-icon')).toHaveCount(0);
});
