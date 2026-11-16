import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { buildFixture } from '../build-fixture.mjs';

// Network-free missing-export regression over the real production component.
// Other primitives are the pinned LOWER 0.2.0-rc.2 implementation, not rc.3.
let fixture, source;
const runtime = new WeakMap();
test.beforeEach(({ page }) => {
  const record = { errors: [], requests: [] }; runtime.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('request', request => record.requests.push(request.url()));
});
test.afterEach(({ page }) => {
  expect(runtime.get(page).errors).toEqual([]);
  expect(runtime.get(page).requests.filter(url => url !== 'http://fixture.test/')).toEqual([]);
});
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../../src/color-picker.jsx', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'browser', jsx: 'transform',
    external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  });
  source = result.outputFiles[0].text;
  fixture = await buildFixture('tests/color-position-fixture.jsx');
});
const picker = page => page.getByRole('dialog', { name: 'Custom color', exact: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function setup(page, { legacy = false, priority = false, captureObservers = false, frame = 0, width = 1000, height = 1200 } = {}) {
  await page.setViewportSize({ width, height });
  await page.route('**/*', route => route.request().url() === 'http://fixture.test/'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto('http://fixture.test/');
  await page.addStyleTag({ content: fixture.css });
  await page.evaluate(({ source, legacy, frame, captureObservers }) => {
    window.colorPickerSource = source; window.legacyPositioning = legacy;
    if (frame) document.documentElement.style.setProperty('--dsh-frame-overlay-top', frame + 'px');
    if (captureObservers) {
      // Controlled late-delivery seam only: layout still uses the real browser IO.
      const NativeObserver = window.IntersectionObserver;
      window.positionObservers = [];
      window.IntersectionObserver = class {
        constructor(callback, options) {
          this.callback = callback; this.native = new NativeObserver(callback, options);
          window.positionObservers.push(this);
        }
        observe(target) { this.target = target; this.native.observe(target); }
        disconnect() { this.native.disconnect(); }
      };
    }
    if (legacy) {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => /anchor|position-try/.test(args.join(' ')) ? false : supports(...args);
    }
  }, { source, legacy, frame, captureObservers });
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(() => window.fixture.mount());
  if (priority) await page.locator('#color-anchor').evaluate(node => node.style.setProperty('anchor-name', '--preexisting-color-anchor', 'important'));
  await page.locator('#color-anchor').click();
  await settle(page);
  expect(await page.evaluate(() => window.fixture.errors), 'real ColorPicker render must not call a missing host export').toEqual([]);
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByRole('textbox', { name: 'HEX', exact: true })).toBeFocused();
}
async function expectBounds(page) {
  const box = await picker(page).boundingBox(), size = page.viewportSize();
  const placement = await picker(page).evaluate(node => {
    const css = getComputedStyle(node), anchor = document.getElementById('color-anchor');
    return { panel: node.getBoundingClientRect().toJSON(), anchor: anchor.getBoundingClientRect().toJSON(), anchorName: getComputedStyle(anchor).anchorName,
      positionAnchor: css.positionAnchor, top: css.top, bottom: css.bottom, left: css.left, right: css.right, alignSelf: css.alignSelf, positionTryFallbacks: css.positionTryFallbacks };
  });
  expect(box.x, JSON.stringify(placement)).toBeGreaterThanOrEqual(11.5); expect(box.y, JSON.stringify(placement)).toBeGreaterThanOrEqual(11.5);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width - 11.5);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height - 11.5);
}

