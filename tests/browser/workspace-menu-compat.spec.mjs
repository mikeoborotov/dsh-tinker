import { test, expect } from '@playwright/test';
import { buildFixture } from '../build-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
let fixture;
test.beforeAll(async () => { fixture = await buildFixture('tests/workspace-menu-fixture.jsx'); });
test('captured current native overlay and outlet source hashes are locked', async () => {
  const base = new URL('../native-workspace-rc1/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', base), 'utf8'));
  for (const fragment of provenance.capturedFragments) {
    const source = (await readFile(new URL(fragment.path, base), 'utf8')).replaceAll('\r\n', '\n');
    expect(createHash('sha256').update(source).digest('hex')).toBe(fragment.fixtureNormalizedSha256);
  }
});
async function mount(page, options = {}) {
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(options => window.workspaceMenuFixture.mount(options), options);
  await expect(page.locator('#workspace-trigger-w1')).toBeVisible();
}
async function open(page, id = 'w1') {
  await page.locator('#workspace-trigger-' + id).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

for (const variant of ['legacy', 'current']) test(variant + ' preserves native actions and inserts Appearance immediately after Rename', async ({ page }, testInfo) => {
  await mount(page, { variant });
  await open(page);
  await page.evaluate(() => window.workspaceMenuFixture.captureNative());
  await expect(page.getByRole('menuitem')).toHaveText(variant === 'legacy'
    ? ['Rename', 'Appearance', 'Delete workspace'] : ['Rename', 'Appearance', 'Show in folder', 'Delete workspace']);
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeIdentity())).toEqual((variant === 'legacy'
    ? ['Rename', 'Delete workspace'] : ['Rename', 'Show in folder', 'Delete workspace']).map(label => ({ label, connected: true, sameWrapper: true })));
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).calls).toEqual({});
  await page.getByRole('menu').screenshot({ path: testInfo.outputPath('workspace-' + variant + '.png') });
  for (const [label, action] of [['Rename', 'rename'], ...(variant === 'legacy' ? [] : [['Show in folder', 'reveal']]), ['Delete workspace', 'delete']]) {
    const nativeButton = page.getByRole('menuitem', { name: label, exact: true });
    if (variant === 'current') await nativeButton.locator('[data-slot="contextMenu.icon"] > svg').click();
    else await nativeButton.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).calls['w1:' + action]).toBe(1);
    await open(page);
    await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toHaveCount(1);
  }
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).edits).toEqual([{ id: 'w1', anchor: 'workspace-trigger-w1' }]);
  await expect(page.locator('#workspace-trigger-w1')).toBeFocused();
});

for (const reveal of [true, false]) test('current inline slot icons preserve native nodes with reveal=' + reveal, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page, { reveal });
  await open(page);
  await expect(page.locator('[role="menu"] [data-slot="contextMenu.icon"]')).toHaveCount(reveal ? 3 : 2);
  await page.evaluate(() => window.workspaceMenuFixture.captureNative());
  await page.clock.runFor(350);
  await expect(page.getByRole('menuitem')).toHaveText(reveal
    ? ['Rename', 'Appearance', 'Show in folder', 'Delete workspace'] : ['Rename', 'Appearance', 'Delete workspace']);
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeIconIdentity())).toEqual((reveal
    ? ['Rename', 'Show in folder', 'Delete workspace'] : ['Rename', 'Delete workspace'])
    .map(label => ({ label, sameIcon: true, sameOutlet: true, sameGlyph: true, connected: true })));
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeContentIdentity())).toEqual({ same: true, connected: true, children: 0 });
  await expect(page.locator('[role="menu"] [data-slot="contextMenu.content"]')).toHaveCount(1);
  await expect(page.locator('[data-wsp-menu] [data-slot]')).toHaveCount(0);
  await expect(page.locator('[data-wsp-menu] > span:first-child > svg')).toHaveCount(1);
});

