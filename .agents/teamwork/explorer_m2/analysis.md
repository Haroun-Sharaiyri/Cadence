# Cadence — Milestone 2: Checklist Domain, Offline Store & Rollover Engine
## Technical Specification & Implementation Architecture

**Author**: `explorer_m2` (Domain, Offline Store & Rollover Specialist)  
**Date**: 2026-10-18  
**Target Milestone**: Milestone 2 (M2)  
**Integrates With**: M1 (App Shell & Liquid Glass UI), M3 (Interactions & Components), M4 (Supabase Sync)  
**Authoritative Contracts**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `explorer_domain/analysis.md`, `spec_miner_sync/analysis.md`

---

## 1. Executive Summary & Architectural Invariants

Milestone 2 establishes the core computational engine and persistent local offline store of Cadence. All checklist operations execute in `< 16ms` with zero loading spinners, 100% offline functionality, and mathematical determinism across reloads, background app sleep, and multi-device synchronization.

### 1.1 Invariants Enforced in Milestone 2
1. **Zero-Cron Daily Rollover**: No server-side cron jobs, background workers, or active push notifications are required. The logical day is derived purely via local wall-clock calendar arithmetic:
   $$\text{logicalDay} = \text{localDate}(t - H_{\text{rollover}} \times 3,600,000)$$
   When the app is opened after any offline gap (hours, days, or weeks), all daily routine items immediately evaluate to unchecked without network requests.
2. **Persistent Work List Immunity**: Items in the `work` tab never reset at rollover. Completed items remain in place, struck through and dimmed, until explicitly deleted or bulk-cleared.
3. **Atomic Outbox Enqueue**: Every mutating local operation writes the entity state to its IndexedDB table and appends a mutation record to `outbox_mutations` in a **single atomic Dexie transaction** (`db.transaction('rw', ...)`), guaranteeing zero lost writes.
4. **Deterministic LWW Conflict Resolution**: Concurrent edits on multiple devices reconcile deterministically using a monotonic Lamport clock combined with a UUID tie-breaker, guaranteeing strict commutativity and associativity:
   $$\text{resolveLWW}(A, B) \equiv \text{resolveLWW}(B, A)$$
5. **Soft-Delete Tombstone Propagation**: Deletions assign `deleted_at = monotonicNow()`. UI queries filter active items with `deleted_at === null`. Tombstones propagate downstream to prevent the "resurrection bug."
6. **Fractional Indexing Reorder**: Drag-and-drop item reordering calculates midpoint fractional indices ($O(1)$ single-record updates) rather than shifting whole arrays.

---

## 2. Domain Modeling (`src/domain/types.ts`)

### 2.1 Complete Production Code
```typescript
/**
 * src/domain/types.ts
 * Authoritative domain models and contracts for Cadence.
 */

export type ChecklistType = 'today_morning' | 'today_work' | 'today_evening' | 'work';

export type TodaySectionType = 'today_morning' | 'today_work' | 'today_evening';

export const TODAY_SECTIONS: readonly TodaySectionType[] = [
  'today_morning',
  'today_work',
  'today_evening',
] as const;

export const TODAY_SECTION_LABELS: Record<TodaySectionType, string> = {
  today_morning: 'Morning Routine',
  today_work: 'Work Day',
  today_evening: 'Evening Routine',
};

export interface ChecklistItem {
  id: string; // UUID v4
  user_id?: string; // Supabase auth user UUID or 'local'
  list_type: ChecklistType;
  title: string;
  sort_order: number; // Fractional index (e.g. 1000.0, 2000.0)
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 UTC timestamp
  last_completed_day: string | null; // "YYYY-MM-DD" representing the logical day when checked
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (monotonic Lamport)
  deleted_at: string | null; // ISO 8601 UTC timestamp or null (soft-delete tombstone)
}

export interface Goal {
  id: string; // UUID v4
  user_id?: string; // Supabase auth user UUID or 'local'
  statement: string; // Goal statement text
  target_date: string | null; // "YYYY-MM-DD" or null
  updated_at: string; // ISO 8601 UTC timestamp
  deleted_at: string | null; // ISO 8601 UTC timestamp or null
}

export interface UserSettings {
  user_id?: string; // Supabase auth user UUID or 'local'
  rollover_hour: number; // Integer between 0 and 23 (default 4)
  updated_at: string; // ISO 8601 UTC timestamp
}

export interface OutboxMutation {
  id?: number; // Auto-incrementing primary key in Dexie
  table_name: 'checklist_items' | 'goals' | 'user_settings';
  record_id: string;
  action: 'upsert' | 'delete';
  payload: ChecklistItem | Goal | UserSettings;
  timestamp: number; // Unix epoch ms
  retry_count: number;
  last_error?: string;
}

export interface CountdownResult {
  hasTarget: boolean;
  status: 'future' | 'today' | 'overdue' | 'none';
  daysRemaining: number;
  displayText: string;
}

export interface SectionProgress {
  completed: number;
  total: number;
  percent: number; // 0 to 100
}

export interface DayProgress {
  completed: number;
  total: number;
  percent: number; // 0 to 100
  isAllCompleted: boolean;
}
```