test('missing-export contract facade opens real ColorPicker with HEX and native focus ownership', async ({ page }, info) => {
  await setup(page);
  expect(await page.evaluate(() => window.fixture.hasLegacyHook)).toBe(false);
  const panel = picker(page), anchor = page.locator('#color-anchor');
  await expect(panel.getByRole('textbox', { name: 'HEX' })).toHaveValue('#336699');
  const first = await panel.boundingBox(), trigger = await anchor.boundingBox();
  expect(Math.abs(first.x - trigger.x)).toBeLessThanOrEqual(.5);
  expect(Math.abs(first.y - trigger.y - trigger.height - 8)).toBeLessThanOrEqual(.5);
  await expectBounds(page);
  await panel.getByRole('textbox', { name: 'HEX' }).fill('#a1b2c3');
  await expect(page.locator('#draft-color')).toHaveText('#a1b2c3');
  await panel.getByRole('button', { name: 'Apply', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0); await expect(anchor).toBeFocused();
  expect(await anchor.evaluate(node => node.style.getPropertyValue('anchor-name'))).toBe('--preexisting-color-anchor');
  expect(await page.evaluate(() => window.fixture.events)).toEqual(['cancel']);
  await anchor.click(); await expect(panel).toBeVisible();
  await page.screenshot({ path: info.outputPath('missing-export-color-picker.png') });
  await page.evaluate(() => window.fixture.dispose()); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape'); expect(await page.evaluate(() => window.fixture.errors)).toEqual([]);
});

test('missing-export contract facade tracks nested scroll resize and layout-window bounds', async ({ page }) => {
  await setup(page);
  const before = await picker(page).boundingBox();
  await page.locator('#position-scroller').evaluate(node => { node.scrollTop += 40; }); await settle(page);
  const after = await picker(page).boundingBox(); expect(Math.abs(after.y - before.y + 40)).toBeLessThanOrEqual(.5);
  for (const size of [{ width: 390, height: 720 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size); await settle(page); await expectBounds(page);
    await expect(picker(page).getByRole('button', { name: 'Apply', exact: true })).toBeInViewport({ ratio: 1 });
  }
  // A previously selected anchor-dependent fallback must not leave the window
  // when its trigger scrolls entirely above the nested scrollport.
  await page.locator('#position-scroller').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await settle(page); await expectBounds(page);
  await page.evaluate(() => document.documentElement.style.setProperty('--dsh-frame-overlay-top', '54px'));
  await settle(page); await expectBounds(page);
  expect((await picker(page).boundingBox()).y).toBeGreaterThanOrEqual(53.5);
  const hex = picker(page).getByRole('textbox', { name: 'HEX' });
  await expect(hex).toBeFocused(); await hex.fill('#a1b2c'); await hex.evaluate(node => node.setSelectionRange(3, 3));
  await page.setViewportSize({ width: 1000, height: 1200 });
  await page.locator('#position-scroller').evaluate(node => { node.scrollTop = 0; }); await settle(page);
  await expectBounds(page); await expect(picker(page)).not.toHaveAttribute('data-window-pinned');
  const recovered = await picker(page).boundingBox(), anchor = await page.locator('#color-anchor').boundingBox();
  expect(Math.abs(recovered.y - anchor.y - anchor.height - 8)).toBeLessThanOrEqual(.5);
  await expect(hex).toBeFocused(); await expect(hex).toHaveValue('#a1b2c'); expect(await hex.evaluate(node => node.selectionStart)).toBe(3);
  await picker(page).getByRole('button', { name: 'Apply', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(picker(page).getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(picker(page)).toHaveCount(0); await expect(page.locator('#color-anchor')).toBeFocused();
  expect(await page.evaluate(() => window.fixture.events)).toEqual(['cancel']);
});

test('CSS viewport fit respects an existing frame inset while the anchor stays visible', async ({ page }) => {
  await setup(page, { frame: 54, width: 1000, height: 420 });
  const hex = picker(page).getByRole('textbox', { name: 'HEX' });
  await page.locator('#position-scroller').evaluate(node => { node.scrollTop = 40; }); await settle(page);
  await expectBounds(page); expect((await picker(page).boundingBox()).y).toBeGreaterThanOrEqual(53.5);
  await expect(hex).toBeFocused();
  await page.evaluate(() => document.documentElement.style.setProperty('--dsh-frame-overlay-top', '72px'));
  await page.locator('#position-scroller').evaluate(node => { node.scrollTop = 60; }); await settle(page);
  await expectBounds(page); expect((await picker(page).boundingBox()).y).toBeGreaterThanOrEqual(71.5);
  await expect(hex).toBeFocused();
});

test('CSS anchor cleanup preserves inline priority and does not overwrite a foreign owner', async ({ page }) => {
  await setup(page, { priority: true });
  const anchor = page.locator('#color-anchor');
  expect(await anchor.evaluate(node => node.style.getPropertyPriority('anchor-name'))).toBe('important');
  await page.keyboard.press('Escape');
  expect(await anchor.evaluate(node => [node.style.getPropertyValue('anchor-name'), node.style.getPropertyPriority('anchor-name')])).toEqual(['--preexisting-color-anchor', 'important']);
  await anchor.click(); await expect(picker(page)).toBeVisible();
  await anchor.evaluate(node => node.style.setProperty('anchor-name', '--foreign-owner', 'important'));
  await page.keyboard.press('Escape');
  expect(await anchor.evaluate(node => [node.style.getPropertyValue('anchor-name'), node.style.getPropertyPriority('anchor-name')])).toEqual(['--foreign-owner', 'important']);
  await anchor.click(); await expect(picker(page)).toBeVisible();
  await anchor.evaluate(node => { window.lastColorAnchor = node; });
  await page.evaluate(() => {
    document.getElementById('position-scroller').dispatchEvent(new Event('scroll'));
    window.fixture.dispose();
  });
  await settle(page);
  expect(await page.evaluate(() => [window.lastColorAnchor.style.getPropertyValue('anchor-name'), window.lastColorAnchor.style.getPropertyPriority('anchor-name')])).toEqual(['--foreign-owner', 'important']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('controlled late observer delivery cannot pin a reopened ColorPicker through its shared ref', async ({ page }) => {
  await setup(page, { captureObservers: true });
  await page.evaluate(() => {
    window.retiredPositionObserver = window.positionObservers.find(observer => observer.target.classList.contains('wsp-color-picker'));
    if (!window.retiredPositionObserver) throw new Error('ColorPicker observer was not captured');
  });
  await page.keyboard.press('Escape'); await expect(picker(page)).toHaveCount(0);
  await page.locator('#color-anchor').click(); await expect(picker(page)).toBeVisible(); await settle(page);
  await expect(picker(page)).not.toHaveAttribute('data-window-pinned');
  await page.evaluate(() => {
    const old = window.retiredPositionObserver;
    old.callback([{ target: old.target, intersectionRatio: 0 }]);
  });
  await expect(picker(page)).not.toHaveAttribute('data-window-pinned');
  await expect(picker(page).getByRole('textbox', { name: 'HEX' })).toBeFocused();
});

test('legacy browser contract facade uses the real optional lower hook without CSS anchors', async ({ page }) => {
  await setup(page, { legacy: true });
  expect(await page.evaluate(() => window.fixture.hasLegacyHook)).toBe(true);
  expect(await page.evaluate(() => window.fixture.events.filter(value => value === 'legacy-position').length)).toBeGreaterThan(0);
  await expectBounds(page); await page.keyboard.press('Escape'); await expect(picker(page)).toHaveCount(0);
  await expect(page.locator('#color-anchor')).toBeFocused();
  expect(await page.locator('#color-anchor').evaluate(node => node.style.getPropertyValue('anchor-name'))).toBe('--preexisting-color-anchor');
});
