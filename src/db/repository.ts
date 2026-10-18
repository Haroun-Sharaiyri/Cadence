/**
 * src/db/repository.ts
 * Optimistic CRUD operations for checklist items, goals, settings, and outbox mutations.
 * All mutations commit locally in < 16ms with zero loading spinners.
 */

import { db } from './index';
import type { ChecklistItem, ChecklistType, Goal, UserSettings } from '../domain/types';
import { lamportClock } from '../domain/lww';
import { isItemCheckedToday } from '../domain/rollover';

/**
 * Safe RFC4122 v4 UUID generator with fallback for non-secure HTTP contexts
 * (e.g. accessing via local network IP on mobile).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculates a new sort order using fractional indexing.
 */
export function calculateNewSortOrder(
  prevOrder: number | null,
  nextOrder: number | null
): number {
  if (prevOrder === null && nextOrder === null) {
    return 1000.0;
  }
  if (prevOrder === null && nextOrder !== null) {
    return nextOrder / 2.0;
  }
  if (prevOrder !== null && nextOrder === null) {
    return prevOrder + 1000.0;
  }
  if (prevOrder !== null && nextOrder !== null) {
    if (prevOrder >= nextOrder) {
      return prevOrder + 1.0;
    }
    return (prevOrder + nextOrder) / 2.0;
  }
  return 1000.0;
}

