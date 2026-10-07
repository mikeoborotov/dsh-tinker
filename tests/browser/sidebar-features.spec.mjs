import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
import { UNREAD_STORAGE_KEY } from '../../src/unread.js';
let fixture;
test.beforeAll(async () => { fixture = await buildFixture('tests/sidebar-fixture.jsx'); });
const pageErrors=new WeakMap();
test.beforeEach(({page}) => { const errors=[];pageErrors.set(page,errors);page.on('pageerror', reason=>errors.push(reason.message)); });
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function mount(page, platform = 'web') {
  await page.route('https://sidebar.test/**', route => route.fulfill({ contentType:'text/html', body:`<!doctype html><html ${platform==='windows'?'data-windows-titlebar':platform==='darwin'?'data-platform="darwin"':''}><body><div id="app"></div><style>#app{height:900px;width:300px}.test-session-row{display:flex;align-items:center;height:34px;cursor:pointer}.test-status{display:inline-flex;align-items:center;justify-content:center;width:16px;flex:none}.test-time{margin-left:auto}.test-row-actions{display:none;align-items:center;gap:10px;margin-left:auto}.test-session-row:hover .test-row-actions{display:inline-flex}.test-session-row:hover .test-time{display:none}html[data-windows-titlebar]{--dsh-windows-titlebar-height:32px}</style></body></html>` }));
  await page.goto('https://sidebar.test/'); await attach(page);
}
async function attach(page) {
  await page.addStyleTag({content:fixture.css}); await page.addScriptTag({content:fixture.js}); await page.evaluate(()=>window.sidebarFixture.mount());
  await expect(page.locator('[data-row-key="session:s1"]')).toBeVisible();
}
const row = (page,id='s1') => page.locator(`[data-row-key="session:${id}"]`);
const reminder = (page,id='s1') => row(page,id).getByRole('img',{name:'Unread reminder'});
async function mark(page,id='s1') { await row(page,id).hover(); await row(page,id).getByRole('button',{name:'Mark as unread',exact:true}).click(); }

test('hover mark on current chat keeps green reminder without opening, changing model or restarting', async({page})=>{
  await mount(page); const before=await page.evaluate(()=>window.sidebarFixture.rows());
  await mark(page);
  await expect(reminder(page)).toBeVisible(); await expect(reminder(page).locator('[data-state="done"]')).toBeVisible();
  expect(await page.evaluate(()=>window.sidebarFixture.opens())).toBe(0);
  expect(await page.evaluate(()=>window.sidebarFixture.rows())).toEqual(before);
  await expect(row(page).locator('.wsp-session-icon')).toHaveAttribute('title','Qwen');
  await page.evaluate(()=>window.sidebarFixture.status('s1','idle')); await expect(reminder(page)).toBeVisible();
  await row(page).locator('>span').nth(2).click(); await expect(reminder(page)).toHaveCount(0);
});

test('native menu supports keyboard selection, closes and returns focus without opening the row', async({page})=>{
  await mount(page); await row(page,'s2').hover(); const anchor=row(page,'s2').getByRole('button',{name:'Menu s2'});
  await anchor.click(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem',{name:'Mark as unread'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0); await expect(anchor).toBeFocused();
  await expect(reminder(page,'s2')).toBeVisible(); expect(await page.evaluate(()=>window.sidebarFixture.opens())).toBe(0);
});

test('failed native menu write restores focus and shows a native failure toast, not a green mark',async({page})=>{
  await mount(page);await page.evaluate(()=>window.sidebarFixture.failWrites());await row(page,'s2').hover();
  const anchor=row(page,'s2').getByRole('button',{name:'Menu s2'});await anchor.click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);await expect(anchor).toBeFocused();
  await expect(page.getByRole('alert').filter({hasText:'Could not save the reminder.'})).toBeVisible();await expect(reminder(page,'s2')).toHaveCount(0);
});

test('an unopened reminder survives reload until its actual opening',async({page})=>{
  await mount(page); await mark(page,'s2'); await page.reload(); await attach(page);
  await expect(reminder(page,'s2')).toBeVisible();
  await page.evaluate(()=>window.sidebarFixture.open('s2')); await expect(reminder(page,'s2')).toHaveCount(0);
});

async function holdUnreadLock(page) {
  await page.evaluate(key=>new Promise(ready=>{
    void navigator.locks.request(key,async()=>{await new Promise(release=>{window.releaseUnreadLock=release;ready();});});
  }),UNREAD_STORAGE_KEY);
}
for(const fail of [false,true]) test(`plugin reenable while a durable mark is queued preserves ${fail?'its failure notice':'its current-chat mark'}`,async({page})=>{
  await mount(page);await holdUnreadLock(page);await mark(page);await page.evaluate(()=>window.sidebarFixture.restartPlugin());
  await page.evaluate(fail=>{if(fail)window.sidebarFixture.failWrites();window.releaseUnreadLock();},fail);
  if(fail) {await expect(page.getByRole('alert').filter({hasText:'Could not save the reminder.'})).toBeVisible();await expect(reminder(page)).toHaveCount(0);}
  else {
    await expect(reminder(page)).toBeVisible();expect(await page.evaluate(()=>window.sidebarFixture.unread().s1)).toBe(true);
    await page.evaluate(()=>window.sidebarFixture.open('s1'));await expect(reminder(page)).toHaveCount(0);
  }
});