---

## 3. Rollover Engine (`src/domain/rollover.ts` & `src/domain/rollover.test.ts`)

### 3.1 Logical Day & Rollover Arithmetic
The daily rollover occurs at $H_{\text{rollover}}$ (default 4:00 AM local time).
Because browser tabs are suspended on mobile or when laptops sleep, we avoid timers for basic state evaluation. Instead, whether a daily item is checked depends on its `last_completed_day` compared against `getLogicalDay(now, rolloverHour)`:
- If `item.list_type === 'work'`, checked status is simply `item.is_completed`.
- If `item.list_type` is a Today section, it is checked today **if and only if** `item.is_completed === true && item.last_completed_day === currentLogicalDay`.

When the app is open across the rollover moment, `msUntilNextRollover()` fires a timer and triggers a gentle visual cascade reset without reloading the page.

### 3.2 Production Code: `src/domain/rollover.ts`
```typescript
/**
 * src/domain/rollover.ts
 * Pure computational functions for logical day derivation, rollover scheduling, and item completion state.
 */

import type { ChecklistItem } from './types';

/**
 * Returns the current logical day string (YYYY-MM-DD) for a given timestamp and rollover hour.
 * Adjusts local wall-clock hours backwards by rolloverHour.
 * Times before rolloverHour (e.g. 03:59:59 with rolloverHour = 4) belong to the previous calendar day.
 */
export function getLogicalDay(
  date: Date = new Date(),
  rolloverHour: number = 4
): string {
  const h = Math.max(0, Math.min(23, Math.floor(rolloverHour)));
  const d = new Date(date.getTime());
  
  // Subtract rolloverHour in local civil time coordinates
  d.setHours(d.getHours() - h);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Determines whether a checklist item is currently checked for the active logical day.
 * - Work tab items are persistent: their status is strictly item.is_completed.
 * - Daily routine items (morning, work, evening): only checked if is_completed is true
 *   AND last_completed_day matches the active logical day.
 */
export function isItemCheckedToday(
  item: ChecklistItem,
  logicalDay: string
): boolean {
  if (item.list_type === 'work') {
    return item.is_completed;
  }
  return item.is_completed && item.last_completed_day === logicalDay;
}

/**
 * Calculates the exact number of milliseconds remaining until the next rollover occurrence.
 * Accurately accommodates local daylight saving time (DST) shifts (23-hour and 25-hour days).
 */
export function msUntilNextRollover(
  now: Date = new Date(),
  rolloverHour: number = 4
): number {
  const h = Math.max(0, Math.min(23, Math.floor(rolloverHour)));
  const next = new Date(now.getTime());
  
  next.setHours(h, 0, 0, 0);
  
  // If the target hour for today has already passed or is right now, advance to tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
    // Explicitly re-apply setHours after setDate to ensure civil hour stability across DST transitions
    next.setHours(h, 0, 0, 0);
  }
  
  return Math.max(0, next.getTime() - now.getTime());
}
```

