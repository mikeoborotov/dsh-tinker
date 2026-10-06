import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { buildFixture } from '../build-fixture.mjs';
import samples from '../image-fixtures.json' with { type: 'json' };

let fixture;
test.beforeAll(async () => { fixture = await buildFixture(); });
const key = 'dsh-workspace-plus:v1';
const html = `<!doctype html><html><head><style>
.workspace-row{display:flex;align-items:center;gap:6px;height:34px;padding:0 8px;width:280px;font-size:14px;line-height:20px}
.workspace-row>span:first-child{display:flex;width:16px;height:20px;align-items:center;justify-content:center;flex:none}
.workspace-row svg{width:16px;height:16px;flex:none}.workspace-row>span:nth-child(3){flex:1;min-width:0}
#settings{padding:24px}body{margin:0}
</style></head><body><div class="workspace-row" data-row-key="workspace:w1" role="treeitem"><span><svg width="16" height="16"><path/></svg></span><span><svg/></span><span>Infra</span><span><button id="menu-anchor">...</button><button>New</button></span></div>
<div data-row-key="session:s1" role="treeitem"><span></span><span>First</span><span>1m</span></div>
<div id="toolbar"><div><button aria-haspopup="menu" aria-busy="false" title="Model"><svg/><span>Model</span></button></div><div id="marker"></div></div>
<div id="overlay"></div><div id="settings"></div></body></html>`;
async function setup(page, { dark = true, language = 'en', seed } = {}) {
  await page.route('http://fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://fixture.test/');
  await page.addStyleTag({ content: fixture.css });
  await page.evaluate(({ dark, seed }) => { if (dark) document.body.setAttribute('data-ds-dark-theme', ''); if (seed) localStorage.setItem('dsh-workspace-plus:v1', JSON.stringify(seed)); }, { dark, seed });
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(language => { window.fixture.mount(); window.fixture.setLanguage(language); }, language);
  await expect(page.locator('#wsp-workspace')).toBeVisible();
}
async function open(page) {
  await page.locator('#wsp-workspace').focus();
  await page.locator('#wsp-workspace').selectOption('w1');
  await expect(page.getByRole('dialog')).toBeVisible();
}
const storage = page => page.evaluate(() => localStorage.getItem('dsh-workspace-plus:v1'));
const state = async page => JSON.parse(await storage(page));
async function transfer(page, entries = ['png'], { emptyMime = false } = {}) {
  const data = entries.map(extension => ({ ...samples[extension], extension }));
  return page.evaluateHandle(({ data, emptyMime }) => {
    const transfer = new DataTransfer();
    for (const item of data) transfer.items.add(new File([Uint8Array.from(atob(item.base64), value => value.charCodeAt(0))], 'sample.' + item.extension, { type: emptyMime ? '' : item.mime }));
    return transfer;
  }, { data, emptyMime });
}
async function drop(page, data, selector = '.wsp-image-dropzone') {
  await page.locator(selector).dispatchEvent('dragenter', { dataTransfer: data });
  await page.locator(selector).dispatchEvent('dragover', { dataTransfer: data });
  await page.locator(selector).dispatchEvent('drop', { dataTransfer: data });
}
async function imageMode(page) { await page.getByRole('button', { name: 'Image', exact: true }).click(); }