for (const delay of [0, 450, 1000]) test('native opening after resolution delay=' + delay + ' keeps Appearance', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page, { delay });
  await page.locator('#workspace-trigger-w1').click();
  await expect(page.locator('#workspace-trigger-w1')).toHaveAttribute('aria-expanded', 'true');
  await page.clock.runFor(delay);
  // Flush the React commit after the simulated resolver timer, then the adapter's RAF.
  await expect(page.getByRole('menu')).toBeVisible();
  await page.clock.runFor(64);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).items)
    .toEqual(['Rename', 'Appearance', 'Show in folder', 'Delete workspace']);
});

for (const options of [{ delay: 1400 }, { variant: 'legacy', delay: 450 }]) test('opening beyond bounded budget stays unowned ' + JSON.stringify(options), async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page, options);
  await page.locator('#workspace-trigger-w1').click();
  await page.clock.runFor(options.delay);
  await expect(page.getByRole('menu')).toBeVisible();
  await page.clock.runFor(64);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
});

for (const cancel of ['escape', 'outside', 'feature-off', 'removed-workspace', 'trigger-closed', 'dispose']) test('pending preparation cancels before late popup: ' + cancel, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page, { delay: 450 });
  await page.locator('#workspace-trigger-w1').click();
  await page.clock.runFor(100);
  if (cancel === 'escape') await page.keyboard.press('Escape');
  if (cancel === 'outside') await page.locator('#outside').click();
  if (cancel === 'feature-off') await page.evaluate(() => window.workspaceMenuFixture.toggle(false));
  if (cancel === 'removed-workspace') await page.evaluate(() => window.workspaceMenuFixture.setWorkspaces(['w2']));
  if (cancel === 'trigger-closed') await page.evaluate(() => window.workspaceMenuFixture.cancel());
  if (cancel === 'dispose') await page.evaluate(() => window.workspaceMenuFixture.dispose());
  await page.clock.runFor(100);
  if (cancel === 'feature-off') await page.evaluate(() => window.workspaceMenuFixture.toggle(true));
  if (cancel === 'removed-workspace') await page.evaluate(() => window.workspaceMenuFixture.setWorkspaces(['w1', 'w2']));
  await page.clock.runFor(400);
  if (cancel === 'trigger-closed') { await page.evaluate(() => window.workspaceMenuFixture.latePopup()); await page.clock.runFor(50); }
  await expect(page.getByRole('menu')).toBeVisible();
  await page.clock.runFor(64);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).edits).toEqual([]);
});

test('an older preparation timeout cannot cancel a newer workspace opening', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page, { delay: 3000 });
  await page.locator('#workspace-trigger-w1').click();
  await page.clock.runFor(1000);
  await page.evaluate(() => { window.workspaceMenuFixture.cancel('w1'); window.workspaceMenuFixture.configure({ delay: 450 }); });
  await page.locator('#workspace-trigger-w2').click();
  await page.clock.runFor(450);
  await expect(page.getByRole('menu')).toBeVisible();
  await page.clock.runFor(64);
  await expect(page.locator('[data-wsp-menu="w2"]')).toHaveCount(1);
  await expect(page.locator('[data-wsp-menu="w1"]')).toHaveCount(0);
});

test('native keyboard, cancel, workspace id and reopen remain correct', async ({ page }) => {
  await mount(page);
  await open(page, 'w2');
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitem', { name: 'Rename', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Show in folder', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).edits).toEqual([{ id: 'w2', anchor: 'workspace-trigger-w2' }]);
  await open(page, 'w2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#workspace-trigger-w2')).toBeFocused();
  await page.evaluate(() => window.workspaceMenuFixture.configure({ variant: 'legacy' }));
  await open(page);
  await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeVisible();
});

test('locale and known reordered native contributions keep native order around semantic Rename', async ({ page }) => {
  await mount(page, { lang: 'ru', reordered: true, finder: true });
  await open(page);
  await expect(page.getByRole('menuitem')).toHaveText(['Удалить рабочую область', 'Переименовать', 'Оформление', 'Показать в Finder']);
});

test('terminal Rename without a following native sibling retains the existing safe Delete fallback', async ({ page }) => {
  await mount(page, { variant: 'legacy', reordered: true });
  await open(page);
  await expect(page.getByRole('menuitem')).toHaveText(['Appearance', 'Delete workspace', 'Rename']);
});

