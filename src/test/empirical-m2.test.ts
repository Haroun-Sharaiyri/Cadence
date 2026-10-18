/**
 * src/test/empirical-m2.test.ts
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 2:
 * 1. Monotonic LamportClock Strict Ordering (10,000 rapid timestamps)
 * 2. LWW Commutativity and Associativity (Random fuzz testing & multi-permutation convergence)
 * 3. Soft-Delete Tombstone Precedence & Non-Resurrection
 * 4. Dexie Atomic Transactions & Outbox Invariants (1:1 enqueue & rollback)
 * 5. Clear Completed Work Items Exactness (Surgical soft-delete with untouched unchecked/routine items)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LamportClock, resolveLWW } from '../domain/lww';
import { db } from '../db/index';
import { checklistRepository } from '../db/repository';
import type { ChecklistItem, Goal, UserSettings } from '../domain/types';

describe('Empirical Adversarial Stress Tests: Milestone 2', () => {

  // =========================================================================
  // SUITE 1: Monotonic LamportClock Strict Ordering
  // =========================================================================
  describe('1. Monotonic LamportClock Strict Monotonicity & Burst Stress', () => {
    it('generates 10,000 timestamps in rapid succession and asserts strict monotonic increase', () => {
      const clock = new LamportClock();
      const count = 10000;
      const timestamps: string[] = new Array(count);

      const startTime = performance.now();
      for (let i = 0; i < count; i++) {
        timestamps[i] = clock.now();
      }
      const durationMs = performance.now() - startTime;

      console.log(`[LamportClock] Generated ${count} timestamps in ${durationMs.toFixed(2)}ms`);

      expect(timestamps.length).toBe(count);

      // Verify valid ISO format regex
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(isoRegex.test(timestamps[0]!)).toBe(true);

      // Check strict monotonicity for every consecutive pair
      let prevMs = -1;
      for (let i = 0; i < count; i++) {
        const ts = timestamps[i]!;
        const ms = new Date(ts).getTime();

        expect(Number.isNaN(ms)).toBe(false);

        if (i > 0) {
          // Epoch ms must be strictly greater than preceding
          expect(ms).toBeGreaterThan(prevMs);
          // ISO 8601 string must be lexicographically strictly greater
          expect(ts.localeCompare(timestamps[i - 1]!)).toBeGreaterThan(0);
          // Delta must be at least 1 millisecond
          expect(ms - prevMs).toBeGreaterThanOrEqual(1);
        }
        prevMs = ms;
      }

      // Assert zero duplicates across the entire 10,000 timestamp set
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(count);
    });

    it('handles clock skews, backwards jumps, and future remote clocks correctly', () => {
      const clock = new LamportClock(Date.now());
      const t1 = clock.now();
      const t1Ms = new Date(t1).getTime();

      // Remote future clock (10 days in future)
      const remoteFuture = new Date(t1Ms + 10 * 86400 * 1000).toISOString();
      clock.receive(remoteFuture);

      const t2 = clock.now();
      const t2Ms = new Date(t2).getTime();
      expect(t2Ms).toBeGreaterThan(new Date(remoteFuture).getTime());

      // Remote past clock (1 year in past) - clock should NOT regress
      const remotePast = new Date(t1Ms - 365 * 86400 * 1000).toISOString();
      clock.receive(remotePast);

      const t3 = clock.now();
      const t3Ms = new Date(t3).getTime();
      expect(t3Ms).toBeGreaterThan(t2Ms);

      // Malformed or invalid ISO strings should not corrupt the clock
      clock.receive('INVALID_ISO_STRING');
      clock.receive('');
      const t4 = clock.now();
      expect(new Date(t4).getTime()).toBeGreaterThan(t3Ms);
    });
  });

  // =========================================================================
  // SUITE 2: LWW Commutativity and Associativity
  // =========================================================================
  describe('2. Deterministic LWW Commutativity and Associativity Fuzz Testing', () => {
    function createFuzzItem(
      id: string,
      updatedAt: string,
      title: string,
      isCompleted: boolean,
      deletedAt: string | null = null
    ): ChecklistItem {
      return {
        id,
        user_id: 'user-test',
        list_type: 'today_morning',
        title,
        sort_order: 1000.0,
        is_completed: isCompleted,
        completed_at: isCompleted ? updatedAt : null,
        last_completed_day: isCompleted ? '2026-10-18' : null,
        created_at: updatedAt,
        updated_at: updatedAt,
        deleted_at: deletedAt,
      };
    }

    it('proves commutativity across 5,000 randomized pairs with distinct device tie-breakers', () => {
      const clock = new LamportClock(1700000000000);
      const iterations = 5000;
      let commutativitySuccessCount = 0;

      for (let i = 0; i < iterations; i++) {
        const id = 'fuzz-item-1';
        // 30% chance of identical millisecond timestamp
        const sameTime = i % 3 === 0;
        const timeA = clock.now();
        const timeB = sameTime ? timeA : clock.now();

        const itemA = createFuzzItem(id, timeA, `Title A ${i}`, i % 2 === 0);
        const itemB = createFuzzItem(id, timeB, `Title B ${i}`, i % 2 !== 0);

        // Distinct device UUIDs (simulating iPhone vs Desktop)
        const tieA = `device-alpha-${i}`;
        const tieB = `device-beta-${i}`;

        const resAB = resolveLWW(itemA, itemB, tieA, tieB);
        const resBA = resolveLWW(itemB, itemA, tieB, tieA);

        // Mathematical Commutativity assertion:
        // The winning record must be identically resolved regardless of parameter order
        expect(resAB.winningRecord).toEqual(resBA.winningRecord);
        expect(resAB.reason).toBe(resBA.reason);

        if (resAB.winner === 'local') {
          expect(resBA.winner).toBe('remote');
        } else if (resAB.winner === 'remote') {
          expect(resBA.winner).toBe('local');
        } else {
          expect(resBA.winner).toBe('equal');
        }

        commutativitySuccessCount++;
      }

      console.log(`[LWW Fuzz] Successfully proved commutativity across ${commutativitySuccessCount} random pairs with distinct device IDs`);
      expect(commutativitySuccessCount).toBe(iterations);
    });

    it('proves commutativity across 5,000 randomized pairs when tie-breakers are omitted (intrinsic JSON hash comparison)', () => {
      const clock = new LamportClock(1700000000000);
      const iterations = 5000;
      let count = 0;

      for (let i = 0; i < iterations; i++) {
        const id = 'fuzz-item-intrinsic';
        const sameTime = i % 3 === 0;
        const timeA = clock.now();
        const timeB = sameTime ? timeA : clock.now();

        const itemA = createFuzzItem(id, timeA, `Title A ${i}`, i % 2 === 0);
        const itemB = createFuzzItem(id, timeB, `Title B ${i}`, i % 2 !== 0);

        // Omit tie-breaker arguments
        const resAB = resolveLWW(itemA, itemB);
        const resBA = resolveLWW(itemB, itemA);

        expect(resAB.winningRecord).toEqual(resBA.winningRecord);
        count++;
      }

      console.log(`[LWW Fuzz] Successfully proved intrinsic commutativity across ${count} random pairs`);
      expect(count).toBe(iterations);
    });

    it('proves commutativity even when tie-breaker strings are identical across 2,000 randomized pairs', () => {
      const clock = new LamportClock(1700000000000);
      const iterations = 2000;
      let identicalTieSuccessCount = 0;

      for (let i = 0; i < iterations; i++) {
        const id = `item-dup-tie-${i}`;
        const sameTime = i % 2 === 0;
        const timeA = clock.now();
        const timeB = sameTime ? timeA : clock.now();

        const itemA = createFuzzItem(id, timeA, `Title Alpha ${i}`, i % 2 === 0);
        const itemB = createFuzzItem(id, timeB, `Title Beta ${i}`, i % 2 !== 0);

        // When identical tie-breakers are passed (e.g. both using user_id or empty string):
        const identicalTie = 'user-shared-id-12345';
        const resAB = resolveLWW(itemA, itemB, identicalTie, identicalTie);
        const resBA = resolveLWW(itemB, itemA, identicalTie, identicalTie);

        // Tertiary content hash comparison guarantees commutativity:
        expect(resAB.winningRecord).toEqual(resBA.winningRecord);
        expect(resAB.reason).toBe(resBA.reason);

        if (resAB.winner === 'local') {
          expect(resBA.winner).toBe('remote');
        } else if (resAB.winner === 'remote') {
          expect(resBA.winner).toBe('local');
        } else {
          expect(resBA.winner).toBe('equal');
        }

        identicalTieSuccessCount++;
      }

      console.log(`[LWW Fuzz] Successfully proved commutativity across ${identicalTieSuccessCount} pairs with identical tie-breakers`);
      expect(identicalTieSuccessCount).toBe(iterations);
    });

    it('proves associativity across 2,000 random triples and 6-permutation convergence', () => {
      const clock = new LamportClock(1700000000000);
      const iterations = 2000;
      let associativitySuccessCount = 0;

      for (let i = 0; i < iterations; i++) {
        const id = 'fuzz-assoc-1';
        const tA = clock.now();
        const tB = i % 4 === 0 ? tA : clock.now();
        const tC = i % 5 === 0 ? tB : clock.now();

        const itemA = createFuzzItem(id, tA, `Version A ${i}`, false);
        const itemB = createFuzzItem(id, tB, `Version B ${i}`, true);
        const itemC = createFuzzItem(id, tC, `Version C ${i}`, false);

        const tieA = `client-A-${i % 100}`;
        const tieB = `client-B-${(i + 1) % 100}`;
        const tieC = `client-C-${(i + 2) % 100}`;

        // Grouping 1: (A merge B) merge C
        const ab = resolveLWW(itemA, itemB, tieA, tieB);
        const tieAB = ab.winner === 'local' ? tieA : tieB;
        const res_AB_C = resolveLWW(ab.winningRecord, itemC, tieAB, tieC);

        // Grouping 2: A merge (B merge C)
        const bc = resolveLWW(itemB, itemC, tieB, tieC);
        const tieBC = bc.winner === 'local' ? tieB : tieC;
        const res_A_BC = resolveLWW(itemA, bc.winningRecord, tieA, tieBC);

        // Associativity assertion: (A * B) * C === A * (B * C)
        expect(res_AB_C.winningRecord).toEqual(res_A_BC.winningRecord);

        // Permutation convergence: all 6 permutations must arrive at identical winning record
        const perms: Array<[ChecklistItem, string]> = [
          [itemA, tieA],
          [itemB, tieB],
          [itemC, tieC],
        ];

        const permOrders = [
          [0, 1, 2],
          [0, 2, 1],
          [1, 0, 2],
          [1, 2, 0],
          [2, 0, 1],
          [2, 1, 0],
        ];

        const winningResults: ChecklistItem[] = [];
        for (const [p1, p2, p3] of permOrders) {
          const [first, tie1] = perms[p1!]!;
          const [second, tie2] = perms[p2!]!;
          const [third, tie3] = perms[p3!]!;

          const r12 = resolveLWW(first, second, tie1, tie2);
          const tie12 = r12.winner === 'local' ? tie1 : tie2;
          const r123 = resolveLWW(r12.winningRecord, third, tie12, tie3);
          winningResults.push(r123.winningRecord);
        }

        // Assert all 6 permutations produce identical winner
        const expectedWinner = winningResults[0]!;
        for (let p = 1; p < winningResults.length; p++) {
          expect(winningResults[p]).toEqual(expectedWinner);
        }

        associativitySuccessCount++;
      }

      console.log(`[LWW Fuzz] Successfully proved associativity and 6-permutation convergence across ${associativitySuccessCount} random triples`);
      expect(associativitySuccessCount).toBe(iterations);
    });
  });

  // =========================================================================
  // SUITE 3: Soft-Delete Tombstone Precedence
  // =========================================================================
  describe('3. Soft-Delete Tombstone Precedence & Non-Resurrection', () => {
    beforeEach(async () => {
      await db.checklist_items.clear();
      await db.outbox_mutations.clear();
    });

    it('asserts older edits never resurrect a record deleted with a later timestamp across 1,000 cases', () => {
      const clock = new LamportClock(1700000000000);

      for (let i = 0; i < 1000; i++) {
        const id = `item-tombstone-${i}`;
        const editTime = clock.now();
        const deleteTime = clock.now(); // strictly greater than editTime

        const olderEdit: ChecklistItem = {
          id,
          user_id: 'user-1',
          list_type: 'today_morning',
          title: `Active Edit at ${editTime}`,
          sort_order: 1000.0,
          is_completed: true,
          completed_at: editTime,
          last_completed_day: '2026-10-18',
          created_at: editTime,
          updated_at: editTime,
          deleted_at: null, // Attempted active state
        };

        const tombstone: ChecklistItem = {
          id,
          user_id: 'user-1',
          list_type: 'today_morning',
          title: `Deleted Item`,
          sort_order: 1000.0,
          is_completed: false,
          completed_at: null,
          last_completed_day: null,
          created_at: editTime,
          updated_at: deleteTime,
          deleted_at: deleteTime, // Soft delete tombstone
        };

        // Resolution in both directions
        const res1 = resolveLWW(olderEdit, tombstone);
        expect(res1.winner).toBe('remote');
        expect(res1.winningRecord.deleted_at).toBe(deleteTime);

        const res2 = resolveLWW(tombstone, olderEdit);
        expect(res2.winner).toBe('local');
        expect(res2.winningRecord.deleted_at).toBe(deleteTime);
      }
    });

    it('proves repository mutation methods reject resurrecting soft-deleted items', async () => {
      const item = await checklistRepository.addItem('today_morning', 'Habit to delete');
      const deleteResult = await checklistRepository.softDeleteItem(item.id);
      expect(deleteResult).toBe(true);

      const dbRecord = await db.checklist_items.get(item.id);
      expect(dbRecord?.deleted_at).toBeTruthy();
      const originalDeletedAt = dbRecord?.deleted_at;

      // Attempting toggle on soft-deleted item must return null and keep tombstone intact
      const toggleAttempt = await checklistRepository.toggleItem(item.id, '2026-10-18');
      expect(toggleAttempt).toBeNull();

      // Attempting rename on soft-deleted item must return null
      const renameAttempt = await checklistRepository.renameItem(item.id, 'Resurrected title');
      expect(renameAttempt).toBeNull();

      // Attempting reorder on soft-deleted item must return null
      const reorderAttempt = await checklistRepository.reorderItem(item.id, 5000.0);
      expect(reorderAttempt).toBeNull();

      // Attempting second delete must return false
      const secondDeleteAttempt = await checklistRepository.softDeleteItem(item.id);
      expect(secondDeleteAttempt).toBe(false);

      // Verify DB record is untouched and still deleted
      const finalDbRecord = await db.checklist_items.get(item.id);
      expect(finalDbRecord?.deleted_at).toBe(originalDeletedAt);
      expect(finalDbRecord?.title).toBe('Habit to delete');

      // Verify active queries exclude the soft-deleted item
      const activeMorning = await checklistRepository.getActiveItems('today_morning');
      expect(activeMorning.some((i) => i.id === item.id)).toBe(false);

      const allActive = await checklistRepository.getAllActiveItems();
      expect(allActive.some((i) => i.id === item.id)).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Dexie Atomic Transactions & Outbox Invariants
  // =========================================================================
  describe('4. Dexie Atomic Transactions & Outbox Mutation Invariants', () => {
    beforeEach(async () => {
      await db.checklist_items.clear();
      await db.goals.clear();
      await db.user_settings.clear();
      await db.outbox_mutations.clear();
    });

    it('asserts every single repository mutation enqueues exactly one corresponding outbox record', async () => {
      expect(await db.outbox_mutations.count()).toBe(0);

      // 1. addItem
      const item = await checklistRepository.addItem('today_morning', 'Task 1');
      expect(await db.outbox_mutations.count()).toBe(1);
      const m1 = await db.outbox_mutations.orderBy('id').last();
      expect(m1?.table_name).toBe('checklist_items');
      expect(m1?.record_id).toBe(item.id);
      expect(m1?.action).toBe('upsert');
      expect((m1?.payload as ChecklistItem).title).toBe('Task 1');

      // 2. toggleItem
      const toggled = await checklistRepository.toggleItem(item.id, '2026-10-18');
      expect(toggled).not.toBeNull();
      expect(await db.outbox_mutations.count()).toBe(2);
      const m2 = await db.outbox_mutations.orderBy('id').last();
      expect(m2?.table_name).toBe('checklist_items');
      expect(m2?.record_id).toBe(item.id);
      expect(m2?.action).toBe('upsert');
      expect((m2?.payload as ChecklistItem).is_completed).toBe(true);

      // 3. renameItem
      const renamed = await checklistRepository.renameItem(item.id, 'Task 1 Renamed');
      expect(renamed).not.toBeNull();
      expect(await db.outbox_mutations.count()).toBe(3);
      const m3 = await db.outbox_mutations.orderBy('id').last();
      expect(m3?.table_name).toBe('checklist_items');
      expect(m3?.record_id).toBe(item.id);
      expect(m3?.action).toBe('upsert');
      expect((m3?.payload as ChecklistItem).title).toBe('Task 1 Renamed');

      // 4. reorderItem
      const reordered = await checklistRepository.reorderItem(item.id, 4500.0);
      expect(reordered).not.toBeNull();
      expect(await db.outbox_mutations.count()).toBe(4);
      const m4 = await db.outbox_mutations.orderBy('id').last();
      expect(m4?.table_name).toBe('checklist_items');
      expect(m4?.record_id).toBe(item.id);
      expect(m4?.action).toBe('upsert');
      expect((m4?.payload as ChecklistItem).sort_order).toBe(4500.0);

      // 5. softDeleteItem
      const deleted = await checklistRepository.softDeleteItem(item.id);
      expect(deleted).toBe(true);
      expect(await db.outbox_mutations.count()).toBe(5);
      const m5 = await db.outbox_mutations.orderBy('id').last();
      expect(m5?.table_name).toBe('checklist_items');
      expect(m5?.record_id).toBe(item.id);
      expect(m5?.action).toBe('delete');
      expect((m5?.payload as ChecklistItem).deleted_at).toBeTruthy();

      // 6. upsertGoal
      const goal = await checklistRepository.upsertGoal('Ship Cadence App', '2026-12-31');
      expect(await db.outbox_mutations.count()).toBe(6);
      const m6 = await db.outbox_mutations.orderBy('id').last();
      expect(m6?.table_name).toBe('goals');
      expect(m6?.record_id).toBe(goal.id);
      expect(m6?.action).toBe('upsert');
      expect((m6?.payload as Goal).statement).toBe('Ship Cadence App');

      // 7. updateUserSettings
      const settings = await checklistRepository.updateUserSettings(5);
      expect(await db.outbox_mutations.count()).toBe(7);
      const m7 = await db.outbox_mutations.orderBy('id').last();
      expect(m7?.table_name).toBe('user_settings');
      expect(m7?.record_id).toBe(settings.user_id);
      expect(m7?.action).toBe('upsert');
      expect((m7?.payload as UserSettings).rollover_hour).toBe(5);

      // Verify complete sequence integrity
      const allMutations = await db.outbox_mutations.toArray();
      expect(allMutations.length).toBe(7);
      const firstId = allMutations[0]!.id!;
      for (let i = 0; i < allMutations.length; i++) {
        expect(allMutations[i]?.id).toBe(firstId + i);
        expect(allMutations[i]?.retry_count).toBe(0);
        expect(typeof allMutations[i]?.timestamp).toBe('number');
      }
    });

    it('proves transactional rollback when a mutation fails mid-transaction', async () => {
      const initialItemCount = await db.checklist_items.count();
      const initialOutboxCount = await db.outbox_mutations.count();

      const failingOperation = async () => {
        await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
          const testItem: ChecklistItem = {
            id: 'rollback-item-1',
            user_id: 'user-local',
            list_type: 'today_morning',
            title: 'Will Rollback',
            sort_order: 1000.0,
            is_completed: false,
            completed_at: null,
            last_completed_day: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          };

          await db.checklist_items.put(testItem);
          await db.outbox_mutations.add({
            table_name: 'checklist_items',
            record_id: testItem.id,
            action: 'upsert',
            payload: testItem,
            timestamp: Date.now(),
            retry_count: 0,
          });

          // Simulate mid-transaction unexpected failure
          throw new Error('Simulated atomic transaction failure');
        });
      };

      await expect(failingOperation()).rejects.toThrow('Simulated atomic transaction failure');

      // Assert rollback: neither item nor outbox record was written
      expect(await db.checklist_items.count()).toBe(initialItemCount);
      expect(await db.outbox_mutations.count()).toBe(initialOutboxCount);
      expect(await db.checklist_items.get('rollback-item-1')).toBeUndefined();
    });

    it('maintains 1:1 outbox parity under 50 concurrent parallel mutations', async () => {
      const concurrency = 50;
      const promises: Promise<ChecklistItem>[] = [];

      for (let i = 0; i < concurrency; i++) {
        promises.push(checklistRepository.addItem('today_work', `Concurrent Item ${i}`));
      }

      const createdItems = await Promise.all(promises);

      expect(createdItems.length).toBe(concurrency);
      expect(await db.checklist_items.count()).toBe(concurrency);
      expect(await db.outbox_mutations.count()).toBe(concurrency);

      const allOutbox = await db.outbox_mutations.toArray();
      const outboxRecordIds = new Set(allOutbox.map((m) => m.record_id));
      const createdItemIds = new Set(createdItems.map((item) => item.id));

      expect(outboxRecordIds.size).toBe(concurrency);
      expect(createdItemIds.size).toBe(concurrency);

      // Verify every created item has an outbox entry
      for (const item of createdItems) {
        expect(outboxRecordIds.has(item.id)).toBe(true);
      }
    });
  });

  // =========================================================================
  // SUITE 5: Clear Completed Work Items Exactness
  // =========================================================================
  describe('5. Clear Completed Work Items Exactness & Boundary Isolation', () => {
    beforeEach(async () => {
      await db.checklist_items.clear();
      await db.outbox_mutations.clear();
    });

    it('marks all completed work items with deleted_at while leaving unchecked and daily routine items completely untouched', async () => {
      // 1. Setup Work Items: 5 completed, 5 uncompleted
      const workCompletedIds: string[] = [];
      const workUncheckedIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const item = await checklistRepository.addItem('work', `Work Completed ${i}`);
        await checklistRepository.toggleItem(item.id, '2026-10-18');
        workCompletedIds.push(item.id);
      }

      for (let i = 0; i < 5; i++) {
        const item = await checklistRepository.addItem('work', `Work Unchecked ${i}`);
        workUncheckedIds.push(item.id);
      }

      // 2. Setup Today Routine Items:
      // Morning: 3 completed, 3 uncompleted
      const morningCompletedIds: string[] = [];
      const morningUncheckedIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const item = await checklistRepository.addItem('today_morning', `Morning Completed ${i}`);
        await checklistRepository.toggleItem(item.id, '2026-10-18');
        morningCompletedIds.push(item.id);
      }
      for (let i = 0; i < 3; i++) {
        const item = await checklistRepository.addItem('today_morning', `Morning Unchecked ${i}`);
        morningUncheckedIds.push(item.id);
      }

      // Evening: 4 completed
      const eveningCompletedIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const item = await checklistRepository.addItem('today_evening', `Evening Completed ${i}`);
        await checklistRepository.toggleItem(item.id, '2026-10-18');
        eveningCompletedIds.push(item.id);
      }

      // Snapshot pre-state of untouched items
      const preUncheckedWork = await Promise.all(workUncheckedIds.map((id) => db.checklist_items.get(id)));
      const preMorningCompleted = await Promise.all(morningCompletedIds.map((id) => db.checklist_items.get(id)));
      const preMorningUnchecked = await Promise.all(morningUncheckedIds.map((id) => db.checklist_items.get(id)));
      const preEveningCompleted = await Promise.all(eveningCompletedIds.map((id) => db.checklist_items.get(id)));

      // Clear outbox to measure only mutations emitted by clearCompletedWorkItems
      await db.outbox_mutations.clear();
      expect(await db.outbox_mutations.count()).toBe(0);

      // Execute clearCompletedWorkItems
      const clearedCount = await checklistRepository.clearCompletedWorkItems();

      // Assert exactly 5 items were cleared
      expect(clearedCount).toBe(5);

      // Assert exactly 5 outbox mutations were generated with action 'delete'
      const clearMutations = await db.outbox_mutations.toArray();
      expect(clearMutations.length).toBe(5);
      const mutatedRecordIds = new Set(clearMutations.map((m) => m.record_id));

      for (const m of clearMutations) {
        expect(m.table_name).toBe('checklist_items');
        expect(m.action).toBe('delete');
        expect((m.payload as ChecklistItem).deleted_at).toBeTruthy();
      }

      // Verify all 5 completed work items now have deleted_at set in DB
      for (const id of workCompletedIds) {
        const item = await db.checklist_items.get(id);
        expect(item).toBeDefined();
        expect(item?.deleted_at).toBeTruthy();
        expect(mutatedRecordIds.has(id)).toBe(true);
      }

      // Verify all 5 unchecked work items are COMPLETELY UNTOUCHED
      for (let i = 0; i < workUncheckedIds.length; i++) {
        const id = workUncheckedIds[i]!;
        const current = await db.checklist_items.get(id);
        const original = preUncheckedWork[i]!;

        expect(current).toBeDefined();
        expect(current?.deleted_at).toBeNull();
        expect(current?.is_completed).toBe(false);
        expect(current).toEqual(original);
        expect(mutatedRecordIds.has(id)).toBe(false);
      }

      // Verify Morning completed items are COMPLETELY UNTOUCHED
      for (let i = 0; i < morningCompletedIds.length; i++) {
        const id = morningCompletedIds[i]!;
        const current = await db.checklist_items.get(id);
        const original = preMorningCompleted[i]!;

        expect(current).toBeDefined();
        expect(current?.deleted_at).toBeNull();
        expect(current?.is_completed).toBe(true);
        expect(current).toEqual(original);
        expect(mutatedRecordIds.has(id)).toBe(false);
      }

      // Verify Morning unchecked items are COMPLETELY UNTOUCHED
      for (let i = 0; i < morningUncheckedIds.length; i++) {
        const id = morningUncheckedIds[i]!;
        const current = await db.checklist_items.get(id);
        const original = preMorningUnchecked[i]!;

        expect(current).toBeDefined();
        expect(current?.deleted_at).toBeNull();
        expect(current?.is_completed).toBe(false);
        expect(current).toEqual(original);
        expect(mutatedRecordIds.has(id)).toBe(false);
      }

      // Verify Evening completed items are COMPLETELY UNTOUCHED
      for (let i = 0; i < eveningCompletedIds.length; i++) {
        const id = eveningCompletedIds[i]!;
        const current = await db.checklist_items.get(id);
        const original = preEveningCompleted[i]!;

        expect(current).toBeDefined();
        expect(current?.deleted_at).toBeNull();
        expect(current?.is_completed).toBe(true);
        expect(current).toEqual(original);
        expect(mutatedRecordIds.has(id)).toBe(false);
      }

      // Verify getActiveItems('work') returns ONLY the 5 unchecked items
      const activeWork = await checklistRepository.getActiveItems('work');
      expect(activeWork.length).toBe(5);
      expect(activeWork.map((i) => i.id).sort()).toEqual([...workUncheckedIds].sort());

      // Idempotency: Running clearCompletedWorkItems again must return 0 and emit 0 mutations
      const secondClearedCount = await checklistRepository.clearCompletedWorkItems();
      expect(secondClearedCount).toBe(0);
      expect(await db.outbox_mutations.count()).toBe(5); // No extra mutations
    });
  });
});
