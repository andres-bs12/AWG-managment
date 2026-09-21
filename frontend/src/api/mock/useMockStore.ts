import { useSyncExternalStore } from 'react'
import { getStoreVersion, subscribeStore } from './store'

/** Re-render when mock data mutates. No-op conceptually once HTTP is live. */
export function useMockStoreVersion(): number {
  return useSyncExternalStore(subscribeStore, getStoreVersion, getStoreVersion)
}
