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

  const partsT = trimmedTarget.split('-').map(Number);
  const partsC = trimmedLogical.split('-').map(Number);

  if (partsT.length !== 3 || partsC.length !== 3) {
    return null;
  }

  const [tY, tM, tD] = partsT as [number, number, number];
  const [cY, cM, cD] = partsC as [number, number, number];

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
