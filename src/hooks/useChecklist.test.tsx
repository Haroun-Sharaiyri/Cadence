/**
 * src/hooks/useChecklist.test.tsx
 * Unit tests for useChecklist hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useChecklist } from './useChecklist';
import { db } from '../db';
import { getLogicalDay } from '../domain/rollover';

describe('useChecklist hook', () => {
  beforeEach(async () => {
    await db.checklist_items.clear();
    await db.goals.clear();
    await db.user_settings.clear();
    await db.outbox_mutations.clear();
  });

  it('initializes with empty lists, zero progress, and default settings', async () => {
    let hookResult!: ReturnType<typeof useChecklist>;

    function TestComponent() {
      hookResult = useChecklist();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(hookResult.morningItems).toEqual([]);
    expect(hookResult.todayWorkItems).toEqual([]);
    expect(hookResult.eveningItems).toEqual([]);
    expect(hookResult.workItems).toEqual([]);
    expect(hookResult.goal).toBeNull();
    expect(hookResult.countdown).toBeNull();
    expect(hookResult.dayProgress).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
      isAllCompleted: false,
    });
    expect(hookResult.settings.rollover_hour).toBe(4);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('exposes action methods to add and mutate items', async () => {
    let hookResult!: ReturnType<typeof useChecklist>;

    function TestComponent() {
      hookResult = useChecklist();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      await hookResult.addItem('today_morning', 'Meditate 10 mins');
      // allow useLiveQuery microtasks to flush
      await new Promise((r) => setTimeout(r, 20));
    });

    const activeItems = await db.checklist_items.toArray();
    expect(activeItems.length).toBe(1);
    expect(activeItems[0]?.title).toBe('Meditate 10 mins');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('normalizes daily routine items completed yesterday to unchecked and triggers startup rollover reconciliation', async () => {
    // Seed item completed yesterday
    await db.checklist_items.put({
      id: 'habit-yesterday-1',
      user_id: 'local',
      list_type: 'today_morning',
      title: 'Yesterday Habit',
      sort_order: 1000.0,
      is_completed: true,
      completed_at: '2020-01-01T08:00:00.000Z',
      last_completed_day: '2020-01-01',
      created_at: '2020-01-01T08:00:00.000Z',
      updated_at: '2020-01-01T08:00:00.000Z',
      deleted_at: null,
    });

    let hookResult!: ReturnType<typeof useChecklist>;

    function TestComponent() {
      hookResult = useChecklist();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      for (let i = 0; i < 20; i++) {
        if (hookResult.morningItems.length > 0) break;
        await new Promise((r) => setTimeout(r, 20));
      }
    });

    // Check that derived list normalized is_completed to false
    expect(hookResult.morningItems.length).toBe(1);
    expect(hookResult.morningItems[0]?.is_completed).toBe(false);
    expect(hookResult.morningProgress.completed).toBe(0);
    expect(hookResult.dayProgress.completed).toBe(0);

    // Verify startup rollover reconciliation updated IndexedDB record
    const stored = await db.checklist_items.get('habit-yesterday-1');
    expect(stored?.is_completed).toBe(false);
    expect(stored?.last_completed_day).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('preserves daily routine items completed today on mount/reload', async () => {
    const today = getLogicalDay(new Date(), 4);
    const nowIso = new Date().toISOString();

    // Seed item completed today
    await db.checklist_items.put({
      id: 'habit-today-1',
      user_id: 'local',
      list_type: 'today_morning',
      title: 'Morning Routine Item',
      sort_order: 1000.0,
      is_completed: true,
      completed_at: nowIso,
      last_completed_day: today,
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null,
    });

    let hookResult!: ReturnType<typeof useChecklist>;

    function TestComponent() {
      hookResult = useChecklist();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      for (let i = 0; i < 20; i++) {
        if (hookResult.morningItems.length > 0) break;
        await new Promise((r) => setTimeout(r, 20));
      }
    });

    // Check that derived list retains is_completed as true
    expect(hookResult.morningItems.length).toBe(1);
    expect(hookResult.morningItems[0]?.is_completed).toBe(true);
    expect(hookResult.morningItems[0]?.last_completed_day).toBe(today);
    expect(hookResult.morningProgress.completed).toBe(1);
    expect(hookResult.dayProgress.completed).toBe(1);

    // Verify IndexedDB record was NOT reset by startup rollover reconciliation
    const stored = await db.checklist_items.get('habit-today-1');
    expect(stored?.is_completed).toBe(true);
    expect(stored?.last_completed_day).toBe(today);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
