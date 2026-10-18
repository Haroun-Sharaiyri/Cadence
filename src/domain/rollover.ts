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
