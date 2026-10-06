import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { CSS } from '../../src/styles.js';
let code;
test.beforeAll(async()=>{code=(await build({entryPoints:['src/adapters.js'],bundle:true,platform:'browser',format:'iife',globalName:'Adapters',write:false})).outputFiles[0].text;});
test('logo is visible in installed Codex Subscription 2.5.2 selector',async({page})=>{
 // Exact trigger attributes/children from installed dsh-codex-subscription/lib/client.js:9238-9262.
 await page.setContent(`<div id="toolbar"><div class="codexModelSelect"><button type="button" class="codexModelSelectTrigger" aria-label="Sol" aria-haspopup="menu" aria-expanded="false" title="Sol"><span class="codexModelSelectLabel">Sol</span><span class="codexModelSelectEffort">High</span><svg class="codexModelSelectChevron"><path/></svg></button></div><div id="marker"></div></div>`);
 await page.addScriptTag({content:code});await page.addStyleTag({content:CSS});
 await page.evaluate(()=>{window.cleanup=Adapters.attachComposerIcon(document.querySelector('#marker'),{provider:'openai-codex',model:'sol'});});
 await expect(page.locator('.codexModelSelectTrigger .wsp-composer-icon:visible')).toHaveCount(1,{timeout:1000});
 await expect(page.locator('.codexModelSelectChevron')).toBeVisible();
 await page.evaluate(()=>window.cleanup());
 await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
});

test('late-mounted subscription picker and React replacement are observed',async({page})=>{
 await page.setContent('<div id="toolbar"><div id="picker"></div><span id="marker"></span></div>');await page.addScriptTag({content:code});await page.addStyleTag({content:CSS});
 await page.evaluate(()=>{window.cleanup=Adapters.attachComposerIcon(document.querySelector('#marker'),{provider:'openai-codex',model:'sol'});});
 async function mount(label){await page.evaluate(label=>document.querySelector('#picker').innerHTML=`<button class="codexModelSelectTrigger" aria-haspopup="menu" title="${label}"><span class="codexModelSelectLabel">${label}</span><svg class="codexModelSelectChevron" width="14" height="14"></svg></button>`,label);}
 await mount('Sol');await expect(page.locator('.wsp-composer-icon:visible')).toHaveCount(1);
 await mount('Sol after remount');await expect(page.locator('.wsp-composer-icon:visible')).toHaveCount(1);
 await expect(page.locator('.codexModelSelectChevron')).toBeVisible();
 await page.evaluate(()=>window.cleanup());await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
});
