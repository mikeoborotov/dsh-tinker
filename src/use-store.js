import { useCallback, useSyncExternalStore } from 'react';

export function useStore(store) {
  return useSyncExternalStore(
    useCallback(listener => store.subscribe(listener), [store]),
    useCallback(() => store.getSnapshot(), [store]),
  );
}
