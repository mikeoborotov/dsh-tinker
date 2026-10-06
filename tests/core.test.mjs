import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreferences, validateProfile, STORAGE_KEY } from '../src/store.js';
// Data module imports are bundled in the browser, so exercise the resolver in the browser suite.
const ids = ['folder', 'code'];
const icon = { kind: 'icon', icon: 'code', color: '#4176e6' };
function memory() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; }
test('settings survive restart and export omits machine bindings', () => {
 const storage = memory(), p = createPreferences(storage, ids);
 p.save('windows-id', 'infra', icon);
 const next = createPreferences(storage, ids); assert.deepEqual(next.appearance('windows-id'), icon);
 const exported = JSON.parse(next.export()); assert.equal(exported.bindings, undefined); assert.equal(exported.profiles.infra.icon, 'code');
 const mac = createPreferences(memory(), ids); mac.import(next.export()); assert.equal(mac.appearance('windows-id'), undefined);
 mac.save('mac-id', 'infra', mac.getSnapshot().profiles.infra); assert.deepEqual(mac.appearance('mac-id'), icon);
});
test('prototype names, unsafe images, invalid emoji and unknown schema rejected', () => {
 for (const value of [{kind:'image',data:'https://attacker/image.png'}, {kind:'image',data:'data:image/svg+xml;base64,AAAA'}, {kind:'emoji',emoji:'<script>'}, {kind:'icon',icon:'code',color:'red; background: url(https://bad)'}])
  assert.throws(() => validateProfile({version:1, profiles:{bad:value}},ids));
 assert.throws(() => validateProfile(JSON.parse('{"version":1,"profiles":{"__proto__":{"kind":"icon","icon":"code","color":"#4176e6"}}}'),ids));
 assert.throws(() => validateProfile({version:2,profiles:{}},ids));
});
test('family emoji accepted; failed persistence never changes visible state', () => {
 const storage = memory(), p = createPreferences(storage, ids);
 p.save('one','family',{kind:'emoji',emoji:'👨‍👩‍👧‍👦'}); assert.equal(p.appearance('one').kind,'emoji');
 const before = p.getSnapshot(); storage.setItem = () => { throw new Error('quota'); };
 assert.throws(() => p.save('one','infra',icon)); assert.equal(p.getSnapshot(),before);
});
test('corrupt or future data preserved until explicit reset', () => {
 const storage=memory(); storage.setItem(STORAGE_KEY,'{"version":999}');
 const p=createPreferences(storage,ids); assert.ok(p.getSnapshot().error); assert.throws(() => p.save('one','infra',icon)); assert.equal(storage.getItem(STORAGE_KEY),'{"version":999}');
 p.resetAll(); p.save('one','infra',icon); assert.deepEqual(p.appearance('one'),icon);
});
test('import conflicts keep existing bound profiles intact', () => {
 const p=createPreferences(memory(),ids);p.save('one','infra',icon);
 p.import(JSON.stringify({version:1,profiles:{infra:{kind:'emoji',emoji:'💻'}}}));
 assert.deepEqual(p.appearance('one'),icon);assert.equal(p.getSnapshot().profiles['infra (2)'].emoji,'💻');
});
