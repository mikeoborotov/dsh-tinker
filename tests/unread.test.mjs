import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createUnreadStore, observeSessionOpenings, UNREAD_STORAGE_KEY, UNREAD_CHANGE_EVENT } from '../src/unread.js';

function storage(initial) {
  const values = new Map(initial ? [[UNREAD_STORAGE_KEY, initial]] : []);
  return { values, fail: false, getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('QuotaExceededError'); values.set(key, value); },
    removeItem(key) { if (this.fail) throw new Error('QuotaExceededError'); values.delete(key); } };
}
const row = (mainView = 0, running = false) => ({ id: 's1', running, retainedBy: { mainView, tool: 1 } });
const settled = async () => { await navigator.locks.request(UNREAD_STORAGE_KEY, async () => {}); await new Promise(resolve=>setImmediate(resolve)); };
function setup(mainView = 0) {
  const disk = storage(), reminders = createUnreadStore(disk), list = createStore({ byId: { s1: row(mainView), s2: { id: 's2' } } });
  const stop = observeSessionOpenings({ list }, reminders);
  return { disk, reminders, list, stop };
}

test('mark persists, does not mutate session state or acknowledge an already open chat', async () => {
  const { reminders, list, disk, stop } = setup(1), before = list.getSnapshot();
  await reminders.markUnread('s1');
  list.set({ ...before, byId: { ...before.byId, s1: row(1, true) } }); await settled();
  assert.equal(reminders.isUnread('s1'), true); assert.equal(createUnreadStore(disk).isUnread('s1'), true); stop();
});

test('positive mainView edge clears reminder when an unopened session opens', async () => {
  const { reminders, list, stop } = setup(); await reminders.markUnread('s1');
  list.set({ byId: { s1: row(1) } }); await settled(); assert.equal(reminders.isUnread('s1'), false); stop();
});

test('re-opening the current chat is the RC.2 retain 1 -> 2 -> 1 edge', async () => {
  const { reminders, list, stop } = setup(1); await reminders.markUnread('s1');
  list.set({ byId: { s1: row(2) } }); list.set({ byId: { s1: row(1) } });
  await settled(); assert.equal(reminders.isUnread('s1'), false); stop();
});

test('away and back clears; background tool retain does not read a reminder', async () => {
  const { reminders, list, stop } = setup(1); await reminders.markUnread('s1');
  list.set({ byId: { s1: row(0) } }); await settled(); assert.equal(reminders.isUnread('s1'), true);
  list.set({ byId: { s1: row(1) } }); await settled(); assert.equal(reminders.isUnread('s1'), false); stop();
});

test('reload preserves marks; an already-open initial baseline is not evidence of a later opening', async () => {
  const disk = storage(), first = createUnreadStore(disk); await first.markUnread('s1'); await first.markUnread('s2');
  const reminders = createUnreadStore(disk), list = createStore({ byId: { s1: row(1), s2: { id: 's2', retainedBy: {} } } });
  const stop = observeSessionOpenings({ list }, reminders); await settled();
  assert.equal(reminders.isUnread('s1'), true); assert.equal(reminders.isUnread('s2'), true);
  list.set({byId:{s1:row(2),s2:{id:'s2',retainedBy:{}}}}); await settled();
  assert.equal(reminders.isUnread('s1'), false); assert.equal(reminders.isUnread('s2'), true); stop();
});

test('quota failure does not publish false success or remove a durable reminder', async () => {
  const { reminders, disk, list, stop } = setup(); disk.fail = true;
  await assert.rejects(reminders.markUnread('s1'), /Quota/); assert.equal(reminders.isUnread('s1'), false);
  disk.fail = false; await reminders.markUnread('s1'); const raw = disk.getItem(UNREAD_STORAGE_KEY);
  disk.fail = true; list.set({ byId: { s1: row(1) } }); await settled();
  assert.equal(reminders.isUnread('s1'), true); assert.equal(disk.getItem(UNREAD_STORAGE_KEY), raw);
  assert.match(reminders.getSnapshot().lastError, /Quota/); stop();
});

test('invalid/corrupt storage is preserved until explicit recovery reset', async () => {
  const disk = storage('{broken'), reminders = createUnreadStore(disk);
  assert.ok(reminders.getSnapshot().error); await assert.rejects(reminders.markUnread('s1'), /JSON/);
  assert.equal(reminders.backup(), '{broken'); await reminders.resetAll(); await reminders.markUnread('s1'); assert.equal(reminders.isUnread('s1'), true);
});

test('malicious IDs and unknown schema cannot become reminder records', async () => {
  const reminders = createUnreadStore(storage());
  for (const id of ['', '__proto__', 'constructor', null, 'x'.repeat(201)]) await assert.rejects(reminders.markUnread(id), /session ID/);
  assert.ok(createUnreadStore(storage(JSON.stringify({ version: 99, unread: {} }))).getSnapshot().error);
});

test('bare UUID child IDs are accepted without requiring a session prefix', async () => {
  const reminders = createUnreadStore(storage()); await reminders.markUnread('21cb488b-2167-482d-9fca-e06e683a41be');
  assert.equal(reminders.isUnread('21cb488b-2167-482d-9fca-e06e683a41be'), true);
});

