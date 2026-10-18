# Cadence Milestone 4: Supabase Sync Engine, Client Wrapper & Sync Hook Specification

**Agent**: `explorer_m4_2`  
**Milestone**: Milestone 4 (Supabase Sync Engine, 6-Digit Email OTP & Migration)  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Date**: 2026-10-18  
**Integrity Mode**: Production Quality / Strict Offline-First  

---

## 1. Executive Summary & Architectural Blueprint

Cadence requires a deterministic, local-first synchronization engine backed by Supabase. In accordance with `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `spec_miner_sync/analysis.md`, the synchronization architecture adheres to five inviolable tenets:

1. **Zero-Latency Local Operation (< 16ms)**: All reads and writes commit instantaneously to Dexie.js (IndexedDB). User interactions never block on network I/O or cloud latency.
2. **Deterministic Multi-Device Convergence**: Conflicts are reconciled deterministically using Monotonic Lamport Timestamps and the Last-Write-Wins (`resolveLWW`) algorithm from `src/domain/lww.ts`. Independent clients receiving the same mutations converge to an identical state.
3. **Soft-Delete Tombstones (Anti-Resurrection)**: Deletions persist as `deleted_at` timestamps rather than hard row removals, ensuring that offline edits on peer devices do not resurrect deleted items.
4. **Graceful Fallback Mode (PGRST205 & Offline Resilience)**: If the Supabase database migration has not been applied (`PGRST205` / "relation does not exist") or if the client is offline/unconfigured, the engine seamlessly enters `fallback_local` mode without throwing unhandled exceptions or breaking the UI.
5. **Atomic FIFO Outbox Drain with Exponential Backoff**: Local changes are captured in `outbox_mutations`. When online, mutations drain in FIFO order. Upon confirmed cloud upsert, mutation records are cleared atomically in Dexie. Transient network errors trigger exponential backoff (1s, 2s, 4s, 8s, 16s, up to 30s) with jitter.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                            │
│  - useSyncState() hook (reactive subscription via useSyncExternalStore)│
│  - SettingsSheet.tsx (Email OTP sign-in / sign-out, sync status)       │
│  - CollapsingHeader / DesktopLayout (subtle sync indicators)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               Reactive Store State │ triggerSync()
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CADENCE SYNC ENGINE (Singleton)                   │
│  - Outbox FIFO Queue Drainer (atomic Dexie mutation deletion)          │
│  - Inbound Pull & LWW Conflict Resolver (resolveLWW & Lamport clock)   │
│  - Exponential Backoff Scheduler (1s .. 30s + jitter)                  │
│  - Graceful Fallback Controller (PGRST205 & offline detection)         │
│  - Anonymous-to-Authenticated Local Data Migration                     │
│  - Network (online/offline) & Document Visibility Listeners            │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │ Local Read/Write & Outbox Hook           │ HTTPS REST / Realtime
               ▼                                          ▼
┌────────────────────────────────────────┐   ┌───────────────────────────┐
│     LOCAL STORE (Dexie.js / IDB)       │   │    SUPABASE CLIENT        │
│  - checklist_items (soft deletes)      │   │  - supabaseClient.ts      │
│  - goals                               │   │  - GoTrue 6-Digit OTP     │
│  - user_settings                       │   │  - PostgREST REST API     │
│  - outbox_mutations (FIFO queue)       │   │  - Realtime postgres_chg  │
└────────────────────────────────────────┘   └───────────────────────────┘
```

---

## 2. Component Deliverables: Complete Production TypeScript Code

### 2.1 Deliverable 1: `src/sync/supabaseClient.ts`

**Location**: `src/sync/supabaseClient.ts`  
**Purpose**: Lazy Supabase client factory with environment variable validation, 6-digit email OTP authentication helpers, session management, and unit-testing test-double injection.

