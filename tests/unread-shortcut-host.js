// Test-only boundary adapters. The registry, dispatcher and binding policy are exact upstream sources.
export { createStore as createSnapshotStore } from '../src/store.js';
export const randomUUID = () => globalThis.crypto.randomUUID();
export function assertNever(value, context) { throw new Error(`${context}: ${String(value)}`); }
