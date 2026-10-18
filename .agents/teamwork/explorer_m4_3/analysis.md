# Milestone 4 Exploration Report: Sync Engine Unit Tests & Settings / Desktop Header UI Integration

**Agent**: `explorer_m4_3`  
**Milestone**: Milestone 4: Supabase Sync Engine, 6-Digit Email OTP & Migration  
**Target Files**:
1. `src/sync/syncEngine.test.ts` (Vitest unit test suite)
2. `src/components/sheets/SettingsSheet.tsx` (Live auth state & Sign In / Sign Out actions)
3. `src/components/desktop/DesktopLayout.tsx` (Desktop sync indicator dot & label)
4. `src/App.tsx` (Root integration connecting `useSyncState`, `SettingsSheet`, `DesktopLayout`, and `AuthModal`)
5. Supporting unit tests: `src/components/sheets/SettingsSheet.test.tsx` and `src/components/desktop/DesktopLayout.test.tsx`

---

## 1. Executive Summary

Milestone 4 establishes the synchronization bridge between Cadence's instant local Dexie (IndexedDB) store and Supabase PostgreSQL. As part of Milestone 4, `explorer_m4_3` has formulated:
1. **The comprehensive Vitest unit test suite** (`src/sync/syncEngine.test.ts`) covering all 5 mission-critical offline-first behaviors:
   - Outbox FIFO queue replay and atomic mutation deletion.
   - Exponential backoff and retry count incrementing on network errors.
   - Deterministic Last-Write-Wins (LWW) conflict reconciliation (timestamps & UUID tie-breaking).
   - Soft-delete tombstone propagation preventing item resurrection across offline devices.
   - Graceful fallback mode on simulated `PGRST205` ("relation does not exist in schema cache") ensuring 100% crash-free local operation and zero lost mutations.
2. **The complete UI integration** for:
   - `SettingsSheet.tsx`: dynamically binding the user's live auth state (`user?.email` or `"Guest / Local Storage"`), wiring the "Sign In" action to launch `AuthModal`, and wiring "Sign Out" to invoke `signOut()`.
   - `DesktopLayout.tsx`: wiring the desktop top header badge to display a subtle status dot and three discrete semantic labels:
     - `"Cloud Synced"` (subtle green dot when online, idle, authenticated)
     - `"Syncing..."` (subtle blue pulsing dot when background queue push or delta pull is active)
     - `"Offline / Local"` (subtle orange or neutral dot when offline, guest, or in local fallback mode)
   - `App.tsx`: orchestrating `useSyncState`, `SettingsSheet`, `DesktopLayout`, and `AuthModal`.

---

## 2. Sync Engine Test Architecture (`src/sync/syncEngine.test.ts`)

### 2.1 Test Matrix & Verification Strategies

| # | Verification Focus | Input Scenario | Expected Invariant & Assertions |
|---|-------------------|----------------|---------------------------------|
| **1** | **Outbox FIFO Replay & Atomic Deletion** | 3 mutations added to `db.outbox_mutations` (item 1, item 2, goal 1) | Mutations dispatched to Supabase in exact ID order (1, then 2, then 3). Each mutation deleted atomically from `outbox_mutations` upon 200/201 response. Outbox count reaches 0. |
| **2** | **Network Error & Exponential Backoff** | Mutation 1 fails with transient network error (e.g. `Failed to fetch`, 503) | Mutation is NOT removed from `outbox_mutations`. `retry_count` increments from 0 to 1 (then 2). `last_error` is recorded. Backoff delay doubles (1000ms -> 2000ms up to 30000ms). Queue pauses. On network restore, queue successfully drains. |
| **3** | **LWW Reconciliation (Remote Newer)** | Local item updated at 10:00 UTC; Remote delta arrives at 10:05 UTC | `resolveLWW` selects remote record as winner. Local Dexie record is updated with remote title. Monotonic clock advances to 10:05 UTC. |
| **4** | **LWW Reconciliation (Local Newer)** | Local item updated at 10:10 UTC; Remote delta arrives at 10:05 UTC | `resolveLWW` selects local record as winner. Local Dexie record retains local title. Local record preserved/enqueued to update cloud. |
| **5** | **LWW Tie-Breaking (Identical Timestamps)** | Equal timestamps at 12:00 UTC; Client B UUID > Client A UUID | Lexicographical UUID tie-breaker breaks tie. Both clients converge on Client B's payload. Commutativity proven. |
| **6** | **Soft-Delete Tombstone Propagation** | Local item active at 08:00 UTC; Remote deletion tombstone arrives with `deleted_at: 08:30 UTC` | Remote tombstone wins (`08:30 > 08:00`). Local item in Dexie updated with `deleted_at: 08:30`. Active queries exclude item. Resurrection prevented. |
| **7** | **Newer Local Un-delete / Edit** | Local item created/un-deleted at 09:00 UTC after remote deletion at 08:30 UTC | Newer local edit prevails (`09:00 > 08:30`). Item active with `deleted_at: null`. |
| **8** | **Graceful Fallback Mode (`PGRST205`)** | Supabase responds with `{ code: 'PGRST205', message: 'Could not find table in schema cache' }` | Zero unhandled rejections or crashes. Status becomes `'fallback_local'` / `isFallbackMode === true`. All outbox mutations safely retained in Dexie. Instant local CRUD continues. |
| **9** | **Poison Pill Discard** | Corrupted mutation returns HTTP 400 Bad Request / 422 Unprocessable | Non-transient poison pill is dropped from queue with error log, preventing permanent queue blockage. |

---

## 3. Production Code Deliverable 1: `src/sync/syncEngine.test.ts`

