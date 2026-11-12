import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = new URL('../', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const attribute = (markup, name) => markup.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))?.[1];
function geometry(markup) {
  const svg = markup.match(/<svg\b[^>]*>/)[0];
  return {
    attributes: Object.fromEntries(['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'data-framing'].map(name => [name, attribute(svg, name)])),
    transforms: [...markup.matchAll(/<g\b[^>]*\btransform="([^"]*)"/g)].map(match => match[1]),
    paths: [...markup.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)].map(match => match[1]),
  };
}

test('plugin manifest uses the exact accepted color wrench 13', async () => {
  const icon = Buffer.from((await readFile(new URL('icon.svg', root), 'utf8')).replaceAll('\r\n', '\n'));
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.icon, './icon.svg');
  // Only two trailing spaces on an empty source line are removed; artwork is unchanged.
  assert.equal(icon.length, 2407);
  assert.equal(sha256(icon), '41f7ad5ebde39a12f1eca03c3677c6fa71f32fd1da6c92c750c9f50ca5bc4382');
  assert.match(icon.toString('utf8'), /data-framing="centered-60-of-64"/);
});

test('Settings wrench preserves authored variant 13 geometry and inherits native color at host sizes', async () => {
  const original = Buffer.from((await readFile(new URL('tests/branding-13/tinker-settings-wrench-13.svg', root), 'utf8')).replaceAll('\r\n', '\n'));
  assert.equal(original.length, 633);
  assert.equal(sha256(original), '6eb51a3fa590a2d364d3653a3a3dc504a28dae1d6c8bb7d3fc8bd776059152b5');
  const bundle = await build({ absWorkingDir: fileURLToPath(root), entryPoints: ['src/settings-icon.jsx'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'] });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { SettingsSectionIcon } = module.exports;
  for (const size of [16, 24]) {
    const rendered = renderToStaticMarkup(React.createElement(SettingsSectionIcon, { size, active: true }));
    assert.deepEqual(geometry(rendered), geometry(original.toString('utf8')));
    assert.equal(attribute(rendered, 'width'), String(size));
    assert.equal(attribute(rendered, 'height'), String(size));
    assert.equal(attribute(rendered, 'aria-hidden'), 'true');
    assert.equal(attribute(rendered, 'focusable'), 'false');
    assert.doesNotMatch(rendered, /(?:role="img"|aria-label=|style=|<script|<foreignObject)/);
  }
});
