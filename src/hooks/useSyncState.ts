/**
 * src/hooks/useSyncState.ts
 * Reactive hook exposing Cadence cloud synchronization state to React components.
 * Strictly adheres to React 19 concurrent safety via useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { syncEngine, type SyncEngineState } from '../sync/syncEngine';
import type { User } from '@supabase/supabase-js';

export interface UseSyncStateResult {
  /** True when browser has active network connection */
  isOnline: boolean;
  /** True while sync engine is actively pulling or pushing mutations */
  isSyncing: boolean;
  /** Timestamp of most recent successful sync, or null if never synced */
  lastSyncedAt: Date | null;
  /** True if unconfigured, offline, or table unmigrated (PGRST205) */
  fallbackMode: boolean;
  /** Authenticated Supabase user object, or null in guest mode */
  user: User | null;
  /** True if user is unauthenticated (operating entirely in local Dexie) */
  isGuest: boolean;
  /** Current detailed state machine status */
  status: SyncEngineState['status'];
  /** Manually trigger immediate delta pull and outbox queue replay */
  triggerSync: () => Promise<void>;
}

export function useSyncState(): UseSyncStateResult {
  const snapshot = useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getServerSnapshot
  );

  const triggerSync = useCallback(async () => {
    await syncEngine.triggerSync();
  }, []);

  return {
    isOnline: snapshot.isOnline,
    isSyncing: snapshot.isSyncing,
    lastSyncedAt: snapshot.lastSyncedAt,
    fallbackMode: snapshot.fallbackMode,
    user: snapshot.user,
    isGuest: snapshot.user === null,
    status: snapshot.status,
    triggerSync,
  };
}

export default useSyncState;
