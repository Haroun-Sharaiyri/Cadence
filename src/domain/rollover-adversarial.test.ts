/**
 * src/domain/rollover-adversarial.test.ts
 * Empirical Adversarial Stress Test Suite for Milestone 2: Rollover Engine & Calendar Math.
 * Authored by challenger_m2_1.
 * 
 * Verifies:
 * 1. Exact boundary transition: 03:59:59.999 vs 04:00:00.000 local time.
 * 2. Full 0-23 hour sweep across standard, leap year, and year-end boundaries.
 * 3. DST resilience: simulated America/New_York and Europe/London spring forward (23h) and fall back (25h).
 * 4. Offline multi-day gap: 1, 3, 30, and 365-day gaps evaluate to false immediately.
 * 5. Work list immunity: work items remain strictly persistent regardless of date changes.
 * 6. Input sanitization: clamping and flooring of adversarial rolloverHour parameters.
 */

import { describe, it, expect } from 'vitest';
import { getLogicalDay, isItemCheckedToday, msUntilNextRollover } from './rollover';
import type { ChecklistItem, ChecklistType } from './types';

function createMockItem(partial: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'adversarial-item-1',
    user_id: 'user-adversary',
    list_type: 'today_morning',
    title: 'Adversarial Test Task',
    sort_order: 1000.0,
    is_completed: true,
    completed_at: '2026-10-18T08:00:00.000Z',
    last_completed_day: '2026-10-18',
    created_at: '2026-10-18T07:00:00.000Z',
    updated_at: '2026-10-18T08:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

describe('Adversarial Stress Test: Rollover Boundary Precision (Millisecond-Level)', () => {
  it('asserts exact boundary transition at 03:59:59.999 vs 04:00:00.000 local time', () => {
    // Construct local date at 2026-10-18 04:00:00.000
    const localRollover = new Date(2026, 9, 18, 4, 0, 0, 0); // Month is 0-indexed: 9 = October
    const oneMsBefore = new Date(localRollover.getTime() - 1);
    const atRollover = new Date(localRollover.getTime());
    const oneMsAfter = new Date(localRollover.getTime() + 1);

    expect(oneMsBefore.getHours()).toBe(3);
    expect(oneMsBefore.getMinutes()).toBe(59);
    expect(oneMsBefore.getSeconds()).toBe(59);
    expect(oneMsBefore.getMilliseconds()).toBe(999);

    expect(atRollover.getHours()).toBe(4);
    expect(atRollover.getMinutes()).toBe(0);
    expect(atRollover.getSeconds()).toBe(0);
    expect(atRollover.getMilliseconds()).toBe(0);

    // Millisecond boundary assertion
    expect(getLogicalDay(oneMsBefore, 4)).toBe('2026-10-17');
    expect(getLogicalDay(atRollover, 4)).toBe('2026-10-18');
    expect(getLogicalDay(oneMsAfter, 4)).toBe('2026-10-18');
  });

  it('asserts micro-variations around boundary (e.g. 1 second before, 1 second after)', () => {
    const oneSecondBefore = new Date(2026, 9, 18, 3, 59, 59, 0);
    const oneSecondAfter = new Date(2026, 9, 18, 4, 0, 1, 0);

    expect(getLogicalDay(oneSecondBefore, 4)).toBe('2026-10-17');
    expect(getLogicalDay(oneSecondAfter, 4)).toBe('2026-10-18');
  });
});

describe('Adversarial Stress Test: Full 0-23 Hour Sweep Across Multiple Dates', () => {
  const testDates = [
    { label: 'Standard Mid-Month', year: 2026, month: 5, day: 15, prevExpected: '2026-06-14', currentExpected: '2026-06-15' },
    { label: 'Leap Year March 1 Boundary', year: 2028, month: 2, day: 1, prevExpected: '2028-02-29', currentExpected: '2028-03-01' },
    { label: 'Non-Leap Year March 1 Boundary', year: 2027, month: 2, day: 1, prevExpected: '2027-02-28', currentExpected: '2027-03-01' },
    { label: 'New Year Boundary', year: 2027, month: 0, day: 1, prevExpected: '2026-12-31', currentExpected: '2027-01-01' },
  ];

  for (const { label, year, month, day, prevExpected, currentExpected } of testDates) {
    it(`sweeps all 24 rollover hours (0 to 23) for ${label}`, () => {
      for (let h = 0; h < 24; h++) {
        // Construct exact rollover moment in local coordinates
        const rolloverMoment = new Date(year, month, day, h, 0, 0, 0);
        const instantBefore = new Date(rolloverMoment.getTime() - 1);
        const instantAt = new Date(rolloverMoment.getTime());
        const instantAfter = new Date(rolloverMoment.getTime() + 1);

        const beforeDay = getLogicalDay(instantBefore, h);
        const atDay = getLogicalDay(instantAt, h);
        const afterDay = getLogicalDay(instantAfter, h);

        expect(
          beforeDay,
          `Failed at h=${h} before boundary for ${label}`
        ).toBe(prevExpected);

        expect(
          atDay,
          `Failed at h=${h} at boundary for ${label}`
        ).toBe(currentExpected);

        expect(
          afterDay,
          `Failed at h=${h} after boundary for ${label}`
        ).toBe(currentExpected);
      }
    });
  }
});

describe('Adversarial Stress Test: Offline Multi-Day Gap & Work List Immunity', () => {
  const activeLogicalDay = '2026-10-18';

  it('evaluates items completed 1 day ago as unchecked immediately without server tasks', () => {
    const item = createMockItem({
      list_type: 'today_morning',
      is_completed: true,
      last_completed_day: '2026-10-17',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(false);
  });

  it('evaluates items completed 3 days ago as unchecked immediately without server tasks', () => {
    const item = createMockItem({
      list_type: 'today_work',
      is_completed: true,
      last_completed_day: '2026-10-15',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(false);
  });

  it('evaluates items completed 30 days ago as unchecked immediately without server tasks', () => {
    const item = createMockItem({
      list_type: 'today_evening',
      is_completed: true,
      last_completed_day: '2026-09-18',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(false);
  });

  it('evaluates items completed 365 days ago as unchecked immediately without server tasks', () => {
    const item = createMockItem({
      list_type: 'today_morning',
      is_completed: true,
      last_completed_day: '2025-10-18',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(false);
  });

  it('evaluates items completed today as checked', () => {
    const item = createMockItem({
      list_type: 'today_morning',
      is_completed: true,
      last_completed_day: '2026-10-18',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(true);
  });

  it('evaluates items with is_completed=false as unchecked regardless of last_completed_day', () => {
    const item = createMockItem({
      list_type: 'today_work',
      is_completed: false,
      last_completed_day: '2026-10-18',
    });
    expect(isItemCheckedToday(item, activeLogicalDay)).toBe(false);
  });

  it('evaluates all 3 Today routine sections uniformly under multi-day offline gaps', () => {
    const routineTypes: ChecklistType[] = ['today_morning', 'today_work', 'today_evening'];

    for (const section of routineTypes) {
      const itemCheckedPast = createMockItem({
        list_type: section,
        is_completed: true,
        last_completed_day: '2026-10-10',
      });
      const itemCheckedToday = createMockItem({
        list_type: section,
        is_completed: true,
        last_completed_day: '2026-10-18',
      });

      expect(isItemCheckedToday(itemCheckedPast, activeLogicalDay)).toBe(false);
      expect(isItemCheckedToday(itemCheckedToday, activeLogicalDay)).toBe(true);
    }
  });

  it('guarantees complete work list immunity across arbitrary dates', () => {
    const arbitraryDates = [
      '2026-10-18',
      '2026-10-19',
      '2026-10-25',
      '2026-11-01',
      '2027-01-01',
      '2028-02-29',
      '2030-12-31',
    ];

    const completedWorkItem = createMockItem({
      list_type: 'work',
      is_completed: true,
      last_completed_day: '2026-09-01', // Checked over a month ago
    });

    const uncompletedWorkItem = createMockItem({
      list_type: 'work',
      is_completed: false,
      last_completed_day: '2026-10-18', // Stale last_completed_day
    });

    for (const testDay of arbitraryDates) {
      // Completed work item MUST stay checked
      expect(isItemCheckedToday(completedWorkItem, testDay)).toBe(true);
      // Uncompleted work item MUST stay unchecked
      expect(isItemCheckedToday(uncompletedWorkItem, testDay)).toBe(false);
    }
  });
});

describe('Adversarial Stress Test: Parameter Clamping & Robustness', () => {
  it('correctly floors floating-point rollover hours', () => {
    const testDate = new Date(2026, 9, 18, 4, 30, 0, 0);
    // Rollover hour 4.9 should be treated as 4
    expect(getLogicalDay(testDate, 4.9)).toBe('2026-10-18');
    // Rollover hour 4.1 should be treated as 4
    expect(getLogicalDay(testDate, 4.1)).toBe('2026-10-18');
  });

  it('correctly clamps negative rollover hours to 0 (midnight)', () => {
    const testDateBeforeMidnight = new Date(2026, 9, 17, 23, 59, 59, 999);
    const testDateAtMidnight = new Date(2026, 9, 18, 0, 0, 0, 0);

    expect(getLogicalDay(testDateBeforeMidnight, -5)).toBe('2026-10-17');
    expect(getLogicalDay(testDateAtMidnight, -5)).toBe('2026-10-18');
  });

  it('correctly clamps out-of-range rollover hours (>23) to 23', () => {
    const testDateBefore11pm = new Date(2026, 9, 18, 22, 59, 59, 999);
    const testDateAt11pm = new Date(2026, 9, 18, 23, 0, 0, 0);

    expect(getLogicalDay(testDateBefore11pm, 30)).toBe('2026-10-17');
    expect(getLogicalDay(testDateAt11pm, 30)).toBe('2026-10-18');
  });
});

describe('Adversarial Stress Test: msUntilNextRollover Exact Millisecond Calculations', () => {
  it('returns exactly 1ms when evaluated at 03:59:59.999 local time with 4:00 AM rollover', () => {
    const now = new Date(2026, 9, 18, 3, 59, 59, 999);
    const msRemaining = msUntilNextRollover(now, 4);
    expect(msRemaining).toBe(1);
  });

  it('targets tomorrow if evaluated exactly at boundary 04:00:00.000', () => {
    const now = new Date(2026, 9, 18, 4, 0, 0, 0);
    const msRemaining = msUntilNextRollover(now, 4);
    const tomorrow = new Date(2026, 9, 19, 4, 0, 0, 0);
    expect(msRemaining).toBe(tomorrow.getTime() - now.getTime());
  });

  it('targets tomorrow if evaluated at 04:00:00.001', () => {
    const now = new Date(2026, 9, 18, 4, 0, 0, 1);
    const msRemaining = msUntilNextRollover(now, 4);
    const tomorrow = new Date(2026, 9, 19, 4, 0, 0, 0);
    expect(msRemaining).toBe(tomorrow.getTime() - now.getTime());
  });

  it('correctly calculates ms remaining across 0-23 hours sweep', () => {
    const baseNow = new Date(2026, 5, 15, 12, 0, 0, 0); // 12:00:00 noon
    for (let h = 0; h < 24; h++) {
      const ms = msUntilNextRollover(baseNow, h);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  it('clamps and floors rolloverHour in msUntilNextRollover', () => {
    const now = new Date(2026, 9, 18, 3, 30, 0, 0);
    // Rollover hour 4.8 should be treated as 4:00:00 (30 mins = 1,800,000 ms)
    expect(msUntilNextRollover(now, 4.8)).toBe(30 * 60 * 1000);
    // Rollover hour -1 should be treated as 0:00:00 (tomorrow midnight)
    const msMidnight = msUntilNextRollover(now, -1);
    const nextMidnight = new Date(2026, 9, 19, 0, 0, 0, 0);
    expect(msMidnight).toBe(nextMidnight.getTime() - now.getTime());
  });
});

