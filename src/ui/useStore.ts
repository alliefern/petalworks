import { useSyncExternalStore } from 'react';
import { store } from '../app/store';

/** Re-render on every store change (ticks and UI). Cheap enough for a small HUD. */
export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
