/**
 * src/hooks/useDoneCelebration.ts
 * Coordinates restrained section & day completion moments with transition guards.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import type { DayProgress, SectionProgress } from '../domain/types';

export interface UseDoneCelebrationProps {
  dayProgress: DayProgress;
  morningProgress?: SectionProgress;
  workProgress?: SectionProgress;
  eveningProgress?: SectionProgress;
}

export function useDoneCelebration({
  dayProgress,
  morningProgress,
  workProgress,
  eveningProgress,
}: UseDoneCelebrationProps) {
  const [isDayShimmering, setIsDayShimmering] = useState<boolean>(false);

  // Transition guards to prevent celebration triggers on initial page load / mount
  const hasMountedRef = useRef<boolean>(false);
  const prevDayCompleteRef = useRef<boolean>(dayProgress.isAllCompleted);
  const prevMorningCompleteRef = useRef<boolean>(
    (morningProgress?.completed ?? 0) === (morningProgress?.total ?? 0) && (morningProgress?.total ?? 0) > 0
  );
  const prevWorkCompleteRef = useRef<boolean>(
    (workProgress?.completed ?? 0) === (workProgress?.total ?? 0) && (workProgress?.total ?? 0) > 0
  );
  const prevEveningCompleteRef = useRef<boolean>(
    (eveningProgress?.completed ?? 0) === (eveningProgress?.total ?? 0) && (eveningProgress?.total ?? 0) > 0
  );

  useEffect(() => {
    // Skip celebration on the very first mount cycle
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevDayCompleteRef.current = dayProgress.isAllCompleted;
      return;
    }

    // If any task is unchecked, immediately clear the shimmer state
    if (!dayProgress.isAllCompleted) {
      setIsDayShimmering(false);
      prevDayCompleteRef.current = false;
      return;
    }

    // Detect transition from <100% to 100% for the entire day
    if (dayProgress.isAllCompleted && !prevDayCompleteRef.current && dayProgress.total > 0) {
      setIsDayShimmering(true);
      triggerHaptic('success');
      prevDayCompleteRef.current = true;

      const timer = setTimeout(() => {
        setIsDayShimmering(false);
      }, 2200);
      return () => clearTimeout(timer);
    }

    prevDayCompleteRef.current = dayProgress.isAllCompleted;
  }, [dayProgress.isAllCompleted, dayProgress.total]);

  // Section completion transitions
  useEffect(() => {
    const isMorningComplete =
      (morningProgress?.completed ?? 0) === (morningProgress?.total ?? 0) && (morningProgress?.total ?? 0) > 0;
    if (isMorningComplete && !prevMorningCompleteRef.current && hasMountedRef.current) {
      triggerHaptic('success');
    }
    prevMorningCompleteRef.current = isMorningComplete;
  }, [morningProgress?.completed, morningProgress?.total]);

  useEffect(() => {
    const isWorkComplete =
      (todayWorkProgress() ?? 0) === (workProgress?.total ?? 0) && (workProgress?.total ?? 0) > 0;
    function todayWorkProgress() {
      return workProgress?.completed ?? 0;
    }
    if (isWorkComplete && !prevWorkCompleteRef.current && hasMountedRef.current) {
      triggerHaptic('success');
    }
    prevWorkCompleteRef.current = isWorkComplete;
  }, [workProgress?.completed, workProgress?.total]);

  useEffect(() => {
    const isEveningComplete =
      (eveningProgress?.completed ?? 0) === (eveningProgress?.total ?? 0) && (eveningProgress?.total ?? 0) > 0;
    if (isEveningComplete && !prevEveningCompleteRef.current && hasMountedRef.current) {
      triggerHaptic('success');
    }
    prevEveningCompleteRef.current = isEveningComplete;
  }, [eveningProgress?.completed, eveningProgress?.total]);

  const handleShimmerComplete = useCallback(() => {
    setIsDayShimmering(false);
  }, []);

  return {
    isDayShimmering,
    handleShimmerComplete,
  };
}

export default useDoneCelebration;
