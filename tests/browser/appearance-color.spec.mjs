import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildFixture } from '../build-fixture.mjs';

let fixture;
test.beforeAll(async () => { fixture = await buildFixture(); });
const runtime = new WeakMap();
test.beforeEach(({ page }) => { const record = { errors: [], requests: [] }; runtime.set(page, record); page.on('pageerror', error => record.errors.push(error.message)); page.on('request', request => record.requests.push(request.url())); });
test.afterEach(({ page }) => { const record = runtime.get(page); expect(record.errors).toEqual([]); expect(record.requests.filter(url => url !== 'http://fixture.test/')).toEqual([]); });
const words = {
  en: { title: 'Workspace appearance', emoji: 'Emoji', category: 'Emoji category', custom: 'Custom color' },
  ru: { title: 'Оформление Workspace', emoji: 'Emoji', category: 'Категория emoji', custom: 'Свой цвет' },
};
async function setup(page, { language = 'en', dark = true, width = 1280, height = 900, frame = 0, longName = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.route('http://fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0;background:var(--dsw-alias-bg-layer-1)"><div data-row-key="workspace:w1" role="treeitem"><span><svg width="16" height="16"/></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div><div id="overlay"></div><div id="settings"></div><div id="marker"></div></body></html>` }));
  await page.goto('http://fixture.test/');
  await page.addStyleTag({ content: fixture.css });
  if (frame) await page.evaluate(value => {
    // Native overlayTopMargin uses frame clearance + 20; the CSS token reserves the same strip.
    document.documentElement.style.setProperty('--dsh-frame-top-clearance', (value - 20) + 'px');
    document.documentElement.style.setProperty('--dsh-frame-overlay-top', value + 'px');
  }, frame);
  if (dark) await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(({ language, longName }) => { window.fixture.mount(); window.fixture.setLanguage(language); if (longName) window.fixture.setWorkspaces([{ workspaceId:'w1', title:'Protected long workspace name '.repeat(16), sessionIds:['s1'] }]); }, { language, longName });
  await page.evaluate(() => window.fixture.openWorkspaceMenu());
  await page.getByRole('menuitem', { name: /^(Appearance|Оформление)$/ }).click();
  await expect(page.getByRole('dialog', { name: words[language].title, exact: true })).toBeVisible();
}
async function evidence(info, name, data) {
  const file = info.outputPath(name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// Compute the actual outline paint box, then intersect it with every clipping
// ancestor padding box. Visibility of the colored disk alone misses this bug.
async function outlineMetrics(element) {
  return element.evaluate(node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    const width = parseFloat(style.outlineWidth) || 0, offset = parseFloat(style.outlineOffset) || 0;
    const visible = width > 0 && !['none', 'hidden'].includes(style.outlineStyle);
    const extension = visible ? Math.max(0, width + offset) : 0;
    const paint = { left: rect.left - extension, top: rect.top - extension, right: rect.right + extension, bottom: rect.bottom + extension };
    const ancestors = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
      const clipX = /^(hidden|clip|scroll|auto)$/.test(css.overflowX), clipY = /^(hidden|clip|scroll|auto)$/.test(css.overflowY);
      const paintContainment = /\b(paint|strict|content)\b/.test(css.contain);
      if (!clipX && !clipY && !paintContainment) continue;
      const clip = { left: box.left + parent.clientLeft, top: box.top + parent.clientTop,
        right: box.left + parent.clientLeft + parent.clientWidth, bottom: box.top + parent.clientTop + parent.clientHeight };
      const loss = { left: clipX || paintContainment ? Math.max(0, clip.left - paint.left) : 0,
        right: clipX || paintContainment ? Math.max(0, paint.right - clip.right) : 0,
        top: clipY || paintContainment ? Math.max(0, clip.top - paint.top) : 0,
        bottom: clipY || paintContainment ? Math.max(0, paint.bottom - clip.bottom) : 0 };
      ancestors.push({ label: parent.tagName + (parent.id ? '#' + parent.id : '') + '.' + String(parent.className).replace(/\s+/g, '.'),
        overflowX: css.overflowX, overflowY: css.overflowY, contain: css.contain, clip, loss });
    }
    return { value: node.getAttribute('aria-label'), tag: node.tagName, focusVisible: node.matches(':focus-visible'),
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      outline: { visible, width, offset, style: style.outlineStyle, color: style.outlineColor }, paint, ancestors,
      clipped: ancestors.filter(item => Object.values(item.loss).some(value => value > .6)) };
  });
}
for (const config of [
  { language: 'en', dark: true, width: 1280, height: 900, wrap: false },
  { language: 'ru', dark: false, width: 390, height: 720, wrap: true },
]) test(`T164 selected and keyboard-focus outline paint is inside clip bounds ${config.language} ${config.width}`, async ({ page }, info) => {
  await setup(page, config);
  const presets = page.locator('.wsp-color-swatch'), metrics = [];
  const positions = await presets.evaluateAll(nodes => nodes.map(node => ({ y: node.getBoundingClientRect().y })));
  const wrapped = positions.findIndex(position => position.y > positions[0].y + 1);
  if (config.wrap) expect(wrapped, 'narrow fixture must actually wrap the presets').toBeGreaterThan(0);
  for (let index = 0; index < await presets.count(); index++) {
    const swatch = presets.nth(index);
    await swatch.click();
    const measurement = { index, wrappedStart: index === wrapped, ...await outlineMetrics(swatch) };
    metrics.push(measurement);
    if ([0, positions.length - 1, wrapped].includes(index)) await page.getByRole('dialog', { name: words[config.language].title, exact: true }).screenshot({ path: info.outputPath(`selected-${index}.png`), animations: 'disabled' });
  }
  await presets.last().focus();
  await page.keyboard.press('Tab');
  const custom = page.locator('.wsp-custom-color');
  await expect(custom).toBeFocused();
  const focus = await outlineMetrics(custom);
  await page.getByRole('dialog', { name: words[config.language].title, exact: true }).screenshot({ path: info.outputPath('custom-keyboard-focus.png'), animations: 'disabled' });
  await evidence(info, 'outline-metrics.json', { config, wrapped, presets: metrics, customFocus: focus });
  const violations = metrics.flatMap(item => [
    ...(!item.outline.visible || item.outline.width < 2 || item.outline.offset < 3 ? [{ index: item.index, missingOrReducedSelectedIndicator: item.outline }] : []),
    ...item.clipped.map(clip => ({ index: item.index, wrappedStart: item.wrappedStart, clip })),
  ]);
  if (!focus.focusVisible || !focus.outline.visible) violations.push({ customFocusIndicatorMissing: focus });
  violations.push(...focus.clipped.map(clip => ({ customFocusClipped: clip })));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

for (const language of ['en', 'ru']) test(`T164 native category borderbox matches actual trigger across resize ${language}`, async ({ page }, info) => {
  await setup(page, { language });
  await page.getByRole('button', { name: words[language].emoji, exact: true }).click();
  const trigger = page.getByRole('button', { name: words[language].category, exact: true }), popup = page.locator('.wsp-emoji-category-menu');
  const metrics = [];
  for (const width of [1280, 741, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    if (!await popup.count()) await trigger.click();
    await expect(popup).toBeVisible();
    await settle(page);
    const field = await trigger.boundingBox(), card = await popup.boundingBox();
    metrics.push({ viewportWidth: width, trigger: field, popup: card, difference: card.width - field.width });
    await page.screenshot({ path: info.outputPath(`category-${width}.png`) });
  }
  await evidence(info, 'category-metrics.json', { language, measurements: metrics });
  expect(metrics.filter(item => Math.abs(item.difference) > .5), JSON.stringify(metrics, null, 2)).toEqual([]);
});

test('T164 custom trigger is a constant full clockwise rainbow without decorative border', async ({ page }, info) => {
  await setup(page);
  const custom = page.locator('.wsp-custom-color'), measurements = [];
  for (const index of [0, 8, 3]) {
    await page.locator('.wsp-color-swatch').nth(index).click();
    measurements.push(await custom.evaluate(node => {
      const css = getComputedStyle(node);
      return { tag: node.tagName, type: node.getAttribute('type'), value: node.value,
        gradient: css.backgroundImage, border: [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth], boxShadow: css.boxShadow };
    }));
  }
  await evidence(info, 'rainbow-metrics.json', measurements);
  await page.getByRole('dialog', { name: words.en.title, exact: true }).screenshot({ path: info.outputPath('rainbow-before.png'), animations: 'disabled' });
  const first = measurements[0];
  expect(first.gradient, JSON.stringify(measurements)).toMatch(/^conic-gradient\(/);
  expect(first.gradient).toMatch(/rgb\(255, 0, 0\).*rgb\(255, 255, 0\).*rgb\(0, 255, 0\).*rgb\(0, 255, 255\).*rgb\(0, 0, 255\).*rgb\(255, 0, 255\).*rgb\(255, 0, 0\)/);
  expect(first.border).toEqual(['0px', '0px', '0px', '0px']);
  expect(measurements.every(item => item.gradient === first.gradient && item.border.every(width => width === '0px'))).toBe(true);
  await custom.hover(); expect(await custom.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(first.gradient);
  await page.mouse.move(5,5); await page.locator('.wsp-color-swatch').last().focus(); await page.keyboard.press('Tab'); await expect(custom).toBeFocused();
  await page.keyboard.down('Space');
  try { expect(await custom.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(first.gradient); }
  finally { await page.keyboard.up('Space'); }
  await expect(colorPicker(page)).toBeVisible(); await colorPicker(page).getByRole('textbox', {name:'HEX',exact:true}).fill('#12abcd');
  expect(await custom.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(first.gradient);
});

test('T164 chosen B picker opens explicitly with split SV HSV HEX and draft-only Apply', async ({ page }, info) => {
  await setup(page);
  const picker = page.getByRole('dialog', { name: words.en.custom, exact: true });
  await expect(picker).toHaveCount(0);
  await page.getByRole('dialog', { name: words.en.title, exact: true }).screenshot({ path: info.outputPath('picker-contract-before.png'), animations: 'disabled' });
  // Never click the old native color input: its browser/OS popup is not our test seam.
  const trigger = page.locator('button.wsp-custom-color');
  expect(await trigger.count(), 'owned rainbow BUTTON must replace the native color input before opening').toBe(1);
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  const outer = await page.getByRole('dialog', { name: words.en.title, exact: true }).boundingBox();
  await trigger.click();
  await expect(picker).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(Math.abs((await picker.boundingBox()).width - 510)).toBeLessThanOrEqual(.5);
  await expect(picker).toHaveCSS('border-radius', '16px');
  const plane = picker.locator('.wsp-color-plane'), hue = picker.getByRole('slider', { name: 'Hue', exact: true });
  await expect(plane).toHaveAttribute('role', 'slider');
  await expect(picker.getByRole('slider', { name: 'Saturation', exact: true })).toBeVisible();
  await expect(picker.getByRole('slider', { name: 'Brightness', exact: true })).toBeVisible();
  const sv = await plane.boundingBox(), controls = await hue.boundingBox();
  expect(controls.x).toBeGreaterThan(sv.x + sv.width);
  const hex = picker.getByRole('textbox', { name: 'HEX', exact: true });
  await expect(hex).toHaveCSS('border-radius', '12px');
  await hex.fill('#A3F'); await expect(hex).toHaveValue('#A3F');
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(170, 51, 255)');
  await hex.fill('#A3'); await expect(hex).toHaveValue('#A3');
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(170, 51, 255)');
  await hex.press('Enter'); await expect(picker).toBeVisible(); await expect(hex).toHaveAttribute('aria-invalid', 'true');
  await hex.fill('12ABCD'); await hex.press('Enter');
  await expect(picker).toHaveCount(0); await expect(page.getByRole('dialog', { name: words.en.title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dsh-workspace-plus:v1'))).toBeNull();
  expect(await page.getByRole('dialog', { name: words.en.title, exact: true }).boundingBox()).toEqual(outer);
  await trigger.click(); await expect(hex).toHaveValue('#12abcd');
});

const colorTrigger = page => page.locator('button.wsp-custom-color');
const colorPicker = (page, language = 'en') => page.getByRole('dialog', { name: words[language].custom, exact: true });
async function openColor(page, language = 'en') {
  await colorTrigger(page).click(); await expect(colorPicker(page, language)).toBeVisible();
  await expect(colorPicker(page, language).getByRole('textbox', { name: 'HEX', exact: true })).toBeFocused();
  return colorPicker(page, language).getByRole('textbox', { name: 'HEX', exact: true });
}
const savedColorState = page => page.evaluate(() => localStorage.getItem('dsh-workspace-plus:v1'));

test('T164 Cancel X and Escape roll back color and the captured native-default flag', async ({ page }) => {
  await setup(page); await expect(page.locator('.wsp-native-folder')).toHaveCount(1);
  let hex = await openColor(page); await hex.fill('#12abcd');
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(18, 171, 205)');
  await colorPicker(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.wsp-native-folder')).toHaveCount(1); await expect(colorTrigger(page)).toBeFocused();
  await page.getByRole('button', { name: '#e5484d', exact: true }).click();
  for (const close of ['Close', 'Escape']) {
    hex = await openColor(page); await hex.fill('#00ff00');
    if (close === 'Escape') await page.keyboard.press('Escape');
    else await colorPicker(page).getByRole('button', { name: close, exact: true }).click();
    await expect(colorPicker(page)).toHaveCount(0); await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(229, 72, 77)');
  }
  await expect(page.getByRole('dialog', { name: words.en.title, exact: true })).toBeVisible();
  expect(await savedColorState(page)).toBeNull();
});

test('T164 outside Search and kind change preserve the live valid draft; outer Save writes it once', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.colorWrites = 0; const write = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'dsh-workspace-plus:v1') window.colorWrites++; return write.call(this, key, value); }; });
  let hex = await openColor(page); await hex.fill('#12abcd');
  const search = page.getByRole('searchbox', { name: 'Search icons', exact: true }); await search.click({ position: { x: 12, y: 12 } });
  await expect(colorPicker(page)).toHaveCount(0); await expect(search).toBeFocused();
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(18, 171, 205)');
  hex = await openColor(page); await hex.fill('#00ff00'); await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  await expect(colorPicker(page)).toHaveCount(0); await page.getByRole('button', { name: 'Icon', exact: true }).click();
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(0, 255, 0)');
  hex = await openColor(page); await hex.fill('#123456'); await hex.fill('#12345678');
  expect(await savedColorState(page)).toBeNull(); expect(await page.evaluate(() => window.colorWrites)).toBe(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => window.colorWrites)).toBe(1);
  expect(JSON.parse(await savedColorState(page)).appearances.w1.color).toBe('#123456');
});

test('T164 native top-layer Tab ShiftTab and two Escape presses have the correct owners', async ({ page }) => {
  await setup(page); await openColor(page);
  await colorPicker(page).getByRole('button', { name: 'Apply', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(colorPicker(page).getByRole('button', { name: 'Close', exact: true })).toBeFocused(); await page.keyboard.press('Shift+Tab');
  await expect(colorPicker(page).getByRole('button', { name: 'Apply', exact: true })).toBeFocused(); await page.keyboard.press('Escape');
  await expect(colorPicker(page)).toHaveCount(0); await expect(colorTrigger(page)).toBeFocused(); await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('#menu-anchor')).toBeFocused(); expect(await savedColorState(page)).toBeNull();
});

for (const key of ['Enter', 'Escape']) test(`T164 proper INPUT composition ending before picker open guards late ${key}`, async ({ page }) => {
  await setup(page); const source = page.getByRole('searchbox', { name: 'Search icons', exact: true }); await source.focus();
  await source.dispatchEvent('compositionstart'); await source.dispatchEvent('compositionend'); const hex = await openColor(page);
  await hex.press(key); await expect(colorPicker(page)).toBeVisible(); await expect(page.getByRole('dialog', { name: words.en.title, exact: true })).toBeVisible(); expect(await savedColorState(page)).toBeNull();
  await hex.press(key); await expect(colorPicker(page)).toHaveCount(0); await expect(page.getByRole('dialog', { name: words.en.title, exact: true })).toBeVisible(); expect(await savedColorState(page)).toBeNull();
});

test('T164 active INPUT composition cannot apply from HEX or default button Enter and Space', async ({ page }) => {
  await setup(page); const hex = await openColor(page); await hex.dispatchEvent('compositionstart'); await hex.press('Enter');
  await expect(colorPicker(page)).toBeVisible(); const apply = colorPicker(page).getByRole('button', { name: 'Apply', exact: true });
  await apply.focus(); await apply.press('Enter'); await expect(colorPicker(page)).toBeVisible(); await apply.press('Space'); await expect(colorPicker(page)).toBeVisible();
  await hex.dispatchEvent('compositionend'); await hex.dispatchEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13 }); await apply.press('Enter');
  await expect(colorPicker(page)).toHaveCount(0); expect(await savedColorState(page)).toBeNull();
});

test('T164 partial HEX preserves caret and last valid color; alpha names and unsafe text are rejected', async ({ page }) => {
  await setup(page); const hex = await openColor(page); await hex.fill('#0000ff'); await hex.evaluate(node => node.setSelectionRange(2, 2)); await hex.press('a');
  await expect(hex).toHaveValue('#0a000ff'); expect(await hex.evaluate(node => node.selectionStart)).toBe(3);
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(0, 0, 255)');
  for (const invalid of ['#11223344', 'red', 'rgba(0,0,0,1)', 'url(x)', '#12']) {
    await hex.fill(invalid); await hex.press('Enter'); await expect(hex).toHaveValue(invalid); await expect(hex).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(0, 0, 255)'); expect(await savedColorState(page)).toBeNull();
  }
  await hex.fill('A1B2C3'); await colorPicker(page).getByRole('button', { name: 'Apply', exact: true }).click(); await openColor(page); await expect(hex).toHaveValue('#a1b2c3');
});

test('T164 HSV channel keyboard keeps hue through zero brightness and saturation', async ({ page }) => {
  await setup(page); const hex = await openColor(page); await hex.fill('#0000ff');
  const hue = colorPicker(page).getByRole('slider', { name: 'Hue', exact: true }), brightness = colorPicker(page).getByRole('slider', { name: 'Brightness', exact: true }), saturation = colorPicker(page).getByRole('slider', { name: 'Saturation', exact: true });
  await brightness.press('Home'); await expect(hex).toHaveValue('#000000'); await expect(hue).toHaveValue('240'); await brightness.press('End'); await expect(hex).toHaveValue('#0000ff');
  await saturation.press('Home'); await expect(hex).toHaveValue('#ffffff'); await expect(hue).toHaveValue('240'); await saturation.press('End'); await expect(hex).toHaveValue('#0000ff');
  await hue.press('ArrowRight'); await expect(hue).toHaveValue('241'); expect(await savedColorState(page)).toBeNull();
});

test('T164 SV pointer capture and keyboard update live color and release without stale moves', async ({ page }) => {
  await setup(page); const hex = await openColor(page); await hex.fill('#ff0000'); const plane = colorPicker(page).locator('.wsp-color-plane'), box = await plane.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width + 30, box.y - 20); await page.mouse.up();
  await expect(hex).toHaveValue('#ff0000'); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await expect(hex).toHaveValue('#ff0000');
  await plane.press('ArrowLeft'); expect(await hex.inputValue()).not.toBe('#ff0000');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await plane.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true }); const cancelled = await hex.inputValue();
  await page.mouse.move(box.x + box.width, box.y); await page.mouse.up(); await expect(hex).toHaveValue(cancelled); expect(await savedColorState(page)).toBeNull();
});

test('T164 locale editor scroll target deletion and disposal clear owned Surface and native backing', async ({ page }) => {
  await setup(page); let hex = await openColor(page); await hex.fill('#12abcd'); await page.evaluate(() => window.fixture.setLanguage('ru'));
  await expect(colorPicker(page, 'ru')).toHaveCount(0); hex = await openColor(page, 'ru'); await expect(hex).toHaveValue('#12abcd');
  await page.setViewportSize({ width: 800, height: 360 }); await page.locator('.wsp-appearance-editor').evaluate(node => { node.scrollTop = node.scrollHeight; }); await settle(page); await expect(colorPicker(page, 'ru')).toBeVisible();
  const moved = await colorPicker(page, 'ru').boundingBox(); expect(moved.y).toBeGreaterThanOrEqual(11.5); expect(moved.y + moved.height).toBeLessThanOrEqual(348.5);
  await page.evaluate(() => window.fixture.setWorkspaces([])); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('[data-menu-backing]')).toHaveCount(0);
  await page.evaluate(() => { window.fixture.setWorkspaces([{workspaceId:'w1',title:'Infra',sessionIds:['s1']}]); window.fixture.setLanguage('en'); window.fixture.openWorkspaceMenu(); });
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click(); await openColor(page);
  const plane = colorPicker(page).locator('.wsp-color-plane'), rect = await plane.boundingBox(); await page.mouse.move(rect.x + rect.width/2, rect.y + rect.height/2); await page.mouse.down();
  await plane.dispatchEvent('pointerdown', { pointerId:2, button:0, pointerType:'touch' });
  await page.evaluate(() => window.fixture.dispose()); await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('[data-menu-backing]')).toHaveCount(0); await page.keyboard.press('Escape');
});

for (const config of [
  { language:'en',dark:true,width:1280,height:900,longName:true }, { language:'ru',dark:false,width:1280,height:900 },
  { language:'en',dark:false,width:390,height:720 }, { language:'ru',dark:true,width:800,height:360 },
  { language:'en',dark:true,width:800,height:360,frame:54 },
]) test(`T164 actual B surface bounds and stable outer footer ${config.language} ${config.width}x${config.height} frame${config.frame || 0}`, async ({ page }, info) => {
  await setup(page, config); const outer = page.getByRole('dialog', { name: words[config.language].title, exact: true }), before = await outer.boundingBox();
  const save = page.getByRole('button', { name: config.language === 'en' ? 'Save' : 'Сохранить', exact: true }), footer = await save.boundingBox();
  const hex = await openColor(page, config.language), picker = colorPicker(page, config.language), box = await picker.boundingBox();
  expect(Math.abs(box.width - Math.min(510, config.width - 24))).toBeLessThanOrEqual(.5); expect(box.x).toBeGreaterThanOrEqual(11.5); expect(box.y).toBeGreaterThanOrEqual(Math.max(12, config.frame || 0) - .5); expect(box.x + box.width).toBeLessThanOrEqual(config.width - 11.5); expect(box.y + box.height).toBeLessThanOrEqual(config.height - 11.5);
  await expect(picker.getByRole('button', { name: config.language === 'en' ? 'Apply' : 'Применить', exact: true })).toBeInViewport({ratio:1});
  expect(await outer.boundingBox()).toEqual(before); expect((await save.boundingBox()).y).toBe(footer.y); await hex.fill('#a137e9'); await page.mouse.move(5,5);
  await page.screenshot({ path:info.outputPath(`picker-${config.language}-${config.width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