for (const dark of [true, false]) test(`native modal/header/input/footer match ${dark ? 'dark' : 'light'} theme`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, { dark }); await open(page);
  const dialog = page.getByRole('dialog', { name: 'Change workspace appearance', exact: true });
  await expect(dialog.getByRole('heading')).toHaveText('Change workspace appearance');
  await expect(dialog.getByRole('button', { name: 'Close', exact: true }).locator('svg')).toHaveCount(1);
  await expect(dialog).toHaveCSS('border-radius', '28px');
  await expect(dialog).toHaveCSS('border-width', '0px');
  await expect(dialog).toHaveCSS('background-color', dark ? 'rgb(44, 44, 46)' : 'rgb(255, 255, 255)');
  await expect(dialog.getByRole('heading')).toHaveCSS('font-size', '16px');
  await expect(dialog.getByRole('heading')).toHaveCSS('line-height', '24px');
  await expect(dialog.getByRole('heading')).toHaveCSS('font-weight', '500');
  const input = page.getByRole('searchbox', { name: 'Search icons' });
  await expect(input).toHaveCSS('height', '44px'); await expect(input).toHaveCSS('border-radius', '16px');
  await expect(input).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); await expect(input).toHaveCSS('font-size', '14px');
  for (const name of ['Save', 'Cancel']) {
    const button = dialog.getByRole('button', { name, exact: true });
    await expect(button).toHaveCSS('height', '36px'); await expect(button).toHaveCSS('border-radius', '12px');
  }
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCSS('background-color', dark ? 'rgb(249, 250, 251)' : 'rgb(15, 17, 21)');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCSS('color', dark ? 'rgb(15, 17, 21)' : 'rgb(255, 255, 255)');
  if (await page.evaluate(() => CSS.supports('corner-shape', 'round'))) {
    await expect(page.locator('.wsp-color-swatch').first()).toHaveCSS('corner-shape', /^(round|superellipse\(1\))$/);
    await expect(page.locator('.wsp-custom-color')).toHaveCSS('corner-shape', /^(round|superellipse\(1\))$/);
  }
  expect(errors).toEqual([]);
});

test('icons search EN/RU without changing selection; palette is above grid and previews color', async ({ page }) => {
  await setup(page); await open(page);
  await expect(page.locator('.wsp-choice-grid button')).toHaveCount(36);
  const palette = await page.locator('.wsp-color-section').boundingBox(), grid = await page.locator('.wsp-choice-grid').boundingBox();
  expect(palette.y + palette.height).toBeLessThan(grid.y);
  const search = page.getByRole('searchbox', { name: 'Search icons' });
  await search.fill('ТЕРМИНАЛ'); await expect(page.locator('.wsp-choice-grid button')).toHaveCount(1);
  await search.fill('terminal'); await expect(page.locator('.wsp-choice-grid button')).toHaveCount(1);
  await search.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible(); expect(await storage(page)).toBeNull();
  await page.locator('.wsp-choice-grid button').click();
  await page.getByRole('button', { name: '#e5484d', exact: true }).click();
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('color', 'rgb(229, 72, 77)');
  await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await expect(page.locator('.wsp-color-section')).toHaveCount(0);
  await page.getByRole('button', { name: 'Icon', exact: true }).click();
  await expect(page.locator('.wsp-choice-grid button[aria-pressed=true]')).toHaveAttribute('title', 'terminal');
  await search.fill('no-such-icon'); await expect(page.getByRole('status')).toHaveText('No results');
  await search.fill(''); await expect(page.locator('.wsp-choice-grid button')).toHaveCount(36);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await storage(page)).toBeNull();
});

test('full emoji catalog is bounded in DOM but searches all 3512 entries and both languages', async ({ page }) => {
  await setup(page); await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  await expect(page.locator('.wsp-emoji-grid button')).toHaveCount(120);
  await expect(page.locator('.wsp-results-row')).toContainText('120 / 3512');
  await page.getByRole('button', { name: 'Show more' }).click(); await expect(page.locator('.wsp-emoji-grid button')).toHaveCount(240);
  const search = page.getByRole('searchbox', { name: 'Search emoji' });
  await search.fill('ракета'); await expect(page.locator('.wsp-emoji-grid').getByRole('button', { name: 'rocket', exact: true })).toHaveText('🚀');
  await search.fill('rocket'); await expect(page.locator('.wsp-emoji-grid').getByRole('button', { name: 'rocket', exact: true })).toBeVisible();
  await search.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.wsp-emoji-grid').getByRole('button', { name: 'rocket', exact: true }).click(); await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveText('🚀');
  await search.fill('💰'); await expect(page.locator('.wsp-emoji-grid button')).toHaveCount(1);
  await search.fill('never-an-emoji'); await expect(page.getByRole('status')).toHaveText('No results');
  await search.fill(''); await page.getByRole('combobox', { name: 'Emoji category' }).selectOption('animals-nature');
  await expect(page.locator('.wsp-results-row')).toContainText('120 / 140');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🚀');
  expect((await state(page)).profiles.Infra).toEqual({ kind: 'emoji', emoji: '🚀' });
});