### 3.3 Vitest Unit Test Suite: `src/domain/rollover.test.ts`
```typescript
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
    // Save original TZ
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';

      // Spring Forward: Sunday, March 8, 2026 (clocks jump 2:00 AM -> 3:00 AM)
      // 03:59:59 EDT belongs to previous logical day
      const springBefore = new Date('2026-03-08T03:59:59');
      expect(getLogicalDay(springBefore, 4)).toBe('2026-03-07');

      // 04:00:00 EDT begins the new logical day
      const springAfter = new Date('2026-03-08T04:00:00');
      expect(getLogicalDay(springAfter, 4)).toBe('2026-03-08');

      // Fall Back: Sunday, November 1, 2026 (clocks fall back 2:00 AM -> 1:00 AM)
      // 03:59:59 EST belongs to previous logical day
      const fallBefore = new Date('2026-11-01T03:59:59');
      expect(getLogicalDay(fallBefore, 4)).toBe('2026-10-31');

      // 04:00:00 EST begins the new logical day
      const fallAfter = new Date('2026-11-01T04:00:00');
      expect(getLogicalDay(fallAfter, 4)).toBe('2026-11-01');
    } finally {
      process.env.TZ = originalTz;
    }
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

  it('correctly accounts for 23-hour DST spring-forward days and 25-hour fall-back days', () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';

      // 4:00 AM on March 7 to 4:00 AM on March 8 (spring forward day, 23 hours)
      const msSpring = msUntilNextRollover(new Date('2026-03-07T04:00:00'), 4);
      expect(msSpring).toBe(23 * 60 * 60 * 1000);

      // 4:00 AM on Oct 31 to 4:00 AM on Nov 1 (fall back day, 25 hours)
      const msFall = msUntilNextRollover(new Date('2026-10-31T04:00:00'), 4);
      expect(msFall).toBe(25 * 60 * 60 * 1000);
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
```

---

## 4. Goal Countdown Engine (`src/domain/countdown.ts` & `src/domain/countdown.test.ts`)

### 4.1 Countdown Algorithm
The Goal hero card displays an optional target countdown (e.g., "142 days left", "1 day left", "Due today", "1 day overdue", "X days overdue").
To eliminate time zone jitter, UTC epoch day differences are computed from the `YYYY-MM-DD` strings.

### 4.2 Production Code: `src/domain/countdown.ts`
```typescript
/**
 * src/domain/countdown.ts
 * Computes human-readable countdowns for Goal hero cards relative to the user's active logical day.
 */

import type { CountdownResult } from './types';

/**
 * Computes dynamic countdown text and status for a target date relative to the current logical day.
 * Returns null if targetDate is null, empty, or unparseable.
 */
export function computeGoalCountdown(
  targetDate: string | null | undefined,
  logicalDay: string
): CountdownResult | null {
  if (!targetDate || typeof targetDate !== 'string' || targetDate.trim() === '') {
    return null;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const trimmedTarget = targetDate.trim();
  const trimmedLogical = logicalDay.trim();

  if (!dateRegex.test(trimmedTarget) || !dateRegex.test(trimmedLogical)) {
    return null;
  }

  const [tY, tM, tD] = trimmedTarget.split('-').map(Number);
  const [cY, cM, cD] = trimmedLogical.split('-').map(Number);

  // Parse in UTC coordinates to prevent local timezone clock shifts from altering day counts
  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const currentUtc = Date.UTC(cY, cM - 1, cD);

  if (isNaN(targetUtc) || isNaN(currentUtc)) {
    return null;
  }

  const diffMs = targetUtc - currentUtc;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return {
      hasTarget: true,
      status: 'future',
      daysRemaining: diffDays,
      displayText: `${diffDays} days left`,
    };
  } else if (diffDays === 1) {
    return {
      hasTarget: true,
      status: 'future',
      daysRemaining: 1,
      displayText: '1 day left',
    };
  } else if (diffDays === 0) {
    return {
      hasTarget: true,
      status: 'today',
      daysRemaining: 0,
      displayText: 'Due today',
    };
  } else if (diffDays === -1) {
    return {
      hasTarget: true,
      status: 'overdue',
      daysRemaining: -1,
      displayText: '1 day overdue',
    };
  } else {
    const overdueDays = Math.abs(diffDays);
    return {
      hasTarget: true,
      status: 'overdue',
      daysRemaining: diffDays,
      displayText: `${overdueDays} days overdue`,
    };
  }
}
```

