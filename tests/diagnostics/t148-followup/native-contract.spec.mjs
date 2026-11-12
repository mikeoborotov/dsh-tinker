import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { buildNative } from './build-native.mjs';
let fixture;
test.beforeAll(async () => { fixture = await buildNative(); });
async function mount(page, options) {
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ type: 'module', content: fixture.js });
  await page.waitForFunction(() => Boolean(window.t148followup));
  await page.evaluate(options => window.t148followup.mount(options), options);
  await expect(page.locator('[data-row-key="workspace:w1"]')).toBeVisible();
  await page.locator('[data-row-key="workspace:w1"]').hover();
  await expect(page.locator('[data-row-key="workspace:w1"] button[data-context-menu-trigger]')).toBeVisible();
  await page.locator('[data-row-key="workspace:w1"] button[data-context-menu-trigger]').click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test('native full captured render baseline: ProjectRow, LocaleRuntime, SlotRegistry, Overlay, current Menu', async ({ page }) => {
  await mount(page, { adapterEnabled: false });
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Show in folder', 'Delete workspace']);
  const state = await page.evaluate(() => window.t148followup.snapshot());
  expect(state.errors).toEqual([]);
  expect(state.calls).toEqual({ rename: 0, delete: 0, reveal: 0, newSession: 0 });
  console.log('[T148 FULL NATIVE BASELINE]', JSON.stringify({ items: state.items, labels: state.labels, parts: state.parts }));
});

test('source-contract RED: actual full native menu must contain Appearance with production adapter', async ({ page }, testInfo) => {
  await mount(page, { adapterEnabled: true });
  const captured = await page.evaluate(() => window.t148followup.snapshot());
  await writeFile(testInfo.outputPath('captured-source-dom.txt'), JSON.stringify(captured, null, 2));
  await writeFile(testInfo.outputPath('captured-native-menu.html'), captured.menu.replaceAll('><', '>\n<'));
  console.log('[T148 FULL NATIVE]', JSON.stringify({ items: captured.items, labels: captured.labels, parts: captured.parts, errors: captured.errors }));
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true }), 'T148 full current native source contract: Appearance absent').toBeVisible();
  expect((await page.evaluate(() => window.t148followup.snapshot())).calls).toEqual({ rename: 0, delete: 0, reveal: 0, newSession: 0 });
});

test('minimal caller reduction: production callee on the exact full native rendered menu', async ({ page }) => {
  await mount(page, { adapterEnabled: false });
  const inserted = await page.evaluate(() => window.t148followup.tryProductionCallee());
  const state = await page.evaluate(() => window.t148followup.snapshot());
  console.log('[T148 FULL NATIVE MINIMUM]', JSON.stringify({ inserted, items: state.items, labels: state.labels, errors: state.errors }));
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true }), 'T148 direct production callee: Appearance absent on full captured native Menu').toBeVisible();
});

for (const change of ['remove-only-empty', 'foreign-empty', 'nonempty-exact', 'extra-empty-exact']) test('native content outlet regression: ' + change, async ({ page }) => {
  await mount(page, { adapterEnabled: false });
  const result = await page.evaluate(change => window.t148followup.probeEmptyContentOutlet(change), change);
  console.log('[T148 CONTENT OUTLET REGRESSION]', JSON.stringify(result));
  expect(result.before).toBe(true);
  expect(result.nativeButtonsUnchanged).toBe(true);
  expect(result.after).toBe(change === 'remove-only-empty');
  expect(result.inserted).toBe(change === 'remove-only-empty');
  if (change === 'remove-only-empty') await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Show in folder', 'Appearance', 'Delete workspace']);
});