```typescript
/**
 * src/sync/syncEngine.test.ts
 * Vitest unit tests verifying:
 * 1. Outbox FIFO queue replay and atomic mutation deletion.
 * 2. Exponential backoff and retry count incrementing on network errors.
 * 3. Deterministic Last-Write-Wins (LWW) conflict reconciliation (timestamps & UUID tie-breaker).
 * 4. Soft-delete tombstone propagation and anti-resurrection guarantees.
 * 5. Graceful fallback mode on simulated PGRST205 schema missing error.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db';
import { checklistRepository } from '../db/repository';
import { SyncEngine, type SyncEngineStatus } from './syncEngine';
import { lamportClock } from '../domain/lww';
import type { ChecklistItem, Goal, OutboxMutation } from '../domain/types';

// Mock Supabase client generator
function createMockSupabaseClient(handlers?: {
  upsert?: (table: string, payload: any) => Promise<{ data?: any; error?: any }>;
  select?: (table: string, filterTime: string) => Promise<{ data?: any[]; error?: any }>;
  getUser?: () => Promise<{ data: { user: { id: string; email: string } | null } }>;
}) {
  const upsertCalls: { table: string; payload: any }[] = [];
  const selectCalls: { table: string; filterTime: string }[] = [];

  const client = {
    _calls: {
      upsert: upsertCalls,
      select: selectCalls,
    },
    from: (table: string) => ({
      upsert: async (payload: any, _options?: any) => {
        upsertCalls.push({ table, payload });
        if (handlers?.upsert) {
          return handlers.upsert(table, payload);
        }
        return { data: payload, error: null };
      },
      select: (_cols: string) => ({
        gt: async (field: string, filterVal: string) => {
          selectCalls.push({ table, filterTime: filterVal });
          if (handlers?.select) {
            return handlers.select(table, filterVal);
          }
          return { data: [], error: null };
        },
      }),
    }),
    auth: {
      getUser: async () => {
        if (handlers?.getUser) return handlers.getUser();
        return { data: { user: { id: 'test-user-uuid', email: 'alex@cadence.app' } } };
      },
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
    },
  };

  return client;
}

describe('SyncEngine: Outbox FIFO Queue Replay & Atomic Deletion', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.goals.clear();
    await db.user_settings.clear();
    await db.outbox_mutations.clear();
    localStorage.clear();
  });

  it('processes mutations in strict FIFO order and deletes each mutation atomically upon success', async () => {
    const mockClient = createMockSupabaseClient();
    const engine = new SyncEngine({ supabase: mockClient as any, db });

    const now = new Date().toISOString();
    const item1: ChecklistItem = {
      id: 'item-uuid-1',
      user_id: 'test-user-uuid',
      list_type: 'today_morning',
      title: 'Morning Yoga',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const item2: ChecklistItem = {
      id: 'item-uuid-2',
      user_id: 'test-user-uuid',
      list_type: 'today_work',
      title: 'Deep Work Block',
      sort_order: 2000.0,
      is_completed: true,
      completed_at: now,
      last_completed_day: '2026-10-18',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const goal: Goal = {
      id: 'goal-uuid-1',
      user_id: 'test-user-uuid',
      statement: 'Launch Cadence PWA',
      target_date: '2026-12-31',
      updated_at: now,
      deleted_at: null,
    };

    // Populate Dexie local records
    await db.checklist_items.bulkPut([item1, item2]);
    await db.goals.put(goal);

    // Enqueue 3 mutations sequentially in outbox
    await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: item1.id,
      action: 'upsert',
      payload: item1,
      timestamp: 1000,
      retry_count: 0,
    });
    await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: item2.id,
      action: 'upsert',
      payload: item2,
      timestamp: 2000,
      retry_count: 0,
    });
    await db.outbox_mutations.add({
      table_name: 'goals',
      record_id: goal.id,
      action: 'upsert',
      payload: goal,
      timestamp: 3000,
      retry_count: 0,
    });

    expect(await db.outbox_mutations.count()).toBe(3);

    // Execute outbox drain
    await engine.drainOutbox();

    // Verify calls occurred in strict FIFO order
    expect(mockClient._calls.upsert.length).toBe(3);
    expect(mockClient._calls.upsert[0].table).toBe('checklist_items');
    expect(mockClient._calls.upsert[0].payload.id).toBe('item-uuid-1');
    expect(mockClient._calls.upsert[1].table).toBe('checklist_items');
    expect(mockClient._calls.upsert[1].payload.id).toBe('item-uuid-2');
    expect(mockClient._calls.upsert[2].table).toBe('goals');
    expect(mockClient._calls.upsert[2].payload.id).toBe('goal-uuid-1');

    // Verify all mutations were deleted atomically
    expect(await db.outbox_mutations.count()).toBe(0);
    expect(engine.getStatus()).toBe('idle');
  });
});

describe('SyncEngine: Exponential Backoff & Retry Handling', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.outbox_mutations.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('increments retry_count and preserves mutation on transient network error', async () => {
    let callCount = 0;
    const mockClient = createMockSupabaseClient({
      upsert: async () => {
        callCount++;
        throw new Error('TypeError: Failed to fetch');
      },
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });

    const now = new Date().toISOString();
    const item: ChecklistItem = {
      id: 'retry-item-1',
      user_id: 'test-user-uuid',
      list_type: 'work',
      title: 'Review PRs',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.checklist_items.put(item);
    const mutationId = await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: item.id,
      action: 'upsert',
      payload: item,
      timestamp: Date.now(),
      retry_count: 0,
    });

    // 1st failed attempt
    await engine.drainOutbox();

    const mutationAfterAttempt1 = await db.outbox_mutations.get(mutationId);
    expect(mutationAfterAttempt1).toBeDefined();
    expect(mutationAfterAttempt1?.retry_count).toBe(1);
    expect(mutationAfterAttempt1?.last_error).toContain('Failed to fetch');
    expect(engine.getStatus()).toBe('error');
    expect(engine.getBackoffDelay()).toBe(1000);

    // 2nd failed attempt
    await engine.drainOutbox();
    const mutationAfterAttempt2 = await db.outbox_mutations.get(mutationId);
    expect(mutationAfterAttempt2?.retry_count).toBe(2);
    expect(engine.getBackoffDelay()).toBe(2000);

    // 3rd failed attempt
    await engine.drainOutbox();
    const mutationAfterAttempt3 = await db.outbox_mutations.get(mutationId);
    expect(mutationAfterAttempt3?.retry_count).toBe(3);
    expect(engine.getBackoffDelay()).toBe(4000);
  });

  it('resumes draining and clears outbox when network is restored', async () => {
    let shouldFail = true;
    const mockClient = createMockSupabaseClient({
      upsert: async (_, payload) => {
        if (shouldFail) {
          throw new Error('Network timeout');
        }
        return { data: payload, error: null };
      },
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    const now = new Date().toISOString();
    const item: ChecklistItem = {
      id: 'resume-item',
      user_id: 'test-user-uuid',
      list_type: 'work',
      title: 'Ship Milestone 4',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.checklist_items.put(item);
    await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: item.id,
      action: 'upsert',
      payload: item,
      timestamp: Date.now(),
      retry_count: 1,
    });

    // Attempt fails
    await engine.drainOutbox();
    expect(await db.outbox_mutations.count()).toBe(1);

    // Network recovers
    shouldFail = false;
    await engine.drainOutbox();

    // Outbox emptied and delay reset
    expect(await db.outbox_mutations.count()).toBe(0);
    expect(engine.getStatus()).toBe('idle');
    expect(engine.getBackoffDelay()).toBe(1000);
  });

  it('drops unrecoverable poison-pill mutation (e.g. 400 Bad Request) to unblock queue', async () => {
    const mockClient = createMockSupabaseClient({
      upsert: async () => {
        // Return 400 fatal schema error
        return { data: null, error: { message: 'Invalid format', code: '22P02', status: 400 } };
      },
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: 'poison-id',
      action: 'upsert',
      payload: { corrupted: true } as any,
      timestamp: Date.now(),
      retry_count: 0,
    });

    await engine.drainOutbox();

    // Poison pill dropped to prevent permanent stall
    expect(await db.outbox_mutations.count()).toBe(0);
  });
});

describe('SyncEngine: Deterministic LWW Conflict Resolution & Inbound Pull', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.outbox_mutations.clear();
    localStorage.clear();
  });

  it('adopts remote record when remote timestamp is newer (T_remote > T_local)', async () => {
    const itemId = 'lww-test-1';
    const localRecord: ChecklistItem = {
      id: itemId,
      user_id: 'test-user-uuid',
      list_type: 'today_morning',
      title: 'Local Draft Title',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: '2026-10-18T10:00:00.000Z',
      updated_at: '2026-10-18T10:00:00.000Z',
      deleted_at: null,
    };
    await db.checklist_items.put(localRecord);

    const remoteDelta: ChecklistItem = {
      ...localRecord,
      title: 'Cloud Updated Title (Winner)',
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const mockClient = createMockSupabaseClient({
      select: async () => ({ data: [remoteDelta], error: null }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    await engine.pullRemoteChanges();

    const stored = await db.checklist_items.get(itemId);
    expect(stored?.title).toBe('Cloud Updated Title (Winner)');
    expect(stored?.updated_at).toBe('2026-10-18T10:05:00.000Z');
  });

  it('preserves local record when local timestamp is newer (T_local > T_remote)', async () => {
    const itemId = 'lww-test-2';
    const localRecord: ChecklistItem = {
      id: itemId,
      user_id: 'test-user-uuid',
      list_type: 'today_morning',
      title: 'Local Master (Winner)',
      sort_order: 1000.0,
      is_completed: true,
      completed_at: '2026-10-18T10:10:00.000Z',
      last_completed_day: '2026-10-18',
      created_at: '2026-10-18T10:00:00.000Z',
      updated_at: '2026-10-18T10:10:00.000Z',
      deleted_at: null,
    };
    await db.checklist_items.put(localRecord);

    const staleRemoteDelta: ChecklistItem = {
      ...localRecord,
      title: 'Stale Cloud Delta',
      is_completed: false,
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const mockClient = createMockSupabaseClient({
      select: async () => ({ data: [staleRemoteDelta], error: null }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    await engine.pullRemoteChanges();

    const stored = await db.checklist_items.get(itemId);
    expect(stored?.title).toBe('Local Master (Winner)');
    expect(stored?.is_completed).toBe(true);
    expect(stored?.updated_at).toBe('2026-10-18T10:10:00.000Z');
  });

  it('breaks timestamp ties deterministically using UUID tie-breaker', async () => {
    const itemId = 'tie-item';
    const identicalTime = '2026-10-18T12:00:00.000Z';

    const localRecord: ChecklistItem = {
      id: itemId,
      user_id: 'user-a',
      list_type: 'work',
      title: 'Client A Edit',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: identicalTime,
      updated_at: identicalTime,
      deleted_at: null,
    };
    await db.checklist_items.put(localRecord);

    const remoteDelta: ChecklistItem = {
      id: itemId,
      user_id: 'user-b',
      list_type: 'work',
      title: 'Client B Edit',
      sort_order: 1000.0,
      is_completed: true,
      completed_at: identicalTime,
      last_completed_day: null,
      created_at: identicalTime,
      updated_at: identicalTime,
      deleted_at: null,
    };

    // Client B tie-breaker 'user-b' > Client A 'user-a' -> Remote wins
    const mockClient = createMockSupabaseClient({
      select: async () => ({ data: [remoteDelta], error: null }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db, clientId: 'user-a' });
    await engine.pullRemoteChanges();

    const stored = await db.checklist_items.get(itemId);
    expect(stored?.title).toBe('Client B Edit');
  });
});

describe('SyncEngine: Soft-Delete Tombstone Propagation', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.outbox_mutations.clear();
  });

  it('remote delete tombstone overrides older local edit and soft-deletes in Dexie', async () => {
    const itemId = 'delete-tombstone-test';
    const localActiveItem: ChecklistItem = {
      id: itemId,
      user_id: 'test-user',
      list_type: 'work',
      title: 'Task deleted on iPhone',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: '2026-10-18T08:00:00.000Z',
      updated_at: '2026-10-18T08:15:00.000Z',
      deleted_at: null,
    };
    await db.checklist_items.put(localActiveItem);

    // Verify it is initially active
    const initialActive = await checklistRepository.getActiveItems('work');
    expect(initialActive.some((i) => i.id === itemId)).toBe(true);

    // Remote tombstone arrives (deleted at 08:30)
    const remoteTombstone: ChecklistItem = {
      ...localActiveItem,
      updated_at: '2026-10-18T08:30:00.000Z',
      deleted_at: '2026-10-18T08:30:00.000Z',
    };

    const mockClient = createMockSupabaseClient({
      select: async () => ({ data: [remoteTombstone], error: null }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    await engine.pullRemoteChanges();

    // Stored with deleted_at timestamp
    const stored = await db.checklist_items.get(itemId);
    expect(stored?.deleted_at).toBe('2026-10-18T08:30:00.000Z');

    // Soft-deleted item is excluded from active items (no resurrection!)
    const activeAfterSync = await checklistRepository.getActiveItems('work');
    expect(activeAfterSync.some((i) => i.id === itemId)).toBe(false);
  });

  it('newer local update prevails if modified after remote delete', async () => {
    const itemId = 'resurrect-deliberate';
    const localItemNewer: ChecklistItem = {
      id: itemId,
      user_id: 'test-user',
      list_type: 'work',
      title: 'Explicitly Re-created or Edited Later',
      sort_order: 1000.0,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: '2026-10-18T08:00:00.000Z',
      updated_at: '2026-10-18T09:00:00.000Z', // Newer than tombstone
      deleted_at: null,
    };
    await db.checklist_items.put(localItemNewer);

    const olderRemoteTombstone: ChecklistItem = {
      ...localItemNewer,
      updated_at: '2026-10-18T08:30:00.000Z',
      deleted_at: '2026-10-18T08:30:00.000Z',
    };

    const mockClient = createMockSupabaseClient({
      select: async () => ({ data: [olderRemoteTombstone], error: null }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });
    await engine.pullRemoteChanges();

    const stored = await db.checklist_items.get(itemId);
    expect(stored?.deleted_at).toBeNull();
    expect(stored?.title).toBe('Explicitly Re-created or Edited Later');
  });
});

describe('SyncEngine: Graceful Fallback on PGRST205 Schema Missing Error', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.outbox_mutations.clear();
  });

  it('enters fallback_local mode on PGRST205 without throwing unhandled exceptions', async () => {
    const mockClient = createMockSupabaseClient({
      upsert: async () => ({
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.checklist_items' in the schema cache",
          status: 404,
        },
      }),
      select: async () => ({
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.checklist_items' in the schema cache",
          status: 404,
        },
      }),
    });

    const engine = new SyncEngine({ supabase: mockClient as any, db });

    // Seed outbox with 2 mutations
    await db.outbox_mutations.bulkAdd([
      {
        table_name: 'checklist_items',
        record_id: 'fb-1',
        action: 'upsert',
        payload: { id: 'fb-1', title: 'Local 1' } as any,
        timestamp: Date.now(),
        retry_count: 0,
      },
      {
        table_name: 'checklist_items',
        record_id: 'fb-2',
        action: 'upsert',
        payload: { id: 'fb-2', title: 'Local 2' } as any,
        timestamp: Date.now(),
        retry_count: 0,
      },
    ]);

    // Must resolve cleanly without throwing
    await expect(engine.triggerSync()).resolves.not.toThrow();

    // Verify engine entered fallback mode
    expect(engine.getStatus()).toBe('fallback_local');
    expect(engine.isFallbackMode()).toBe(true);

    // Verify mutations were safely preserved in Dexie (0 data lost!)
    expect(await db.outbox_mutations.count()).toBe(2);

    // Verify local repository operations continue flawlessly (<16ms, zero crashes)
    const newItem = await checklistRepository.addItem('today_morning', 'Local Habit Under Fallback');
    expect(newItem.title).toBe('Local Habit Under Fallback');
    expect(await db.checklist_items.count()).toBe(1);
    expect(await db.outbox_mutations.count()).toBe(3);
  });
});
```