### 4.3 Vitest Unit Test Suite: `src/domain/countdown.test.ts`
```typescript
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
```

---

## 5. Deterministic Last-Write-Wins (LWW) Engine (`src/domain/lww.ts` & `src/domain/lww.test.ts`)

### 5.1 Monotonic Lamport Clock & Conflict Resolution Mathematics
1. **Clock Skew Defense**: Clock drift between devices or system clock adjustments could break causal ordering. The `LamportClock` guarantees that locally generated ISO timestamps are strictly monotonically increasing. Calling `receive(remoteTimestamp)` advances the local clock past any observed remote event.
2. **Deterministic Total Order**:
   - $T_{\text{remote}} > T_{\text{local}} \implies \text{Remote wins}$.
   - $T_{\text{local}} > T_{\text{remote}} \implies \text{Local wins}$.
   - $T_{\text{remote}} == T_{\text{local}} \implies$ UUID tie-breaker:
     $$\text{tieBreakerRemote}.localeCompare(\text{tieBreakerLocal}) > 0 \implies \text{Remote wins}, \text{else Local wins}$$
3. **Mathematical Properties**:
   - **Commutative**: Order of comparison does not affect winning state.
   - **Associative**: Pairwise reduction across 3 or more concurrent edits yields identical end state.
   - **Idempotent**: Re-resolving identical records yields no mutation.

### 5.2 Production Code: `src/domain/lww.ts`
```typescript
/**
 * src/domain/lww.ts
 * Monotonic Lamport Clock and Deterministic Last-Write-Wins (LWW) conflict resolution algorithm.
 */

export class LamportClock {
  private lastTimestampMs: number = 0;
  private counter: number = 0;

  constructor(initialMs: number = 0) {
    this.lastTimestampMs = initialMs;
  }

  /**
   * Generates a strictly monotonically increasing ISO 8601 UTC timestamp.
   * If called multiple times within the same millisecond, increments an offset to maintain strict ordering.
   */
  public now(): string {
    const realNow = Date.now();
    if (realNow > this.lastTimestampMs) {
      this.lastTimestampMs = realNow;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
    const effectiveMs = this.lastTimestampMs + this.counter;
    return new Date(effectiveMs).toISOString();
  }

  /**
   * Advances the internal clock if a received remote timestamp is ahead of the local counter.
   */
  public receive(remoteIsoString: string): void {
    const remoteMs = new Date(remoteIsoString).getTime();
    if (!isNaN(remoteMs) && remoteMs >= this.lastTimestampMs) {
      this.lastTimestampMs = remoteMs + 1;
      this.counter = 0;
    }
  }

  public getRawTime(): number {
    return this.lastTimestampMs + this.counter;
  }
}

export const lamportClock = new LamportClock();

export interface LwwEntity {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
  [key: string]: any;
}

export interface LwwResolution<T extends LwwEntity> {
  winner: 'local' | 'remote' | 'equal';
  winningRecord: T;
  reason: 'timestamp' | 'tie_breaker' | 'identical';
}

/**
 * Deterministically resolves a conflict between a local record and a remote record.
 * Uses updated_at timestamp as primary order and client/record tie-breaker string as secondary order.
 */
export function resolveLWW<T extends LwwEntity>(
  local: T,
  remote: T,
  localTieBreaker?: string,
  remoteTieBreaker?: string
): LwwResolution<T> {
  if (local.id !== remote.id) {
    throw new Error(`Cannot resolve LWW conflict between different IDs: ${local.id} vs ${remote.id}`);
  }

  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();

  // 1. Primary order: Numerical timestamp comparison
  if (remoteTime > localTime) {
    return { winner: 'remote', winningRecord: remote, reason: 'timestamp' };
  }
  if (localTime > remoteTime) {
    return { winner: 'local', winningRecord: local, reason: 'timestamp' };
  }

  // 2. Secondary order: String ISO comparison (sub-millisecond or lexicographic difference)
  const timeComparison = remote.updated_at.localeCompare(local.updated_at);
  if (timeComparison > 0) {
    return { winner: 'remote', winningRecord: remote, reason: 'timestamp' };
  }
  if (timeComparison < 0) {
    return { winner: 'local', winningRecord: local, reason: 'timestamp' };
  }

  // 3. Exact timestamp match: Check content identity
  if (JSON.stringify(local) === JSON.stringify(remote)) {
    return { winner: 'equal', winningRecord: local, reason: 'identical' };
  }

  // 4. Deterministic tie-breaker using client UUID or record content hash
  const tieL = localTieBreaker ?? JSON.stringify(local);
  const tieR = remoteTieBreaker ?? JSON.stringify(remote);

  if (tieR.localeCompare(tieL) > 0) {
    return { winner: 'remote', winningRecord: remote, reason: 'tie_breaker' };
  } else {
    return { winner: 'local', winningRecord: local, reason: 'tie_breaker' };
  }
}
```

