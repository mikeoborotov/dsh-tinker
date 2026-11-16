import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

let fixture;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixture.js', import.meta.url))],
    bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', write: false,
  });
  fixture = result.outputFiles[0].text;
});

async function openMenu(page, options) {
  await page.route('**/*', route => route.abort());
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate(options => window.t148.mount(options), options);
  await page.locator('#workspace-menu-anchor').click();
  // Exercise the adapter's actual RAF/MutationObserver plus its 300ms final scan.
  await page.clock.runFor(350);
  await expect(page.getByRole('menu')).toBeVisible();
  const snapshot = await page.evaluate(() => window.t148.snapshot());
  expect(snapshot.menuHeight).toBeGreaterThan(0);
  expect(snapshot.calls).toEqual({ rename: 0, reveal: 0, delete: 0 });
  return snapshot;
}

test('01 positive control: supported two-item native pattern inserts Appearance', async ({ page }) => {
  const snapshot = await openMenu(page, { reveal: false });
  console.log('[T148 CONTROL]', JSON.stringify(snapshot));
  expect(snapshot.items).toEqual(['Rename', 'Appearance', 'Delete workspace']);
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click();
  expect(await page.evaluate(() => window.t148.snapshot().edits)).toEqual(['w1']);
  expect(await page.evaluate(() => window.t148.snapshot().calls)).toEqual({ rename: 0, reveal: 0, delete: 0 });
});

function assertCurrentAppearance(snapshot) {
  expect(snapshot.items.filter(label => label !== 'Appearance')).toEqual(['Rename', 'Show in folder', 'Delete workspace']);
  expect(snapshot.items, 'T148: Appearance missing from source-shaped current native Workspace menu')
    .toContain('Appearance');
}

test('02 RED exact symptom: current native Rename / Show in folder / Delete workspace needs Appearance', async ({ page }) => {
  const snapshot = await openMenu(page, { reveal: true });
  console.log('[T148 CURRENT]', JSON.stringify(snapshot));
  assertCurrentAppearance(snapshot);
});

// Cumulative reductions: one option changes from the immediately preceding scene.
// Each reduced scene must retain its corresponding passing native two-item control.
for (const [name, options] of [
  ['03 remove separator', { separator: false }],
  ['04 reduce row presentation to one trigger', { separator: false, fullRow: false }],
  ['05 remove native CSS class names', { separator: false, fullRow: false, classes: false }],
]) {
  test(name, async ({ page, context }) => {
    const controlPage = await context.newPage();
    const control = await openMenu(controlPage, { ...options, reveal: false });
    expect(control.items).toEqual(['Rename', 'Appearance', 'Delete workspace']);
    await controlPage.close();
    const current = await openMenu(page, { ...options, reveal: true });
    console.log('[T148 MINIMIZE]', name, JSON.stringify({ control: control.items, current }));
    assertCurrentAppearance(current);
  });
}

test('06 minimum production callee: menu only, no adapter caller or services', async ({ page }) => {
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: fixture });
  const control = await page.evaluate(() => window.t148.direct(false));
  expect(control.items).toEqual(['Rename', 'Appearance', 'Delete workspace']);
  expect(control.returnedButton).toBe(true);
  const current = await page.evaluate(() => window.t148.direct(true));
  console.log('[T148 MINIMUM CALLEE]', JSON.stringify({ control, current }));
  assertCurrentAppearance(current);
});

test('07 semantic regression: known actions accepted, unknown labels or roles left untouched', async ({ page }) => {
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: fixture });
  const cases = await page.evaluate(() => [
    ['baseline', true, 'none'],
    ['delete-old-position', true, 'delete-old-position'],
    ['third-label', true, 'third-label'],
    ['third-role', true, 'third-role'],
    ['two-item-control', false, 'none'],
  ].map(([name, reveal, change]) => ({ name, ...window.t148.direct(reveal, change) })));
  console.log('[T148 PROBES]', JSON.stringify(cases));
  expect(cases.map(({ name, matchedButtonCount, returnedButton, appearance }) => ({ name, matchedButtonCount, returnedButton, appearance }))).toEqual([
    { name: 'baseline', matchedButtonCount: 3, returnedButton: true, appearance: 1 },
    { name: 'delete-old-position', matchedButtonCount: 3, returnedButton: true, appearance: 1 },
    { name: 'third-label', matchedButtonCount: 3, returnedButton: false, appearance: 0 },
    { name: 'third-role', matchedButtonCount: 2, returnedButton: false, appearance: 0 },
    { name: 'two-item-control', matchedButtonCount: 2, returnedButton: true, appearance: 1 },
  ]);
});
