import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1360,height:960}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try {
 await page.addLocatorHandler(page.getByRole('button',{name:'Continue',exact:true}),async locator=>locator.click());
 await page.addLocatorHandler(page.getByRole('button',{name:'Configure later',exact:true}),async locator=>locator.click());
 await page.goto(process.env.DSH_TEST_URL);await page.locator('.wsp-composer-icon:visible').first().waitFor();
 const trigger=page.locator('button[aria-haspopup="menu"][aria-busy][title]').first();
 await trigger.click();
 let id=await trigger.getAttribute('aria-controls'), selector=await page.evaluate(id=>'#'+CSS.escape(id),id), menu=page.locator(selector);
 if(await menu.locator('section[data-menu-group] > button[role="menuitemradio"]').count()===0)await menu.getByRole('menuitem',{name:/^Model/}).click();
 const options=menu.locator('section[data-menu-group] > button[role="menuitemradio"]');await options.first().waitFor();
 const count=await options.count();await expect(menu.locator('.wsp-model-menu-icon')).toHaveCount(count);
 console.log('MODEL_ROWS',count,'VENDORS',await menu.locator('.wsp-model-menu-icon').evaluateAll(items=>items.map(el=>el.dataset.vendor)));
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/model-menu-host-light.png'});
 await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));await page.screenshot({path:'test-results/model-menu-host-dark.png'});await page.evaluate(()=>document.body.removeAttribute('data-ds-dark-theme'));
 const search=menu.locator('input');
 if(await search.count()) {
  const text=await options.first().getAttribute('title');await search.fill(text);await expect(menu.locator('.wsp-model-menu-icon')).toHaveCount(await options.count());console.log('NATIVE_SEARCH_OK');
 }
 await options.first().click();await expect(menu).toHaveCount(0);await expect(page.locator('.wsp-model-menu-icon')).toHaveCount(0);
 await trigger.click();id=await trigger.getAttribute('aria-controls');selector=await page.evaluate(id=>'#'+CSS.escape(id),id);menu=page.locator(selector);
 if(await menu.locator('section[data-menu-group] > button[role="menuitemradio"]').count()===0)await menu.getByRole('menuitem',{name:/^Model/}).click();
 await expect(menu.locator('.wsp-model-menu-icon').first()).toBeVisible();
 expect(errors).toEqual([]);console.log('MODEL_MENU_HOST_OK: native RC.2 list, selection, close/reopen, light/dark');
} catch(e) {console.log('ERRORS',errors);console.log('BODY',(await page.locator('body').innerText()).slice(0,2500));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/model-menu-host-failure.png'});throw e;}
finally {await browser.close();}