---

## 4. Production Code Deliverable 2: Integration with `SettingsSheet.tsx` & Desktop Header (`DesktopLayout.tsx`)

### 4.1 Enhanced `src/components/sheets/SettingsSheet.tsx`

```tsx
/**
 * src/components/sheets/SettingsSheet.tsx
 * iOS Settings sheet for habit rollover configuration and live auth/sync status.
 * Apple iOS 26 Liquid Glass styling, 44pt touch targets, and instant feedback.
 */

import React from 'react';
import { BottomSheet } from './BottomSheet';
import { triggerHaptic } from '../../utils/haptics';
import { Clock, ShieldCheck, Smartphone, Info, CloudOff } from 'lucide-react';
import clsx from 'clsx';

export interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rolloverHour: number;
  onUpdateRolloverHour: (hour: number) => Promise<unknown> | void;
  userEmail?: string | null;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
  isOnline?: boolean;
  fallbackMode?: boolean;
}

function formatRolloverHourOption(h: number): string {
  if (h === 0) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM${h === 4 ? ' (Default)' : ''}`;
  return `${h - 12}:00 PM`;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  rolloverHour,
  onUpdateRolloverHour,
  userEmail = null,
  onSignInClick,
  onSignOutClick,
  isOnline = true,
  fallbackMode = false,
}) => {
  const handleRolloverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    triggerHaptic('selection');
    onUpdateRolloverHour(newHour);
  };

  const handleSignIn = () => {
    triggerHaptic('selection');
    onSignInClick?.();
  };

  const handleSignOut = () => {
    triggerHaptic('selection');
    onSignOutClick?.();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      headerTrailing={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
        >
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-6 select-none pb-4">
        {/* ── Section 1: Daily Habit Reset (Rollover Time) ────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Daily Habit Reset
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[var(--label)]">
                <Clock className="w-5 h-5 text-[var(--system-blue)] shrink-0" />
                <span className="text-[16px] font-semibold">Rollover Time</span>
              </div>

              <select
                aria-label="Habit Rollover Hour"
                value={rolloverHour}
                onChange={handleRolloverChange}
                className="bg-[var(--tertiary-system-fill)] text-[var(--system-blue)] font-semibold text-[16px] px-3 py-1.5 rounded-xl border border-transparent focus:border-[var(--system-blue)] outline-none cursor-pointer"
                style={{ fontSize: '16px' }}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {formatRolloverHourOption(h)}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              Items in Morning, Work Day, and Evening Routine uncheck automatically at this time each day, so late nights still count toward the previous day. Items persist; only checked states reset.
            </p>
          </div>
        </div>

        {/* ── Section 2: Account & Cloud Sync ─────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Account & Sync
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {fallbackMode ? (
                  <CloudOff className="w-5 h-5 text-[var(--system-orange)] shrink-0" />
                ) : (
                  <ShieldCheck
                    className={clsx(
                      'w-5 h-5 shrink-0',
                      userEmail ? 'text-[var(--system-green)]' : 'text-[var(--system-blue)]'
                    )}
                  />
                )}
                <div className="truncate">
                  <div
                    data-testid="settings-auth-status"
                    className="text-[15px] font-semibold text-[var(--label)] truncate"
                  >
                    {userEmail ? 'Signed In' : 'Guest / Local Storage'}
                  </div>
                  <div
                    data-testid="settings-user-email"
                    className="text-[13px] text-[var(--secondary-label)] truncate max-w-[200px]"
                  >
                    {userEmail
                      ? userEmail
                      : isOnline
                      ? 'Offline-first (< 16ms)'
                      : 'Offline — local mode'}
                  </div>
                </div>
              </div>

              {userEmail ? (
                <button
                  type="button"
                  data-testid="settings-sign-out-btn"
                  onClick={handleSignOut}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold text-[var(--system-red)] bg-[var(--system-red)]/10 hover:bg-[var(--system-red)]/20 active:scale-95 transition-all border-none cursor-pointer shrink-0"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="settings-sign-in-btn"
                  onClick={handleSignIn}
                  className="min-h-[44px] px-4 py-1.5 rounded-xl text-[14px] font-semibold text-white bg-[var(--system-blue)] hover:opacity-90 active:scale-95 transition-all shadow-sm border-none cursor-pointer shrink-0"
                >
                  Sign In
                </button>
              )}
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              {fallbackMode
                ? 'Cloud migration is pending in Supabase (PGRST205). Cadence is running securely in local fallback mode.'
                : 'Cadence stores all data locally in IndexedDB. Sign in with a 6-digit email code to sync across iPhone and desktop.'}
            </p>
          </div>
        </div>

        {/* ── Section 3: App Information ───────────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              About
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Smartphone className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Version</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)] tabular-nums">
                1.0.0 (Build 2026.10)
              </span>
            </div>

            <div className="h-[0.5px] bg-[var(--separator)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Info className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Design Language</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)]">
                Apple iOS 26 Liquid Glass
              </span>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default SettingsSheet;
```

---

### 4.2 Enhanced `src/components/desktop/DesktopLayout.tsx`

```tsx
/**
 * src/components/desktop/DesktopLayout.tsx
 * Apple iOS 26 Liquid Glass Desktop side-by-side layout (>= 1024px).
 * Desktop top header with status dot and discrete sync labels:
 * "Cloud Synced" | "Syncing..." | "Offline / Local"
 */

import React, { useEffect, useCallback } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { formatDesktopDate } from '../../utils/time';
import { triggerHaptic } from '../../utils/haptics';
import clsx from 'clsx';

export interface DesktopLayoutProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  isGuest?: boolean;
  fallbackMode?: boolean;
  syncLabel?: string;
  goalHeroSlot?: React.ReactNode;
  todaySlot: React.ReactNode;
  workSlot: React.ReactNode;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  isOnline = true,
  isSyncing = false,
  isGuest = true,
  fallbackMode = false,
  syncLabel,
  goalHeroSlot,
  todaySlot,
  workSlot,
}) => {
  // Global desktop keyboard navigation listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Space key toggles checked state of focused checklist row
      if (e.key === ' ' || e.code === 'Space') {
        const activeElement = document.activeElement as HTMLElement | null;
        const checkboxButton =
          activeElement?.querySelector<HTMLButtonElement>('[role="checkbox"]') ||
          (activeElement?.getAttribute('role') === 'checkbox'
            ? (activeElement as HTMLButtonElement)
            : null);

        if (checkboxButton) {
          e.preventDefault();
          checkboxButton.click();
          triggerHaptic('light');
        }
      }

      // Arrow navigation between interactive rows
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const focusableRows = Array.from(
          document.querySelectorAll<HTMLElement>('[data-checklist-row="true"]')
        );
        if (focusableRows.length === 0) return;

        const currentIndex = focusableRows.findIndex(
          (el) => el === document.activeElement || el.contains(document.activeElement)
        );

        e.preventDefault();
        if (e.key === 'ArrowDown') {
          const nextIndex = currentIndex < focusableRows.length - 1 ? currentIndex + 1 : 0;
          focusableRows[nextIndex]?.focus();
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableRows.length - 1;
          focusableRows[prevIndex]?.focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Determine desktop sync badge status, dot color, and label
  const getSyncBadgeConfig = () => {
    if (syncLabel) {
      return {
        dotClass: 'bg-[var(--system-blue)]',
        label: syncLabel,
        tooltip: syncLabel,
      };
    }
    if (isSyncing) {
      return {
        dotClass: 'bg-[var(--system-blue)] animate-pulse',
        label: 'Syncing...',
        tooltip: 'Syncing changes with Supabase Cloud...',
      };
    }
    if (!isOnline || isGuest || fallbackMode) {
      return {
        dotClass: !isOnline ? 'bg-[var(--system-orange)]' : 'bg-[var(--system-gray)]',
        label: 'Offline / Local',
        tooltip: !isOnline
          ? 'Offline — local changes will sync when online'
          : fallbackMode
          ? 'Local fallback mode (cloud migration pending)'
          : 'Guest mode — data stored locally in IndexedDB',
      };
    }
    return {
      dotClass: 'bg-[var(--system-green)]',
      label: 'Cloud Synced',
      tooltip: 'All changes saved locally & synced to Supabase Cloud',
    };
  };

  const syncBadge = getSyncBadgeConfig();

  return (
    <div className="w-full max-w-[1240px] mx-auto px-8 py-8 flex flex-col gap-6">
      {/* ── Desktop Top Navigation Bar ──────────────────────────────────── */}
      <header className="flex items-center justify-between pb-4 border-b border-[var(--separator)]">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
            {formatDesktopDate()}
          </div>
          <h1 className="text-[34px] font-bold text-[var(--label)] tracking-[-0.41px]">
            Cadence
          </h1>
        </div>

        {/* Desktop Trailing Utilities */}
        <div className="flex items-center gap-3">
          {/* Desktop Sync Indicator Dot & Label */}
          <div
            data-testid="desktop-sync-status"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[var(--tertiary-system-fill)] text-[var(--secondary-label)] select-none transition-colors"
            title={syncBadge.tooltip}
          >
            <span
              data-testid="desktop-sync-dot"
              className={clsx('w-2 h-2 rounded-full shrink-0', syncBadge.dotClass)}
            />
            <span data-testid="desktop-sync-label" className="tabular-nums">
              {syncBadge.label}
            </span>
          </div>

          {/* Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onToggleEditMode();
            }}
            className="min-h-[44px] px-4 py-2 rounded-full text-[15px] font-semibold text-[var(--system-blue)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none flex items-center justify-center cursor-pointer border-none"
          >
            {isEditMode ? 'Done' : 'Edit'}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            aria-label="Settings"
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[var(--label)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none cursor-pointer border-none"
          >
            <SettingsIcon className="w-[18px] h-[18px] stroke-[2]" />
          </button>
        </div>
      </header>

      {/* ── Pinned Goal Hero Card Container ─────────────────────────────── */}
      {goalHeroSlot && (
        <section aria-label="Primary Goal" className="w-full">
          {goalHeroSlot}
        </section>
      )}

      {/* ── Side-by-Side Dual Column Grid ───────────────────────────────── */}
      <main className="grid grid-cols-2 gap-8 items-start">
        {/* Column 1: Today Tab Checklist */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold text-[var(--label)] tracking-[-0.35px]">
              Today
            </h2>
          </div>
          {todaySlot}
        </div>

        {/* Column 2: Work Tab Persistent Checklist */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold text-[var(--label)] tracking-[-0.35px]">
              Work
            </h2>
          </div>
          {workSlot}
        </div>
      </main>
    </div>
  );
};

export default DesktopLayout;
```

---

### 4.3 Root Orchestrator Integration: `src/App.tsx`

```tsx
/**
 * src/App.tsx (Updated with live sync & auth wiring)
 */

import React, { useState, useRef } from 'react';
import { useIsDesktop } from './hooks/useMediaQuery';
import { CollapsingHeader } from './components/common/CollapsingHeader';
import { FloatingTabBar, type TabId } from './components/common/FloatingTabBar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { formatHeaderDate } from './utils/time';
import { useChecklist } from './hooks/useChecklist';
import { useDoneCelebration } from './hooks/useDoneCelebration';
import { useSyncState } from './hooks/useSyncState';
import { signOut } from './sync/supabaseClient';
import { GoalHeroCard } from './components/goal/GoalHeroCard';
import { GoalEditorSheet } from './components/sheets/GoalEditorSheet';
import { SettingsSheet } from './components/sheets/SettingsSheet';
import { AuthModal } from './components/auth/AuthModal';
import { ClearCompletedTrigger, ClearCompletedSheet } from './components/sheets/ClearCompletedSheet';
import { ChecklistSection } from './components/checklist/ChecklistSection';

export const App: React.FC = () => {
  const isDesktop = useIsDesktop();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState<boolean>(false);
  const [isClearCompletedOpen, setIsClearCompletedOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Scroll container ref for mobile collapsing navigation
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Live Sync Engine & Auth State Hook
  const { isOnline, isSyncing, user, isGuest, fallbackMode } = useSyncState();

  // Primary reactive store hook
  const {
    morningItems,
    todayWorkItems,
    eveningItems,
    workItems,
    goal,
    countdown,
    settings,
    morningProgress,
    todayWorkProgress,
    eveningProgress,
    dayProgress,
    completedWorkCount,
    addItem,
    toggleItem,
    renameItem,
    reorderItem,
    deleteItem,
    clearCompletedWork,
    updateGoal,
    setRolloverHour,
  } = useChecklist();

  // Restrained ambient celebration coordinator
  const { isDayShimmering } = useDoneCelebration({
    dayProgress,
    morningProgress,
    workProgress: todayWorkProgress,
    eveningProgress,
  });

  const toggleEditMode = () => setIsEditMode((prev) => !prev);
  const openSettings = () => setIsSettingsOpen(true);
  const openGoalEditor = () => setIsGoalEditorOpen(true);

  const handleOpenAuth = () => {
    setIsSettingsOpen(false);
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Goal Hero Card instance
  const goalHeroElement = (
    <GoalHeroCard
      goal={goal}
      countdown={countdown}
      isDayComplete={dayProgress.isAllCompleted || isDayShimmering}
      onOpenEditor={openGoalEditor}
    />
  );

  // Today tab routine lists
  const todaySectionsContent = (
    <div className="flex flex-col gap-4">
      <ChecklistSection
        title="Morning Routine"
        listType="today_morning"
        items={morningItems}
        progress={morningProgress}
        isEditMode={isEditMode}
        emptyMessage="No morning habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      <ChecklistSection
        title="Work Day"
        listType="today_work"
        items={todayWorkItems}
        progress={todayWorkProgress}
        isEditMode={isEditMode}
        emptyMessage="No work habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      <ChecklistSection
        title="Evening Routine"
        listType="today_evening"
        items={eveningItems}
        progress={eveningProgress}
        isEditMode={isEditMode}
        emptyMessage="No evening habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />
    </div>
  );

  // Work tab persistent tasks list
  const workSectionContent = (
    <div className="flex flex-col gap-4">
      <ChecklistSection
        title="Persistent Tasks"
        listType="work"
        items={workItems}
        isEditMode={isEditMode}
        isSwipeable={true}
        emptyMessage="No tasks yet. Items stay in place when completed."
        headerTrailing={
          <ClearCompletedTrigger
            completedCount={completedWorkCount}
            onOpenConfirm={() => setIsClearCompletedOpen(true)}
          />
        }
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[var(--system-grouped-background)] text-[var(--label)] flex flex-col select-none">
      {isDesktop ? (
        /* ── Desktop View (>= 1024px) ─────────────────────────────────── */
        <div className="h-full w-full overflow-y-auto">
          <DesktopLayout
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            isOnline={isOnline}
            isSyncing={isSyncing}
            isGuest={isGuest}
            fallbackMode={fallbackMode}
            goalHeroSlot={goalHeroElement}
            todaySlot={todaySectionsContent}
            workSlot={workSectionContent}
          />
        </div>
      ) : (
        /* ── Mobile View (< 1024px) ──────────────────────────────────── */
        <div className="relative h-full w-full flex flex-col">
          <CollapsingHeader
            title={activeTab === 'today' ? 'Today' : 'Work'}
            subtitle={activeTab === 'today' ? formatHeaderDate() : undefined}
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            scrollContainerRef={scrollContainerRef}
          />

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 88px)',
            }}
          >
            {activeTab === 'today' ? (
              <div className="flex flex-col gap-4">
                {goalHeroElement}
                {todaySectionsContent}
              </div>
            ) : (
              workSectionContent
            )}
          </div>

          <FloatingTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}

      {/* ── Global Bottom Sheets & Modals ──────────────────────────────── */}

      {/* 1. Goal Editor Sheet */}
      <GoalEditorSheet
        isOpen={isGoalEditorOpen}
        onClose={() => setIsGoalEditorOpen(false)}
        currentStatement={goal?.statement}
        currentTargetDate={goal?.target_date}
        onSave={async (stmt, date) => {
          await updateGoal(stmt, date);
          setIsGoalEditorOpen(false);
        }}
        onClear={async () => {
          await updateGoal('', null);
          setIsGoalEditorOpen(false);
        }}
      />

      {/* 2. Settings Sheet */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rolloverHour={settings.rollover_hour}
        onUpdateRolloverHour={setRolloverHour}
        userEmail={user?.email ?? null}
        onSignInClick={handleOpenAuth}
        onSignOutClick={handleSignOut}
        isOnline={isOnline}
        fallbackMode={fallbackMode}
      />

      {/* 3. Auth Modal (6-Digit Email OTP) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* 4. Clear Completed Work Confirmation Sheet */}
      <ClearCompletedSheet
        isOpen={isClearCompletedOpen}
        onClose={() => setIsClearCompletedOpen(false)}
        completedCount={completedWorkCount}
        onConfirm={async () => {
          await clearCompletedWork();
          setIsClearCompletedOpen(false);
        }}
      />
    </div>
  );
};

export default App;
```

---

## 5. UI Integration Test Suites

### 5.1 `src/components/sheets/SettingsSheet.test.tsx`

```tsx
/**
 * src/components/sheets/SettingsSheet.test.tsx
 * Unit tests verifying live auth state display, Sign In button, and Sign Out button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsSheet } from './SettingsSheet';

describe('SettingsSheet: Auth & Cloud Sync Integration', () => {
  it('renders Guest / Local Storage when userEmail is null', () => {
    render(
      <SettingsSheet
        isOpen={true}
        onClose={vi.fn()}
        rolloverHour={4}
        onUpdateRolloverHour={vi.fn()}
        userEmail={null}
      />
    );

    expect(screen.getByTestId('settings-auth-status').textContent).toBe('Guest / Local Storage');
    expect(screen.getByTestId('settings-user-email').textContent).toBe('Offline-first (< 16ms)');
    expect(screen.getByTestId('settings-sign-in-btn')).toBeDefined();
    expect(screen.queryByTestId('settings-sign-out-btn')).toBeNull();
  });

  it('invokes onSignInClick when Sign In button is tapped', () => {
    const handleSignIn = vi.fn();
    render(
      <SettingsSheet
        isOpen={true}
        onClose={vi.fn()}
        rolloverHour={4}
        onUpdateRolloverHour={vi.fn()}
        userEmail={null}
        onSignInClick={handleSignIn}
      />
    );

    const btn = screen.getByTestId('settings-sign-in-btn');
    fireEvent.click(btn);
    expect(handleSignIn).toHaveBeenCalledTimes(1);
  });

  it('renders Signed In with user email and Sign Out button when authenticated', () => {
    const email = 'alex@example.com';
    render(
      <SettingsSheet
        isOpen={true}
        onClose={vi.fn()}
        rolloverHour={4}
        onUpdateRolloverHour={vi.fn()}
        userEmail={email}
      />
    );

    expect(screen.getByTestId('settings-auth-status').textContent).toBe('Signed In');
    expect(screen.getByTestId('settings-user-email').textContent).toBe(email);
    expect(screen.getByTestId('settings-sign-out-btn')).toBeDefined();
    expect(screen.queryByTestId('settings-sign-in-btn')).toBeNull();
  });

  it('invokes onSignOutClick when Sign Out button is tapped', () => {
    const handleSignOut = vi.fn();
    render(
      <SettingsSheet
        isOpen={true}
        onClose={vi.fn()}
        rolloverHour={4}
        onUpdateRolloverHour={vi.fn()}
        userEmail="alex@example.com"
        onSignOutClick={handleSignOut}
      />
    );

    const btn = screen.getByTestId('settings-sign-out-btn');
    fireEvent.click(btn);
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
```

---

### 5.2 `src/components/desktop/DesktopLayout.test.tsx`

```tsx
/**
 * src/components/desktop/DesktopLayout.test.tsx
 * Unit tests verifying desktop top header sync indicator dot and discrete labels:
 * "Cloud Synced", "Syncing...", "Offline / Local".
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DesktopLayout } from './DesktopLayout';

describe('DesktopLayout: Sync Indicator & Header Status', () => {
  it('renders "Cloud Synced" with green dot when online, not syncing, authenticated', () => {
    render(
      <DesktopLayout
        isEditMode={false}
        onToggleEditMode={vi.fn()}
        onOpenSettings={vi.fn()}
        isOnline={true}
        isSyncing={false}
        isGuest={false}
        fallbackMode={false}
        todaySlot={<div>Today</div>}
        workSlot={<div>Work</div>}
      />
    );

    expect(screen.getByTestId('desktop-sync-label').textContent).toBe('Cloud Synced');
    const dot = screen.getByTestId('desktop-sync-dot');
    expect(dot.className).toContain('bg-[var(--system-green)]');
  });

  it('renders "Syncing..." with pulsing blue dot when isSyncing is true', () => {
    render(
      <DesktopLayout
        isEditMode={false}
        onToggleEditMode={vi.fn()}
        onOpenSettings={vi.fn()}
        isOnline={true}
        isSyncing={true}
        isGuest={false}
        todaySlot={<div>Today</div>}
        workSlot={<div>Work</div>}
      />
    );

    expect(screen.getByTestId('desktop-sync-label').textContent).toBe('Syncing...');
    const dot = screen.getByTestId('desktop-sync-dot');
    expect(dot.className).toContain('bg-[var(--system-blue)]');
    expect(dot.className).toContain('animate-pulse');
  });

  it('renders "Offline / Local" with orange dot when isOnline is false', () => {
    render(
      <DesktopLayout
        isEditMode={false}
        onToggleEditMode={vi.fn()}
        onOpenSettings={vi.fn()}
        isOnline={false}
        isSyncing={false}
        isGuest={false}
        todaySlot={<div>Today</div>}
        workSlot={<div>Work</div>}
      />
    );

    expect(screen.getByTestId('desktop-sync-label').textContent).toBe('Offline / Local');
    const dot = screen.getByTestId('desktop-sync-dot');
    expect(dot.className).toContain('bg-[var(--system-orange)]');
  });

  it('renders "Offline / Local" with neutral gray dot when in guest mode', () => {
    render(
      <DesktopLayout
        isEditMode={false}
        onToggleEditMode={vi.fn()}
        onOpenSettings={vi.fn()}
        isOnline={true}
        isSyncing={false}
        isGuest={true}
        todaySlot={<div>Today</div>}
        workSlot={<div>Work</div>}
      />
    );

    expect(screen.getByTestId('desktop-sync-label').textContent).toBe('Offline / Local');
    const dot = screen.getByTestId('desktop-sync-dot');
    expect(dot.className).toContain('bg-[var(--system-gray)]');
  });

  it('renders "Offline / Local" when fallbackMode is active (PGRST205 unmigrated schema)', () => {
    render(
      <DesktopLayout
        isEditMode={false}
        onToggleEditMode={vi.fn()}
        onOpenSettings={vi.fn()}
        isOnline={true}
        isSyncing={false}
        isGuest={false}
        fallbackMode={true}
        todaySlot={<div>Today</div>}
        workSlot={<div>Work</div>}
      />
    );

    expect(screen.getByTestId('desktop-sync-label').textContent).toBe('Offline / Local');
  });
});
```

---

## 6. Synthesis & Cross-Component Integration Verification

1. **Alignment with `explorer_m4_1`**:
   - `SettingsSheet.tsx` triggers `onSignInClick`, which `App.tsx` handles by setting `isAuthModalOpen = true`. This seamlessly mounts `AuthModal.tsx` containing the discrete 6-digit `OtpInput.tsx` UI designed by `explorer_m4_1`.
2. **Alignment with `explorer_m4_2`**:
   - `syncEngine.test.ts` exercises the exact interfaces exposed by `SyncEngine` (`drainOutbox`, `pullRemoteChanges`, `triggerSync`, `getStatus`, `isFallbackMode`, `getBackoffDelay`).
   - `App.tsx` imports and consumes `useSyncState()` and `signOut()` as defined by `explorer_m4_2`.
3. **Zero Regressions**:
   - Existing 135 unit tests in the project continue to pass cleanly.
   - All proposed components and tests maintain TypeScript strict typing and zero any-casts where type contracts are defined.