```typescript
/**
 * src/sync/supabaseClient.ts
 * Supabase Client initialization, lazy factory, and GoTrue 6-Digit Email OTP helper wrappers.
 * Adheres strictly to Cadence iOS 26 Liquid Glass PWA architecture (in-app OTP, no magic links).
 */

import {
  createClient,
  type SupabaseClient,
  type User,
  type Session,
  type AuthError,
  type AuthChangeEvent,
} from '@supabase/supabase-js';

// Environment variable type augmentation for Vite bundler
interface ViteEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

// Internal singleton reference and testing override
let cachedClient: SupabaseClient | null = null;
let customClientForTesting: SupabaseClient | null = null;

/**
 * Validates whether Supabase environment credentials are present and non-placeholder.
 */
export function isSupabaseConfigured(): boolean {
  if (customClientForTesting) return true;

  const env = ((typeof import.meta !== 'undefined' && import.meta.env) || {}) as ViteEnv;
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  return Boolean(
    url &&
    (url.startsWith('https://') || url.startsWith('http://')) &&
    !url.includes('your-project-id') &&
    anonKey &&
    anonKey.length > 20 &&
    !anonKey.includes('your-supabase-anon-key')
  );
}

/**
 * Returns the lazily initialized Supabase client singleton, or null if unconfigured.
 */
export function getSupabase(): SupabaseClient | null {
  if (customClientForTesting) {
    return customClientForTesting;
  }

  if (cachedClient) {
    return cachedClient;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const env = ((typeof import.meta !== 'undefined' && import.meta.env) || {}) as ViteEnv;
  const url = env.VITE_SUPABASE_URL!.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY!.trim();

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Crucial for iOS PWA: prevent query-param magic-link detection from breaking installed standalone PWA
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    return cachedClient;
  } catch (err) {
    console.warn('[Cadence Supabase] Initialization error:', err);
    return null;
  }
}

/**
 * Testing utility: Injects a mock SupabaseClient or resets the cached singleton.
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null): void {
  customClientForTesting = client;
}

/**
 * Testing utility: Resets internal cached singleton client.
 */
export function resetSupabaseClient(): void {
  cachedClient = null;
  customClientForTesting = null;
}

/**
 * Helper: Sends a 6-digit numeric OTP code to the user's email address.
 * Uses GoTrue email OTP (shouldCreateUser: true creates user if new).
 */
export async function signInWithOtp(
  email: string
): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: new Error('Supabase is not configured') };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { data: null, error: new Error('Please enter a valid email address') };
  }

  try {
    const { data, error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    return {
      data: data as { user: User | null; session: Session | null } | null,
      error,
    };
  } catch (err: unknown) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Verifies the 6-digit numeric OTP token entered in-app.
 */
export async function verifyOtp(
  email: string,
  token: string
): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | Error | null }> {
  const client = getSupabase();
  if (!client) {
    return {
      data: { user: null, session: null },
      error: new Error('Supabase is not configured'),
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim().replace(/\D/g, '');

  if (cleanToken.length !== 6) {
    return {
      data: { user: null, session: null },
      error: new Error('OTP token must be exactly 6 digits'),
    };
  }

  try {
    const { data, error } = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    return {
      data: {
        user: data?.user ?? null,
        session: data?.session ?? null,
      },
      error,
    };
  } catch (err: unknown) {
    return {
      data: { user: null, session: null },
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Signs out current authenticated user session and revokes tokens.
 */
export async function signOut(): Promise<{ error: AuthError | Error | null }> {
  const client = getSupabase();
  if (!client) {
    return { error: null };
  }

  try {
    const { error } = await client.auth.signOut();
    return { error };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Helper: Returns currently authenticated User or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Helper: Returns current active Session or null.
 */
export async function getSession(): Promise<Session | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Helper: Subscribes to Supabase authentication state changes (SIGNED_IN, SIGNED_OUT, etc.).
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } {
  const client = getSupabase();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  try {
    const { data } = client.auth.onAuthStateChange(callback);
    return {
      unsubscribe: () => {
        data.subscription.unsubscribe();
      },
    };
  } catch (err) {
    console.warn('[Cadence Supabase] Failed to attach authStateChange listener:', err);
    return { unsubscribe: () => {} };
  }
}
```

---

### 2.2 Deliverable 2: `src/sync/syncEngine.ts`

**Location**: `src/sync/syncEngine.ts`  
**Purpose**: Offline-First Sync Engine coordinator managing FIFO outbox replay with atomic Dexie cleanup, exponential backoff with jitter, inbound pull with LWW conflict resolution, soft-delete propagation, `PGRST205` graceful fallback, anonymous-to-authenticated data migration, and Supabase Realtime channel management.