test('two windows serialize mutations before a storage event can arrive', async () => {
  const disk = storage(), a = createUnreadStore(disk), b = createUnreadStore(disk);
  await Promise.all([a.markUnread('s1'), b.markUnread('s2')]); a.refresh(); b.refresh();
  assert.equal(a.isUnread('s1'), true); assert.equal(a.isUnread('s2'), true);
  assert.equal(b.isUnread('s1'), true); assert.equal(b.isUnread('s2'), true);
});

test('opening in another window acknowledges latest durable mark before its storage event', async () => {
  const disk = storage(), a = createUnreadStore(disk), b = createUnreadStore(disk);
  const sessions = { list:createStore({byId:{s1:row(0)}}) }, stop=observeSessionOpenings(sessions,b);
  await a.markUnread('s1'); sessions.list.set({byId:{s1:row(1)}}); await settled(); a.refresh();
  assert.equal(a.isUnread('s1'), false); stop();
});

test('plugin reenable on an existing reference is not another opening', async () => {
  const disk=storage(), first=createUnreadStore(disk), sessions={list:createStore({byId:{s1:row(1)}})};
  const stop=observeSessionOpenings(sessions,first); await first.markUnread('s1'); stop();
  const next=createUnreadStore(disk), stopAgain=observeSessionOpenings({list:sessions.list},next); await settled();
  assert.equal(next.isUnread('s1'),true);
  sessions.list.set({byId:{s1:row(2)}}); await settled(); assert.equal(next.isUnread('s1'),false); stopAgain();
});

test('first late activation cannot acknowledge a mark newer than its already-open view', async () => {
  const disk=storage(), other=createUnreadStore(disk), sessions={list:createStore({byId:{s1:row(1)}})};
  await other.markUnread('s1'); const late=createUnreadStore(disk), stop=observeSessionOpenings(sessions,late); await settled();
  assert.equal(late.isUnread('s1'),true); stop();
});

test('observed startup restoration after activation is a real opening', async () => {
  const disk=storage(), first=createUnreadStore(disk); await first.markUnread('s1');
  const reminders=createUnreadStore(disk), sessions={list:createStore({phase:'pending',byId:{}})}, stop=observeSessionOpenings(sessions,reminders);
  sessions.list.set({phase:'ready',byId:{s1:row(1)}}); await settled(); assert.equal(reminders.isUnread('s1'),false); stop();
});

test('concurrent mark/ack operations retain other IDs and follow queued opening order', async () => {
  const disk=storage(), a=createUnreadStore(disk), b=createUnreadStore(disk); await a.markUnread('s1');
  await Promise.all([a.acknowledge('s1'), b.markUnread('s2')]); a.refresh();
  assert.equal(a.isUnread('s1'),false); assert.equal(a.isUnread('s2'),true);
  await Promise.all([a.markUnread('s1'), b.acknowledge('s1')]); a.refresh(); assert.equal(a.isUnread('s1'),false);
  await Promise.all([a.acknowledge('s1'), b.markUnread('s1')]); a.refresh(); assert.equal(a.isUnread('s1'),true);
});

test('a stale window cannot overwrite newly corrupt storage before its event', async () => {
  const disk=storage(), stale=createUnreadStore(disk); disk.setItem(UNREAD_STORAGE_KEY,'{broken');
  await assert.rejects(stale.markUnread('s1'),/JSON/); await assert.rejects(stale.acknowledge('s1'),/JSON/);
  assert.equal(disk.getItem(UNREAD_STORAGE_KEY),'{broken'); assert.ok(stale.getSnapshot().error);
});

test('missing secure-context Web Locks fails explicitly without unlocked writes', async () => {
  const disk=storage(), reminders=createUnreadStore(disk,{locks:null});
  await assert.rejects(reminders.markUnread('s1'),/Web Locks/); assert.equal(disk.getItem(UNREAD_STORAGE_KEY),null);
});

for (const fail of [false,true]) test(`a queued ${fail?'failed':'successful'} old-owner write notifies the current owner without event loops`, async () => {
  const disk=storage(), before=globalThis.window;
  const target=Object.assign(new EventTarget(),{localStorage:disk,CustomEvent});globalThis.window=target;
  let release;const gate=new Promise(resolve=>{release=resolve;}), locks={request:(_key,operation)=>gate.then(operation)};
  try {
    const old=createUnreadStore(disk,{locks}), pending=old.markUnread('s1').catch(reason=>old.reportError(reason));
    const current=createUnreadStore(disk);let events=0;
    target.addEventListener(UNREAD_CHANGE_EVENT,()=>{events++;});
    target.addEventListener(UNREAD_CHANGE_EVENT,old.onChange);target.addEventListener(UNREAD_CHANGE_EVENT,current.onChange);
    disk.fail=fail;release();await pending;
    assert.equal(events,1);assert.equal(current.isUnread('s1'),!fail);
    if(fail) assert.match(current.getSnapshot().lastError,/Quota/);
  } finally {if(before===undefined)delete globalThis.window;else globalThis.window=before;}
});

test('dispose stops acknowledging navigation, refresh synchronizes durable changes', async () => {
  const { reminders, list, stop, disk } = setup(); await reminders.markUnread('s1'); stop();
  list.set({ byId: { s1: row(1) } }); await settled(); assert.equal(reminders.isUnread('s1'), true);
  disk.removeItem(UNREAD_STORAGE_KEY); reminders.refresh(); assert.equal(reminders.isUnread('s1'), false);
});
