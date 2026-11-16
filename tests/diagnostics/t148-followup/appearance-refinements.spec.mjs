import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { buildNative } from './build-native.mjs';
let fixture;
test.beforeAll(async()=>{fixture=await buildNative();});
for(const [lang,copy] of Object.entries({
  en:['Rename','Appearance','Show in folder','Delete workspace'],
  ru:['Переименовать','Оформление','Показать в папке','Удалить рабочую область'],
}))test(`T165 full captured native adapter places Appearance immediately after Rename in ${lang}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.abort());await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({content:fixture.css});await page.addScriptTag({type:'module',content:fixture.js});await page.waitForFunction(()=>Boolean(window.t148followup));
  await page.evaluate(lang=>window.t148followup.mount({lang,adapterEnabled:true}),lang);
  const trigger=page.locator('[data-row-key="workspace:w1"] button[data-context-menu-trigger]');
  const open=async()=>{await page.locator('[data-row-key="workspace:w1"]').hover();await trigger.click();await expect(page.locator('[data-wsp-menu="w1"]')).toHaveCount(1);};
  await open();
  const order=()=>page.evaluate(()=>[...document.querySelector('[role="menu"] > [role="presentation"]').children].map(node=>node.getAttribute('role')==='separator'?'separator':node.hasAttribute('data-slot')?'content':node.querySelector('button')?.textContent));
  const wanted=[...copy.slice(0,3),'separator',copy[3],'content'];
  await expect.poll(order).toEqual(wanted);
  await expect(page.locator('[data-wsp-menu-wrapper="w1"][data-wsp-owned] > [data-wsp-menu="w1"][data-wsp-owned]')).toHaveCount(1);
  await page.evaluate(()=>{
    const menu=document.querySelector('[role="menu"]');
    window.nativeRefinement={buttons:[...menu.querySelectorAll('button:not([data-wsp-owned])')].map(button=>({button,wrapper:button.parentElement,html:button.outerHTML,icon:button.firstElementChild,glyph:button.querySelector('svg')})),sep:menu.querySelector('[role="separator"]'),content:menu.querySelector('[data-slot="contextMenu.content"]'),own:menu.querySelector('[data-wsp-menu]')};
    document.dispatchEvent(new Event('scroll',{bubbles:true}));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  expect(await order()).toEqual(wanted);
  expect(await page.evaluate(()=>{
    const ref=window.nativeRefinement,menu=document.querySelector('[role="menu"]');
    return ref.buttons.every(({button,wrapper,html,icon,glyph})=>button.isConnected&&button.parentElement===wrapper&&button.outerHTML===html&&button.firstElementChild===icon&&button.querySelector('svg')===glyph)
      &&menu.querySelector('[role="separator"]')===ref.sep&&menu.querySelector('[data-slot="contextMenu.content"]')===ref.content&&menu.querySelector('[data-wsp-menu]')===ref.own;
  })).toBe(true);
  const snapshot=await page.evaluate(()=>window.t148followup.snapshot());expect(snapshot.errors).toEqual([]);expect(snapshot.calls).toEqual({rename:0,delete:0,reveal:0,newSession:0});
  await writeFile(testInfo.outputPath('native-refined-menu.html'),snapshot.menu.replaceAll('><','>\n<'));await page.getByRole('menu').screenshot({path:testInfo.outputPath('native-refined-menu.png')});
  for(const [label,action] of [[copy[0],'rename'],[copy[2],'reveal'],[copy[3],'delete']]){
    await page.getByRole('menuitem',{name:label,exact:true}).locator('svg').click();await expect(page.getByRole('menu')).toHaveCount(0);
    expect((await page.evaluate(()=>window.t148followup.snapshot())).calls[action]).toBe(1);await open();expect(await order()).toEqual(wanted);
  }
  await page.getByRole('menuitem',{name:copy[1],exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0);
  const final=await page.evaluate(()=>window.t148followup.snapshot());expect(final.calls).toEqual({rename:1,delete:1,reveal:1,newSession:0});expect(final.edits).toEqual([{id:'w1',anchor:await trigger.getAttribute('aria-label')}]);
  expect(errors).toEqual([]);
});
