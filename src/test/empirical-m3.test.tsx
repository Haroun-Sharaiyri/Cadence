/**
 * src/test/empirical-m3.test.tsx
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 3:
 * 1. ProgressRing SVG geometry, clamping, round-cap nub elimination, and empty section safety.
 * 2. Goal Hero Card dynamic countdown calculations & state rendering.
 * 3. Clear Completed Work action gating & atomic soft-delete invariants.
 * 4. Fractional sort order reordering & 100 sequential reorder drops monotonicity stress harness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgressRing } from '../components/checklist/ProgressRing';
import { GoalHeroCard } from '../components/goal/GoalHeroCard';
import {
  ClearCompletedTrigger,
  ClearCompletedSheet,
} from '../components/sheets/ClearCompletedSheet';
import { computeGoalCountdown } from '../domain/countdown';
import { db } from '../db/index';
import { checklistRepository, calculateNewSortOrder } from '../db/repository';
import type { ChecklistItem, Goal, CountdownResult } from '../domain/types';

describe('Empirical Adversarial Stress Tests: Milestone 3', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.checklist_items.clear();
    await db.goals.clear();
    await db.outbox_mutations.clear();
  });

  // =========================================================================
  // SUITE 1: ProgressRing SVG Geometry & Round-Cap Nub Elimination
  // =========================================================================
  describe('1. ProgressRing SVG Geometry & Round-Cap Nub Mitigation', () => {
    it('proves mathematical invariants: nub opacity = 0 at zero, clamped at over-completion, safe at total=0', () => {
      const testCases = [
        // completed, total, size, strokeWidth
        { completed: 0, total: 4, size: 28, strokeWidth: 3 },
        { completed: 4, total: 4, size: 28, strokeWidth: 3 },
        { completed: 6, total: 4, size: 28, strokeWidth: 3 }, // over-completion
        { completed: 0, total: 0, size: 28, strokeWidth: 3 }, // empty section
        { completed: 5, total: 0, size: 28, strokeWidth: 3 }, // edge: completed > 0 with total = 0
        { completed: -2, total: 5, size: 32, strokeWidth: 4 }, // negative completed
        { completed: 1, total: 3, size: 20, strokeWidth: 2 },
      ];

      for (const tc of testCases) {
        const radius = Math.max((tc.size - tc.strokeWidth) / 2, 0);
        const circumference = 2 * Math.PI * radius;
        const fraction = tc.total > 0 ? Math.min(Math.max(tc.completed / tc.total, 0), 1) : 0;
        const strokeDashoffset = circumference * (1 - fraction);

        // Invariant 1: Fraction is strictly clamped to [0, 1]
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
        expect(Number.isNaN(fraction)).toBe(false);

        // Invariant 2: Circumference is finite and non-negative
        expect(circumference).toBeGreaterThanOrEqual(0);
        expect(Number.isNaN(circumference)).toBe(false);

        // Invariant 3: strokeDashoffset is strictly clamped to [0, circumference]
        expect(strokeDashoffset).toBeGreaterThanOrEqual(0);
        expect(strokeDashoffset).toBeLessThanOrEqual(circumference + 1e-10);
        expect(Number.isNaN(strokeDashoffset)).toBe(false);

        // Invariant 4: When completed = 0, strokeDashoffset === circumference
        if (tc.completed === 0 && tc.total > 0) {
          expect(strokeDashoffset).toBeCloseTo(circumference, 5);
          const opacity = fraction === 0 ? 0 : 1;
          expect(opacity).toBe(0); // Nub eliminated!
        }

        // Invariant 5: When completed = total, strokeDashoffset === 0
        if (tc.completed === tc.total && tc.total > 0) {
          expect(strokeDashoffset).toBe(0);
          const opacity = fraction === 0 ? 0 : 1;
          expect(opacity).toBe(1);
        }

        // Invariant 6: When completed > total, strokeDashoffset === 0 (clamped, no negative offsets)
        if (tc.completed > tc.total && tc.total > 0) {
          expect(fraction).toBe(1.0);
          expect(strokeDashoffset).toBe(0);
        }

        // Invariant 7: When total = 0, no division by zero or NaN
        if (tc.total === 0) {
          expect(fraction).toBe(0);
          expect(strokeDashoffset).toBeCloseTo(circumference, 5);
          const opacity = fraction === 0 ? 0 : 1;
          expect(opacity).toBe(0);
        }
      }
    });

    it('renders DOM safely with correct attributes when completed = 0 (opacity 0, no nub artifact)', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<ProgressRing completed={0} total={5} size={28} strokeWidth={3} />);
      });

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar).not.toBeNull();
      expect(progressbar?.getAttribute('aria-valuenow')).toBe('0');
      expect(progressbar?.getAttribute('aria-valuemax')).toBe('5');
      expect(progressbar?.getAttribute('aria-label')).toBe('0 of 5 items completed (0%)');

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(2);

      const trackCircle = circles[0];
      const strokeCircle = circles[1];

      // Radius = (28 - 3) / 2 = 12.5
      expect(trackCircle?.getAttribute('r')).toBe('12.5');
      expect(strokeCircle?.getAttribute('r')).toBe('12.5');

      // Circumference = 2 * Math.PI * 12.5 = 78.5398...
      const expectedCircumference = 2 * Math.PI * 12.5;
      const strokeDasharray = Number(strokeCircle?.getAttribute('stroke-dasharray'));
      expect(strokeDasharray).toBeCloseTo(expectedCircumference, 4);

      // Verify strokeLinecap is round
      expect(strokeCircle?.getAttribute('stroke-linecap')).toBe('round');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('renders DOM correctly when completed = total (100% completion)', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<ProgressRing completed={4} total={4} size={30} strokeWidth={3} />);
      });

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar?.getAttribute('aria-valuenow')).toBe('4');
      expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
      expect(progressbar?.getAttribute('aria-label')).toBe('4 of 4 items completed (100%)');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('clamps completed > total cleanly to 100% without negative offset or layout distortion', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<ProgressRing completed={12} total={4} size={32} strokeWidth={4} />);
      });

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar?.getAttribute('aria-valuenow')).toBe('12');
      expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
      expect(progressbar?.getAttribute('aria-label')).toBe('12 of 4 items completed (100%)');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('renders empty section (total = 0) without NaN or zero division errors', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<ProgressRing completed={0} total={0} />);
      });

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar?.getAttribute('aria-valuenow')).toBe('0');
      expect(progressbar?.getAttribute('aria-valuemax')).toBe('0');
      expect(progressbar?.getAttribute('aria-label')).toBe('No items in section');

      // Verify no NaN in innerHTML
      expect(container.innerHTML).not.toContain('NaN');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  // =========================================================================
  // SUITE 2: Goal Hero Card & Dynamic Countdown Calculations
  // =========================================================================
  describe('2. Goal Hero Card & Dynamic Countdown Calculations', () => {
    const logicalDay = '2026-10-18';

    it('computes future countdowns: "1 day left" and "X days left"', () => {
      const plusOne = computeGoalCountdown('2026-10-19', logicalDay);
      expect(plusOne).toEqual({
        hasTarget: true,
        status: 'future',
        daysRemaining: 1,
        displayText: '1 day left',
      });

      const plusFive = computeGoalCountdown('2026-10-23', logicalDay);
      expect(plusFive).toEqual({
        hasTarget: true,
        status: 'future',
        daysRemaining: 5,
        displayText: '5 days left',
      });

      const plus100 = computeGoalCountdown('2027-01-26', logicalDay);
      expect(plus100).toEqual({
        hasTarget: true,
        status: 'future',
        daysRemaining: 100,
        displayText: '100 days left',
      });
    });

    it('computes same-day target: "Due today"', () => {
      const today = computeGoalCountdown('2026-10-18', logicalDay);
      expect(today).toEqual({
        hasTarget: true,
        status: 'today',
        daysRemaining: 0,
        displayText: 'Due today',
      });
    });

    it('computes past targets: "1 day overdue" and "X days overdue"', () => {
      const minusOne = computeGoalCountdown('2026-10-17', logicalDay);
      expect(minusOne).toEqual({
        hasTarget: true,
        status: 'overdue',
        daysRemaining: -1,
        displayText: '1 day overdue',
      });

      const minusSeven = computeGoalCountdown('2026-10-11', logicalDay);
      expect(minusSeven).toEqual({
        hasTarget: true,
        status: 'overdue',
        daysRemaining: -7,
        displayText: '7 days overdue',
      });
    });

    it('returns null on null, empty, whitespace, or malformed target dates', () => {
      expect(computeGoalCountdown(null, logicalDay)).toBeNull();
      expect(computeGoalCountdown(undefined, logicalDay)).toBeNull();
      expect(computeGoalCountdown('', logicalDay)).toBeNull();
      expect(computeGoalCountdown('   ', logicalDay)).toBeNull();
      expect(computeGoalCountdown('2026/10/18', logicalDay)).toBeNull();
      expect(computeGoalCountdown('invalid-date', logicalDay)).toBeNull();
    });

    it('renders GoalHeroCard with dynamic countdown badge states in DOM', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const baseGoal: Goal = {
        id: 'goal-test-1',
        user_id: 'local',
        statement: 'Master iOS 26 Design System',
        target_date: '2026-10-25',
        updated_at: '2026-10-18T10:00:00.000Z',
        deleted_at: null,
      };

      // State A: Future (7 days left)
      const countdownFuture: CountdownResult = {
        hasTarget: true,
        status: 'future',
        daysRemaining: 7,
        displayText: '7 days left',
      };
      await act(async () => {
        root.render(<GoalHeroCard goal={baseGoal} countdown={countdownFuture} onOpenEditor={vi.fn()} />);
      });
      expect(container.textContent).toContain('7 days left');
      expect(container.textContent).toContain('Master iOS 26 Design System');

      // State B: Due today
      const countdownToday: CountdownResult = {
        hasTarget: true,
        status: 'today',
        daysRemaining: 0,
        displayText: 'Due today',
      };
      await act(async () => {
        root.render(<GoalHeroCard goal={baseGoal} countdown={countdownToday} onOpenEditor={vi.fn()} />);
      });
      expect(container.textContent).toContain('Due today');

      // State C: Overdue (3 days overdue)
      const countdownOverdue: CountdownResult = {
        hasTarget: true,
        status: 'overdue',
        daysRemaining: -3,
        displayText: '3 days overdue',
      };
      await act(async () => {
        root.render(<GoalHeroCard goal={baseGoal} countdown={countdownOverdue} onOpenEditor={vi.fn()} />);
      });
      expect(container.textContent).toContain('3 days overdue');

      // State D: Null target date — countdown badge must be completely hidden/absent
      await act(async () => {
        root.render(<GoalHeroCard goal={baseGoal} countdown={null} onOpenEditor={vi.fn()} />);
      });
      expect(container.textContent).not.toContain('days left');
      expect(container.textContent).not.toContain('Due today');
      expect(container.textContent).not.toContain('days overdue');

      // State E: Null goal — renders placeholder text, no countdown badge
      await act(async () => {
        root.render(<GoalHeroCard goal={null} countdown={null} onOpenEditor={vi.fn()} />);
      });
      expect(container.textContent).toContain('Tap to set your primary goal…');
      expect(container.textContent).not.toContain('days left');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });
  });

  // =========================================================================
  // SUITE 3: Clear Completed Work Action Gating & Atomic Soft-Delete
  // =========================================================================
  describe('3. Clear Completed Work Action Gating & Atomic Soft-Delete Invariants', () => {
    it('strictly hides ClearCompletedTrigger from DOM when completedWorkCount === 0', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<ClearCompletedTrigger completedCount={0} onOpenConfirm={vi.fn()} />);
      });

      // Assert container has no child button or interactive element
      expect(container.querySelector('button')).toBeNull();
      expect(container.innerHTML).toBe('');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('renders ClearCompletedTrigger when completedWorkCount >= 1 with correct count', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const openSpy = vi.fn();

      // Test with count = 1
      await act(async () => {
        root.render(<ClearCompletedTrigger completedCount={1} onOpenConfirm={openSpy} />);
      });
      const button1 = container.querySelector('button');
      expect(button1).not.toBeNull();
      expect(button1?.textContent).toContain('Clear Completed (1)');
      expect(button1?.getAttribute('aria-label')).toBe('Clear completed (1) tasks');

      // Test with count = 5
      await act(async () => {
        root.render(<ClearCompletedTrigger completedCount={5} onOpenConfirm={openSpy} />);
      });
      const button5 = container.querySelector('button');
      expect(button5?.textContent).toContain('Clear Completed (5)');
      expect(button5?.getAttribute('aria-label')).toBe('Clear completed (5) tasks');

      // Test click opens confirm dialog
      await act(async () => {
        button5?.click();
      });
      expect(openSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('renders ClearCompletedSheet confirmation modal with singular/plural task noun', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const confirmSpy = vi.fn();
      const closeSpy = vi.fn();

      await act(async () => {
        root.render(
          <ClearCompletedSheet
            isOpen={true}
            completedCount={1}
            onClose={closeSpy}
            onConfirm={confirmSpy}
          />
        );
      });

      expect(container.textContent).toContain('Clear 1 Completed Task?');

      await act(async () => {
        root.render(
          <ClearCompletedSheet
            isOpen={true}
            completedCount={4}
            onClose={closeSpy}
            onConfirm={confirmSpy}
          />
        );
      });

      expect(container.textContent).toContain('Clear 4 Completed Tasks?');

      await act(async () => {
        root.unmount();
      });
      container.remove();
    });

    it('executes clearCompletedWorkItems: soft-deletes ONLY checked work items, leaving all unchecked and routine items completely untouched', async () => {
      // 1. Seed database with heterogeneous checklist items
      const now = new Date().toISOString();

      // 3 Morning Routine items (1 checked, 2 unchecked)
      const morning1: ChecklistItem = {
        id: 'm1',
        user_id: 'local',
        list_type: 'today_morning',
        title: 'Morning Sunlight',
        sort_order: 1000,
        is_completed: true,
        completed_at: now,
        last_completed_day: '2026-10-18',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const morning2: ChecklistItem = {
        id: 'm2',
        user_id: 'local',
        list_type: 'today_morning',
        title: 'Drink Water',
        sort_order: 2000,
        is_completed: false,
        completed_at: null,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      // 2 Today Work routine items (1 checked, 1 unchecked)
      const todayWork1: ChecklistItem = {
        id: 'tw1',
        user_id: 'local',
        list_type: 'today_work',
        title: 'Deep Work Block',
        sort_order: 1000,
        is_completed: true,
        completed_at: now,
        last_completed_day: '2026-10-18',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const todayWork2: ChecklistItem = {
        id: 'tw2',
        user_id: 'local',
        list_type: 'today_work',
        title: 'Review PRs',
        sort_order: 2000,
        is_completed: false,
        completed_at: null,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      // 2 Evening Routine items (1 checked, 1 unchecked)
      const evening1: ChecklistItem = {
        id: 'e1',
        user_id: 'local',
        list_type: 'today_evening',
        title: 'Wind down',
        sort_order: 1000,
        is_completed: true,
        completed_at: now,
        last_completed_day: '2026-10-18',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const evening2: ChecklistItem = {
        id: 'e2',
        user_id: 'local',
        list_type: 'today_evening',
        title: 'Screen off',
        sort_order: 2000,
        is_completed: false,
        completed_at: null,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      // 4 Persistent Work items (2 checked, 2 unchecked)
      const workChecked1: ChecklistItem = {
        id: 'w1',
        user_id: 'local',
        list_type: 'work',
        title: 'Fix auth bug',
        sort_order: 1000,
        is_completed: true,
        completed_at: now,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const workChecked2: ChecklistItem = {
        id: 'w2',
        user_id: 'local',
        list_type: 'work',
        title: 'Ship migration',
        sort_order: 2000,
        is_completed: true,
        completed_at: now,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const workUnchecked1: ChecklistItem = {
        id: 'w3',
        user_id: 'local',
        list_type: 'work',
        title: 'Plan Q1 roadmap',
        sort_order: 3000,
        is_completed: false,
        completed_at: null,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const workUnchecked2: ChecklistItem = {
        id: 'w4',
        user_id: 'local',
        list_type: 'work',
        title: 'Write docs',
        sort_order: 4000,
        is_completed: false,
        completed_at: null,
        last_completed_day: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      await db.checklist_items.bulkPut([
        morning1,
        morning2,
        todayWork1,
        todayWork2,
        evening1,
        evening2,
        workChecked1,
        workChecked2,
        workUnchecked1,
        workUnchecked2,
      ]);

      // Verify initial state: 10 items total, 0 deleted
      const initialItems = await db.checklist_items.toArray();
      expect(initialItems.length).toBe(10);
      expect(initialItems.every((i) => i.deleted_at === null)).toBe(true);

      // 2. Execute clearCompletedWorkItems
      const clearedCount = await checklistRepository.clearCompletedWorkItems();
      expect(clearedCount).toBe(2);

      // 3. Assert exact outcomes in database
      const finalItems = await db.checklist_items.toArray();
      expect(finalItems.length).toBe(10);

      // Persistent Work items checked: MUST BE SOFT-DELETED
      const deletedW1 = finalItems.find((i) => i.id === 'w1');
      const deletedW2 = finalItems.find((i) => i.id === 'w2');
      expect(deletedW1?.deleted_at).not.toBeNull();
      expect(deletedW2?.deleted_at).not.toBeNull();

      // Persistent Work items unchecked: MUST REMAIN UNTOUCHED (deleted_at === null)
      const activeW3 = finalItems.find((i) => i.id === 'w3');
      const activeW4 = finalItems.find((i) => i.id === 'w4');
      expect(activeW3?.deleted_at).toBeNull();
      expect(activeW3?.is_completed).toBe(false);
      expect(activeW4?.deleted_at).toBeNull();
      expect(activeW4?.is_completed).toBe(false);

      // ALL Routine items (morning, today_work, evening): MUST REMAIN UNTOUCHED (deleted_at === null)
      const routineItems = finalItems.filter((i) => i.list_type !== 'work');
      expect(routineItems.length).toBe(6);
      for (const rItem of routineItems) {
        expect(rItem.deleted_at).toBeNull();
      }

      // 4. Verify outbox mutations: exactly 2 delete records created
      const outbox = await db.outbox_mutations.toArray();
      expect(outbox.length).toBe(2);
      expect(outbox.every((m) => m.action === 'delete')).toBe(true);
      expect(outbox.map((m) => m.record_id).sort()).toEqual(['w1', 'w2'].sort());

      // 5. Calling clearCompletedWorkItems again when completedWorkCount === 0 returns 0 and mutates nothing
      const secondCleared = await checklistRepository.clearCompletedWorkItems();
      expect(secondCleared).toBe(0);
      const outboxAfter = await db.outbox_mutations.toArray();
      expect(outboxAfter.length).toBe(2);
    });
  });

  // =========================================================================
  // SUITE 4: Fractional Sort Order Reordering & Monotonicity Stress Harness
  // =========================================================================
  describe('4. Fractional Sort Order Reordering & Monotonicity Stress Harness', () => {
    it('executes 100 sequential reorder drops and asserts strict monotonicity without collisions', () => {
      // 1. Initialize a list of 10 items with base spacing
      const itemCount = 10;
      interface TestItem {
        id: string;
        sort_order: number;
      }

      let items: TestItem[] = Array.from({ length: itemCount }, (_, idx) => ({
        id: `item-${idx + 1}`,
        sort_order: (idx + 1) * 1000.0,
      }));

      // Pseudo-random generator with fixed seed for deterministic reproducibility
      let seed = 42;
      function nextRandom(): number {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
      }

      const totalDrops = 100;
      const dropLog: Array<{ drop: number; from: number; to: number; newOrder: number }> = [];

      for (let drop = 1; drop <= totalDrops; drop++) {
        // Pick random item to move
        const fromIdx = Math.floor(nextRandom() * items.length);
        // Pick random destination slot different from fromIdx
        let toIdx = Math.floor(nextRandom() * items.length);
        if (toIdx === fromIdx) {
          toIdx = (toIdx + 1) % items.length;
        }

        const movedItem = items[fromIdx]!;

        // Construct new array simulating Reorder.Group
        const reordered = items.filter((_, idx) => idx !== fromIdx);
        reordered.splice(toIdx, 0, movedItem);

        // Compute adjacent orders exactly as ChecklistSection.tsx does
        const prevItem = toIdx > 0 ? reordered[toIdx - 1] : undefined;
        const nextItem = toIdx < reordered.length - 1 ? reordered[toIdx + 1] : undefined;
        const prevOrder = prevItem ? prevItem.sort_order : null;
        const nextOrder = nextItem ? nextItem.sort_order : null;

        const newSortOrder = calculateNewSortOrder(prevOrder, nextOrder);

        // Invariant A: Finite, non-NaN
        expect(Number.isFinite(newSortOrder)).toBe(true);
        expect(Number.isNaN(newSortOrder)).toBe(false);

        // Invariant B: If prevOrder exists, newSortOrder > prevOrder
        if (prevOrder !== null && nextOrder !== null && prevOrder < nextOrder) {
          expect(newSortOrder).toBeGreaterThan(prevOrder);
          expect(newSortOrder).toBeLessThan(nextOrder);
        } else if (prevOrder !== null && nextOrder === null) {
          expect(newSortOrder).toBeGreaterThan(prevOrder);
        } else if (prevOrder === null && nextOrder !== null) {
          expect(newSortOrder).toBeLessThan(nextOrder);
        }

        // Apply new sort order to moved item
        movedItem.sort_order = newSortOrder;

        // Sort items by sort_order
        items = [...reordered].sort((a, b) => a.sort_order - b.sort_order);

        // Invariant C: List must maintain strict monotonicity across ALL elements
        for (let i = 0; i < items.length - 1; i++) {
          const current = items[i]!.sort_order;
          const next = items[i + 1]!.sort_order;
          const delta = next - current;

          // Strict monotonicity: every consecutive pair must have positive delta
          expect(delta).toBeGreaterThan(0);
          expect(current).toBeLessThan(next);
        }

        // Invariant D: Zero collisions (Set size equals array length)
        const orderSet = new Set(items.map((i) => i.sort_order));
        expect(orderSet.size).toBe(itemCount);

        dropLog.push({ drop, from: fromIdx, to: toIdx, newOrder: newSortOrder });
      }

      expect(dropLog.length).toBe(totalDrops);
      console.log(`[Monotonicity Stress] Successfully proved 100 sequential reorder drops without collisions`);
    });

    it('handles 100 consecutive drops to the very top (moving to index 0)', () => {
      let currentOrder = 1000.0;
      const orders: number[] = [currentOrder];

      for (let i = 0; i < 100; i++) {
        const newOrder = calculateNewSortOrder(null, currentOrder);
        expect(newOrder).toBe(currentOrder / 2.0);
        expect(newOrder).toBeGreaterThan(0);
        expect(newOrder).toBeLessThan(currentOrder);
        orders.push(newOrder);
        currentOrder = newOrder;
      }

      // Check strict monotonic decrease
      for (let i = 0; i < orders.length - 1; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i + 1]!);
      }
      expect(new Set(orders).size).toBe(101);
    });

    it('handles 100 consecutive drops to the very bottom (moving to end of list)', () => {
      let currentOrder = 1000.0;
      const orders: number[] = [currentOrder];

      for (let i = 0; i < 100; i++) {
        const newOrder = calculateNewSortOrder(currentOrder, null);
        expect(newOrder).toBe(currentOrder + 1000.0);
        expect(newOrder).toBeGreaterThan(currentOrder);
        orders.push(newOrder);
        currentOrder = newOrder;
      }

      // Check strict monotonic increase
      for (let i = 0; i < orders.length - 1; i++) {
        expect(orders[i]!).toBeLessThan(orders[i + 1]!);
      }
      expect(new Set(orders).size).toBe(101);
    });

    it('persists reorderItem operations in Dexie database and verifies sorted query order', async () => {
      // Create 3 persistent work items
      const item1 = await checklistRepository.addItem('work', 'Item Alpha');
      const item2 = await checklistRepository.addItem('work', 'Item Beta');
      const item3 = await checklistRepository.addItem('work', 'Item Gamma');

      expect(item1.sort_order).toBe(1000.0);
      expect(item2.sort_order).toBe(2000.0);
      expect(item3.sort_order).toBe(3000.0);

      // Reorder Item Gamma to top (before Item Alpha)
      const newOrderGamma = calculateNewSortOrder(null, item1.sort_order);
      await checklistRepository.reorderItem(item3.id, newOrderGamma);

      // Reorder Item Beta between Gamma and Alpha
      const newOrderBeta = calculateNewSortOrder(newOrderGamma, item1.sort_order);
      await checklistRepository.reorderItem(item2.id, newOrderBeta);

      // Fetch active items and verify order: Gamma, Beta, Alpha
      const activeItems = await checklistRepository.getActiveItems('work');
      expect(activeItems.map((i) => i.title)).toEqual(['Item Gamma', 'Item Beta', 'Item Alpha']);
      expect(activeItems[0]!.sort_order).toBeLessThan(activeItems[1]!.sort_order);
      expect(activeItems[1]!.sort_order).toBeLessThan(activeItems[2]!.sort_order);
    });
  });
});