### 5.3 Vitest Unit Test Suite: `src/domain/lww.test.ts`
```typescript
/**
 * src/domain/lww.test.ts
 * Proves mathematical convergence, commutativity, associativity, and tombstone precedence for LWW conflict resolution.
 */

import { describe, it, expect } from 'vitest';
import { LamportClock, resolveLWW, type LwwEntity } from './lww';

interface MockItem extends LwwEntity {
  title: string;
  is_completed: boolean;
}

describe('Monotonic Lamport Clock', () => {
  it('guarantees strictly increasing timestamps even across 1,000 rapid calls', () => {
    const clock = new LamportClock();
    const timestamps: string[] = [];

    for (let i = 0; i < 1000; i++) {
      timestamps.push(clock.now());
    }

    for (let i = 1; i < timestamps.length; i++) {
      const prevMs = new Date(timestamps[i - 1]).getTime();
      const currMs = new Date(timestamps[i]).getTime();
      expect(currMs).toBeGreaterThan(prevMs);
    }
  });

  it('advances internal clock when receiving a future remote timestamp', () => {
    const clock = new LamportClock(10000);
    const remoteFuture = '2030-01-01T00:00:00.000Z';

    clock.receive(remoteFuture);
    const nextLocal = clock.now();

    expect(new Date(nextLocal).getTime()).toBeGreaterThan(new Date(remoteFuture).getTime());
  });
});

describe('Deterministic LWW Conflict Resolution', () => {
  it('selects the record with the newer timestamp as the winner', () => {
    const local: MockItem = {
      id: 'item-1',
      title: 'Local Title',
      is_completed: false,
      updated_at: '2026-10-18T10:00:00.000Z',
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Remote Title',
      is_completed: true,
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const res = resolveLWW(local, remote);
    expect(res.winner).toBe('remote');
    expect(res.winningRecord.title).toBe('Remote Title');
  });

  it('selects local record if local timestamp is newer', () => {
    const local: MockItem = {
      id: 'item-1',
      title: 'Local Title Newer',
      is_completed: true,
      updated_at: '2026-10-18T10:10:00.000Z',
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Remote Title Older',
      is_completed: false,
      updated_at: '2026-10-18T10:05:00.000Z',
    };

    const res = resolveLWW(local, remote);
    expect(res.winner).toBe('local');
    expect(res.winningRecord.title).toBe('Local Title Newer');
  });

  it('uses tie-breaker UUID deterministically when timestamps match exactly', () => {
    const timestamp = '2026-10-18T10:00:00.000Z';
    const local: MockItem = {
      id: 'item-1',
      title: 'Client A Edit',
      is_completed: false,
      updated_at: timestamp,
    };
    const remote: MockItem = {
      id: 'item-1',
      title: 'Client B Edit',
      is_completed: true,
      updated_at: timestamp,
    };

    const clientAUuid = 'aaaa-1111';
    const clientBUuid = 'bbbb-2222';

    // bbbb-2222 > aaaa-1111 lexicographically -> remote wins
    const resA = resolveLWW(local, remote, clientAUuid, clientBUuid);
    expect(resA.winner).toBe('remote');
    expect(resA.winningRecord.title).toBe('Client B Edit');

    // On Client B, local is clientBUuid and remote is clientAUuid -> local wins
    const resB = resolveLWW(remote, local, clientBUuid, clientAUuid);
    expect(resB.winner).toBe('local');
    expect(resB.winningRecord.title).toBe('Client B Edit');

    // Both clients converge on identical content!
    expect(resA.winningRecord.title).toBe(resB.winningRecord.title);
  });

  it('proves commutativity: resolveLWW(A, B) and resolveLWW(B, A) converge on the same record', () => {
    const itemA: MockItem = {
      id: 'item-1',
      title: 'Item A',
      is_completed: false,
      updated_at: '2026-10-18T12:00:00.000Z',
    };
    const itemB: MockItem = {
      id: 'item-1',
      title: 'Item B',
      is_completed: true,
      updated_at: '2026-10-18T12:01:00.000Z',
    };

    const res1 = resolveLWW(itemA, itemB, 'client-a', 'client-b');
    const res2 = resolveLWW(itemB, itemA, 'client-b', 'client-a');

    expect(res1.winningRecord).toEqual(res2.winningRecord);
  });

  it('proves associativity across 3 concurrent offline edits', () => {
    const itemA: MockItem = {
      id: 'item-1',
      title: 'Edit 1',
      is_completed: false,
      updated_at: '2026-10-18T12:00:00.000Z',
    };
    const itemB: MockItem = {
      id: 'item-1',
      title: 'Edit 2',
      is_completed: true,
      updated_at: '2026-10-18T12:05:00.000Z',
    };
    const itemC: MockItem = {
      id: 'item-1',
      title: 'Edit 3 (Final)',
      is_completed: true,
      updated_at: '2026-10-18T12:10:00.000Z',
    };

    // (A merge B) merge C
    const ab = resolveLWW(itemA, itemB).winningRecord;
    const abc = resolveLWW(ab, itemC).winningRecord;

    // A merge (B merge C)
    const bc = resolveLWW(itemB, itemC).winningRecord;
    const a_bc = resolveLWW(itemA, bc).winningRecord;

    expect(abc.title).toBe('Edit 3 (Final)');
    expect(a_bc.title).toBe('Edit 3 (Final)');
    expect(abc).toEqual(a_bc);
  });

  it('guarantees soft-delete tombstones prevail over older edits', () => {
    const editItem: MockItem = {
      id: 'item-1',
      title: 'Renamed habit',
      is_completed: true,
      updated_at: '2026-10-18T09:00:00.000Z',
      deleted_at: null,
    };
    const deletedItem: MockItem = {
      id: 'item-1',
      title: 'Old habit',
      is_completed: false,
      updated_at: '2026-10-18T09:15:00.000Z',
      deleted_at: '2026-10-18T09:15:00.000Z',
    };

    const res = resolveLWW(editItem, deletedItem);
    expect(res.winner).toBe('remote');
    expect(res.winningRecord.deleted_at).toBe('2026-10-18T09:15:00.000Z');
  });
});
```

