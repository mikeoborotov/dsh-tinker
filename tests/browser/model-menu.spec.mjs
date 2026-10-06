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
async function setup(page, kind, sections='', groups=catalog) {
 await page.setContent(`<div id="toolbar"><div class="${kind==='codex'?'codexModelSelect':''}"><button id="trigger" ${kind==='codex'?'class="codexModelSelectTrigger"':'aria-busy="false"'} aria-haspopup="menu" title="Sol" aria-expanded="true" aria-controls="picker-menu">${kind==='codex'?'<span class="codexModelSelectLabel">Sol</span>':'<svg width="16" height="16"/>'}</button></div><span id="marker"></span></div><div id="unrelated" role="menu">${nativeSection('Other',['Sol'])}</div>`);
 await page.addScriptTag({content:code});await page.addStyleTag({content:CSS+'button[role=menuitemradio]{display:flex;align-items:center;gap:8px}'});
 await page.evaluate(({groups,sections})=>{
  const listeners=new Set();let state={groups};
  window.dir={getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},set(groups){state={groups};for(const fn of listeners)fn()}};
  const menu=document.createElement('div');menu.id='picker-menu';menu.setAttribute('role','menu');menu.innerHTML=sections;document.body.append(menu);
  window.cleanup=MenuIcons.attachModelMenuIcons(document.querySelector('#marker'),dir);
 },{groups,sections});
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