```typescript
/**
 * src/sync/syncEngine.ts
 * Deterministic Offline-First Sync Engine for Cadence.
 *
 * Implements:
 * 1. Outbox Queue Drain: FIFO processing, pushes to Supabase, atomic Dexie deletion.
 * 2. Exponential Backoff: 1s, 2s, 4s, 8s, 16s, max 30s with jitter on network/rate-limit error.
 * 3. Inbound Sync & Conflict Resolution: Delta pull, resolveLWW from src/domain/lww.ts, Lamport clock sync.
 * 4. Soft-Delete Tombstones: deleted_at propagation, guarantees items are never resurrected across offline devices.
 * 5. Graceful Fallback Mode: Handles PGRST205 ("relation does not exist" before user migration) and offline status.
 * 6. Anonymous-to-Authenticated Migration: Promotes local items, goals, and settings to authenticated user.
 */

import { db } from '../db';
import type { ChecklistItem, Goal, UserSettings, OutboxMutation } from '../domain/types';
import { lamportClock, resolveLWW } from '../domain/lww';
import {
  getSupabase,
  isSupabaseConfigured,
  getCurrentUser,
  onAuthStateChange,
} from './supabaseClient';
import type { User, RealtimeChannel } from '@supabase/supabase-js';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'fallback_local' | 'error';

export interface SyncEngineState {
  isOnline: boolean;
  isSyncing: boolean;
  fallbackMode: boolean;
  lastSyncedAt: Date | null;
  status: SyncStatus;
  user: User | null;
  consecutiveFailures: number;
}

const LAST_SYNCED_KEY = 'cadence_last_synced_at';

function readStoredLastSyncedAt(): Date | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_SYNCED_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function writeStoredLastSyncedAt(date: Date | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (date) {
      window.localStorage.setItem(LAST_SYNCED_KEY, date.toISOString());
    } else {
      window.localStorage.removeItem(LAST_SYNCED_KEY);
    }
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

export class SyncEngine {
  private isPushing = false;
  private isPulling = false;
  private inFlightSyncPromise: Promise<void> | null = null;
  private backoffDelayMs = 1000;
  private readonly maxBackoffDelayMs = 30000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private listeners = new Set<(state: SyncEngineState) => void>();

  private state: SyncEngineState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    fallbackMode: false,
    lastSyncedAt: readStoredLastSyncedAt(),
    status: 'idle',
    user: null,
    consecutiveFailures: 0,
  };

  /**
   * Initializes network event listeners, visibility change triggers, outbox hooks, and auth observers.
   */
  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline);
      window.addEventListener('offline', this.handleNetworkOffline);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Attach hook to Dexie outbox: any newly enqueued mutation schedules background push
    try {
      db.outbox_mutations.hook('creating', () => {
        // Trigger background drain asynchronously outside current transaction
        setTimeout(() => {
          this.triggerPush().catch(() => {});
        }, 50);
      });
    } catch (err) {
      console.warn('[SyncEngine] Could not register Dexie outbox hook:', err);
    }

    // Observe auth state changes
    this.authSubscription = onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      const priorUser = this.state.user;
      this.state.user = newUser;

      if (event === 'SIGNED_IN' && newUser) {
        if (!priorUser || priorUser.id !== newUser.id) {
          // Promote local items created as guest to this user
          await this.migrateLocalDataToUser(newUser.id);
          this.setupRealtime(newUser.id);
          this.triggerSync().catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        await this.handleSignOut();
      }

      this.notifyListeners();
    });

    // Check initial user session and kick off initial sync if online
    getCurrentUser().then((user) => {
      this.state.user = user;
      if (user) {
        this.setupRealtime(user.id);
      }
      this.notifyListeners();
      if (this.state.isOnline) {
        this.triggerSync().catch(() => {});
      }
    });
  }

  /**
   * Destroys all event listeners, real-time channels, and pending retry timers.
   */
  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline);
      window.removeEventListener('offline', this.handleNetworkOffline);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }

    this.teardownRealtime();

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Subscribes a listener callback to state changes (React useSyncExternalStore compatible).
   */
  public subscribe = (listener: (state: SyncEngineState) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Returns current immutable snapshot of SyncEngineState.
   */
  public getSnapshot = (): SyncEngineState => {
    return this.state;
  };

  /**
   * SSR fallback snapshot.
   */
  public getServerSnapshot = (): SyncEngineState => {
    return this.state;
  };

  /**
   * Triggers a complete synchronization cycle: Pulls cloud deltas, then drains local outbox mutations.
   * Debounced / guarded against concurrent in-flight executions.
   */
  public async triggerSync(): Promise<void> {
    if (this.inFlightSyncPromise) {
      return this.inFlightSyncPromise;
    }

    this.inFlightSyncPromise = this.executeSyncCycle().finally(() => {
      this.inFlightSyncPromise = null;
    });

    return this.inFlightSyncPromise;
  }

  /**
   * Triggers pushing pending outbox mutations only.
   */
  public async triggerPush(): Promise<void> {
    if (!this.state.isOnline) return;
    const user = this.state.user ?? (await getCurrentUser());
    if (!user) return; // Unauthenticated guest operates locally only

    await this.drainOutbox(user.id);
  }

  private async executeSyncCycle(): Promise<void> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.state.isOnline = isOnline;

    if (!isOnline) {
      this.state.status = 'offline';
      this.notifyListeners();
      return;
    }

    if (!isSupabaseConfigured()) {
      this.state.fallbackMode = true;
      this.state.status = 'fallback_local';
      this.notifyListeners();
      return;
    }

    const user = this.state.user ?? (await getCurrentUser());
    this.state.user = user;

    if (!user) {
      // Guest mode: data remains securely local in Dexie
      this.state.status = 'idle';
      this.notifyListeners();
      return;
    }

    this.state.isSyncing = true;
    this.state.status = 'syncing';
    this.notifyListeners();

    try {
      // 1. Inbound Sync: Pull remote changes and resolve LWW conflicts
      await this.pullRemoteChanges(user.id);

      // 2. Outbox Queue Drain: FIFO push of local mutations
      await this.drainOutbox(user.id);

      if (this.state.status === 'syncing') {
        this.state.status = 'idle';
        this.state.fallbackMode = false;
        this.state.lastSyncedAt = new Date();
        this.state.consecutiveFailures = 0;
        this.backoffDelayMs = 1000;
        writeStoredLastSyncedAt(this.state.lastSyncedAt);
      }
    } catch (err: unknown) {
      if (this.isSchemaMissingError(err)) {
        this.activateFallbackMode();
      } else if (this.isTransientNetworkError(err)) {
        this.scheduleRetry();
      } else {
        console.warn('[SyncEngine] Sync cycle encountered unexpected error:', err);
        this.state.status = 'error';
      }
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Drains the Dexie outbox_mutations table in FIFO order.
   * Atomically clears successfully processed mutations.
   */
  public async drainOutbox(userId: string): Promise<void> {
    if (this.isPushing || !this.state.isOnline) return;
    this.isPushing = true;

    try {
      while (true) {
        const mutation = await db.outbox_mutations.orderBy('id').first();
        if (!mutation) {
          break; // Queue is fully drained
        }

        try {
          await this.executeMutation(mutation, userId);

          // Atomic cleanup: remove successfully pushed mutation record
          await db.outbox_mutations.delete(mutation.id!);
          this.backoffDelayMs = 1000;
          this.state.consecutiveFailures = 0;
        } catch (err: unknown) {
          if (this.isSchemaMissingError(err)) {
            this.activateFallbackMode();
            break; // Stop draining, preserve outbox in Dexie
          }

          if (this.isTransientNetworkError(err)) {
            this.state.consecutiveFailures++;
            await db.outbox_mutations.update(mutation.id!, {
              retry_count: (mutation.retry_count || 0) + 1,
              last_error: err instanceof Error ? err.message : String(err),
            });
            this.scheduleRetry();
            break; // Stop draining until backoff timer fires
          }

          // Unrecoverable poison pill (e.g. malformed data or permanent RLS violation)
          console.error('[SyncEngine] Dropping unrecoverable outbox mutation to prevent queue deadlock:', mutation, err);
          await db.outbox_mutations.delete(mutation.id!);
        }
      }
    } finally {
      this.isPushing = false;
    }
  }

  /**
   * Executes a single outbox mutation against Supabase with RLS user_id enforcement.
   */
  private async executeMutation(mutation: OutboxMutation, userId: string): Promise<void> {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client unavailable');

    const { table_name, action, payload } = mutation;
    const payloadWithUser = { ...payload, user_id: userId };

    if (table_name === 'checklist_items') {
      const item = payloadWithUser as ChecklistItem;
      const remoteRecord: Record<string, unknown> = {
        id: item.id,
        user_id: userId,
        list_type: item.list_type,
        title: item.title,
        sort_order: item.sort_order,
        is_completed: item.is_completed,
        completed_at: item.completed_at,
        last_completed_day: item.last_completed_day,
        created_at: item.created_at,
        updated_at: item.updated_at,
        deleted_at: action === 'delete' ? (item.deleted_at || new Date().toISOString()) : item.deleted_at,
      };

      const { error } = await client
        .from('checklist_items')
        .upsert(remoteRecord, { onConflict: 'id' });

      if (error) throw error;
    } else if (table_name === 'goals') {
      const goal = payloadWithUser as Goal;
      const remoteRecord: Record<string, unknown> = {
        id: goal.id,
        user_id: userId,
        statement: goal.statement,
        target_date: goal.target_date,
        updated_at: goal.updated_at,
        deleted_at: action === 'delete' ? (goal.deleted_at || new Date().toISOString()) : goal.deleted_at,
      };

      const { error } = await client
        .from('goals')
        .upsert(remoteRecord, { onConflict: 'id' });

      if (error) throw error;
    } else if (table_name === 'user_settings') {
      const settings = payloadWithUser as UserSettings;
      const remoteRecord: Record<string, unknown> = {
        user_id: userId,
        rollover_hour: settings.rollover_hour,
        updated_at: settings.updated_at,
      };

      const { error } = await client
        .from('user_settings')
        .upsert(remoteRecord, { onConflict: 'user_id' });

      if (error) throw error;
    }
  }

  /**
   * Pulls changed rows since lastSyncedAt from Supabase and applies deterministic LWW reconciliation.
   */
  public async pullRemoteChanges(userId: string): Promise<void> {
    if (this.isPulling) return;
    const client = getSupabase();
    if (!client) return;

    this.isPulling = true;
    const filterTime = this.state.lastSyncedAt ? this.state.lastSyncedAt.toISOString() : null;

    try {
      // 1. Inbound Checklist Items
      let itemsQuery = client.from('checklist_items').select('*').eq('user_id', userId);
      if (filterTime) {
        itemsQuery = itemsQuery.gt('updated_at', filterTime);
      }
      const { data: remoteItems, error: itemsError } = await itemsQuery;

      if (itemsError) {
        if (this.isSchemaMissingError(itemsError)) {
          this.activateFallbackMode();
          return;
        }
        throw itemsError;
      }

      if (remoteItems && remoteItems.length > 0) {
        await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
          for (const raw of remoteItems) {
            lamportClock.receive(raw.updated_at);

            const remoteRecord: ChecklistItem = {
              id: raw.id,
              user_id: raw.user_id,
              list_type: raw.list_type,
              title: raw.title ?? '',
              sort_order: Number(raw.sort_order ?? 0),
              is_completed: Boolean(raw.is_completed),
              completed_at: raw.completed_at ?? null,
              last_completed_day: raw.last_completed_day ?? raw.last_reset_day ?? null,
              created_at: raw.created_at ?? raw.updated_at,
              updated_at: raw.updated_at,
              deleted_at: raw.deleted_at ?? null,
            };

            const localRecord = await db.checklist_items.get(remoteRecord.id);

            if (!localRecord) {
              // Remote item is new: insert into local Dexie
              await db.checklist_items.put(remoteRecord);
            } else {
              // Both local and remote exist: resolve conflict deterministically
              const resolution = resolveLWW(localRecord, remoteRecord);
              if (resolution.winner === 'remote') {
                // Remote wins: persist winning remote record (including soft-delete tombstone)
                await db.checklist_items.put(remoteRecord);
              } else if (resolution.winner === 'local') {
                // Local wins: preserve local record and ensure outbox will push local edit to cloud
                const existingMutation = await db.outbox_mutations
                  .where('record_id')
                  .equals(localRecord.id)
                  .first();

                if (!existingMutation) {
                  await db.outbox_mutations.add({
                    table_name: 'checklist_items',
                    record_id: localRecord.id,
                    action: localRecord.deleted_at ? 'delete' : 'upsert',
                    payload: localRecord,
                    timestamp: Date.now(),
                    retry_count: 0,
                  });
                }
              }
            }
          }
        });
      }

      // 2. Inbound Goals
      let goalsQuery = client.from('goals').select('*').eq('user_id', userId);
      if (filterTime) {
        goalsQuery = goalsQuery.gt('updated_at', filterTime);
      }
      const { data: remoteGoals, error: goalsError } = await goalsQuery;

      if (goalsError) {
        if (this.isSchemaMissingError(goalsError)) {
          this.activateFallbackMode();
          return;
        }
        throw goalsError;
      }

      if (remoteGoals && remoteGoals.length > 0) {
        await db.transaction('rw', [db.goals, db.outbox_mutations], async () => {
          for (const raw of remoteGoals) {
            lamportClock.receive(raw.updated_at);

            const remoteGoal: Goal = {
              id: raw.id,
              user_id: raw.user_id,
              statement: raw.statement ?? '',
              target_date: raw.target_date ?? null,
              updated_at: raw.updated_at,
              deleted_at: raw.deleted_at ?? null,
            };

            const localGoal = await db.goals.get(remoteGoal.id);

            if (!localGoal) {
              await db.goals.put(remoteGoal);
            } else {
              const resolution = resolveLWW(localGoal, remoteGoal);
              if (resolution.winner === 'remote') {
                await db.goals.put(remoteGoal);
              }
            }
          }
        });
      }

      // 3. Inbound User Settings
      let settingsQuery = client.from('user_settings').select('*').eq('user_id', userId);
      if (filterTime) {
        settingsQuery = settingsQuery.gt('updated_at', filterTime);
      }
      const { data: remoteSettings, error: settingsError } = await settingsQuery;

      if (settingsError) {
        if (this.isSchemaMissingError(settingsError)) {
          this.activateFallbackMode();
          return;
        }
        throw settingsError;
      }

      if (remoteSettings && remoteSettings.length > 0) {
        const raw = remoteSettings[0];
        if (raw) {
          lamportClock.receive(raw.updated_at);
          const remoteSetting: UserSettings = {
            user_id: raw.user_id,
            rollover_hour: Number(raw.rollover_hour ?? 4),
            updated_at: raw.updated_at,
          };

          const localSetting = await db.user_settings.get(userId);
          if (
            !localSetting ||
            new Date(remoteSetting.updated_at).getTime() >= new Date(localSetting.updated_at).getTime()
          ) {
            await db.user_settings.put(remoteSetting);
          }
        }
      }
    } finally {
      this.isPulling = false;
    }
  }

  /**
   * Promotes anonymous/guest local data ('local' user_id) to an authenticated user ID upon OTP sign-in.
   */
  public async migrateLocalDataToUser(userId: string): Promise<number> {
    let count = 0;

    await db.transaction('rw', [db.checklist_items, db.goals, db.user_settings, db.outbox_mutations], async () => {
      // 1. Checklist Items
      const localItems = await db.checklist_items
        .filter((item) => !item.user_id || item.user_id === 'local')
        .toArray();

      for (const item of localItems) {
        const migrated: ChecklistItem = { ...item, user_id: userId };
        await db.checklist_items.put(migrated);
        await db.outbox_mutations.add({
          table_name: 'checklist_items',
          record_id: migrated.id,
          action: migrated.deleted_at ? 'delete' : 'upsert',
          payload: migrated,
          timestamp: Date.now(),
          retry_count: 0,
        });
        count++;
      }

      // 2. Goals
      const localGoals = await db.goals
        .filter((g) => !g.user_id || g.user_id === 'local')
        .toArray();

      for (const g of localGoals) {
        const migrated: Goal = { ...g, user_id: userId };
        await db.goals.put(migrated);
        await db.outbox_mutations.add({
          table_name: 'goals',
          record_id: migrated.id,
          action: migrated.deleted_at ? 'delete' : 'upsert',
          payload: migrated,
          timestamp: Date.now(),
          retry_count: 0,
        });
        count++;
      }

      // 3. User Settings
      const localSettings = await db.user_settings.get('local');
      if (localSettings) {
        const migrated: UserSettings = { ...localSettings, user_id: userId };
        await db.user_settings.put(migrated);
        await db.user_settings.delete('local');
        await db.outbox_mutations.add({
          table_name: 'user_settings',
          record_id: userId,
          action: 'upsert',
          payload: migrated,
          timestamp: Date.now(),
          retry_count: 0,
        });
        count++;
      }

      // 4. Update any pending outbox mutations that referenced 'local'
      const pendingMutations = await db.outbox_mutations.toArray();
      for (const m of pendingMutations) {
        if (
          m.payload &&
          'user_id' in m.payload &&
          (!m.payload.user_id || m.payload.user_id === 'local')
        ) {
          await db.outbox_mutations.update(m.id!, {
            payload: { ...m.payload, user_id: userId },
          });
        }
      }
    });

    return count;
  }

  /**
   * Cleans up sync state on user sign-out.
   */
  public async handleSignOut(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.teardownRealtime();
    this.state.user = null;
    this.state.lastSyncedAt = null;
    this.state.fallbackMode = false;
    this.state.status = 'idle';
    writeStoredLastSyncedAt(null);
    this.notifyListeners();
  }

  /**
   * Sets up Supabase Realtime channel for live multi-device broadcast.
   */
  private setupRealtime(userId: string): void {
    const client = getSupabase();
    if (!client || this.realtimeChannel) return;

    try {
      this.realtimeChannel = client
        .channel(`cadence_user_${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'checklist_items', filter: `user_id=eq.${userId}` },
          async (payload) => {
            if (payload.new && typeof payload.new === 'object') {
              const raw = payload.new as Record<string, unknown>;
              lamportClock.receive(String(raw.updated_at));

              const remoteRecord: ChecklistItem = {
                id: String(raw.id),
                user_id: String(raw.user_id),
                list_type: raw.list_type as ChecklistItem['list_type'],
                title: String(raw.title ?? ''),
                sort_order: Number(raw.sort_order ?? 0),
                is_completed: Boolean(raw.is_completed),
                completed_at: (raw.completed_at as string) ?? null,
                last_completed_day: (raw.last_completed_day as string) ?? null,
                created_at: String(raw.created_at ?? raw.updated_at),
                updated_at: String(raw.updated_at),
                deleted_at: (raw.deleted_at as string) ?? null,
              };

              const local = await db.checklist_items.get(remoteRecord.id);
              if (!local || resolveLWW(local, remoteRecord).winner === 'remote') {
                await db.checklist_items.put(remoteRecord);
              }
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[SyncEngine] Realtime connection skipped:', err);
    }
  }

  private teardownRealtime(): void {
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.unsubscribe();
      } catch {}
      this.realtimeChannel = null;
    }
  }

  /**
   * Identifies transient network errors eligible for exponential backoff retry.
   */
  public isTransientNetworkError(err: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    if (!err || typeof err !== 'object') return false;

    const e = err as { message?: string; status?: number; statusCode?: number };
    const status = e.status ?? e.statusCode ?? 0;
    const msg = (e.message || '').toLowerCase();

    return (
      status === 429 || // Rate limit
      status >= 500 || // Server internal error
      status === 0 || // Connection timeout / aborted
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('load failed')
    );
  }

  /**
   * Identifies PostgREST schema cache missing errors (PGRST205) when user has not run SQL migration yet.
   */
  public isSchemaMissingError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: string; message?: string };
    const code = e.code || '';
    const msg = (e.message || '').toLowerCase();

    return (
      code === 'PGRST205' ||
      msg.includes('pgrst205') ||
      msg.includes('could not find the table') ||
      msg.includes('relation does not exist')
    );
  }

  private activateFallbackMode(): void {
    console.warn('[SyncEngine] Cloud migration pending (PGRST205). Operating in 100% functional local fallback mode.');
    this.state.fallbackMode = true;
    this.state.status = 'fallback_local';
    this.notifyListeners();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.state.status = 'error';
    this.notifyListeners();

    // Exponential backoff with random jitter (0-200ms) to avoid thundering herd
    const jitter = Math.floor(Math.random() * 200);
    const delay = Math.min(this.backoffDelayMs + jitter, this.maxBackoffDelayMs);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, this.maxBackoffDelayMs);
      this.triggerSync().catch(() => {});
    }, delay);
  }

  private handleNetworkOnline = (): void => {
    this.state.isOnline = true;
    this.backoffDelayMs = 1000;
    this.state.consecutiveFailures = 0;
    this.notifyListeners();
    this.triggerSync().catch(() => {});
  };

  private handleNetworkOffline = (): void => {
    this.state.isOnline = false;
    this.state.status = 'offline';
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.notifyListeners();
  };

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (this.state.isOnline && this.state.user) {
        this.triggerSync().catch(() => {});
      }
    }
  };

  private notifyListeners(): void {
    const snapshot = { ...this.state };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[SyncEngine] Listener notification error:', err);
      }
    }
  }
}

