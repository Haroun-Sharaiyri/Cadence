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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
