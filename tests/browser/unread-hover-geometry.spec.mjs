import { test, expect } from '@playwright/test';
import { buildHoverFixture } from '../native-hover-rc1/build-fixture.mjs';
import { UNREAD_STORAGE_KEY } from '../../src/unread.js';
let fixture;
test.beforeAll(async()=>{fixture=await buildHoverFixture('tests/unread-hover-fixture.jsx');});
const errors=new WeakMap();
test.beforeEach(({page})=>{const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
const row=page=>page.locator('[data-row-key="session:fake-current"]');
const unread=page=>page.getByRole('button',{name:'Mark as unread',exact:true});
async function mount(page,zoom=1){
  await page.route('**/*',route=>route.request().url()==='https://unread-hover.test/'?route.fulfill({contentType:'text/html',body:'<!doctype html><html data-windows-titlebar><body><div id="app"></div></body></html>'}):route.abort());
  await page.goto('https://unread-hover.test/');await page.addStyleTag({content:fixture.css});await page.addScriptTag({content:fixture.js});
  await page.evaluate(zoom=>{document.body.style.zoom=String(zoom);window.unreadHoverFixture.mount();},zoom);
  await expect(row(page)).toBeVisible();await row(page).hover({position:{x:60*zoom,y:16*zoom}});await expect(unread(page)).toBeVisible();
}
async function boxes(page){return page.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return{width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
  return Object.fromEntries(['Mark as unread','Archive','Pin'].map(label=>{const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label);return[label,{button:rect(button),svg:rect(button.querySelector('svg'))}];}));
});}
async function assertTooltip(page){
  const tooltip=page.getByRole('tooltip').filter({hasText:'Mark as unread'});await expect(tooltip).toHaveText('Mark as unread');
  await expect(tooltip).toHaveAttribute('data-side','bottom');
  const anchor=await unread(page).boundingBox(),bubble=await tooltip.boundingBox();
  expect(anchor.width).toBeGreaterThan(0);expect(anchor.height).toBeGreaterThan(0);
  expect(bubble.y-anchor.y-anchor.height,'Tooltip anchored below the actual button').toBeCloseTo(8,4);
  expect(bubble.x+bubble.width-anchor.x-anchor.width,'Tooltip aligns with button end').toBeCloseTo(0,4);
}
function assertGeometry(measured,zoom=1){
  const references=[measured.Archive,measured.Pin];
  for(const control of references){expect(control.button.width/zoom).toBeCloseTo(24,5);expect(control.button.height/zoom).toBeCloseTo(24,5);expect(control.svg.width/zoom).toBeCloseTo(14,5);expect(control.svg.height/zoom).toBeCloseTo(14,5);expect(control.svg.cy).toBeCloseTo(control.button.cy,5);}
  const action=measured['Mark as unread'];
  expect.soft(action.button.width/zoom,'current native hover hit area').toBeCloseTo(24,5);expect.soft(action.button.height/zoom).toBeCloseTo(24,5);
  expect.soft(action.svg.width/zoom,'current native hover SVG viewport').toBeCloseTo(14,5);expect.soft(action.svg.height/zoom).toBeCloseTo(14,5);
  for(const control of references){expect.soft(action.button.cy,'button center against native control').toBeCloseTo(control.button.cy,5);expect.soft(action.svg.cy,'SVG center against native control').toBeCloseTo(control.svg.cy,5);}
}
for(const dpr of [1,2])test.describe(`DPR ${dpr}`,()=>{
  test.use({viewport:{width:523,height:208},deviceScaleFactor:dpr});
  for(const zoom of [1,1.25])test(`hover SVG/hit area/centers follow native at zoom ${zoom}`,async({page},testInfo)=>{
    await mount(page,zoom);assertGeometry(await boxes(page),zoom);
    const snapshot=await page.evaluate(()=>window.unreadHoverFixture.snapshot());
    expect(snapshot.counters).toEqual({opens:0,marks:0,archives:0,pins:0,changes:0});
    expect(snapshot.stored).toBeNull();
    const svg=unread(page).locator('svg');await expect(svg).toHaveAttribute('viewBox','0 0 16 16');await expect(svg).toHaveAttribute('aria-hidden','true');
    await expect(svg.locator('circle')).toHaveAttribute('cx','13.5');await expect(svg.locator('circle')).toHaveAttribute('cy','3.5');await expect(svg.locator('circle')).toHaveAttribute('r','2');
    await expect(svg.locator('path')).toHaveAttribute('d','M12 3H2.5A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V7M1.5 4l6.5 5 4-3');
    const menuSvg=page.getByRole('menuitem',{name:'Mark as unread'}).locator('svg');await expect(menuSvg).toHaveAttribute('width','16');await expect(menuSvg).toHaveAttribute('height','16');
    await page.evaluate(()=>window.unreadHoverFixture.running(true));await expect(row(page).locator('[data-state="ongoing"]')).toBeVisible();assertGeometry(await boxes(page),zoom);
    if(dpr===1&&zoom===1)await page.screenshot({path:testInfo.outputPath('unread-hover.png')});
  });
});

test('keyboard focus/tooltip and durable mark survive feature off and remount without opening current chat',async({page})=>{
  await mount(page);const before=await page.evaluate(()=>window.unreadHoverFixture.snapshot());
  await unread(page).hover();await assertTooltip(page);
  await page.mouse.move(0,200);await row(page).focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  await expect(unread(page)).toBeFocused();await expect(unread(page)).toHaveCSS('outline-style','solid');await expect(unread(page)).toHaveCSS('outline-width','2px');
  await assertTooltip(page);
  assertGeometry(await boxes(page));
  await page.evaluate(key=>new Promise(ready=>{void navigator.locks.request(key,async()=>{await new Promise(release=>{window.releaseUnreadHoverLock=release;ready();});});}),UNREAD_STORAGE_KEY);
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.unreadHoverFixture.snapshot().counters.marks)).toBe(1);
  expect(await page.evaluate(()=>window.unreadHoverFixture.snapshot().stored)).toBeNull();
  await page.evaluate(()=>window.releaseUnreadHoverLock());
  await expect.poll(()=>page.evaluate(()=>window.unreadHoverFixture.snapshot().unread['fake-current'])).toBe(true);
  const marked=await page.evaluate(()=>window.unreadHoverFixture.snapshot());
  expect(JSON.parse(marked.stored)).toEqual({version:1,unread:{'fake-current':true}});expect(marked.session).toEqual(before.session);
  expect(marked.counters).toEqual({opens:0,marks:1,archives:0,pins:0,changes:1});
  await page.evaluate(()=>window.unreadHoverFixture.toggle(false));await expect(unread(page)).toHaveCount(0);expect(await page.evaluate(()=>window.unreadHoverFixture.snapshot().stored)).toBe(marked.stored);
  await page.evaluate(()=>window.unreadHoverFixture.toggle(true));await row(page).hover();await expect(unread(page)).toHaveCount(1);assertGeometry(await boxes(page));
  await page.evaluate(()=>window.unreadHoverFixture.dispose());await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
  await page.evaluate(()=>window.unreadHoverFixture.mount());await row(page).hover();await expect(unread(page)).toHaveCount(1);assertGeometry(await boxes(page));
  expect(await page.evaluate(()=>window.unreadHoverFixture.snapshot())).toEqual(marked);
});
