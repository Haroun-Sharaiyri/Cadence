/**
 * src/hooks/useChecklist.ts
 * Primary reactive hook connecting UI components to local Dexie store and rollover engine.
 */

import { useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { checklistRepository } from '../db/repository';
import { useRollover } from './useRollover';
import { getLogicalDay, isItemCheckedToday } from '../domain/rollover';
import { computeGoalCountdown } from '../domain/countdown';
import type {
  ChecklistItem,
  ChecklistType,
  SectionProgress,
  DayProgress,
  CountdownResult,
} from '../domain/types';

export function useChecklist() {
  // 1. Reactive Dexie queries via useLiveQuery (<16ms, reactive re-render)
  const allItems = useLiveQuery(
    () => db.checklist_items.filter((item) => item.deleted_at === null).toArray(),
    [],
    []
  );

  const goal = useLiveQuery(
    async () => {
      const goals = await db.goals.filter((g) => g.deleted_at === null).toArray();
      return goals[0] ?? null;
    },
    [],
    null
  );

  const settingsRecord = useLiveQuery(
    async () => {
      const all = await db.user_settings.toArray();
      if (all.length === 0) return null;
      return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
    },
    [],
    undefined
  );

  const isSettingsLoaded = settingsRecord !== undefined;
  const settings = settingsRecord ?? { user_id: 'local', rollover_hour: 4, updated_at: '' };

  // 2. Rollover Engine connection
  const handleRolloverCascade = useCallback(
    async (newDay: string) => {
      if (!isSettingsLoaded) return;
      await checklistRepository.rolloverDailyItems(newDay);
    },
    [isSettingsLoaded]
  );

  const { currentLogicalDay, isRollingOver, triggerManualRollover } = useRollover({
    rolloverHour: settings.rollover_hour,
    onRollover: handleRolloverCascade,
  });

  // Reconcile and reset daily routine items on startup or logical day change once settings are loaded
  useEffect(() => {
    if (!isSettingsLoaded) return;
    const effectiveDay = getLogicalDay(new Date(), settings.rollover_hour);
    if (effectiveDay === currentLogicalDay) {
      checklistRepository.rolloverDailyItems(effectiveDay);
    }
  }, [currentLogicalDay, isSettingsLoaded, settings.rollover_hour]);

  // 3. Derived, sectioned lists with dynamic checked evaluation
  const normalizeItem = useCallback(
    (item: ChecklistItem): ChecklistItem => {
      if (item.list_type === 'work') return item;
      return {
        ...item,
        is_completed: isItemCheckedToday(item, currentLogicalDay),
      };
    },
    [currentLogicalDay]
  );

  const morningItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_morning')
      .map(normalizeItem)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems, normalizeItem]);

  const todayWorkItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_work')
      .map(normalizeItem)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems, normalizeItem]);

  const eveningItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_evening')
      .map(normalizeItem)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems, normalizeItem]);

  const workItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'work')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems]);

  // 4. Progress calculations
  const calculateSectionProgress = useCallback(
    (items: ChecklistItem[]): SectionProgress => {
      if (items.length === 0) return { completed: 0, total: 0, percent: 0 };
      const completed = items.filter((item) => isItemCheckedToday(item, currentLogicalDay)).length;
      return {
        completed,
        total: items.length,
        percent: Math.round((completed / items.length) * 100),
      };
    },
    [currentLogicalDay]
  );

  const morningProgress = useMemo(() => calculateSectionProgress(morningItems), [morningItems, calculateSectionProgress]);
  const todayWorkProgress = useMemo(() => calculateSectionProgress(todayWorkItems), [todayWorkItems, calculateSectionProgress]);
  const eveningProgress = useMemo(() => calculateSectionProgress(eveningItems), [eveningItems, calculateSectionProgress]);

  const dayProgress: DayProgress = useMemo(() => {
    const total = morningItems.length + todayWorkItems.length + eveningItems.length;
    if (total === 0) return { completed: 0, total: 0, percent: 0, isAllCompleted: false };
    const completed =
      morningProgress.completed + todayWorkProgress.completed + eveningProgress.completed;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
      isAllCompleted: completed === total && total > 0,
    };
  }, [morningItems, todayWorkItems, eveningItems, morningProgress, todayWorkProgress, eveningProgress]);

  const completedWorkCount = useMemo(() => {
    return workItems.filter((i) => i.is_completed).length;
  }, [workItems]);

  // 5. Goal Countdown
  const countdown: CountdownResult | null = useMemo(() => {
    return computeGoalCountdown(goal?.target_date, currentLogicalDay);
  }, [goal?.target_date, currentLogicalDay]);

  // 6. Action wrappers
  const addItem = useCallback(
    async (listType: ChecklistType, title: string) => {
      return await checklistRepository.addItem(listType, title);
    },
    []
  );

  const toggleItem = useCallback(
    async (id: string) => {
      return await checklistRepository.toggleItem(id, currentLogicalDay);
    },
    [currentLogicalDay]
  );

  const renameItem = useCallback(
    async (id: string, newTitle: string) => {
      return await checklistRepository.renameItem(id, newTitle);
    },
    []
  );

  const reorderItem = useCallback(
    async (id: string, newSortOrder: number) => {
      return await checklistRepository.reorderItem(id, newSortOrder);
    },
    []
  );

  const deleteItem = useCallback(
    async (id: string) => {
      return await checklistRepository.softDeleteItem(id);
    },
    []
  );

  const clearCompletedWork = useCallback(async () => {
    return await checklistRepository.clearCompletedWorkItems();
  }, []);

  const updateGoal = useCallback(
    async (statement: string, targetDate: string | null) => {
      return await checklistRepository.upsertGoal(statement, targetDate);
    },
    []
  );

  const setRolloverHour = useCallback(
    async (hour: number) => {
      return await checklistRepository.updateUserSettings(hour);
    },
    []
  );

  return {
    // State
    currentLogicalDay,
    isRollingOver,
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

    // Actions
    addItem,
    toggleItem,
    renameItem,
    reorderItem,
    deleteItem,
    clearCompletedWork,
    updateGoal,
    setRolloverHour,
    triggerManualRollover,
  };
}