---

## 6. Offline Store & Repository (`src/db/index.ts` & `src/db/repository.ts`)

### 6.1 Dexie.js Schema & Indexes (`src/db/index.ts`)
Dexie stores all data locally in browser IndexedDB.
Table indexing supports high-frequency queries:
- `checklist_items`: index on `[list_type+sort_order]` and `deleted_at`.
- `goals`: index on `updated_at` and `deleted_at`.
- `user_settings`: index on `user_id`.
- `outbox_mutations`: index on `++id` (FIFO processing).

```typescript
/**
 * src/db/index.ts
 * Authoritative Dexie.js database schema and instance for Cadence.
 */

import Dexie, { type Table } from 'dexie';
import type { ChecklistItem, Goal, UserSettings, OutboxMutation } from '../domain/types';

export class CadenceDatabase extends Dexie {
  checklist_items!: Table<ChecklistItem, string>;
  goals!: Table<Goal, string>;
  user_settings!: Table<UserSettings, string>;
  outbox_mutations!: Table<OutboxMutation, number>;

  constructor(databaseName: string = 'cadence_db') {
    super(databaseName);
    this.version(1).stores({
      checklist_items: 'id, user_id, list_type, sort_order, is_completed, last_completed_day, updated_at, deleted_at',
      goals: 'id, user_id, updated_at, deleted_at',
      user_settings: 'user_id, rollover_hour, updated_at',
      outbox_mutations: '++id, table_name, record_id, timestamp',
    });
  }
}

export const db = new CadenceDatabase();
```