test('Russian localization and custom/manual emoji remain available', async ({ page }) => {
  await setup(page, { language: 'ru' }); await open(page);
  await expect(page.getByRole('heading', { name: 'Изменить оформление Workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Поиск emoji' }).fill('rocket');
  await expect(page.locator('.wsp-emoji-grid').getByRole('button', { name: 'ракета', exact: true })).toHaveAttribute('title', 'ракета');
  await page.locator('#wsp-emoji').fill('not-emoji'); await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
  await page.locator('#wsp-emoji').fill('🫨'); // Newer manual/saved emoji are not restricted to the conservative picker catalog.
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🫨');
});

test('existing shared profiles stay collapsed, reusable and schema-compatible', async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' }, other: { kind: 'icon', icon: 'code', color: '#4176e6' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { workspaces: true, composer: false, sessions: true } };
  await setup(page, { seed }); await open(page);
  await expect(page.locator('#wsp-alias')).toBeHidden(); await expect(page.locator('#wsp-saved')).toBeHidden();
  await expect(page.locator('.wsp-list-preview')).toContainText('📚');
  await page.locator('.wsp-advanced summary').click();
  await expect(page.locator('#wsp-alias')).toHaveValue('shared'); await page.locator('#wsp-saved').selectOption('other');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = await state(page); expect(saved.version).toBe(1); expect(saved.bindings).toEqual({ w1: 'other', w2: 'shared' });
  expect(saved.profiles).toEqual(seed.profiles); expect(saved.features).toEqual(seed.features);
});

test('preview names the actual list and uses real-size 18px plugin glyph in a 34px row', async ({ page }) => {
  await setup(page); await open(page);
  await expect(page.getByRole('group', { name: 'Preview in the Workspace list' })).toBeVisible();
  await expect(page.locator('.wsp-list-preview')).toHaveCSS('height', '34px');
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('width', '18px');
  await expect(page.locator('.wsp-list-preview')).toHaveCSS('font-size', '14px');
  await expect(page.locator('.wsp-list-preview')).toContainText('Infra');
});

test('native focus/Tab/Escape/X return focus and cancel without saving', async ({ page }) => {
  await setup(page); await open(page);
  await expect(page.getByRole('searchbox', { name: 'Search icons' })).toBeFocused();
  // Native automatic entry deliberately hides rings until actual keyboard navigation.
  await expect(page.getByRole('searchbox', { name: 'Search icons' })).toHaveCSS('outline-style', 'none');
  await page.getByRole('searchbox', { name: 'Search icons' }).press('ArrowRight');
  await expect(page.getByRole('searchbox', { name: 'Search icons' })).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('searchbox', { name: 'Search icons' })).toHaveCSS('outline-width', '2px');
  await page.getByRole('button', { name: 'Close', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#wsp-workspace')).toBeFocused(); expect(await storage(page)).toBeNull();
  await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.locator('#wsp-emoji').fill('🏠');
  await page.getByRole('button', { name: 'Close', exact: true }).click(); expect(await storage(page)).toBeNull();
});

test('IME composition never confirms or closes; ordinary Enter in manual field saves', async ({ page }) => {
  await setup(page); await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  const input = page.locator('#wsp-emoji'); await input.fill('🏠');
  await input.dispatchEvent('compositionstart'); await input.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible();
  await input.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  await input.dispatchEvent('compositionend'); await input.dispatchEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13 });
  await input.press('Enter'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🏠');
});

