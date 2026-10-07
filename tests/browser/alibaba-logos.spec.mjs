import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

// Public IDs and display names from research/dsh-alibaba-api-2026-10-06.md.
// Synthetic UI metadata only: no config, credentials, provider requests or host profile.
const models = [
  { id: 'qwen3.8-max', name: 'Qwen 3.8 Max', lab: 'Qwen' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', lab: 'DeepSeek' },
  { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', lab: 'Kimi' },
  { id: 'glm-5.3', name: 'GLM 5.3', lab: 'Zhipu AI' },
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', lab: 'MiniMax' },
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', lab: 'DeepSeek' },
];
let code;
test.beforeAll(async () => {
  code = (await build({
    stdin: { contents: "export * from './src/icons.js'; export * from './src/adapters.js'; export * from './src/model-menu.js';", resolveDir: process.cwd(), sourcefile: 'logo-contract-fixture.js' },
    bundle: true, platform: 'browser', format: 'iife', globalName: 'Logos', write: false,
  })).outputFiles[0].text;
});

function nativeSection() {
  return `<section role="group" data-menu-group><div data-menu-group-heading>Alibaba Work</div>${models.map(m => `<button role="menuitemradio" title="${m.name}" aria-checked="false"><span><span>${m.name}</span></span><span data-status><svg width="16" height="16"/></span></button>`).join('')}</section>`;
}
function codexSection() {
  return `<section class="codexModelSelectGroup" role="group" aria-labelledby="picker-alibaba-work"><div id="picker-alibaba-work" class="codexModelSelectGroupTitle">alibaba-work</div>${models.map(m => `<button class="codexModelSelectOption" role="menuitemradio" aria-checked="false"><span class="codexModelSelectOptionCopy"><span class="codexModelSelectOptionName">${m.name}</span></span><span class="codexModelSelectCheck"><svg width="16" height="16" data-check/></span></button>`).join('')}</section>`;
}

for (const kind of ['native', 'codex']) {
  test(`Alibaba lab truth reaches ${kind} selector, list and session projection`, async ({ page }) => {
    await page.route('**/*', route => route.abort());
    await page.setContent(models.map((m, i) => `<div data-row-key="session:s${i}" role="treeitem"><span data-native-status>working</span><span>${m.name}</span><span>1m</span></div><div id="toolbar${i}"><div class="${kind === 'codex' ? 'codexModelSelect' : ''}"><button id="trigger${i}" ${kind === 'codex' ? 'class="codexModelSelectTrigger"' : 'aria-busy="false"'} aria-haspopup="menu" aria-expanded="${i === 0}" aria-controls="picker-menu" title="${m.name}">${kind === 'codex' ? `<span class="codexModelSelectLabel">${m.name}</span><svg data-chevron/>` : `<svg width="16" height="16"/><span>${m.name}</span>`}</button></div><span id="marker${i}"></span></div>`).join('') + `<div id="picker-menu" role="menu">${kind === 'codex' ? codexSection() : nativeSection()}</div>`);
    await page.addScriptTag({ content: code });
    const actual = await page.evaluate(models => {
      const constant = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
      const selections = models.map(m => ({ provider: 'alibaba-work', model: m.id }));
      const snapshot = { byId: Object.fromEntries(selections.map((s, i) => [`s${i}`, { projectionValues: { modelSelection: { next: s } } }])) };
      const cleanups = selections.map((selection, i) => Logos.attachComposerIcon(document.querySelector(`#marker${i}`), selection));
      const adapter = Logos.createDOMAdapter({ document, preferences: constant({ features: { workspaces: false, sessions: true } }), sessions: { list: constant(snapshot), refreshProjections: () => { throw new Error('Unexpected projection fetch'); } }, workspaces: { list: constant({ items: [] }) }, onEdit: () => {}, translate: x => x });
      cleanups.push(() => adapter.dispose());
      cleanups.push(Logos.attachModelMenuIcons(document.querySelector('#marker0'), constant({ groups: [{ id: 'alibaba-work', name: 'Alibaba Work', models }] })));
      const normalizedSVG = selection => { const container = document.createElement('span'); container.innerHTML = Logos.markSVG(selection); return container.innerHTML; };
      const neutral = normalizedSVG(null);
      const output = models.map((m, i) => {
        const selection = Logos.selectionOf(snapshot, `s${i}`);
        const selector = document.querySelector(`#trigger${i} .wsp-composer-icon`);
        const list = document.querySelectorAll('#picker-menu .wsp-model-menu-icon')[i];
        const session = document.querySelector(`[data-row-key="session:s${i}"] .wsp-session-icon`);
        const svg = normalizedSVG(selection);
        return { id: m.id, resolved: Logos.vendorName(selection), selector: selector?.innerHTML === neutral ? 'AI' : Logos.vendorName(selection), list: list?.dataset.vendor ?? 'missing', session: session?.title ?? 'missing', sameMark: [selector, list, session].every(el => el?.innerHTML === svg) };
      });
      window.cleanupLogos = () => cleanups.reverse().forEach(fn => fn());
      return output;
    }, models);
    expect(actual).toEqual(models.map(m => ({ id: m.id, resolved: m.lab, selector: m.lab, list: m.lab, session: m.lab, sameMark: true })));
    await expect(page.locator('[data-native-status]')).toHaveText(models.map(() => 'working'));
    await page.evaluate(() => cleanupLogos());
    await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
  });
}

test('minimal Qwen custom selection gets a non-neutral lab mark', async ({ page }) => {
  await page.route('**/*', route => route.abort());
  await page.addScriptTag({ content: code });
  const actual = await page.evaluate(() => {
    const selection = { model: 'qwen3.8-max' };
    return { lab: Logos.vendorName(selection), neutral: Logos.markSVG(selection) === Logos.markSVG(null) };
  });
  expect(actual).toEqual({ lab: 'Qwen', neutral: false });
});

test('new lab duplicate labels stay neutral unless all directory matches agree', async ({ page }) => {
  await page.route('**/*', route => route.abort());
  const labels = ['Default', 'Unknown', 'Unanimous', 'Mixed'];
  await page.setContent(`<div id="toolbar"><div><button aria-busy="false" aria-haspopup="menu" aria-expanded="true" aria-controls="picker-menu" title="Default"><svg width="16" height="16"/></button></div><span id="marker"></span></div><div id="picker-menu" role="menu"><section role="group" data-menu-group><div data-menu-group-heading>Shared route</div>${labels.map(label => `<button role="menuitemradio" title="${label}"><span>${label}</span><span data-native-check><svg/></span></button>`).join('')}</section></div>`);
  await page.addScriptTag({ content: code });
  await page.evaluate(() => {
    const groups = [
      { id: 'alibaba-work', name: 'Shared route', models: [{ id: 'qwen3.8-max', name: 'Default' }, { id: 'opaque', name: 'Unknown' }, { id: 'qwen2.5-coder', name: 'Unanimous' }, { id: 'qwen3.8-max', name: 'Mixed' }] },
      { id: 'other-route', name: 'Shared route', models: [{ id: 'glm-5.3', name: 'Default' }, { id: 'opaque-2', name: 'Unknown' }, { id: 'qwen3-coder', name: 'Unanimous' }, { id: 'opaque', name: 'Mixed' }] },
    ];
    window.cleanupLogos = Logos.attachModelMenuIcons(document.querySelector('#marker'), { getSnapshot: () => ({ groups }), subscribe: () => () => {} });
  });
  expect(await page.locator('#picker-menu .wsp-model-menu-icon').evaluateAll(items => items.map(el => el.dataset.vendor))).toEqual(['AI', 'AI', 'Qwen', 'AI']);
  await expect(page.locator('[data-native-check] svg')).toHaveCount(4);
  await page.evaluate(() => cleanupLogos());
  await expect(page.locator('[data-wsp-owned]')).toHaveCount(0);
});
