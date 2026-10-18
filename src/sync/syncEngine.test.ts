/**
 * src/sync/syncEngine.test.ts
 * Vitest unit tests verifying:
 * 1. Outbox FIFO queue replay and atomic mutation deletion.
 * 2. Exponential backoff and retry count incrementing on network errors.
 * 3. Deterministic Last-Write-Wins (LWW) conflict reconciliation (timestamps & UUID tie-breaker).
 * 4. Soft-delete tombstone propagation and anti-resurrection guarantees.
 * 5. Graceful fallback mode on simulated PGRST205 schema missing error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db';
import { checklistRepository } from '../db/repository';
import { SyncEngine } from './syncEngine';
import type { ChecklistItem, Goal } from '../domain/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type MockPayload = Record<string, unknown>;

// Mock Supabase client generator
function createMockSupabaseClient(handlers?: {
  upsert?: (table: string, payload: MockPayload) => Promise<{ data?: unknown; error?: unknown }>;
  select?: (table: string, filterTime?: string) => Promise<{ data?: unknown[] | null; error?: unknown }>;
  getUser?: () => Promise<{ data: { user: { id: string; email: string } | null } }>;
}) {
  const upsertCalls: { table: string; payload: MockPayload }[] = [];
  const selectCalls: { table: string; filterTime?: string }[] = [];

  const client = {
    _calls: {
      upsert: upsertCalls,
      select: selectCalls,
    },
    from: (table: string) => ({
      upsert: async (payload: MockPayload, _options?: unknown) => {
        upsertCalls.push({ table, payload });
        if (handlers?.upsert) {
          return handlers.upsert(table, payload);
        }
        return { data: payload, error: null };
      },
      select: (_cols: string = '*') => {
        const createQueryChain = (currentFilterTime?: string): {
          eq: (_field: string, _val: string) => unknown;
          gt: (_field: string, filterVal: string) => unknown;
          then: (onfulfilled?: (val: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
        } => {
          return {
            eq: (_field: string, _val: string) => createQueryChain(currentFilterTime),
            gt: (_field: string, filterVal: string) => {
              selectCalls.push({ table, filterTime: filterVal });
              return createQueryChain(filterVal);
            },
            then: (onfulfilled?: (val: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => {
              const promise = (async () => {
                if (handlers?.select) {
                  return handlers.select(table, currentFilterTime);
                }
                return { data: [], error: null };
              })();
              return promise.then(onfulfilled, onrejected);
            },
          };
        };
        return createQueryChain();
      },
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
    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });

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
    expect(mockClient._calls.upsert[0]!.table).toBe('checklist_items');
    expect(mockClient._calls.upsert[0]!.payload.id).toBe('item-uuid-1');
    expect(mockClient._calls.upsert[1]!.table).toBe('checklist_items');
    expect(mockClient._calls.upsert[1]!.payload.id).toBe('item-uuid-2');
    expect(mockClient._calls.upsert[2]!.table).toBe('goals');
    expect(mockClient._calls.upsert[2]!.payload.id).toBe('goal-uuid-1');

    // Verify all mutations were deleted atomically
    expect(await db.outbox_mutations.count()).toBe(0);
    expect(engine.getStatus()).toBe('idle');
  });
});

describe('SyncEngine: Exponential Backoff & Retry Handling', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.outbox_mutations.clear();
  });

  it('increments retry_count and preserves mutation on transient network error', async () => {
    let callCount = 0;
    const mockClient = createMockSupabaseClient({
      upsert: async () => {
        callCount++;
        throw new Error('TypeError: Failed to fetch');
      },
    });

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });

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
    expect(callCount).toBe(3);
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
    await db.outbox_mutations.add({
      table_name: 'checklist_items',
      record_id: 'poison-id',
      action: 'upsert',
      payload: { corrupted: true } as unknown as ChecklistItem,
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db, clientId: 'user-a' });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });
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

    const engine = new SyncEngine({ supabase: mockClient as unknown as SupabaseClient, db });

    // Seed outbox with 2 mutations
    await db.outbox_mutations.bulkAdd([
      {
        table_name: 'checklist_items',
        record_id: 'fb-1',
        action: 'upsert',
        payload: { id: 'fb-1', title: 'Local 1' } as unknown as ChecklistItem,
        timestamp: Date.now(),
        retry_count: 0,
      },
      {
        table_name: 'checklist_items',
        record_id: 'fb-2',
        action: 'upsert',
        payload: { id: 'fb-2', title: 'Local 2' } as unknown as ChecklistItem,
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
