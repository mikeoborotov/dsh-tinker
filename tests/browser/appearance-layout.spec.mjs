import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
import samples from '../image-fixtures.json' with { type:'json' };
let fixture;
test.beforeAll(async()=>{fixture=await buildFixture();});
const words={
 en:{title:'Workspace appearance',preview:'Preview in workspace list',type:'Select icon type',color:'Select icon color',icon:'Select icon',emoji:'Select emoji',paste:'Or paste your emoji',upload:'Upload image',modes:['Icon','Emoji','Image'],category:'Emoji category',search:'Search emoji',all:'All categories',cancel:'Cancel',save:'Save',close:'Close',reset:'Restore default'},
 ru:{title:'Оформление Workspace',preview:'Превью в списке Workspace',type:'Выберите тип иконки',color:'Выберите цвет иконки',icon:'Выберите иконку',emoji:'Выберите эмодзи',paste:'Или вставьте свой эмодзи',upload:'Загрузите изображение',modes:['Иконка','Emoji','Изображение'],category:'Категория emoji',search:'Поиск emoji',all:'Все категории',cancel:'Отмена',save:'Сохранить',close:'Закрыть',reset:'Восстановить по умолчанию'},
};
const pageErrors=new WeakMap();
test.beforeEach(({page})=>{const errors=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function setup(page,{language='en',dark=true,viewport={width:1280,height:900},longName=false}={}){
 await page.setViewportSize(viewport);
 await page.route('http://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="margin:0;background:var(--dsw-alias-bg-layer-1)"><div data-row-key="workspace:w1" role="treeitem"><span><svg width="16" height="16"/></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div><div id="overlay"></div><div id="settings"></div><div id="marker"></div></body></html>`}));
 await page.goto('http://fixture.test/');await page.addStyleTag({content:fixture.css});
 if(dark)await page.evaluate(()=>document.body.setAttribute('data-ds-dark-theme',''));
 await page.addScriptTag({content:fixture.js});await page.evaluate(({language,longName})=>{window.fixture.mount();window.fixture.setLanguage(language);if(longName)window.fixture.setWorkspaces([{workspaceId:'w1',title:'A protected workspace name '.repeat(18),sessionIds:['s1']}]);},{language,longName});
 await page.evaluate(()=>window.fixture.openWorkspaceMenu());await page.getByRole('menuitem',{name:/^(Appearance|Оформление)$/}).click();await expect(page.getByRole('dialog')).toBeVisible();
}
const category=(page,language='en')=>page.getByRole('button',{name:words[language].category,exact:true});
const menu=page=>page.locator('.wsp-emoji-category-menu');
async function geometry(page,language='en'){
 const box=await page.getByRole('dialog').boundingBox(),save=await page.getByRole('button',{name:words[language].save,exact:true}).boundingBox();return {...box,footerY:save.y};
}
function sameGeometry(actual,expected){for(const key of ['x','y','width','height','footerY'])expect(Math.abs(actual[key]-expected[key]),key).toBeLessThan(.6);}
async function mode(page,index,language='en'){await page.getByRole('button',{name:words[language].modes[index],exact:true}).click();}
for(const [language,dark]of[['en',true],['ru',false]])test(`B approved desktop geometry and labels ${language}`,async({page},testInfo)=>{
 await setup(page,{language,dark,longName:true});const t=words[language];const initial=await geometry(page,language);
 expect(initial.width).toBe(760);expect(initial.height).toBe(620);
 const left=await page.locator('.wsp-appearance-context').boundingBox(),right=await page.locator('.wsp-appearance-editor').boundingBox();expect(left.width).toBe(208);expect(right.x).toBeGreaterThan(left.x+left.width);
 await expect(page.getByText(t.type,{exact:true})).toBeVisible();await expect(page.getByRole('group',{name:t.preview,exact:true})).toBeVisible();
 await expect(page.locator('.wsp-list-preview')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.wsp-list-preview')).toHaveCSS('border-width','0px');await expect(page.locator('.wsp-list-preview>span:last-child')).toHaveCSS('text-overflow','ellipsis');
 await expect(page.getByRole('dialog')).not.toContainText('Customize how');
 for(const index of [0,1,2]){
  await mode(page,index,language);sameGeometry(await geometry(page,language),initial);await expect(page.getByRole('button',{name:t.save,exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:t.cancel,exact:true})).toBeInViewport();
  for(const label of index===0?[t.color,t.icon]:index===1?[t.emoji,t.paste]:[t.upload])await expect(page.getByText(label,{exact:true})).toBeVisible();
  await page.mouse.move(1100,800);await page.getByRole('dialog').screenshot({path:testInfo.outputPath(`${language}-${index}.png`),animations:'disabled'});
 }
});
test('B category is a real portaled native Menu with aligned hover/check and preserved query',async({page},testInfo)=>{
 await setup(page);await mode(page,1);await expect(page.getByRole('combobox')).toHaveCount(0);await expect(category(page)).toHaveCSS('height','44px');
 const search=page.getByRole('searchbox',{name:'Search emoji',exact:true});await search.fill('rocket');const before=await geometry(page);await category(page).click();await expect(menu(page)).toBeVisible();
 expect(await menu(page).evaluate(node=>node.closest('[role="dialog"]')===null)).toBe(true);await expect(menu(page)).toHaveAttribute('role','menu');await expect(menu(page).getByRole('menuitem')).toHaveCount(10);await expect(page.getByRole('listbox')).toHaveCount(0);
 const all=menu(page).getByRole('menuitem',{name:'All categories',exact:true}),animals=menu(page).getByRole('menuitem',{name:'Animals & Nature',exact:true});await expect(all.locator('svg')).toHaveCount(1);await expect(all.locator('svg')).toHaveCSS('width','14px');
 await animals.hover();await expect(animals).toHaveCSS('padding','6px 8px');await expect(animals).toHaveCSS('min-height','34px');await expect(animals).toHaveCSS('border-radius','12px');
 const card=await menu(page).boundingBox(),row=await animals.boundingBox();expect(Math.abs(row.x-card.x-4)).toBeLessThan(.6);expect(Math.abs(row.width-card.width+8)).toBeLessThan(.6);
 await page.screenshot({path:testInfo.outputPath('native-menu-hover.png')});sameGeometry(await geometry(page),before);
 await animals.click();await expect(menu(page)).toHaveCount(0);await expect(category(page)).toBeFocused();await expect(search).toHaveValue('rocket');await expect(page.getByRole('status')).toHaveText('No results');
 await category(page).click();await expect(menu(page).getByRole('menuitem',{name:'Animals & Nature',exact:true}).locator('svg')).toHaveCount(1);await expect(menu(page).getByRole('menuitem',{name:'All categories',exact:true}).locator('svg')).toHaveCount(0);
 await menu(page).getByRole('menuitem',{name:'Travel & Places',exact:true}).click();await expect(page.locator('.wsp-emoji-grid').getByRole('button',{name:'rocket',exact:true})).toHaveText('🚀');await expect(search).toHaveValue('rocket');
 await page.locator('.wsp-emoji-grid').getByRole('button',{name:'rocket',exact:true}).click();await mode(page,2);await mode(page,1);await expect(search).toHaveValue('rocket');await expect(category(page)).toContainText('Travel & Places');await expect(page.locator('#wsp-emoji')).toHaveValue('🚀');expect(await page.evaluate(()=>localStorage.getItem('dsh-workspace-plus:v1'))).toBeNull();
});
test('B native category keyboard enters first row; Tab commits, Shift+Tab returns, Escape closes one layer',async({page})=>{
 await setup(page);await mode(page,1);await category(page).focus();await category(page).press('ArrowDown');await expect(menu(page).getByRole('menuitem').first()).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(menu(page).getByRole('menuitem',{name:'Smileys & Emotion',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(menu(page)).toHaveCount(0);await expect(category(page)).toBeFocused();await expect(category(page)).toContainText('Smileys & Emotion');await expect(page.getByRole('dialog')).toBeVisible();
 await category(page).press('Enter');await expect(menu(page).getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('End');await expect(menu(page).getByRole('menuitem',{name:'Flags',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(menu(page)).toHaveCount(0);await expect(category(page)).toBeFocused();
 await category(page).press('Space');await page.keyboard.press('Escape');await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('dialog')).toBeVisible();await expect(category(page)).toBeFocused();expect(await page.evaluate(()=>localStorage.getItem('dsh-workspace-plus:v1'))).toBeNull();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#menu-anchor')).toBeFocused();
});
test('B category IME cannot open, select or close an outer modal',async({page})=>{
 await setup(page);await mode(page,1);await category(page).focus();await category(page).dispatchEvent('compositionstart');await category(page).press('ArrowDown');await expect(menu(page)).toHaveCount(0);await category(page).dispatchEvent('compositionend');await category(page).dispatchEvent('keyup',{key:'ArrowDown',code:'ArrowDown',keyCode:40});
 await category(page).press('ArrowDown');const first=menu(page).getByRole('menuitem').first();await expect(first).toBeFocused();await first.dispatchEvent('compositionstart');await first.press('Enter');await expect(menu(page)).toBeVisible({timeout:1000});await first.press('Escape');await expect(menu(page)).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();await first.dispatchEvent('compositionend');await first.dispatchEvent('keyup',{key:'Escape',code:'Escape',keyCode:27});await first.press('Escape');await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('dialog')).toBeVisible();
});
test('B late input composition Enter cannot commit a menu category',async({page})=>{
 await setup(page);await mode(page,1);const input=page.locator('#wsp-emoji');await input.focus();await input.dispatchEvent('compositionstart');await input.dispatchEvent('compositionend');
 // No closing-key keyup before focus moves from a real editable input to Menu.
 await category(page).click();const first=menu(page).getByRole('menuitem').first();await expect(first).toBeFocused();await first.press('Enter');expect(await page.evaluate(()=>localStorage.getItem('dsh-workspace-plus:v1'))).toBeNull();await expect(page.getByRole('dialog')).toBeVisible();await expect(menu(page)).toBeVisible({timeout:1000});
 await first.press('Enter');await expect(menu(page)).toHaveCount(0);await expect(category(page)).toBeFocused();await input.fill('🏠');await input.press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dsh-workspace-plus:v1')).appearances.w1)).toEqual({kind:'emoji',emoji:'🏠'});
});
test('B late input composition ArrowDown is guarded once before category opening',async({page})=>{
 await setup(page);await mode(page,1);const input=page.locator('#wsp-emoji');await input.focus();await input.dispatchEvent('compositionstart');await input.dispatchEvent('compositionend');await category(page).focus();await category(page).press('ArrowDown');await expect(menu(page)).toHaveCount(0,{timeout:1000});
 await category(page).press('ArrowDown');await expect(menu(page).getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
});

test('B category dismisses on kind, locale, reset, editor scroll and workspace removal without losing drafts',async({page})=>{
 await setup(page);await mode(page,1);await page.getByRole('searchbox',{name:'Search emoji',exact:true}).fill('rocket');await page.locator('#wsp-emoji').fill('🏠');await category(page).click();await page.evaluate(()=>window.fixture.setLanguage('ru'));await expect(menu(page)).toHaveCount(0);
 await category(page,'ru').click();await mode(page,0,'ru');await expect(menu(page)).toHaveCount(0);await mode(page,1,'ru');await expect(page.getByRole('searchbox',{name:'Поиск emoji',exact:true})).toHaveValue('rocket');await expect(page.locator('#wsp-emoji')).toHaveValue('🏠');
 await category(page,'ru').click();await page.getByRole('button',{name:words.ru.reset,exact:true}).click();await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('button',{name:words.ru.reset,exact:true})).toBeFocused();
 await page.setViewportSize({width:800,height:360});await category(page,'ru').click();await page.locator('.wsp-appearance-editor').evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(menu(page)).toHaveCount(0);
 await category(page,'ru').click();await page.evaluate(()=>window.fixture.setWorkspaces([]));await expect(page.getByRole('dialog')).toHaveCount(0);await expect(menu(page)).toHaveCount(0);await expect(page.locator('[data-menu-backing]')).toHaveCount(0);
});
test('B pending owner autofocus respects native navigation and cancels stale open/context generations',async({page})=>{
 await setup(page);await mode(page,1);
 // Hold only the owner's API handoff. Native placement, Menu keys and focus stay real.
 await page.evaluate(()=>{const raf=requestAnimationFrame,caf=cancelAnimationFrame;window.bCategoryFrames=[];window.requestAnimationFrame=callback=>{if(callback.name!=='enableCategoryAutoFocus')return raf(callback);const id=-window.bCategoryFrames.length-1;window.bCategoryFrames.push({id,callback,cancelled:false});return id;};window.cancelAnimationFrame=id=>{const item=window.bCategoryFrames.find(item=>item.id===id);if(item)item.cancelled=true;else caf(id);};});
 const pending=async(language='en')=>{await category(page,language).click();await expect(menu(page)).toBeVisible();return page.evaluate(()=>window.bCategoryFrames.length-1);};
 const release=async index=>{await page.evaluate(index=>window.bCategoryFrames[index].callback(performance.now()),index);await page.evaluate(()=>new Promise(requestAnimationFrame));};
 const first=await pending();await expect(category(page)).toBeFocused();await category(page).click();const second=await pending();await release(first);await expect(category(page)).toBeFocused();expect(await page.evaluate(index=>window.bCategoryFrames[index].cancelled,first)).toBe(true);await release(second);await expect(menu(page).getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('Escape');
 let frame=await pending();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');const smileys=menu(page).getByRole('menuitem',{name:'Smileys & Emotion',exact:true});await expect(smileys).toBeFocused();await release(frame);await expect(smileys).toBeFocused();await page.keyboard.press('Escape');
 frame=await pending();const search=page.getByRole('searchbox',{name:'Search emoji',exact:true});await search.focus();await release(frame);await expect(search).toBeFocused();await category(page).click();
 frame=await pending();await mode(page,0);await release(frame);await expect(menu(page)).toHaveCount(0);await mode(page,1);await expect(menu(page)).toHaveCount(0);
 frame=await pending();await page.evaluate(()=>window.fixture.setLanguage('ru'));await release(frame);await expect(menu(page)).toHaveCount(0);
 frame=await pending('ru');await page.getByRole('button',{name:words.ru.reset,exact:true}).click();await release(frame);await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('button',{name:words.ru.reset,exact:true})).toBeFocused();
 frame=await pending('ru');await page.evaluate(()=>window.fixture.setWorkspaces([]));await release(frame);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(menu(page)).toHaveCount(0);await expect(page.locator('[data-menu-backing]')).toHaveCount(0);
});

test('B category outside click, X, Cancel and plugin disposal leave no portaled menu or backing',async({page})=>{
 await setup(page);await mode(page,1);await category(page).click();await page.getByRole('searchbox',{name:'Search emoji',exact:true}).click();await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('searchbox',{name:'Search emoji',exact:true})).toBeFocused();
 await category(page).click();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(menu(page)).toHaveCount(0);
 await page.evaluate(()=>window.fixture.openWorkspaceMenu());await page.getByRole('menuitem',{name:'Appearance',exact:true}).click();await mode(page,1);await category(page).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(menu(page)).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.evaluate(()=>window.fixture.openWorkspaceMenu());await page.getByRole('menuitem',{name:'Appearance',exact:true}).click();await mode(page,1);await category(page).click();await page.evaluate(()=>window.fixture.dispose());await expect(menu(page)).toHaveCount(0);await expect(page.locator('[data-menu-backing]')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
});
for(const [width,height]of[[390,620],[600,500],[800,360]])for(const language of ['en','ru'])test(`B viewport ${width}x${height} ${language} keeps geometry/footer and native popup within screen`,async({page},testInfo)=>{
 await setup(page,{language,viewport:{width,height},dark:language==='ru'});const before=await geometry(page,language);const t=words[language];expect(before.width).toBeLessThanOrEqual(width-48);expect(before.height).toBeLessThanOrEqual(height-48);
 for(const index of [0,1,2]){await mode(page,index,language);sameGeometry(await geometry(page,language),before);await expect(page.getByRole('button',{name:t.save,exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:t.cancel,exact:true})).toBeInViewport();}
 await mode(page,1,language);await category(page,language).click();await expect(menu(page)).toBeVisible();const box=await menu(page).boundingBox();expect(box.x).toBeGreaterThanOrEqual(11);expect(box.y).toBeGreaterThanOrEqual(11);expect(box.x+box.width).toBeLessThanOrEqual(width-11);expect(box.y+box.height).toBeLessThanOrEqual(height-11);sameGeometry(await geometry(page,language),before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`viewport-${language}.png`)});
});
test('B outer geometry and footer stay fixed while Image decoding is pending, completed or rejected',async({page})=>{
 await setup(page);const before=await geometry(page);await mode(page,2);
 await page.evaluate(()=>{const NativeImage=window.Image;window.Image=function(...args){const image=new NativeImage(...args),decode=image.decode.bind(image);image.decode=()=>decode().then(()=>new Promise(resolve=>window.releaseBDecode=resolve));return image;};});
 await page.locator('#wsp-upload').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(samples.png.base64,'base64')});await page.waitForFunction(()=>window.releaseBDecode);await expect(page.getByRole('button',{name:'Loading...',exact:true})).toBeDisabled();
 const box=await page.getByRole('dialog').boundingBox(),button=await page.getByRole('button',{name:'Loading...',exact:true}).boundingBox();sameGeometry({...box,footerY:button.y},before);await page.evaluate(()=>window.releaseBDecode());await expect(page.locator('.wsp-list-preview img')).toBeVisible();sameGeometry(await geometry(page),before);
 await page.locator('#wsp-upload').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(page.getByRole('alert')).toBeVisible();sameGeometry(await geometry(page),before);
});
