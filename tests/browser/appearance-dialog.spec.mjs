import { test, expect } from '@playwright/test';
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
async function setup(page, { dark = true, language = 'en', seed, quotaKey } = {}) {
  await page.route('http://fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://fixture.test/');
  await page.addStyleTag({ content: fixture.css });
  await page.evaluate(({ dark, seed }) => { if (dark) document.body.setAttribute('data-ds-dark-theme', ''); if (seed) localStorage.setItem('dsh-workspace-plus:v1', JSON.stringify(seed)); }, { dark, seed });
  if (quotaKey) await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    window.restoreStorageWrites = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, quotaKey);
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(language => { window.fixture.mount(); window.fixture.setLanguage(language); }, language);
  await expect(page.locator('#settings').getByRole('heading', { name: 'Tinker', exact: true })).toBeVisible();
}
async function open(page) {
  await page.evaluate(() => window.fixture.openWorkspaceMenu());
  await page.getByRole('menuitem', { name: /^(Appearance|Оформление)$/ }).click();
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

for (const language of ['en', 'ru']) test(`Tinker settings and reset confirmation use the public product name (${language})`, async ({ page }, testInfo) => {
  await setup(page, { language, dark: language === 'ru' });
  await expect(page.getByRole('heading', { name: 'Tinker', exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(6);
  await expect(page.getByRole('switch', { name: language === 'en' ? 'Profile appearance' : 'Оформление профиля', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#settings .wsp-profile-name, #settings .wsp-profile-portrait')).toHaveCount(0);
  await expect(page.locator('#settings')).not.toContainText('Workspace Plus');
  await page.locator('#settings').screenshot({ path: testInfo.outputPath(`tinker-settings-${language}.png`), animations: 'disabled' });
  // The recovery-only reset path must use the new label without changing its data key.
  await page.evaluate(() => localStorage.setItem('dsh-workspace-plus:v1', '{invalid'));
  await page.reload();
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(language => { window.fixture.mount(); window.fixture.setLanguage(language); }, language);
  const confirmation = page.waitForEvent('dialog').then(async dialog => {
    const message = dialog.message(); await dialog.dismiss(); return message;
  });
  await page.locator('#settings').getByRole('tab', { name: language === 'en' ? 'Recovery' : 'Восстановление', exact: true }).click();
  await page.locator('#settings .wsp-settings-recovery').getByRole('button', { name: language === 'en' ? 'Reset plugin settings' : 'Сбросить настройки плагина', exact: true }).click();
  expect(await confirmation).toBe(language === 'en' ? 'Reset all Tinker settings? Save a recovery copy first.' : 'Сбросить все настройки Tinker? Сначала сохраните копию для восстановления.');
  expect(await storage(page)).toBe('{invalid');
});

for (const dark of [true, false]) test(`native modal/header/input/footer match ${dark ? 'dark' : 'light'} theme`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, { dark }); await open(page);
  const dialog = page.getByRole('dialog', { name: 'Workspace appearance', exact: true });
  await expect(dialog.getByRole('heading')).toHaveText('Workspace appearance');
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
  await search.fill(''); await page.getByRole('button', { name: 'Emoji category', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Animals & Nature', exact: true }).click();
  await expect(page.locator('.wsp-results-row')).toContainText('120 / 140');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🚀');
  expect((await state(page)).appearances.w1).toEqual({ kind: 'emoji', emoji: '🚀' });
});

test('Russian localization and custom/manual emoji remain available', async ({ page }) => {
  await setup(page, { language: 'ru' }); await open(page);
  await expect(page.getByRole('heading', { name: 'Оформление Workspace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Emoji', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Поиск emoji' }).fill('rocket');
  await expect(page.locator('.wsp-emoji-grid').getByRole('button', { name: 'ракета', exact: true })).toHaveAttribute('title', 'ракета');
  await page.locator('#wsp-emoji').fill('not-emoji'); await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
  await page.locator('#wsp-emoji').fill('🫨'); // Newer manual/saved emoji are not restricted to the conservative picker catalog.
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('🫨');
});

test('legacy appearances migrate once with no profile/name/advanced or transfer UI', async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' }, unused: { kind: 'icon', icon: 'code', color: '#4176e6' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { workspaces: true, composer: false, sessions: true } };
  await setup(page, { seed }); await open(page);
  await expect(page.locator('#wsp-alias, #wsp-saved, .wsp-advanced')).toHaveCount(0);
  await expect(page.locator('#settings input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Import|Export) settings$/ })).toHaveCount(0);
  await expect(page.locator('.wsp-list-preview')).toContainText('📚');
  const saved = await state(page); expect(saved.version).toBe(2); expect(saved.profiles).toBeUndefined(); expect(saved.bindings).toBeUndefined();
  expect(saved.appearances).toEqual({ w1: seed.profiles.shared, w2: seed.profiles.shared });
  expect(saved.features).toEqual({ ...seed.features, unread: true, branding: true });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dsh-workspace-plus:v1:legacy-backup')))).toEqual(seed);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('#settings').getByRole('tab', { name: 'Recovery', exact: true }).click();
  const recovery = page.locator('#settings .wsp-settings-recovery');
  await expect(recovery.getByText('A limited recovery copy, not a full backup', { exact: true })).toBeVisible();
  await expect(recovery.getByText('Copy may contain data saved before an update. No import is available.', { exact: true })).toBeVisible();
  await expect(page.locator('#settings details, #settings summary')).toHaveCount(0);
});

for (const quotaKey of [key, key + ':legacy-backup']) test(`migration quota at ${quotaKey} preserves v1 bytes and Retry completes without reset`, async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { composer: false } };
  await setup(page, { seed, quotaKey });
  await expect(page.locator('#settings [role=alert]')).toContainText('Saved appearances could not be migrated: Quota exceeded');
  await expect(page.locator('.wsp-workspace-icon')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'In the model picker', exact: true })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.wsp-composer-icon')).toHaveCount(0);
  expect(await storage(page)).toBe(JSON.stringify(seed));
  await page.evaluate(() => window.restoreStorageWrites());
  await page.locator('#settings').getByRole('tab', { name: 'Recovery', exact: true }).click();
  await expect(page.locator('#settings [role=alert]')).toContainText('Saved appearances could not be migrated: Quota exceeded');
  await page.locator('#settings .wsp-settings-recovery').getByRole('button', { name: 'Retry reading saved settings', exact: true }).click();
  await expect(page.locator('#settings [role=alert]')).toHaveCount(0);
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('📚');
  expect((await state(page)).appearances).toEqual({ w1: seed.profiles.shared, w2: seed.profiles.shared });
  expect(await page.evaluate(() => localStorage.getItem('dsh-workspace-plus:v1:legacy-backup'))).toBe(JSON.stringify(seed));
});

test('preview is below title and above tabs in all modes, with native/default and real-size custom glyphs', async ({ page }) => {
  await setup(page); await open(page);
  await expect(page.getByRole('group', { name: 'Preview in workspace list' })).toBeVisible();
  await expect(page.locator('.wsp-list-preview')).toHaveCSS('height', '34px');
  await expect(page.locator('.wsp-list-preview .wsp-native-folder')).toHaveCSS('width', '16px');
  await expect(page.locator('.wsp-list-preview')).toHaveCSS('font-size', '14px');
  await expect(page.locator('.wsp-list-preview')).toContainText('Infra');
  await page.getByRole('button', { name: 'code', exact: true }).click();
  await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveCSS('width', '18px');
  for (const mode of ['Icon', 'Emoji', 'Image']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    const title = await page.getByRole('dialog').getByRole('heading').boundingBox();
    const preview = await page.locator('.wsp-preview-section').boundingBox(), tabs = await page.locator('.wsp-kind-tabs').boundingBox();
    expect(title.y + title.height).toBeLessThan(preview.y); expect(preview.y + preview.height).toBeLessThan(tabs.y);
  }
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
  await expect(page.locator('#menu-anchor')).toBeFocused(); expect(await storage(page)).toBeNull();
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
  expect((await state(page)).appearances.w1).toEqual({ kind: 'image', data: dimensions.src });
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

test('Restore default during decode cancels the pending image and changes only draft preview', async ({ page }) => {
  const seed = { version: 2, appearances: { w1: { kind: 'emoji', emoji: '📚' }, w2: { kind: 'emoji', emoji: '📚' } }, features: { workspaces: true, composer: true, sessions: true, unread: true, branding: true } };
  await setup(page, { seed }); await open(page); await imageMode(page); await delayDecode(page);
  await drop(page, await transfer(page)); await page.waitForFunction(() => window.releaseDecode);
  await page.getByRole('button', { name: 'Restore default', exact: true }).click();
  await page.evaluate(() => window.releaseDecode());
  await expect(page.locator('.wsp-list-preview .wsp-native-folder svg')).toHaveCount(1);
  await expect(page.locator('.wsp-list-preview img')).toHaveCount(0); expect(await state(page)).toEqual(seed);
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('📚');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});

test('editing a formerly shared appearance changes only the selected workspace', async ({ page }) => {
  const seed = { version: 1, profiles: { shared: { kind: 'emoji', emoji: '📚' } }, bindings: { w1: 'shared', w2: 'shared' }, features: { workspaces: true, composer: true, sessions: true } };
  await setup(page, { seed }); await open(page); await page.locator('#wsp-emoji').fill('🏠');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await state(page)).appearances).toEqual({ w1: { kind: 'emoji', emoji: '🏠' }, w2: { kind: 'emoji', emoji: '📚' } });
  expect(await page.evaluate(() => window.fixture.prefs().appearance('w2'))).toEqual({ kind: 'emoji', emoji: '📚' });
});

test('failed durable Save keeps dialog open and does not publish the draft', async ({ page }) => {
  const seed = { version: 2, appearances: { w1: { kind: 'icon', icon: 'folder', color: '#4176e6' } }, features: { workspaces: true, composer: true, sessions: true, unread: true, branding: true } };
  await setup(page, { seed }); await open(page); await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.locator('#wsp-emoji').fill('🏠');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Quota exceeded'); await expect(page.getByRole('dialog')).toBeVisible();
  expect(await state(page)).toEqual(seed); await expect(page.locator('.wsp-workspace-icon svg')).toHaveCount(1);
});

const resetAppearances = {
  icon: { kind: 'icon', icon: 'code', color: '#e5484d' },
  emoji: { kind: 'emoji', emoji: '📚' },
  image: { kind: 'image', data: 'data:image/png;base64,' + samples.png.base64 },
};
const resetSeed = kind => ({ version: 2, appearances: { w1: resetAppearances[kind], w2: { kind: 'emoji', emoji: '🏠' } }, features: { workspaces: true, composer: true, sessions: true, unread: true, branding: true } });
for (const kind of Object.keys(resetAppearances)) {
  for (const exit of ['Cancel', 'Close', 'Escape']) test(`${kind} reset is only a draft and ${exit} discards it`, async ({ page }) => {
    const seed = resetSeed(kind); await setup(page, { seed }); await open(page);
    const before = await storage(page);
    await page.getByRole('button', { name: 'Restore default', exact: true }).click();
    // Clicking the already selected tab is navigation, not an appearance change.
    await page.getByRole('button', { name: kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await expect(page.locator('.wsp-list-preview .wsp-native-folder')).toHaveCSS('width', '16px');
    await expect(page.locator('.wsp-list-preview svg path').first()).toHaveAttribute('d', /^M1\.50439 3\.11059/);
    expect(await storage(page)).toBe(before); await expect(page.locator('.wsp-workspace-icon')).toHaveCount(1);
    if (exit === 'Escape') await page.keyboard.press('Escape'); else await page.getByRole('button', { name: exit, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); expect(await storage(page)).toBe(before);
    await open(page); await expect(page.locator('.wsp-list-preview .wsp-native-folder')).toHaveCount(0);
    if (kind === 'emoji') await expect(page.locator('.wsp-list-preview .wsp-icon')).toHaveText('📚');
    if (kind === 'image') await expect(page.locator('.wsp-list-preview img')).toBeVisible();
  });
  for (const language of ['en', 'ru']) test(`${kind} ${language} reset applies native folder only on Save and preserves other workspace`, async ({ page }) => {
    const seed = resetSeed(kind); await setup(page, { seed, language }); await open(page);
    const reset = language === 'ru' ? 'Восстановить по умолчанию' : 'Restore default';
    await page.getByRole('button', { name: reset, exact: true }).click(); expect(await state(page)).toEqual(seed);
    await page.getByRole('button', { name: language === 'ru' ? 'Сохранить' : 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.wsp-workspace-icon')).toHaveCount(0);
    await expect(page.locator('[data-row-key="workspace:w1"] > span > svg').first()).not.toHaveCSS('display', 'none');
    expect((await state(page)).appearances).toEqual({ w2: seed.appearances.w2 });
    await open(page); await expect(page.locator('.wsp-list-preview .wsp-native-folder')).toHaveCount(1);
  });
}

test('failed durable reset Save leaves original appearance and bytes intact', async ({ page }) => {
  const seed = resetSeed('emoji'); await setup(page, { seed }); await open(page);
  await page.getByRole('button', { name: 'Restore default', exact: true }).click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('alert')).toHaveText('Quota exceeded');
  await expect(page.locator('.wsp-workspace-icon')).toHaveText('📚'); expect(await state(page)).toEqual(seed);
});

test('corrupted storage shows recovery-only controls, no portable transfer inputs', async ({ page }) => {
  await setup(page, { seed: { version: 999 } });
  await expect(page.locator('#settings [role=alert]')).toContainText('Unsupported settings version');
  await page.locator('#settings').getByRole('tab', { name: 'Recovery', exact: true }).click();
  await expect(page.locator('#settings [role=alert]')).toContainText('Unsupported settings version');
  await expect(page.getByRole('button', { name: 'Save recovery copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry reading saved settings' })).toBeVisible();
  await expect(page.locator('#settings input[type=file]')).toHaveCount(0);
  const original = await storage(page);
  await page.getByRole('button', { name: 'Retry reading saved settings' }).click(); expect(await storage(page)).toBe(original);
});

test('390px narrow and short viewports keep footer reachable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 620 }); await setup(page, { language: 'ru' }); await open(page);
  await page.getByRole('button', { name: 'Emoji', exact: true }).click();
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

test('capture actual implementation previews in both native themes without network/page errors', async ({ page }, testInfo) => {
  const errors = [], requests = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
  for (const dark of [true, false]) {
    await setup(page, { dark }); await open(page); await page.mouse.move(900, 700);
    await page.getByRole('dialog').screenshot({ path: testInfo.outputPath(`appearance-${dark ? 'dark' : 'light'}.png`), animations: 'disabled' });
    if (dark) {
      await imageMode(page); await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('image-drop-dark.png'), animations: 'disabled' });
      await page.getByRole('button', { name: 'Emoji', exact: true }).click(); await page.getByRole('searchbox', { name: 'Search emoji' }).fill('rocket');
      await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('emoji-search-dark.png'), animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  expect(errors).toEqual([]); expect(requests.filter(url => url !== 'http://fixture.test/')).toEqual([]);
});
