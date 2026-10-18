/**
 * src/db/repository.test.ts
 * Unit tests verifying Dexie CRUD, soft deletes, atomic outbox mutations, and fractional reordering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';
import { checklistRepository, calculateNewSortOrder } from './repository';

describe('Fractional Indexing Sort Order', () => {
  it('returns 1000.0 for initial empty list insertion', () => {
    expect(calculateNewSortOrder(null, null)).toBe(1000.0);
  });

  it('calculates midpoint when prepending before the first item', () => {
    expect(calculateNewSortOrder(null, 1000.0)).toBe(500.0);
  });

  it('calculates increment when appending after the last item', () => {
    expect(calculateNewSortOrder(2000.0, null)).toBe(3000.0);
  });

  it('calculates exact midpoint between two items', () => {
    expect(calculateNewSortOrder(1000.0, 2000.0)).toBe(1500.0);
    expect(calculateNewSortOrder(1500.0, 2000.0)).toBe(1750.0);
  });

  it('prevents collision when prevOrder >= nextOrder by incrementing prevOrder', () => {
    expect(calculateNewSortOrder(1000.0, 1000.0)).toBe(1001.0);
    expect(calculateNewSortOrder(1500.0, 1000.0)).toBe(1501.0);
  });
});

describe('Checklist Repository Operations', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.goals.clear();
    await db.user_settings.clear();
    await db.outbox_mutations.clear();
  });

  it('adds items with incrementing sort orders and enqueues outbox mutations', async () => {
    const item1 = await checklistRepository.addItem('today_morning', 'First Habit');
    expect(item1.title).toBe('First Habit');
    expect(item1.sort_order).toBe(1000.0);
    expect(item1.list_type).toBe('today_morning');

    const item2 = await checklistRepository.addItem('today_morning', 'Second Habit');
    expect(item2.title).toBe('Second Habit');
    expect(item2.sort_order).toBe(2000.0);

    const active = await checklistRepository.getActiveItems('today_morning');
    expect(active.length).toBe(2);
    expect(active[0]?.id).toBe(item1.id);
    expect(active[1]?.id).toBe(item2.id);

    // Verify atomic outbox records
    const outbox = await db.outbox_mutations.toArray();
    expect(outbox.length).toBe(2);
    expect(outbox[0]?.action).toBe('upsert');
    expect(outbox[0]?.record_id).toBe(item1.id);
    expect(outbox[1]?.record_id).toBe(item2.id);
  });

  it('rejects adding an item with empty or whitespace title', async () => {
    await expect(checklistRepository.addItem('today_morning', '')).rejects.toThrow(
      'Item title cannot be empty'
    );
    await expect(checklistRepository.addItem('today_morning', '   ')).rejects.toThrow(
      'Item title cannot be empty'
    );
  });

  it('toggles item completion for today sections recording logical day', async () => {
    const item = await checklistRepository.addItem('today_morning', 'Drink water');
    expect(item.is_completed).toBe(false);

    // Toggle to completed
    const toggled = await checklistRepository.toggleItem(item.id, '2026-10-18');
    expect(toggled?.is_completed).toBe(true);
    expect(toggled?.last_completed_day).toBe('2026-10-18');
    expect(toggled?.completed_at).toBeTruthy();

    // Toggle back to incomplete
    const untoggled = await checklistRepository.toggleItem(item.id, '2026-10-18');
    expect(untoggled?.is_completed).toBe(false);
    expect(untoggled?.last_completed_day).toBeNull();
    expect(untoggled?.completed_at).toBeNull();
  });

  it('toggles item completed yesterday on new day without swallowing the tap', async () => {
    const item = await checklistRepository.addItem('today_morning', 'Morning stretches');
    // Simulate completed on previous logical day
    await checklistRepository.toggleItem(item.id, '2026-10-17');

    // On new logical day 2026-10-18, first click must check it for today
    const toggledToday = await checklistRepository.toggleItem(item.id, '2026-10-18');
    expect(toggledToday?.is_completed).toBe(true);
    expect(toggledToday?.last_completed_day).toBe('2026-10-18');

    // Second click untoggles it
    const untoggledToday = await checklistRepository.toggleItem(item.id, '2026-10-18');
    expect(untoggledToday?.is_completed).toBe(false);
    expect(untoggledToday?.last_completed_day).toBeNull();
  });

  it('toggles item completion for work tab without setting last_completed_day', async () => {
    const item = await checklistRepository.addItem('work', 'Write spec');
    const toggled = await checklistRepository.toggleItem(item.id, '2026-10-18');
    expect(toggled?.is_completed).toBe(true);
    expect(toggled?.last_completed_day).toBeNull();
  });

  it('renames an item and updates outbox', async () => {
    const item = await checklistRepository.addItem('today_work', 'Initial Name');
    const renamed = await checklistRepository.renameItem(item.id, 'Updated Name');
    expect(renamed?.title).toBe('Updated Name');

    const retrieved = await checklistRepository.getActiveItems('today_work');
    expect(retrieved[0]?.title).toBe('Updated Name');
  });

  it('reorders an item using fractional indexing', async () => {
    const item1 = await checklistRepository.addItem('today_evening', 'Read 20 pages');
    const item2 = await checklistRepository.addItem('today_evening', 'Meditate');

    // Move item2 before item1
    const newOrder = calculateNewSortOrder(null, item1.sort_order);
    await checklistRepository.reorderItem(item2.id, newOrder);

    const reordered = await checklistRepository.getActiveItems('today_evening');
    expect(reordered[0]?.id).toBe(item2.id);
    expect(reordered[1]?.id).toBe(item1.id);
  });

  it('soft-deletes an item with tombstone and outbox delete action', async () => {
    const item = await checklistRepository.addItem('today_morning', 'Delete me');
    const deleted = await checklistRepository.softDeleteItem(item.id);
    expect(deleted).toBe(true);

    const active = await checklistRepository.getActiveItems('today_morning');
    expect(active.length).toBe(0);

    const rawInDb = await db.checklist_items.get(item.id);
    expect(rawInDb?.deleted_at).toBeTruthy();

    const deleteMutations = await db.outbox_mutations.filter((m) => m.action === 'delete').toArray();
    expect(deleteMutations.length).toBe(1);
    expect(deleteMutations[0]?.record_id).toBe(item.id);
  });

  it('clears only completed work items in bulk', async () => {
    const item1 = await checklistRepository.addItem('work', 'Task 1 (uncompleted)');
    const item2 = await checklistRepository.addItem('work', 'Task 2 (completed)');
    const item3 = await checklistRepository.addItem('today_morning', 'Morning Routine (completed)');

    await checklistRepository.toggleItem(item2.id, '2026-10-18');
    await checklistRepository.toggleItem(item3.id, '2026-10-18');

    const clearedCount = await checklistRepository.clearCompletedWorkItems();
    expect(clearedCount).toBe(1);

    const activeWork = await checklistRepository.getActiveItems('work');
    expect(activeWork.length).toBe(1);
    expect(activeWork[0]?.id).toBe(item1.id);

    // Morning routine item should still be active and completed
    const activeMorning = await checklistRepository.getActiveItems('today_morning');
    expect(activeMorning.length).toBe(1);
    expect(activeMorning[0]?.is_completed).toBe(true);
  });

  it('resets daily items on rollover without affecting work items', async () => {
    const m1 = await checklistRepository.addItem('today_morning', 'M1');
    const w1 = await checklistRepository.addItem('work', 'W1');

    await checklistRepository.toggleItem(m1.id, '2026-10-17');
    await checklistRepository.toggleItem(w1.id, '2026-10-17');

    const resetCount = await checklistRepository.rolloverDailyItems('2026-10-18');
    expect(resetCount).toBe(1);

    const morningActive = await checklistRepository.getActiveItems('today_morning');
    expect(morningActive[0]?.is_completed).toBe(false);
    expect(morningActive[0]?.last_completed_day).toBeNull();

    const workActive = await checklistRepository.getActiveItems('work');
    expect(workActive[0]?.is_completed).toBe(true);
  });

  it('preserves daily items completed on the current logical day while resetting older items', async () => {
    const mYesterday = await checklistRepository.addItem('today_morning', 'Yesterday Routine');
    const mToday = await checklistRepository.addItem('today_morning', 'Today Routine');
    const w1 = await checklistRepository.addItem('work', 'Work Item');

    // Toggle mYesterday on 2026-10-17 and mToday on 2026-10-18
    await checklistRepository.toggleItem(mYesterday.id, '2026-10-17');
    await checklistRepository.toggleItem(mToday.id, '2026-10-18');
    await checklistRepository.toggleItem(w1.id, '2026-10-17');

    // Rollover for 2026-10-18: mToday was completed on 2026-10-18, so it must NOT be reset
    const resetCount = await checklistRepository.rolloverDailyItems('2026-10-18');
    expect(resetCount).toBe(1); // Only mYesterday is reset

    const morningActive = await checklistRepository.getActiveItems('today_morning');
    const yesterdayStored = morningActive.find((i) => i.id === mYesterday.id);
    const todayStored = morningActive.find((i) => i.id === mToday.id);

    // Yesterday item is reset
    expect(yesterdayStored?.is_completed).toBe(false);
    expect(yesterdayStored?.last_completed_day).toBeNull();

    // Today item is preserved
    expect(todayStored?.is_completed).toBe(true);
    expect(todayStored?.last_completed_day).toBe('2026-10-18');

    // Work item remains untouched and completed
    const workActive = await checklistRepository.getActiveItems('work');
    expect(workActive[0]?.is_completed).toBe(true);
  });

  it('handles goal creation and updates', async () => {
    const initial = await checklistRepository.getGoal();
    expect(initial).toBeNull();

    const created = await checklistRepository.upsertGoal('Ship Cadence', '2026-12-31');
    expect(created.statement).toBe('Ship Cadence');
    expect(created.target_date).toBe('2026-12-31');

    const updated = await checklistRepository.upsertGoal('Ship Cadence v1.0', null);
    expect(updated.statement).toBe('Ship Cadence v1.0');
    expect(updated.target_date).toBeNull();
    expect(updated.id).toBe(created.id); // Same record ID
  });

  it('handles user settings and clamps rollover hour between 0 and 23', async () => {
    const defaultSettings = await checklistRepository.getUserSettings();
    expect(defaultSettings.rollover_hour).toBe(4);

    const updated = await checklistRepository.updateUserSettings(6);
    expect(updated.rollover_hour).toBe(6);

    const clampedHigh = await checklistRepository.updateUserSettings(30);
    expect(clampedHigh.rollover_hour).toBe(23);

    const clampedLow = await checklistRepository.updateUserSettings(-5);
    expect(clampedLow.rollover_hour).toBe(0);
  });
});
