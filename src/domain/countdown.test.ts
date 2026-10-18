/**
 * src/domain/countdown.test.ts
 * Unit tests verifying Goal countdown calculations across all temporal states and boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { computeGoalCountdown } from './countdown';

describe('Goal Countdown Engine: computeGoalCountdown', () => {
  const currentLogicalDay = '2026-10-18';

  it('returns null when target date is null, undefined, empty, or whitespace', () => {
    expect(computeGoalCountdown(null, currentLogicalDay)).toBeNull();
    expect(computeGoalCountdown(undefined, currentLogicalDay)).toBeNull();
    expect(computeGoalCountdown('', currentLogicalDay)).toBeNull();
    expect(computeGoalCountdown('   ', currentLogicalDay)).toBeNull();
  });

  it('returns null when target date format is invalid', () => {
    expect(computeGoalCountdown('invalid-date', currentLogicalDay)).toBeNull();
    expect(computeGoalCountdown('2026/10/18', currentLogicalDay)).toBeNull();
    expect(computeGoalCountdown('18-10-2026', currentLogicalDay)).toBeNull();
  });

  it('formats multi-day future targets as "X days left"', () => {
    const result = computeGoalCountdown('2027-03-09', currentLogicalDay);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('future');
    expect(result?.daysRemaining).toBe(142);
    expect(result?.displayText).toBe('142 days left');
  });

  it('formats single-day future target as "1 day left"', () => {
    const result = computeGoalCountdown('2026-10-19', currentLogicalDay);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('future');
    expect(result?.daysRemaining).toBe(1);
    expect(result?.displayText).toBe('1 day left');
  });

  it('formats same-day target as "Due today"', () => {
    const result = computeGoalCountdown('2026-10-18', currentLogicalDay);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('today');
    expect(result?.daysRemaining).toBe(0);
    expect(result?.displayText).toBe('Due today');
  });

  it('formats 1 day in the past as "1 day overdue"', () => {
    const result = computeGoalCountdown('2026-10-17', currentLogicalDay);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('overdue');
    expect(result?.daysRemaining).toBe(-1);
    expect(result?.displayText).toBe('1 day overdue');
  });

  it('formats multi-day past targets as "X days overdue"', () => {
    const result = computeGoalCountdown('2026-10-13', currentLogicalDay);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('overdue');
    expect(result?.daysRemaining).toBe(-5);
    expect(result?.displayText).toBe('5 days overdue');
  });

  it('correctly handles month and year boundary intervals', () => {
    // Current: 2026-12-30 -> Target: 2027-01-02 (3 days)
    const yearEndResult = computeGoalCountdown('2027-01-02', '2026-12-30');
    expect(yearEndResult?.daysRemaining).toBe(3);
    expect(yearEndResult?.displayText).toBe('3 days left');

    // Leap year leap day: 2028-02-28 -> 2028-03-01 (2 days)
    const leapResult = computeGoalCountdown('2028-03-01', '2028-02-28');
    expect(leapResult?.daysRemaining).toBe(2);
    expect(leapResult?.displayText).toBe('2 days left');
  });
});