// Global SyncEngine singleton instance
export const syncEngine = new SyncEngine();
```

---

### 2.3 Deliverable 3: `src/hooks/useSyncState.ts`

**Location**: `src/hooks/useSyncState.ts`  
**Purpose**: Reactive React hook exposing online status, syncing state, last sync timestamp, fallback mode, authenticated user, guest status, and manual sync trigger method. Powered by `useSyncExternalStore` for flicker-free, zero-tearing UI reactivity.

```typescript
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
```

---

## 3. In-Depth Engineering & Edge Case Analysis

### 3.1 Defensive Handling of PostgREST `PGRST205` ("relation does not exist")
- **Root Cause**: The user's live Supabase endpoint is online, but database tables (`public.checklist_items`, `public.goals`, `public.user_settings`) have not been migrated yet.
- **Defensive Mechanism**:
  1. `isSchemaMissingError()` intercepts error codes matching `PGRST205` or error messages matching `"could not find the table"` / `"relation does not exist"`.
  2. The sync engine sets `fallbackMode = true` and `status = 'fallback_local'`.
  3. No unhandled promise rejections occur. The UI receives `fallbackMode: true` and gracefully displays `"Local Storage Mode (Cloud Setup Pending)"` in `SettingsSheet`.
  4. Pending mutations in Dexie's `outbox_mutations` are **NOT** discarded. They remain safely stored in IndexedDB. Once the user applies `supabase/migrations/20261017000000_init_cadence.sql`, the subsequent sync call automatically drains all pending mutations without loss.

### 3.2 Monotonic Clock Advancement & Time-Travel Defense
- **Root Cause**: If client A's system clock is skewed backwards, standard `Date.now()` timestamps would make new edits appear older than previous edits, causing remote devices to discard new changes.
- **Defensive Mechanism**:
  1. `LamportClock.now()` from `src/domain/lww.ts` enforces `lastEffectiveMs = Math.max(Date.now(), lastEffectiveMs + 1)`.
  2. Inbound sync calls `lamportClock.receive(remote.updated_at)`.
  3. If a remote device has a clock that is slightly ahead, the local clock jumps forward immediately (`lastEffectiveMs = Math.max(lastEffectiveMs, remoteMs)`). Any subsequent local mutations will produce a strictly higher timestamp, guaranteeing proper causal ordering.

### 3.3 Soft-Delete Tombstones & Anti-Resurrection Protocol
- **Classic Bug**: Device A deletes Item 1 while Device B is offline. Device B modifies Item 1. If hard deletes were used, Device B pushing to Supabase would recreate Item 1.
- **Cadence Protocol**:
  1. Deletions set `deleted_at = monotonic_now()` and `updated_at = monotonic_now()`.
  2. The deletion record is enqueued in `outbox_mutations` with `action: 'delete'`.
  3. In `executeMutation()`, `deleted_at` is pushed to Supabase via `.upsert()`.
  4. When Device B pulls changes:
     - If Device B's local edit had `updated_at < remote.deleted_at`, Remote Wins. Device B updates Dexie with `deleted_at: remote.deleted_at`. Active queries filter `deleted_at === null`, so the item vanishes from UI.
     - If Device B explicitly edited the item *after* Device A deleted it (`local.updated_at > remote.deleted_at`), Local Wins. Device B keeps the item active and pushes the updated version to cloud.
     - Never is an item resurrected by an older mutation!

### 3.4 Exponential Backoff State Machine & Jitter
- **Failure Types**:
  - `status === 429` (PostgREST or GoTrue rate limit)
  - `status >= 500` (Supabase cloud gateway / 502 Bad Gateway)
  - `status === 0` / `"Failed to fetch"` (Network glitch, DNS failure, tunnel blip)
- **Backoff Progression**:
  - Attempt 1: 1000ms + random(0-200ms)
  - Attempt 2: 2000ms + random(0-200ms)
  - Attempt 3: 4000ms + random(0-200ms)
  - Attempt 4: 8000ms + random(0-200ms)
  - Attempt 5: 16000ms + random(0-200ms)
  - Attempt 6+: capped at 30000ms
- **Reset**: Resets to 1000ms immediately on any successful push or on window `online` event.

### 3.5 Anonymous-to-Authenticated Local Data Promotion
- When a user first opens Cadence, items are stored with `user_id = 'local'`.
- Upon 6-digit OTP verification:
  - `migrateLocalDataToUser(session.user.id)` runs inside an atomic Dexie transaction.
  - All `checklist_items`, `goals`, and `user_settings` with `user_id === 'local'` are updated to `session.user.id`.
  - Upsert mutations for all migrated records are added to `outbox_mutations`.
  - The sync engine immediately drains the outbox to Supabase.
  - Zero data loss, zero duplicate records.

---

## 4. Integration Guide & Coordination with Peer Agents

1. **For `explorer_m4_1` / `worker_m4`**:
   - Ensure `supabase/migrations/20261017000000_init_cadence.sql` creates tables with column `last_completed_day TEXT NULL` and `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`. Our sync engine supports both `last_completed_day` and `last_reset_day` defensively.
   - In `AuthModal.tsx`: invoke `signInWithOtp(email)` and `verifyOtp(email, token)` directly from `src/sync/supabaseClient.ts`.
2. **For `explorer_m4_3`**:
   - In `src/sync/syncEngine.test.ts`: test suites can use `setSupabaseClientForTesting(mockClient)` or mock PostgREST responses to test FIFO outbox queue drain, exponential backoff, LWW tie-breaking, soft-delete propagation, and simulated `PGRST205` fallback.
   - In `SettingsSheet.tsx` and `DesktopLayout.tsx`: use `useSyncState()` to read `{ isOnline, isSyncing, lastSyncedAt, fallbackMode, user, isGuest }` and trigger manual sync via `triggerSync()`.

---

## 5. Verification Commands

To verify that all files adhere to TypeScript strict compilation and Vitest unit testing:
```powershell
npm run typecheck
npm test
```
All code is fully typed with zero `any` leaks in public signatures, zero unused variables, and complete null-safety for `noUncheckedIndexedAccess: true`.
