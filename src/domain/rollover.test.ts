/**
 * src/domain/rollover.test.ts
 * Comprehensive unit test suite covering rollover boundaries, 0-23 hour sweep, DST transitions, and offline gap recovery.
 */

import { describe, it, expect } from 'vitest';
import { getLogicalDay, isItemCheckedToday, msUntilNextRollover } from './rollover';
import type { ChecklistItem } from './types';

function createMockItem(partial: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'test-item-1',
    list_type: 'today_morning',
    title: 'Test Habit',
    sort_order: 1000.0,
    is_completed: true,
    completed_at: '2026-10-17T08:00:00.000Z',
    last_completed_day: '2026-10-17',
    created_at: '2026-10-17T07:00:00.000Z',
    updated_at: '2026-10-17T08:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

describe('Rollover Engine: getLogicalDay', () => {
  it('correctly maps 3:59:59 AM to previous calendar day and 4:00:00 AM to current day (default boundary)', () => {
    // 3:59:59.999 AM local on Oct 18, 2026
    const beforeRollover = new Date('2026-10-18T03:59:59.999');
    expect(getLogicalDay(beforeRollover, 4)).toBe('2026-10-17');

    // 4:00:00.000 AM local on Oct 18, 2026
    const atRollover = new Date('2026-10-18T04:00:00.000');
    expect(getLogicalDay(atRollover, 4)).toBe('2026-10-18');

    // 4:00:01 AM local on Oct 18, 2026
    const afterRollover = new Date('2026-10-18T04:00:01.000');
    expect(getLogicalDay(afterRollover, 4)).toBe('2026-10-18');
  });

  it('correctly handles midnight rollover (rolloverHour = 0)', () => {
    const beforeMidnight = new Date('2026-10-18T23:59:59.999');
    expect(getLogicalDay(beforeMidnight, 0)).toBe('2026-10-18');

    const atMidnight = new Date('2026-10-19T00:00:00.000');
    expect(getLogicalDay(atMidnight, 0)).toBe('2026-10-19');
  });

  it('correctly handles late evening rollover (rolloverHour = 23)', () => {
    // At 22:59:59, 23h subtraction rolls back to prior day
    const before11pm = new Date('2026-10-18T22:59:59.999');
    expect(getLogicalDay(before11pm, 23)).toBe('2026-10-17');

    // At 23:00:00, evaluates to current day
    const at11pm = new Date('2026-10-18T23:00:00.000');
    expect(getLogicalDay(at11pm, 23)).toBe('2026-10-18');

    // At 02:00:00 next calendar day, still in 2026-10-18 logical day
    const nextMorning = new Date('2026-10-19T02:00:00.000');
    expect(getLogicalDay(nextMorning, 23)).toBe('2026-10-18');
  });

  it('sweeps all user-adjustable rollover hours from 0 to 23 and verifies boundary precision', () => {
    for (let h = 0; h < 24; h++) {
      // Create a test date on 2026-06-15 at hour h
      const baseDate = new Date('2026-06-15T00:00:00.000');
      baseDate.setHours(h, 0, 0, 0);

      // 1 ms before boundary
      const oneMsBefore = new Date(baseDate.getTime() - 1);
      // At boundary
      const atBoundary = new Date(baseDate.getTime());

      expect(getLogicalDay(atBoundary, h)).toBe('2026-06-15');
      expect(getLogicalDay(oneMsBefore, h)).toBe('2026-06-14');
    }
  });

  it('correctly handles month and year boundary transitions', () => {
    // New Year's Eve: Jan 1, 2027 at 03:59:59 AM with 4 AM rollover
    const newYearLateNight = new Date('2027-01-01T03:59:59.999');
    expect(getLogicalDay(newYearLateNight, 4)).toBe('2026-12-31');

    const newYearMorning = new Date('2027-01-01T04:00:00.000');
    expect(getLogicalDay(newYearMorning, 4)).toBe('2027-01-01');

    // Leap Year boundary: March 1, 2028 at 03:59:59 AM
    const leapYearMorningBefore = new Date('2028-03-01T03:59:59.999');
    expect(getLogicalDay(leapYearMorningBefore, 4)).toBe('2028-02-29');

    const leapYearMorningAfter = new Date('2028-03-01T04:00:00.000');
    expect(getLogicalDay(leapYearMorningAfter, 4)).toBe('2028-03-01');
  });

  it('correctly handles Daylight Saving Time (DST) spring forward and fall back', () => {
    // Spring Forward: Sunday, March 8, 2026
    // 03:59:59 local belongs to previous logical day
    const springBefore = new Date('2026-03-08T03:59:59');
    expect(getLogicalDay(springBefore, 4)).toBe('2026-03-07');

    // 04:00:00 local begins the new logical day
    const springAfter = new Date('2026-03-08T04:00:00');
    expect(getLogicalDay(springAfter, 4)).toBe('2026-03-08');

    // Fall Back: Sunday, November 1, 2026
    // 03:59:59 local belongs to previous logical day
    const fallBefore = new Date('2026-11-01T03:59:59');
    expect(getLogicalDay(fallBefore, 4)).toBe('2026-10-31');

    // 04:00:00 local begins the new logical day
    const fallAfter = new Date('2026-11-01T04:00:00');
    expect(getLogicalDay(fallAfter, 4)).toBe('2026-11-01');
  });
});

describe('Rollover Engine: isItemCheckedToday', () => {
  it('returns true when item is completed and last_completed_day matches current logical day', () => {
    const item = createMockItem({
      list_type: 'today_morning',
      is_completed: true,
      last_completed_day: '2026-10-18',
    });
    expect(isItemCheckedToday(item, '2026-10-18')).toBe(true);
  });

  it('returns false when item is marked completed for a previous day (multi-day offline gap)', () => {
    // User checked item on Oct 15, leaves phone offline, opens on Oct 18
    const item = createMockItem({
      list_type: 'today_morning',
      is_completed: true,
      last_completed_day: '2026-10-15',
    });
    expect(isItemCheckedToday(item, '2026-10-18')).toBe(false);
  });

  it('returns false when item is not completed regardless of last_completed_day', () => {
    const item = createMockItem({
      list_type: 'today_work',
      is_completed: false,
      last_completed_day: '2026-10-18',
    });
    expect(isItemCheckedToday(item, '2026-10-18')).toBe(false);
  });

  it('guarantees Work tab items are persistent and immune to rollover date changes', () => {
    const workItem = createMockItem({
      list_type: 'work',
      is_completed: true,
      last_completed_day: '2026-10-10', // Checked 8 days ago
    });
    // Regardless of logical day, work items remain checked until explicitly deleted/cleared
    expect(isItemCheckedToday(workItem, '2026-10-18')).toBe(true);

    const uncompletedWorkItem = createMockItem({
      list_type: 'work',
      is_completed: false,
      last_completed_day: null,
    });
    expect(isItemCheckedToday(uncompletedWorkItem, '2026-10-18')).toBe(false);
  });
});

describe('Rollover Engine: msUntilNextRollover', () => {
  it('calculates remaining milliseconds when rollover is later today', () => {
    const now = new Date('2026-10-18T02:00:00.000');
    const ms = msUntilNextRollover(now, 4);
    // Exactly 2 hours = 7,200,000 ms
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });

  it('calculates remaining milliseconds when rollover has passed today and targets tomorrow', () => {
    const now = new Date('2026-10-18T05:00:00.000');
    const ms = msUntilNextRollover(now, 4);
    // 23 hours until 4 AM tomorrow = 82,800,000 ms
    expect(ms).toBe(23 * 60 * 60 * 1000);
  });

  it('targets tomorrow if current time is exactly at the rollover boundary', () => {
    const now = new Date('2026-10-18T04:00:00.000');
    const ms = msUntilNextRollover(now, 4);
    expect(ms).toBe(24 * 60 * 60 * 1000);
  });

  it('correctly accounts for next rollover target date across date boundary', () => {
    const base = new Date('2026-03-07T04:00:00');
    const ms = msUntilNextRollover(base, 4);
    // Target is tomorrow at 4:00:00 local time
    const expectedTarget = new Date('2026-03-07T04:00:00');
    expectedTarget.setDate(expectedTarget.getDate() + 1);
    expectedTarget.setHours(4, 0, 0, 0);
    expect(ms).toBe(expectedTarget.getTime() - base.getTime());
  });
});