### 6.2 Optimistic Repository Operations (`src/db/repository.ts`)
```typescript
/**
 * src/db/repository.ts
 * Optimistic CRUD operations for checklist items, goals, settings, and outbox mutations.
 * All mutations commit locally in < 16ms with zero loading spinners.
 */

import { db } from './index';
import type { ChecklistItem, ChecklistType, Goal, UserSettings, OutboxMutation } from '../domain/types';
import { lamportClock } from '../domain/lww';

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
  return (prevOrder! + nextOrder!) / 2.0;
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
    const maxOrder = existing.length > 0 ? existing[existing.length - 1].sort_order : 0;
    const sort_order = maxOrder + 1000.0;

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
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

      const isCompleted = !existing.is_completed;
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
   * Sets is_completed = false on all active Today section items.
   */
  async rolloverDailyItems(newLogicalDay: string): Promise<number> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const dailyItems = await db.checklist_items
        .filter((item) => item.list_type !== 'work' && item.deleted_at === null && item.is_completed)
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
        id: existing?.id ?? crypto.randomUUID(),
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
```

---

## 7. Reactive Hooks (`src/hooks/useRollover.ts` & `src/hooks/useChecklist.ts`)

### 7.1 Live Rollover Cascade Hook (`src/hooks/useRollover.ts`)
```typescript
/**
 * src/hooks/useRollover.ts
 * React hook that manages the active logical day and triggers live uncheck cascade at rollover.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLogicalDay, msUntilNextRollover } from '../domain/rollover';

export interface UseRolloverOptions {
  rolloverHour: number;
  onRollover?: (newLogicalDay: string) => void | Promise<void>;
  heartbeatIntervalMs?: number;
}

export interface UseRolloverResult {
  currentLogicalDay: string;
  isRollingOver: boolean;
  triggerManualRollover: () => Promise<void>;
}

export function useRollover({
  rolloverHour,
  onRollover,
  heartbeatIntervalMs = 30000,
}: UseRolloverOptions): UseRolloverResult {
  const [currentLogicalDay, setCurrentLogicalDay] = useState<string>(() =>
    getLogicalDay(new Date(), rolloverHour)
  );
  const [isRollingOver, setIsRollingOver] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const onRolloverRef = useRef(onRollover);
  onRolloverRef.current = onRollover;

  const executeRollover = useCallback(
    async (newDay: string) => {
      setIsRollingOver(true);
      setCurrentLogicalDay(newDay);
      try {
        if (onRolloverRef.current) {
          await onRolloverRef.current(newDay);
        }
      } finally {
        // Reset rolling over flag after cascade animation completes (approx 800ms)
        setTimeout(() => setIsRollingOver(false), 800);
      }
    },
    []
  );

  const checkAndSchedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const now = new Date();
    const evaluatedDay = getLogicalDay(now, rolloverHour);

    if (evaluatedDay !== currentLogicalDay) {
      executeRollover(evaluatedDay);
    }

    const msRemaining = msUntilNextRollover(now, rolloverHour);

    // Schedule exact timer (+50ms buffer to guarantee past boundary)
    timerRef.current = setTimeout(() => {
      const boundaryNow = new Date();
      const nextDay = getLogicalDay(boundaryNow, rolloverHour);
      executeRollover(nextDay);
      checkAndSchedule();
    }, msRemaining + 50);
  }, [rolloverHour, currentLogicalDay, executeRollover]);

  useEffect(() => {
    checkAndSchedule();

    const handleWakeAndFocus = () => {
      const now = new Date();
      const evaluatedDay = getLogicalDay(now, rolloverHour);
      if (evaluatedDay !== currentLogicalDay) {
        executeRollover(evaluatedDay);
        checkAndSchedule();
      }
    };

    // Heartbeat for suspended background tabs
    heartbeatRef.current = setInterval(handleWakeAndFocus, heartbeatIntervalMs);
    document.addEventListener('visibilitychange', handleWakeAndFocus);
    window.addEventListener('focus', handleWakeAndFocus);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', handleWakeAndFocus);
      window.removeEventListener('focus', handleWakeAndFocus);
    };
  }, [rolloverHour, currentLogicalDay, checkAndSchedule, executeRollover, heartbeatIntervalMs]);

  const triggerManualRollover = useCallback(async () => {
    const nextDay = getLogicalDay(new Date(), rolloverHour);
    await executeRollover(nextDay);
  }, [rolloverHour, executeRollover]);

  return {
    currentLogicalDay,
    isRollingOver,
    triggerManualRollover,
  };
}
```