export const checklistRepository = {
  /**
   * Fetches all active (non-soft-deleted) items for a given list type, ordered by sort_order.
   */
  async getActiveItems(listType?: ChecklistType): Promise<ChecklistItem[]> {
    let collection = db.checklist_items.filter((item) => item.deleted_at === null);
    if (listType) {
      collection = collection.filter((item) => item.list_type === listType);
    }
    const items = await collection.toArray();
    return items.sort((a, b) => a.sort_order - b.sort_order);
  },

  /**
   * Fetches all active (non-soft-deleted) items across all lists.
   */
  async getAllActiveItems(): Promise<ChecklistItem[]> {
    const items = await db.checklist_items
      .filter((item) => item.deleted_at === null)
      .toArray();
    return items.sort((a, b) => a.sort_order - b.sort_order);
  },

  /**
   * Optimistically creates a new checklist item with fractional sort_order.
   * Atomically commits to checklist_items and enqueues to outbox_mutations.
   */
  async addItem(listType: ChecklistType, title: string, userId: string = 'local'): Promise<ChecklistItem> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('Item title cannot be empty');
    }

    const now = lamportClock.now();
    const existing = await this.getActiveItems(listType);
    const maxOrder = existing.length > 0 ? (existing[existing.length - 1]?.sort_order ?? 0) : 0;
    const sort_order = maxOrder + 1000.0;

    const newItem: ChecklistItem = {
      id: generateUUID(),
      user_id: userId,
      list_type: listType,
      title: trimmedTitle,
      sort_order,
      is_completed: false,
      completed_at: null,
      last_completed_day: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      await db.checklist_items.put(newItem);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: newItem.id,
        action: 'upsert',
        payload: newItem,
        timestamp: Date.now(),
        retry_count: 0,
      });
    });

    return newItem;
  },

  /**
   * Optimistically toggles an item's completion status.
   * Daily routine items set last_completed_day = currentLogicalDay; Work items do not.
   */
  async toggleItem(id: string, currentLogicalDay: string): Promise<ChecklistItem | null> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const existing = await db.checklist_items.get(id);
      if (!existing || existing.deleted_at !== null) return null;

      const currentlyCompleted = isItemCheckedToday(existing, currentLogicalDay);
      const isCompleted = !currentlyCompleted;
      const updated: ChecklistItem = {
        ...existing,
        is_completed: isCompleted,
        completed_at: isCompleted ? now : null,
        last_completed_day: isCompleted
          ? existing.list_type === 'work'
            ? null
            : currentLogicalDay
          : null,
        updated_at: now,
      };

      await db.checklist_items.put(updated);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: updated.id,
        action: 'upsert',
        payload: updated,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return updated;
    });
  },

  /**
   * Optimistically renames an item inline.
   */
  async renameItem(id: string, newTitle: string): Promise<ChecklistItem | null> {
    const trimmed = newTitle.trim();
    if (!trimmed) return null;

    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const existing = await db.checklist_items.get(id);
      if (!existing || existing.deleted_at !== null) return null;

      const updated: ChecklistItem = {
        ...existing,
        title: trimmed,
        updated_at: now,
      };

      await db.checklist_items.put(updated);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: updated.id,
        action: 'upsert',
        payload: updated,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return updated;
    });
  },

  /**
   * Optimistically updates an item's fractional sort order.
   */
  async reorderItem(id: string, newSortOrder: number): Promise<ChecklistItem | null> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const existing = await db.checklist_items.get(id);
      if (!existing || existing.deleted_at !== null) return null;

      const updated: ChecklistItem = {
        ...existing,
        sort_order: newSortOrder,
        updated_at: now,
      };

      await db.checklist_items.put(updated);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: updated.id,
        action: 'upsert',
        payload: updated,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return updated;
    });
  },

  /**
   * Soft-deletes an item by setting deleted_at = monotonicNow().
   */
  async softDeleteItem(id: string): Promise<boolean> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const existing = await db.checklist_items.get(id);
      if (!existing || existing.deleted_at !== null) return false;

      const deletedRecord: ChecklistItem = {
        ...existing,
        deleted_at: now,
        updated_at: now,
      };

      await db.checklist_items.put(deletedRecord);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: deletedRecord.id,
        action: 'delete',
        payload: deletedRecord,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return true;
    });
  },

  /**
   * "Clear Completed" for Work tab: soft-deletes all completed work items atomically.
   */
  async clearCompletedWorkItems(): Promise<number> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const completedWorkItems = await db.checklist_items
        .filter((item) => item.list_type === 'work' && item.is_completed && item.deleted_at === null)
        .toArray();

      if (completedWorkItems.length === 0) return 0;

      for (const item of completedWorkItems) {
        const deletedRecord: ChecklistItem = {
          ...item,
          deleted_at: now,
          updated_at: now,
        };
        await db.checklist_items.put(deletedRecord);
        await db.outbox_mutations.add({
          table_name: 'checklist_items',
          record_id: item.id,
          action: 'delete',
          payload: deletedRecord,
          timestamp: Date.now(),
          retry_count: 0,
        });
      }

      return completedWorkItems.length;
    });
  },

  /**
   * Executes daily rollover reset in local store:
   * Sets is_completed = false on active Today section items whose last_completed_day is not newLogicalDay.
   */
  async rolloverDailyItems(newLogicalDay: string): Promise<number> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const dailyItems = await db.checklist_items
        .filter(
          (item) =>
            item.list_type !== 'work' &&
            item.deleted_at === null &&
            item.is_completed &&
            item.last_completed_day !== newLogicalDay
        )
        .toArray();

      if (dailyItems.length === 0) return 0;

      for (const item of dailyItems) {
        const resetItem: ChecklistItem = {
          ...item,
          is_completed: false,
          completed_at: null,
          last_completed_day: null,
          updated_at: now,
        };
        await db.checklist_items.put(resetItem);
        await db.outbox_mutations.add({
          table_name: 'checklist_items',
          record_id: item.id,
          action: 'upsert',
          payload: resetItem,
          timestamp: Date.now(),
          retry_count: 0,
        });
      }

      return dailyItems.length;
    });
  },

  /**
   * Fetches the user's active Goal hero card.
   */
  async getGoal(): Promise<Goal | null> {
    const activeGoals = await db.goals
      .filter((g) => g.deleted_at === null)
      .toArray();
    return activeGoals[0] ?? null;
  },

  /**
   * Upserts the user's Goal statement and target countdown date.
   */
  async upsertGoal(statement: string, targetDate: string | null, userId: string = 'local'): Promise<Goal> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.goals, db.outbox_mutations], async () => {
      const existing = await this.getGoal();
      const goal: Goal = {
        id: existing?.id ?? generateUUID(),
        user_id: userId,
        statement: statement.trim(),
        target_date: targetDate && targetDate.trim() ? targetDate.trim() : null,
        updated_at: now,
        deleted_at: null,
      };

      await db.goals.put(goal);
      await db.outbox_mutations.add({
        table_name: 'goals',
        record_id: goal.id,
        action: 'upsert',
        payload: goal,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return goal;
    });
  },

  /**
   * Fetches user settings (or defaults to rollover_hour = 4).
   */
  async getUserSettings(userId: string = 'local'): Promise<UserSettings> {
    const settings = await db.user_settings.get(userId);
    if (settings) return settings;

    const defaultSettings: UserSettings = {
      user_id: userId,
      rollover_hour: 4,
      updated_at: lamportClock.now(),
    };
    await db.user_settings.put(defaultSettings);
    return defaultSettings;
  },

  /**
   * Updates user settings (e.g. rollover_hour).
   */
  async updateUserSettings(rolloverHour: number, userId: string = 'local'): Promise<UserSettings> {
    const h = Math.max(0, Math.min(23, Math.floor(rolloverHour)));
    const now = lamportClock.now();

    return await db.transaction('rw', [db.user_settings, db.outbox_mutations], async () => {
      const settings: UserSettings = {
        user_id: userId,
        rollover_hour: h,
        updated_at: now,
      };

      await db.user_settings.put(settings);
      await db.outbox_mutations.add({
        table_name: 'user_settings',
        record_id: userId,
        action: 'upsert',
        payload: settings,
        timestamp: Date.now(),
        retry_count: 0,
      });

      return settings;
    });
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as { __CADENCE_REPO__?: typeof checklistRepository }).__CADENCE_REPO__ =
    checklistRepository;
}