for (const kind of ['session', 'profile']) test(kind + ' row cannot become a workspace menu owner', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page);
  await page.locator('[data-row-key="workspace:w1"]').evaluate((row, kind) => row.setAttribute('data-row-key', kind + ':w1'), kind);
  await open(page);
  await page.clock.runFor(1100);
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Show in folder', 'Delete workspace']);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).edits).toEqual([]);
});

test('unknown extra contribution is left unchanged rather than claiming any menu', async ({ page }) => {
  await mount(page, { extra: true });
  await open(page);
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Show in folder', 'Other command', 'Delete workspace']);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
});

test('feature off, disposal, removal and reopening cannot revive stale Appearance', async ({ page }) => {
  await mount(page);
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await page.evaluate(() => window.workspaceMenuFixture.toggle(false));
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.evaluate(() => window.workspaceMenuFixture.toggle(true));
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await page.evaluate(() => window.workspaceMenuFixture.dispose());
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.evaluate(() => window.workspaceMenuFixture.restart());
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
});

test('unknown workspace cannot own a compatible-looking menu', async ({ page }) => {
  await mount(page, { variant: 'legacy' });
  await page.evaluate(() => window.workspaceMenuFixture.setWorkspaces(['w2']));
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
});

test('activation rechecks a workspace removed before the next observer frame', async ({ page }) => {
  await mount(page);
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await page.evaluate(() => {
    const button = document.querySelector('[data-wsp-menu]');
    window.workspaceMenuFixture.setWorkspaces(['w2']);
    button.click();
  });
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).edits).toEqual([]);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).calls).toEqual({});
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
});

test('legacy native namespace works when optional reveal namespace is unavailable', async ({ page }) => {
  await mount(page, { variant: 'legacy', lang: 'ru', missingRevealNamespace: true });
  await open(page);
  await expect(page.getByRole('menuitem')).toHaveText(['Переименовать', 'Оформление', 'Удалить рабочую область']);
});

test('known async contributions retain native identity; unknown late contributions remove only our row', async ({ page }) => {
  await mount(page, { reveal: false });
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await page.evaluate(() => window.workspaceMenuFixture.captureNative());
  await page.evaluate(() => window.workspaceMenuFixture.configure({ reveal: true }));
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Appearance', 'Show in folder', 'Delete workspace']);
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeIdentity())).toEqual(['Rename', 'Delete workspace'].map(label => ({ label, connected: true, sameWrapper: true })));
  await page.evaluate(() => window.workspaceMenuFixture.configure({ extra: true }));
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Show in folder', 'Other command', 'Delete workspace']);
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeIdentity())).toEqual(['Rename', 'Delete workspace'].map(label => ({ label, connected: true, sameWrapper: true })));
});

test('a late native content contribution relinquishes only Appearance, then reopens cleanly', async ({ page }) => {
  await mount(page);
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await page.evaluate(() => window.workspaceMenuFixture.captureNative());
  await page.evaluate(() => window.workspaceMenuFixture.configure({ content: true }));
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await expect(page.locator('[data-slot="contextMenu.content"]')).toHaveText('Native contribution');
  expect(await page.evaluate(() => window.workspaceMenuFixture.nativeIdentity())).toEqual(['Rename', 'Show in folder', 'Delete workspace']
    .map(label => ({ label, connected: true, sameWrapper: true })));
  await page.evaluate(() => window.workspaceMenuFixture.configure({ content: false }));
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
});

// Counter-only negative fixtures: deliberately invalid/unowned menus are not native captures.
const foreign = '<div id="foreign-menu" role="menu"><div role="presentation"><div><button role="menuitem"><span><svg/></span><span>Rename</span></button></div><div><button role="menuitem"><span><svg/></span><span>Delete workspace</span></button></div></div></div>';

test('pre-existing unrelated menu is untouched, without claiming it before a workspace trigger', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page);
  await page.evaluate(html => document.body.insertAdjacentHTML('beforeend', html), foreign);
  await page.clock.runFor(350);
  await expect(page.locator('#foreign-menu [data-wsp-menu]')).toHaveCount(0);
  await page.locator('#workspace-trigger-w1').click();
  await page.clock.runFor(350);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(1);
  await expect(page.locator('#foreign-menu [data-wsp-menu]')).toHaveCount(0);
});

