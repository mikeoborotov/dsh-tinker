import { createStore } from './store.js';

export const UNREAD_STORAGE_KEY = 'dsh-workspace-plus:unread:v1';
export const UNREAD_CHANGE_EVENT = 'workspace-plus:unread-change';
const MAX_BYTES = 1024 * 1024;
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 200
  && !['__proto__', 'prototype', 'constructor'].includes(id);
const empty = () => ({ version: 1, unread: Object.create(null) });

function validate(value) {
  if (value?.version !== 1 || !value.unread || typeof value.unread !== 'object' || Array.isArray(value.unread))
    throw new Error('Invalid unread reminders');
  if (Object.keys(value.unread).length > 10000) throw new Error('Too many unread reminders');
  const unread = Object.create(null);
  for (const [id, marked] of Object.entries(value.unread)) {
    if (!validId(id) || marked !== true) throw new Error('Invalid unread reminder');
    unread[id] = true;
  }
  return { version: 1, unread };
}

/** Browser-local reminders, independent of native completion and execution state. */
export function createUnreadStore(storage, { locks = globalThis.navigator?.locks } = {}) {
  const store = createStore({ ...empty(), error: null, lastError: null });
  function read() {
    const raw = storage.getItem(UNREAD_STORAGE_KEY);
    if (raw && new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Unread reminders exceed 1 MB');
    return raw ? validate(JSON.parse(raw)) : empty();
  }
  function refresh() {
    try { store.set({ ...read(), error: null, lastError: null }); }
    catch (reason) { store.set({ ...store.getSnapshot(), error: reason.message }); }
  }
  refresh();
  let errorSequence = 0;
  function signal(error = null) {
    if (typeof window !== 'undefined' && storage === window.localStorage)
      window.dispatchEvent(new window.CustomEvent(UNREAD_CHANGE_EVENT, { detail: { source: store, error } }));
  }
  function reportError(reason, notify = true) {
    store.set({ ...store.getSnapshot(), lastError: reason.message, errorSequence: ++errorSequence });
    if (notify) signal(reason.message);
  }
  async function mutate(operation) {
    // Web Locks serialize the entire read/validate/modify/write across same-origin
    // windows. Reading just before a whole-map write without this lock is NOT atomic.
    if (!locks?.request) throw new Error('Unread reminders require Web Locks in a secure browser context.');
    return locks.request(UNREAD_STORAGE_KEY, async () => {
      let next;
      try { next = read(); }
      catch (reason) { store.set({ ...store.getSnapshot(), error: reason.message }); throw reason; }
      const changed = operation(next.unread);
      if (changed) {
        next = validate(next);
        const raw = JSON.stringify(next);
        if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Unread reminders exceed 1 MB');
        storage.setItem(UNREAD_STORAGE_KEY, raw);
      }
      store.set({ ...next, error: null, lastError: null });
      if (changed) signal();
    });
  }
  return {
    getSnapshot: store.getSnapshot, subscribe: store.subscribe, refresh,
    isUnread(id) { return Object.hasOwn(store.getSnapshot().unread, id); },
    async markUnread(id) {
      if (!validId(id)) throw new Error('Invalid session ID');
      return mutate(unread => { unread[id] = true; return true; });
    },
    acknowledge(id) {
      return mutate(unread => {
        if (!Object.hasOwn(unread, id)) return false;
        delete unread[id]; return true;
      });
    },
    reportError,
    onChange(event) {
      if (event.detail?.source === store) return;
      refresh();
      if (typeof event.detail?.error === 'string') reportError({ message: event.detail.error }, false);
    },
    backup() { return storage.getItem(UNREAD_STORAGE_KEY) ?? '{}'; },
    async resetAll() {
      if (!locks?.request) throw new Error('Unread reminders require Web Locks in a secure browser context.');
      return locks.request(UNREAD_STORAGE_KEY, async () => {
        storage.removeItem(UNREAD_STORAGE_KEY);
        store.set({ ...empty(), error: null, lastError: null });
        signal();
      });
    },
  };
}

/**
 * RC.2 publishes mainView reference counts synchronously in sessions.list.
 * A new positive edge also catches re-opening the current chat (1 -> 2 -> 1).
 * Merely updating a running session, rendering a slot or marking it never reads it.
 * No sessions.retain(), navigation patch, history read or provider call is needed.
 */
export function observeSessionOpenings(sessions, reminders) {
  function counts() {
    return new Map(Object.entries(sessions.list.getSnapshot()?.byId ?? {})
      .map(([id, row]) => [id, row.retainedBy?.mainView ?? 0]).filter(([, count]) => count > 0));
  }
  // An already-retained initial view is not proof that it opened AFTER the mark.
  // Startup restoration before plugin activation, re-enable and HMR are baselines,
  // not read events. Only later native retain edges can acknowledge a reminder.
  let previous = counts();
  function scan() {
    const next = counts();
    const opened = [...next].filter(([id, count]) => count > (previous.get(id) ?? 0)).map(([id]) => id);
    previous = next;
    for (const id of opened) void reminders.acknowledge(id).catch(reason => reminders.reportError(reason));
  }
  const unsubscribe = sessions.list.subscribe(scan);
  scan();
  return unsubscribe;
}