test('late composition-closing Enter does not save before keyup', async ({ page }) => {
  await setup(page); await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  const input = page.locator('#wsp-emoji'); await input.fill('🏠');
  await input.dispatchEvent('compositionstart'); await input.dispatchEvent('compositionend');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, isComposing: false });
  expect(await page.getByRole('dialog').count()).toBe(1); expect(await storage(page)).toBeNull();
  await input.dispatchEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13 });
  await input.press('Enter'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🏠');
});

test('late composition-closing Escape is ignored until keyup, then normal Escape closes', async ({ page }) => {
  await setup(page); await open(page); const input = page.getByRole('searchbox', { name: 'Search icons' });
  await input.dispatchEvent('compositionstart'); await input.dispatchEvent('compositionend');
  await input.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, isComposing: false });
  expect(await page.getByRole('dialog').count()).toBe(1); expect(await storage(page)).toBeNull();
  await input.dispatchEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27 });
  await input.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const extension of Object.keys(samples)) test(`Image area accepts a real ${extension} drop and saves a local static PNG`, async ({ page }) => {
  await setup(page); await open(page); await imageMode(page);
  const data = await transfer(page, [extension], { emptyMime: extension === 'jpeg' });
  await page.locator('.wsp-image-dropzone').dispatchEvent('dragenter', { dataTransfer: data });
  await expect(page.locator('.wsp-image-dropzone')).toHaveClass(/wsp-is-dragging/);
  // Dropping on a child of the area must work too.
  await drop(page, data, '.wsp-image-dropzone button');
  await expect(page.locator('.wsp-list-preview img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  const dimensions = await page.locator('.wsp-list-preview img').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, src: image.src }));
  expect(dimensions.width).toBe(128); expect(dimensions.height).toBe(64); expect(dimensions.src).toMatch(/^data:image\/png;base64,/);
  expect(await storage(page)).toBeNull();
  if (extension === 'png') expect(await page.locator('.wsp-list-preview img').evaluate(image => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, 1, 1).data[3];
  })).toBe(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await state(page)).profiles.Infra).toEqual({ kind: 'image', data: dimensions.src });
  await expect(page.locator('.wsp-workspace-icon img')).toBeVisible();
});

