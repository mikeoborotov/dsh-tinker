import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { buildNative } from './build-native.mjs';
let fixture;
test.beforeAll(async()=>{fixture=await buildNative();});
test('full captured current native menu keeps Appearance above the untouched Delete divider',async({page},testInfo)=>{
  await page.route('**/*',route=>route.abort());await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({content:fixture.css});await page.addScriptTag({type:'module',content:fixture.js});await page.waitForFunction(()=>Boolean(window.t148followup));
  await page.evaluate(()=>window.t148followup.mount({adapterEnabled:true}));
  const row=page.locator('[data-row-key="workspace:w1"]');await row.hover();await row.locator('button[data-context-menu-trigger]').click();await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  const order=()=>page.evaluate(()=>[...document.querySelector('[role="menu"] > [role="presentation"]').children].map(node=>node.getAttribute('role')==='separator'?'separator':node.hasAttribute('data-slot')?'content':node.querySelector('button')?.textContent));
  await expect.poll(order).toEqual(['Rename','Show in folder','Appearance','separator','Delete workspace','content']);
  await page.evaluate(()=>{const menu=document.querySelector('[role="menu"]'),remove=[...menu.querySelectorAll('button')].find(button=>button.textContent==='Delete workspace');window.nativeRefinement={remove,wrapper:remove.parentElement,icon:remove.firstElementChild,sep:menu.querySelector('[role="separator"]')};document.dispatchEvent(new Event('scroll',{bubbles:true}));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  expect(await order()).toEqual(['Rename','Show in folder','Appearance','separator','Delete workspace','content']);
  expect(await page.evaluate(()=>{const ref=window.nativeRefinement,menu=document.querySelector('[role="menu"]');return ref.remove.isConnected&&ref.remove.parentElement===ref.wrapper&&ref.remove.firstElementChild===ref.icon&&menu.querySelector('[role="separator"]')===ref.sep;})).toBe(true);
  const snapshot=await page.evaluate(()=>window.t148followup.snapshot());expect(snapshot.errors).toEqual([]);expect(snapshot.calls).toEqual({rename:0,delete:0,reveal:0,newSession:0});
  await writeFile(testInfo.outputPath('native-refined-menu.html'),snapshot.menu.replaceAll('><','>\n<'));await page.getByRole('menu').screenshot({path:testInfo.outputPath('native-refined-menu.png')});
  await page.getByRole('menuitem',{name:'Delete workspace',exact:true}).locator('svg').click();expect((await page.evaluate(()=>window.t148followup.snapshot())).calls.delete).toBe(1);
});