test('two real same-origin windows serialize reminders and observe cross-window acknowledgement',async({page,context})=>{
  await mount(page);const other=await context.newPage();await mount(other);
  try {
    await Promise.all([mark(page,'s1'),mark(other,'s2')]);
    await expect.poll(()=>page.evaluate(()=>window.sidebarFixture.unread())).toEqual({s1:true,s2:true});
    await expect(reminder(page,'s2')).toBeVisible();await expect(reminder(other,'s1')).toBeVisible();
    await other.evaluate(()=>window.sidebarFixture.open('s1'));
    await expect(reminder(page,'s1')).toHaveCount(0);await expect(reminder(other,'s1')).toHaveCount(0);
    await expect(reminder(page,'s2')).toBeVisible();await expect(reminder(other,'s2')).toBeVisible();
  } finally {await other.close();}
});

test('native running/warning/completion/archive status takes precedence; manual mark is not discarded',async({page})=>{
  await mount(page); await mark(page);
  for(const status of ['ongoing','warning','done','archived']) {
    await page.evaluate(status=>window.sidebarFixture.status('s1',status),status);
    await expect(reminder(page)).toHaveCount(0);
    if(status!=='archived') await expect(row(page).locator(`.test-status>[data-state="${status}"]`)).toBeVisible();
    expect(await page.evaluate(()=>window.sidebarFixture.unread().s1)).toBe(true);
  }
  await page.evaluate(()=>window.sidebarFixture.status('s1','idle')); await expect(reminder(page)).toBeVisible();
});

test('feature disable removes action and green marker but retains saved unread reminder',async({page})=>{
  await mount(page); await mark(page,'s2'); await page.getByRole('switch',{name:'Mark chats unread'}).click();
  await expect(reminder(page,'s2')).toHaveCount(0); await expect(page.getByRole('button',{name:'Mark as unread',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>window.sidebarFixture.unread().s2)).toBe(true);
  await page.getByRole('switch',{name:'Mark chats unread'}).click(); await expect(reminder(page,'s2')).toBeVisible();
});

test('RU labels, write failure and corrupt-state recovery are visible instead of false success',async({page})=>{
  await mount(page); await page.evaluate(()=>window.sidebarFixture.setLanguage('ru')); await row(page,'s2').hover();
  await expect(row(page,'s2').getByRole('button',{name:'Пометить непрочитанным'})).toBeVisible();
  await page.evaluate(()=>window.sidebarFixture.failWrites()); await row(page,'s2').getByRole('button',{name:'Пометить непрочитанным'}).click();
  await expect(row(page,'s2').getByRole('alert')).toContainText('QuotaExceededError'); expect(await page.evaluate(()=>window.sidebarFixture.unread().s2)).toBeUndefined();
  await page.reload(); await attach(page); await page.evaluate(()=>window.sidebarFixture.corruptUnread());
  await page.reload(); await attach(page); await expect(page.getByRole('alert').first()).toContainText('Unread reminders could not be read');
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Reset plugin settings',exact:true}).click();
  await mark(page,'s2'); await expect(reminder(page,'s2')).toBeVisible();
});

for (const platform of ['web','windows','darwin']) {
  test(`brand row removed with its height; New Session and toggle survive (${platform})`,async({page})=>{
    await mount(page,platform);
    const fresh=page.getByRole('button',{name:'New Session',exact:true}).last(), after=await fresh.evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
    await expect(page.locator('[data-wsp-brand-row]')).toHaveCSS('height','0px');
    await expect(page.locator('[data-wsp-brand-hidden]')).toBeHidden();
    await fresh.click(); expect(await page.evaluate(()=>window.sidebarFixture.starts())).toBe(1);
    await page.getByRole('button',{name:'Collapse sidebar'}).click(); await expect(page.getByRole('button',{name:'Expand sidebar'})).toBeVisible();
    await page.getByRole('button',{name:'Expand sidebar'}).click(); await expect(page.locator('[data-wsp-brand-row]')).toHaveCSS('height','0px');
    await page.getByRole('switch',{name:'Hide sidebar branding'}).click();
    await expect(page.locator('[data-wsp-brand-row]')).toHaveCount(0); await expect(page.getByText('DeepSeek Harness',{exact:true})).toBeVisible();
    const before=await fresh.evaluate(el=>el.getBoundingClientRect().top+window.scrollY); expect(before-after).toBeGreaterThan(platform==='windows'?35:45);
    await page.getByRole('switch',{name:'Hide sidebar branding'}).click(); await expect(page.locator('[data-wsp-brand-row]')).toHaveCSS('height','0px');
    if(platform==='web') {
      await page.evaluate(()=>window.scrollTo(0,0));
      await expect(fresh).toBeVisible();
      await page.screenshot({path:'test-results/sidebar-next-light.png'});
      await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme','')); await page.screenshot({path:'test-results/sidebar-next-dark.png'});
    }
    await page.evaluate(()=>window.sidebarFixture.dispose()); await expect(page.locator('[data-wsp-brand-row]')).toHaveCount(0); await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
  });
}