test('drops outside Image area do not switch mode, save or navigate', async ({ page }) => {
  await setup(page); await open(page); const data = await transfer(page);
  await drop(page, data, '.wsp-appearance-dialog');
  await expect(page.getByRole('button', { name: 'Icon', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wsp-image-dropzone')).toHaveCount(0); expect(await storage(page)).toBeNull();
  await imageMode(page); await drop(page, data, '.wsp-list-preview'); await expect(page.locator('.wsp-list-preview img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled(); expect(page.url()).toBe('http://fixture.test/');
  const link = await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData('text/uri-list', 'https://example.invalid/image.png'); return data; });
  expect(await page.evaluate(data => {
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data });
    document.querySelector('.wsp-list-preview').dispatchEvent(event); return event.defaultPrevented;
  }, link)).toBe(true);
  await expect(page.locator('.wsp-list-preview img')).toHaveCount(0); expect(await storage(page)).toBeNull();
});

test('file chooser accepts the same file repeatedly and uses the shared upload path', async ({ page }) => {
  await setup(page); await open(page); await imageMode(page);
  const file = { name: 'sample.webp', mimeType: 'image/webp', buffer: Buffer.from(samples.webp.base64, 'base64') };
  await page.locator('#wsp-upload').setInputFiles(file); await expect(page.locator('.wsp-list-preview img')).toBeVisible();
  await expect(page.locator('#wsp-upload')).toHaveValue('');
  const first = await page.locator('.wsp-list-preview img').getAttribute('src');
  await page.locator('#wsp-upload').setInputFiles(file); await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await expect(page.locator('.wsp-list-preview img')).toHaveAttribute('src', first);
  await expect(page.locator('#wsp-upload')).toHaveAttribute('accept', /image\/gif.*image\/avif/);
});

test('invalid, oversized, corrupt and multiple files give errors without storing them', async ({ page }) => {
  await setup(page); await open(page); await imageMode(page);
  await page.locator('#wsp-upload').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Choose a PNG');
  await page.locator('#wsp-upload').setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toHaveText('Image exceeds 5 MB.');
  await page.locator('#wsp-upload').setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from([137,80,78,71,13,10,26,10,0,0]) });
  await expect(page.getByRole('alert')).toHaveText('This image could not be read. Choose another file.');
  await drop(page, await transfer(page, ['png', 'jpeg'])); await expect(page.getByRole('alert')).toHaveText('Choose one image at a time.');
  const link = await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData('text/uri-list', 'https://example.invalid/image.png'); return data; });
  await drop(page, link); await expect(page.getByRole('alert')).toHaveText('Drop an image file, not a link.');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled(); expect(await storage(page)).toBeNull();
  await drop(page, await transfer(page)); await expect(page.locator('.wsp-list-preview img')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('dimensions policy rejects a compressed image above 16 million pixels', async ({ page }) => {
  await setup(page); await open(page); await imageMode(page);
  const data = await page.evaluateHandle(async () => { const canvas = document.createElement('canvas'); canvas.width = 4500; canvas.height = 4000;
    const blob = await new Promise(resolve => canvas.toBlob(resolve)); const data = new DataTransfer(); data.items.add(new File([blob], 'large.png', { type: 'image/png' })); return data; });
  await drop(page, data); await expect(page.getByRole('alert')).toContainText('16 million pixels'); expect(await storage(page)).toBeNull();
});

async function delayDecode(page) {
  await page.evaluate(() => { const NativeImage = window.Image; window.releaseDecodes = []; window.Image = function (...args) {
    const image = new NativeImage(...args), decode = image.decode.bind(image); image.decode = () => decode().then(() => new Promise(resolve => { window.releaseDecodes.push(resolve); window.releaseDecode = resolve; })); return image;
  }; });
}
test('switching mode during decode cancels stale upload; it never forces Image back', async ({ page }) => {
  await setup(page); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page)); await page.waitForFunction(() => window.releaseDecode);
  await expect(page.getByRole('button', { name: 'Loading...', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Icon', exact: true }).click(); await page.evaluate(() => window.releaseDecode());
  await expect(page.getByRole('button', { name: 'Icon', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await imageMode(page); await expect(page.locator('.wsp-list-preview img')).toHaveCount(0); expect(await storage(page)).toBeNull();
});

test('close during decode and workspace deletion do not commit or leave a modal', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page)); await page.waitForFunction(() => window.releaseDecode);
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.evaluate(() => window.releaseDecode());
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(await storage(page)).toBeNull();
  await open(page); await page.evaluate(() => window.fixture.setWorkspaces([])); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('latest overlapping upload owns preview and loading even if the older decoder finishes last', async ({ page }) => {
  await setup(page); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page, ['png'])); await page.waitForFunction(() => window.releaseDecodes.length === 1);
  await drop(page, await transfer(page, ['jpeg'])); await page.waitForFunction(() => window.releaseDecodes.length === 2);
  await page.evaluate(() => window.releaseDecodes[1]()); await expect(page.locator('.wsp-list-preview img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  const latest = await page.locator('.wsp-list-preview img').getAttribute('src');
  await page.evaluate(() => window.releaseDecodes[0]()); await expect(page.locator('.wsp-list-preview img')).toHaveAttribute('src', latest);
  await expect(page.getByRole('alert')).toHaveCount(0); expect(await storage(page)).toBeNull();
});

for (const rejection of ['multiple', 'link']) test(`rejected ${rejection} drop cancels an older pending upload`, async ({ page }) => {
  await setup(page); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page)); await page.waitForFunction(() => window.releaseDecode);
  const rejected = rejection === 'multiple' ? await transfer(page, ['png', 'jpeg']) : await page.evaluateHandle(() => {
    const data = new DataTransfer(); data.setData('text/uri-list', 'https://example.invalid/image.png'); return data;
  });
  await drop(page, rejected); await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => window.releaseDecode()); await expect(page.locator('.wsp-list-preview img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled(); expect(await storage(page)).toBeNull();
});

test('choosing a saved profile during decode cancels the pending image without rebinding until Save', async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' }, other: { kind: 'icon', icon: 'code', color: '#4176e6' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { workspaces: true, composer: true, sessions: true } };
  await setup(page, { seed }); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page)); await page.waitForFunction(() => window.releaseDecode);
  await page.locator('.wsp-advanced summary').click(); await page.locator('#wsp-saved').selectOption('other');
  await page.evaluate(() => window.releaseDecode()); await expect(page.getByRole('button', { name: 'Icon', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wsp-list-preview img')).toHaveCount(0); expect(await state(page)).toEqual(seed);
});

test('editing a shared profile preserves both bindings and updates their appearance', async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { workspaces: true, composer: true, sessions: true } };
  await setup(page, { seed }); await open(page); await page.locator('#wsp-emoji').fill('🏠');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await state(page)).bindings).toEqual(seed.bindings);
  expect(await page.evaluate(() => window.fixture.prefs().appearance('w2'))).toEqual({ kind: 'emoji', emoji: '🏠' });
});

