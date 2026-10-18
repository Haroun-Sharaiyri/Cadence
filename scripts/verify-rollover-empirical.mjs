/**
 * scripts/verify-rollover-empirical.mjs
 * Standalone empirical runner testing multi-timezone DST transitions (America/New_York, Europe/London),
 * boundary transitions, 0-23h parameter sweeps, offline gaps, and work list immunity.
 */

import { getLogicalDay, isItemCheckedToday, msUntilNextRollover } from '../src/domain/rollover.ts';

const currentTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`[Empirical Test Runner] Active Timezone: ${currentTZ}`);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

let testCount = 0;
function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`  ✓ [${testCount}] ${name}`);
  } catch (err) {
    console.error(`  ❌ [${testCount}] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n--- 1. BOUNDARY PRECISION TESTS ---');

test('Boundary precision: 03:59:59.999 vs 04:00:00.000 local time', () => {
  const base = new Date(2026, 9, 18, 4, 0, 0, 0); // Oct 18, 2026 04:00:00.000 local
  const before = new Date(base.getTime() - 1); // 03:59:59.999 local
  const at = new Date(base.getTime());         // 04:00:00.000 local

  assert(getLogicalDay(before, 4) === '2026-10-17', `Expected 2026-10-17, got ${getLogicalDay(before, 4)}`);
  assert(getLogicalDay(at, 4) === '2026-10-18', `Expected 2026-10-18, got ${getLogicalDay(at, 4)}`);
});

console.log('\n--- 2. FULL 0-23 HOUR SWEEP ---');

test('Full 0-23 hour sweep on standard date (2026-06-15)', () => {
  for (let h = 0; h < 24; h++) {
    const atBoundary = new Date(2026, 5, 15, h, 0, 0, 0);
    const beforeBoundary = new Date(atBoundary.getTime() - 1);

    const actualAt = getLogicalDay(atBoundary, h);
    const actualBefore = getLogicalDay(beforeBoundary, h);

    assert(actualAt === '2026-06-15', `h=${h}: expected 2026-06-15 at boundary, got ${actualAt}`);
    assert(actualBefore === '2026-06-14', `h=${h}: expected 2026-06-14 before boundary, got ${actualBefore}`);
  }
});

test('Full 0-23 hour sweep on Leap Year boundary (2028-03-01)', () => {
  for (let h = 0; h < 24; h++) {
    const atBoundary = new Date(2028, 2, 1, h, 0, 0, 0);
    const beforeBoundary = new Date(atBoundary.getTime() - 1);

    const actualAt = getLogicalDay(atBoundary, h);
    const actualBefore = getLogicalDay(beforeBoundary, h);

    assert(actualAt === '2028-03-01', `h=${h}: expected 2028-03-01 at boundary, got ${actualAt}`);
    assert(actualBefore === '2028-02-29', `h=${h}: expected 2028-02-29 before boundary, got ${actualBefore}`);
  }
});

console.log('\n--- 3. DST RESILIENCE (CALENDAR & MS CALCULATION) ---');

test('DST Spring Forward boundary & elapsed ms calculation', () => {
  // If in America/New_York: 2026-03-08 is spring forward (23h day)
  // If in Europe/London: 2026-03-29 is spring forward (23h day)
  const isNY = currentTZ === 'America/New_York';
  const isLondon = currentTZ === 'Europe/London';

  if (isNY) {
    // 2026-03-08 at 03:59:59.999 EDT
    const springBefore = new Date(2026, 2, 8, 3, 59, 59, 999);
    const springAt = new Date(2026, 2, 8, 4, 0, 0, 0);

    assert(getLogicalDay(springBefore, 4) === '2026-03-07', `NY spring before failed: ${getLogicalDay(springBefore, 4)}`);
    assert(getLogicalDay(springAt, 4) === '2026-03-08', `NY spring at failed: ${getLogicalDay(springAt, 4)}`);

    // msUntilNextRollover from 2026-03-07 22:00:00 to 2026-03-08 04:00:00
    // Clocks jump 2am -> 3am, so 22:00 -> 04:00 is exactly 5 hours, NOT 6 hours!
    const eveningBefore = new Date(2026, 2, 7, 22, 0, 0, 0);
    const msRemaining = msUntilNextRollover(eveningBefore, 4);
    const expectedMs = 5 * 60 * 60 * 1000;
    assert(msRemaining === expectedMs, `NY spring ms mismatch: expected ${expectedMs} (5h), got ${msRemaining} (${msRemaining/3600000}h)`);
  } else if (isLondon) {
    // 2026-03-29 at 03:59:59.999 BST
    const springBefore = new Date(2026, 2, 29, 3, 59, 59, 999);
    const springAt = new Date(2026, 2, 29, 4, 0, 0, 0);

    assert(getLogicalDay(springBefore, 4) === '2026-03-28', `London spring before failed: ${getLogicalDay(springBefore, 4)}`);
    assert(getLogicalDay(springAt, 4) === '2026-03-29', `London spring at failed: ${getLogicalDay(springAt, 4)}`);

    // msUntilNextRollover from 2026-03-28 22:00:00 to 2026-03-29 04:00:00
    // Clocks jump 1am -> 2am, so 22:00 -> 04:00 is exactly 5 hours!
    const eveningBefore = new Date(2026, 2, 28, 22, 0, 0, 0);
    const msRemaining = msUntilNextRollover(eveningBefore, 4);
    const expectedMs = 5 * 60 * 60 * 1000;
    assert(msRemaining === expectedMs, `London spring ms mismatch: expected ${expectedMs} (5h), got ${msRemaining} (${msRemaining/3600000}h)`);
  } else {
    console.log(`  (Skipping timezone-specific DST spring assertions in ${currentTZ})`);
  }
});

test('DST Fall Back boundary & elapsed ms calculation', () => {
  const isNY = currentTZ === 'America/New_York';
  const isLondon = currentTZ === 'Europe/London';

  if (isNY) {
    // 2026-11-01 at 03:59:59.999 EST
    const fallBefore = new Date(2026, 10, 1, 3, 59, 59, 999);
    const fallAt = new Date(2026, 10, 1, 4, 0, 0, 0);

    assert(getLogicalDay(fallBefore, 4) === '2026-10-31', `NY fall before failed: ${getLogicalDay(fallBefore, 4)}`);
    assert(getLogicalDay(fallAt, 4) === '2026-11-01', `NY fall at failed: ${getLogicalDay(fallAt, 4)}`);

    // msUntilNextRollover from 2026-10-31 22:00:00 to 2026-11-01 04:00:00
    // Clocks repeat 1am -> 2am, so 22:00 -> 04:00 is exactly 7 hours, NOT 6 hours!
    // Note: October is month index 9 (0-indexed)
    const eveningBefore = new Date(2026, 9, 31, 22, 0, 0, 0);
    const msRemaining = msUntilNextRollover(eveningBefore, 4);
    const expectedMs = 7 * 60 * 60 * 1000;
    assert(msRemaining === expectedMs, `NY fall ms mismatch: expected ${expectedMs} (7h), got ${msRemaining} (${msRemaining/3600000}h)`);
  } else if (isLondon) {
    // 2026-10-25 at 03:59:59.999 GMT
    const fallBefore = new Date(2026, 9, 25, 3, 59, 59, 999);
    const fallAt = new Date(2026, 9, 25, 4, 0, 0, 0);

    assert(getLogicalDay(fallBefore, 4) === '2026-10-24', `London fall before failed: ${getLogicalDay(fallBefore, 4)}`);
    assert(getLogicalDay(fallAt, 4) === '2026-10-25', `London fall at failed: ${getLogicalDay(fallAt, 4)}`);

    // msUntilNextRollover from 2026-10-24 22:00:00 to 2026-10-25 04:00:00
    // Clocks repeat 1am -> 2am, so 22:00 -> 04:00 is exactly 7 hours!
    const eveningBefore = new Date(2026, 9, 24, 22, 0, 0, 0);
    const msRemaining = msUntilNextRollover(eveningBefore, 4);
    const expectedMs = 7 * 60 * 60 * 1000;
    assert(msRemaining === expectedMs, `London fall ms mismatch: expected ${expectedMs} (7h), got ${msRemaining} (${msRemaining/3600000}h)`);
  } else {
    console.log(`  (Skipping timezone-specific DST fall assertions in ${currentTZ})`);
  }
});

console.log('\n--- 4. OFFLINE MULTI-DAY GAP TESTS ---');

test('Offline gap: items completed 3 days ago or 30 days ago evaluate to false immediately', () => {
  const currentLogicalDay = '2026-10-18';

  const itemCompleted3DaysAgo = {
    id: 'item-3d',
    list_type: 'today_morning',
    title: 'Morning Meditate',
    sort_order: 1000.0,
    is_completed: true,
    last_completed_day: '2026-10-15',
    created_at: '2026-10-15T08:00:00.000Z',
    updated_at: '2026-10-15T08:00:00.000Z',
    completed_at: '2026-10-15T08:00:00.000Z',
    deleted_at: null,
  };

  const itemCompleted30DaysAgo = {
    id: 'item-30d',
    list_type: 'today_work',
    title: 'Review Inbox',
    sort_order: 2000.0,
    is_completed: true,
    last_completed_day: '2026-09-18',
    created_at: '2026-09-18T08:00:00.000Z',
    updated_at: '2026-09-18T08:00:00.000Z',
    completed_at: '2026-09-18T08:00:00.000Z',
    deleted_at: null,
  };

  const itemCompletedToday = {
    id: 'item-today',
    list_type: 'today_evening',
    title: 'Evening Journal',
    sort_order: 3000.0,
    is_completed: true,
    last_completed_day: '2026-10-18',
    created_at: '2026-10-18T08:00:00.000Z',
    updated_at: '2026-10-18T08:00:00.000Z',
    completed_at: '2026-10-18T08:00:00.000Z',
    deleted_at: null,
  };

  assert(isItemCheckedToday(itemCompleted3DaysAgo, currentLogicalDay) === false, '3-day gap should evaluate to false');
  assert(isItemCheckedToday(itemCompleted30DaysAgo, currentLogicalDay) === false, '30-day gap should evaluate to false');
  assert(isItemCheckedToday(itemCompletedToday, currentLogicalDay) === true, 'Today item should evaluate to true');
});

console.log('\n--- 5. WORK LIST IMMUNITY TESTS ---');

test('Work list immunity: items with list_type === "work" evaluate to isItemCheckedToday === is_completed', () => {
  const datesToTest = [
    '2026-10-18',
    '2026-10-19',
    '2026-10-25',
    '2026-11-01',
    '2027-01-01',
    '2028-02-29',
  ];

  const completedWorkItem = {
    id: 'work-1',
    list_type: 'work',
    title: 'Renew Passport',
    sort_order: 1000.0,
    is_completed: true,
    last_completed_day: '2026-08-01', // Months ago
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
    completed_at: '2026-08-01T08:00:00.000Z',
    deleted_at: null,
  };

  const uncompletedWorkItem = {
    id: 'work-2',
    list_type: 'work',
    title: 'File Tax Return',
    sort_order: 2000.0,
    is_completed: false,
    last_completed_day: null,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    completed_at: null,
    deleted_at: null,
  };

  for (const date of datesToTest) {
    assert(
      isItemCheckedToday(completedWorkItem, date) === true,
      `Work item must remain checked on ${date}`
    );
    assert(
      isItemCheckedToday(uncompletedWorkItem, date) === false,
      `Work item must remain unchecked on ${date}`
    );
  }
});

console.log('\n✅ ALL EMPIRICAL CHECKS PASSED FOR TIMEZONE:', currentTZ);