test('two fresh menus are ambiguous and cannot acquire an Appearance after one disappears', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page);
  await page.evaluate(html => { document.getElementById('workspace-trigger-w1').click(); document.body.insertAdjacentHTML('beforeend', html); }, foreign);
  await page.clock.runFor(350);
  await expect(page.getByRole('menu')).toHaveCount(2);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  await page.evaluate(() => document.getElementById('foreign-menu').remove());
  await page.clock.runFor(350);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
});

for (const change of ['missing-rename', 'duplicate-label', 'unknown-label', 'unknown-layout', 'wrong-controls', 'removed-workspace', 'cancelled-trigger',
  'wrong-slot-name', 'multiple-slot-children', 'non-native-slot-child', 'nested-slot-svg', 'div-slot', 'slot-error', 'interactive-slot', 'interactive-svg', 'wrong-slot-display',
  'nonempty-content', 'foreign-content', 'duplicate-content', 'misplaced-content', 'styled-content', 'malformed-content', 'wrong-content-tag', 'text-content']) test('rejects ' + change, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount(page);
  await page.evaluate(change => {
    const anchor = document.getElementById('workspace-trigger-w1');
    if (change === 'wrong-controls') anchor.setAttribute('aria-controls', 'another-menu');
    anchor.click();
    if (change === 'removed-workspace') window.workspaceMenuFixture.setWorkspaces(['w2']);
    if (change === 'cancelled-trigger') document.getElementById('outside').click();
  }, change);
  // Pause at the pre-adapter render, then alter exactly one native contract element.
  await expect(page.getByRole('menu')).toBeVisible();
  await page.evaluate(change => {
    const buttons = [...document.querySelectorAll('[role="menu"] button[role="menuitem"]')];
    if (change === 'missing-rename') buttons[0].lastElementChild.textContent = 'Other command';
    if (change === 'duplicate-label') buttons[1].lastElementChild.textContent = 'Rename';
    if (change === 'unknown-label') buttons[1].lastElementChild.textContent = 'Other command';
    if (change === 'unknown-layout') buttons[1].parentElement.append(document.createElement('input'));
    const outlet = buttons[0].querySelector('[data-slot="contextMenu.icon"]');
    if (change === 'wrong-slot-name') outlet.dataset.slot = 'someOther.icon';
    if (change === 'multiple-slot-children') outlet.append(outlet.firstElementChild.cloneNode(true));
    if (change === 'non-native-slot-child') outlet.replaceChildren(document.createElement('i'));
    if (change === 'nested-slot-svg') { const nested = document.createElement('span'); nested.append(outlet.firstElementChild); outlet.append(nested); }
    if (change === 'div-slot') { const div = document.createElement('div'); div.dataset.slot = 'contextMenu.icon'; div.style.display = 'contents'; div.append(...outlet.childNodes); outlet.replaceWith(div); }
    if (change === 'slot-error') outlet.dataset.slotError = 'contextMenu.icon';
    if (change === 'interactive-slot') outlet.setAttribute('tabindex', '0');
    if (change === 'interactive-svg') outlet.firstElementChild.setAttribute('tabindex', '0');
    if (change === 'wrong-slot-display') outlet.style.display = 'inline';
    const content = document.querySelector('[role="menu"] [data-slot="contextMenu.content"]');
    if (change === 'nonempty-content') content.append(document.createElement('span'));
    if (change === 'foreign-content') content.dataset.slot = 'foreign.content';
    if (change === 'duplicate-content') content.after(content.cloneNode(true));
    if (change === 'misplaced-content') content.parentElement.prepend(content);
    if (change === 'styled-content') content.style.color = 'red';
    if (change === 'malformed-content') content.setAttribute('role', 'group');
    if (change === 'wrong-content-tag') { const span = document.createElement('span'); span.dataset.slot = 'contextMenu.content'; span.style.display = 'contents'; content.replaceWith(span); }
    if (change === 'text-content') content.textContent = 'Unknown contribution';
  }, change);
  await page.clock.runFor(350);
  await expect(page.locator('[data-wsp-menu]')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspaceMenuFixture.snapshot())).calls).toEqual({});
});
