import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Use the shipped browser resolver, including its JSON marks, without changing its module imports.
const output = await build({ entryPoints: ['src/icons.js'], bundle: true, platform: 'node', format: 'esm', write: false });
const { vendorOf, vendorName, markSVG, selectionOf } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
const matrix = [
  ['qwen3.8-max', 'qwen', 'Qwen'],
  ['deepseek-v4-pro', 'deepseek', 'DeepSeek'],
  ['kimi-k2.7-code', 'moonshotai', 'Kimi'],
  ['glm-5.3', 'zhipuai', 'Zhipu AI'],
  ['MiniMax-M2.5', 'minimax', 'MiniMax'],
  ['deepseek-v4.1-flash', 'deepseek', 'DeepSeek'],
];

test('all six Alibaba custom IDs resolve by laboratory and session projection, not transport', () => {
  for (const [model, vendor, label] of matrix) {
    const selection = { provider: 'alibaba-work', model };
    const snapshot = { byId: { s1: { projectionValues: { modelSelection: { next: selection } } } } };
    assert.equal(vendorOf(selection), vendor, model);
    assert.equal(vendorName(selectionOf(snapshot, 's1')), label, model);
    assert.notEqual(markSVG(selection), markSVG(null), model);
  }
});

test('truthful model family and provider aliases use guarded, case-insensitive boundaries', () => {
  const families = [
    ['qwen', ['qwen3.8-max', 'QWEN3.8-MAX', 'qwen/qwen3-coder', 'qwen2.5-coder', 'qwen-turbo', 'qwen']],
    ['zhipuai', ['glm-5.3', 'GLM-5.3', 'THUDM/glm-4', 'chatglm3-6b', 'zhipuai/glm-5.3', 'z-ai/glm-5.3']],
    ['minimax', ['MiniMax-M2.5', 'minimax-m2.5', 'minimax/minimax-m2.5', 'minimax']],
  ];
  for (const [vendor, models] of families) for (const model of models) assert.equal(vendorOf({ provider: 'router', model }), vendor, model);
  for (const [vendor, providers] of [
    ['qwen', ['qwen', 'qwen-api']],
    ['zhipuai', ['zhipu', 'zhipuai', 'zhipu-ai', 'zai', 'z-ai', 'z.ai', 'zai-coding-plan']],
    ['minimax', ['minimax', 'minimax-cn', 'minimax-coding-plan']],
  ]) for (const provider of providers) assert.equal(vendorOf({ provider, model: 'opaque' }), vendor, provider);
  // Substrings in unrelated private aliases do not claim a laboratory.
  for (const value of ['notqwen3.8', 'qwenish', 'myglm-5.3', 'glmatrix', 'chatglmish', 'banzai', 'zairport', 'zhipuish', 'notminimax', 'minimaximum', 'alibaba', 'dashscope', 'alibaba-work', 'auto']) {
    assert.equal(vendorOf({ provider: 'router', model: value }), null, value);
    assert.equal(vendorOf({ provider: value, model: 'opaque' }), null, value);
  }
});

test('known model laboratory outranks disagreeing transport provider', () => {
  for (const [model, vendor] of matrix) for (const provider of ['openai', 'openai-codex', 'deepseek-account', 'qwen', 'zai', 'minimax', 'alibaba-work', 'openrouter']) {
    assert.equal(vendorOf({ provider, model }), vendor, `${provider}/${model}`);
  }
  assert.equal(vendorOf({ provider: 'qwen', model: 'anthropic/claude-opus' }), 'anthropic');
  assert.equal(vendorOf({ provider: 'zai', model: 'google/gemini-pro' }), 'google');
  assert.equal(vendorOf({ provider: 'minimax', model: 'gpt-6.1-sol' }), 'openai');
});

test('new marks are distinct valid local paths and preserve theme fill and Qwen even-odd rule', () => {
  const marks = matrix.filter(([, vendor]) => ['qwen', 'zhipuai', 'minimax'].includes(vendor)).map(([model]) => markSVG({ model }));
  assert.equal(new Set(marks).size, 3);
  for (const svg of marks) {
    assert.match(svg, /^<svg viewBox="0 0 (24 24|40 40)" fill="currentColor"><path d="M/);
    assert.doesNotMatch(svg, /<rect|<script|\bon\w+=|<image|href=|url\(/);
  }
  assert.match(marks[0], /fill-rule="evenodd"/);
  assert.match(markSVG({ model: 'deepseek-v4-pro' }), /fill="#4176e6"/);
});

test('unknown or unavailable model selection remains a neutral AI mark', () => {
  for (const selection of [null, undefined, {}, { provider: 'alibaba-work', model: 'opaque' }, { provider: 'dashscope', model: 'auto' }]) {
    assert.equal(vendorOf(selection), null);
    assert.equal(vendorName(selection), 'AI');
    assert.equal(markSVG(selection), markSVG(null));
  }
  assert.equal(selectionOf({}, 's1'), null);
});