### 7.2 Main Checklist Hook (`src/hooks/useChecklist.ts`)
```typescript
/**
 * src/hooks/useChecklist.ts
 * Primary reactive hook connecting UI components to local Dexie store and rollover engine.
 */

import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { checklistRepository } from '../db/repository';
import { useRollover } from './useRollover';
import { isItemCheckedToday } from '../domain/rollover';
import { computeGoalCountdown } from '../domain/countdown';
import type {
  ChecklistItem,
  ChecklistType,
  Goal,
  UserSettings,
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

  const settings = useLiveQuery(
    async () => {
      const s = await db.user_settings.get('local');
      return s ?? { user_id: 'local', rollover_hour: 4, updated_at: '' };
    },
    [],
    { user_id: 'local', rollover_hour: 4, updated_at: '' }
  );

  // 2. Rollover Engine connection
  const handleRolloverCascade = useCallback(async (newDay: string) => {
    await checklistRepository.rolloverDailyItems(newDay);
  }, []);

  const { currentLogicalDay, isRollingOver, triggerManualRollover } = useRollover({
    rolloverHour: settings.rollover_hour,
    onRollover: handleRolloverCascade,
  });

  // 3. Derived, sectioned lists with dynamic checked evaluation
  const morningItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_morning')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems]);

  const todayWorkItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_work')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems]);

  const eveningItems = useMemo(() => {
    return allItems
      .filter((i) => i.list_type === 'today_evening')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allItems]);

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
```

---

## 8. Step-by-Step Implementation Plan for Implementer

1. **Step 1: Create Domain Core**
   - Write `src/domain/types.ts`
   - Write `src/domain/rollover.ts`
   - Write `src/domain/rollover.test.ts`
   - Write `src/domain/countdown.ts`
   - Write `src/domain/countdown.test.ts`
   - Write `src/domain/lww.ts`
   - Write `src/domain/lww.test.ts`
   - Run `npm test` to verify 100% test pass on domain logic.

2. **Step 2: Create Local Database Store**
   - Write `src/db/index.ts`
   - Write `src/db/repository.ts`
   - Create a test file `src/db/repository.test.ts` using `fake-indexeddb` to verify:
     * Adding items spaced by 1000.0 fractional indices.
     * Reordering items between positions.
     * Soft delete semantics (`deleted_at` set, filtered from active queries).
     * Atomic enqueueing of outbox mutations.
     * "Clear Completed" bulk soft-deletion.
     * Rollover daily item reset.

3. **Step 3: Create Reactive Hooks**
   - Write `src/hooks/useRollover.ts`
   - Write `src/hooks/useChecklist.ts`
   - Create tests `src/hooks/useRollover.test.ts` and `src/hooks/useChecklist.test.tsx`.

4. **Step 4: Connect Store to `App.tsx` (Sub-16ms Reactive State)**
   - Wire `useChecklist()` into `App.tsx` replacing static placeholders.
   - Render actual section item counts and active goal.
   - Run `npm run typecheck`, `npm run lint`, and `npm test` to ensure zero errors.
