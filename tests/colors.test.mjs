import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeHex, hexToHsv, hsvToHex } from '../src/colors.js';
import native from './native-rc2/color-picker-files.json' with { type: 'json' };

test('HEX accepts six digits with/without # and three-digit shorthand without alpha', () => {
  for (const [input, expected] of [['#12ABCD','#12abcd'], ['12aBcD','#12abcd'], ['#A3F','#aa33ff'], ['a3f','#aa33ff'], [' #000000 ','#000000'], ['FFF','#ffffff']]) assert.equal(normalizeHex(input), expected);
  for (const input of ['', '#', '#1', '#12', '#1234', '#12345', '#1234567', '#12345678', '#abcd', 'red', 'rgba(0,0,0,1)', 'url(x)', '##abcdef', '<script>', null, undefined, 123456, {}, ['abcdef']]) {
    assert.equal(normalizeHex(input), null); assert.equal(hexToHsv(input), null);
  }
});
test('HSV conversion covers extrema, hue wrapping and finite validation', () => {
  for (const [hsv, hex] of [[{h:0,s:100,v:100},'#ff0000'], [{h:120,s:100,v:100},'#00ff00'], [{h:240,s:100,v:100},'#0000ff'], [{h:360,s:100,v:100},'#ff0000'], [{h:-60,s:100,v:100},'#ff00ff'], [{h:221,s:0,v:100},'#ffffff'], [{h:221,s:100,v:0},'#000000']]) assert.equal(hsvToHex(hsv), hex);
  for (const value of [null, undefined, {}, {h:NaN,s:0,v:0}, {h:0,s:Infinity,v:1}, {h:'0',s:1,v:1}]) assert.equal(hsvToHex(value), null);
  assert.deepEqual(hexToHsv('#000000'), {h:0,s:0,v:0});
  assert.deepEqual(hexToHsv('#ffffff'), {h:0,s:0,v:100});
});
test('RGB HEX roundtrips through full-precision HSV without quantizing to display channels', () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const hex = '#' + [r,g,b].map(channel => channel.toString(16).padStart(2,'0')).join('');
    assert.equal(hsvToHex(hexToHsv(hex)), hex);
  }
  for (const hex of ['#4176e6','#12abcd','#010203','#feff01','#a137e9']) assert.equal(hsvToHex(hexToHsv(hex)), hex);
});
test('additional anchored helper is the single unchanged commit-pinned public source', async () => {
  assert.equal(native.dshCommit, '639ed015397290b3745d163aafe02ffee4aa3f84');
  assert.equal(native.files.length, 1);
  for (const row of native.files) {
    const bytes = await readFile(new URL('./native-rc2/' + row.path, import.meta.url));
    assert.equal(bytes.length, row.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  }
});