test('failed durable Save keeps dialog open and does not publish the draft', async ({ page }) => {
  const seed = { version: 1, profiles: { original: { kind: 'icon', icon: 'folder', color: '#4176e6' } }, bindings: { w1: 'original' }, features: { workspaces: true, composer: true, sessions: true } };
  await setup(page, { seed }); await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.locator('#wsp-emoji').fill('🏠');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Quota exceeded'); await expect(page.getByRole('dialog')).toBeVisible();
  expect(await state(page)).toEqual(seed); await expect(page.locator('.wsp-workspace-icon svg')).toHaveCount(1);
});

test('390px narrow and short viewports keep footer reachable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 620 }); await setup(page, { language: 'ru' }); await open(page);
  await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.locator('.wsp-advanced summary').click();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport();
  const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    dialog: { width: document.querySelector('[role=dialog]').clientWidth, scrollWidth: document.querySelector('[role=dialog]').scrollWidth },
    overflow: [...document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, id: element.id, className: String(element.className), right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(item => item.right > innerWidth),
  }));
  expect(layout.documentWidth <= layout.width, JSON.stringify(layout)).toBe(true);
  const dialog = await page.getByRole('dialog').boundingBox(); expect(dialog.width).toBeLessThanOrEqual(342);
  await page.setViewportSize({ width: 800, height: 360 });
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCSS('height', '36px');
});

test('capture actual implementation previews in both native themes without network/page errors', async ({ page }) => {
  const errors = [], requests = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
  await mkdir('dist/preview-0.1.4', { recursive: true });
  for (const dark of [true, false]) {
    await setup(page, { dark }); await open(page); await page.mouse.move(900, 700);
    await page.getByRole('dialog').screenshot({ path: `dist/preview-0.1.4/appearance-${dark ? 'dark' : 'light'}.png`, animations: 'disabled' });
    if (dark) {
      await imageMode(page); await page.getByRole('dialog').screenshot({ path: 'dist/preview-0.1.4/image-drop-dark.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.getByRole('searchbox', { name: 'Search emoji' }).fill('rocket');
      await page.getByRole('dialog').screenshot({ path: 'dist/preview-0.1.4/emoji-search-dark.png', animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  expect(errors).toEqual([]); expect(requests.filter(url => url !== 'http://fixture.test/')).toEqual([]);
});
