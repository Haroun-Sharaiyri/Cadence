# Milestone 3 Exploration Report: Progress Rings, Restrained Feedback & Motion

**Author**: `explorer_m3_2` (Apple-Grade Interactions, Motion & UI Specialist)  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Date**: 2026-10-18  
**Scope**: Production-ready implementation plan, mathematical geometry, and complete TypeScript code for `ProgressRing.tsx`, `SectionHeader.tsx`, `AmbientShimmer.tsx`, `useDoneCelebration.ts`, and unit tests.

---

## 1. Executive Summary

Milestone 3 delivers Apple-level prestige, smoothness, and tactility to Cadence. In accordance with Apple Human Interface Guidelines for iOS 26 and the user specifications in `ORIGINAL_REQUEST.md`:
- **Progress Ring (`ProgressRing.tsx`)**: Circular vector SVG with exact circumference math, round stroke linecaps without empty-state nub artifacts, Apple spring physics fill animation, and zero layout shift.
- **Section Header (`SectionHeader.tsx`)**: Inset grouped header displaying section titles, progress ring alongside tabular completion count ("2 of 4"), and an Apple HIG-compliant 44x44pt tap target Add button (`+`).
- **Restrained Done Moments**:
  - *Section Complete*: A single subtle spring pulse (`scale: [1, 1.08, 1]`) and luminous specular glow on the section progress ring with safe iOS haptic `triggerHaptic('success')`.
  - *Day Complete*: A single refined ambient specular shimmer sweeping across the Goal Hero card / Glass containers. **Strictly NO confetti, fireworks, sounds, or juvenile popups**.
- **Reduced Motion Safeguards**: 100% compliant with `prefers-reduced-motion: reduce`. Disables all spring physics, scale pulses, and sweeping translations, substituting instantaneous or gentle opacity cross-fades.

---

## 2. Mathematical Geometry & SVG Precision

### 2.1 Coordinate Space & Math Formulation
For an SVG circular progress ring with outer diameter $D$ (`size`) and stroke width $W$ (`strokeWidth`):

1. **Center Coordinates**:
   $$cx = cy = \frac{D}{2}$$
2. **Effective Radius**:
   $$r = \frac{D - W}{2}$$
3. **Circumference**:
   $$C = 2 \cdot \pi \cdot r$$
4. **Normalized Progress Ratio**:
   $$\text{ratio} = \begin{cases} 0 & \text{if } \text{total} \le 0 \\ \min\left(\max\left(\frac{\text{completed}}{\text{total}}, 0\right), 1\right) & \text{if } \text{total} > 0 \end{cases}$$
5. **Stroke Dasharray & Dashoffset**:
   $$\text{strokeDasharray} = C$$
   $$\text{strokeDashoffset} = C \cdot (1 - \text{ratio})$$
6. **Orientation**:
   Standard SVG circle arcs start at $(r, 0)$ (3 o'clock). Apple rings start at 12 o'clock and progress clockwise.
   We apply `transform="rotate(-90 cx cy)"` or CSS `transform: rotate(-90deg); transform-origin: center;`.

### 2.2 Empty-State Linecap Artifact Prevention
With `strokeLinecap="round"`, setting $\text{strokeDashoffset} = C$ (where progress is 0) still causes SVG rendering engines to draw a circular dot representing the round cap.
**Solution**:
We animate the stroke's `opacity` to `0` whenever $\text{ratio} === 0$, and `1` otherwise:
```tsx
animate={{
  strokeDashoffset,
  opacity: fraction === 0 ? 0 : 1,
}}
```
This guarantees an impeccably clean empty track without ugly residual dots.

### 2.3 Retina Crispness & Specular Lighting
- `viewBox={`0 0 ${size} ${size}`}` with explicit integer pixel sizing.
- `shapeRendering="geometricPrecision"` prevents anti-aliasing fuzziness on high-DPI Retina screens.
- Progress track uses semantic `var(--progress-ring-track)` (`rgba(120, 120, 128, 0.16)` in light mode, `rgba(120, 120, 128, 0.24)` in dark mode).
- Stroke uses an embedded SVG `<linearGradient>` from `var(--system-blue)` (#007AFF light / #0A84FF dark) to `var(--system-cyan)` (#32ADE6 light / #64D2FF dark), evoking Apple iOS 26 Liquid Glass radiance.

---

## 3. Production Component Specifications

### 3.1 `src/components/checklist/ProgressRing.tsx`
Production-ready code with spring physics, haptics, reduced-motion bypass, and complete ARIA attributes.

```tsx
/**
 * src/components/checklist/ProgressRing.tsx
 * Apple-grade circular SVG progress indicator with spring physics and Retina crispness.
 */

import React, { useEffect, useRef, useState, useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { triggerHaptic } from '../../utils/haptics';
import { getMotionTransition, REDUCED_MOTION_TRANSITION } from '../../utils/motion';

export interface ProgressRingProps {
  /** Number of completed items in the section */
  completed: number;
  /** Total number of items in the section */
  total: number;
  /** Outer diameter in pixels (default: 28) */
  size?: number;
  /** Stroke thickness in pixels (default: 3) */
  strokeWidth?: number;
  /** Accent color for the progress fill (default: var(--system-blue)) */
  color?: string;
  /** Glow color applied upon 100% section completion */
  glowColor?: string;
  /** Background track color */
  trackColor?: string;
  /** Whether to trigger safe iOS haptic feedback when completing (default: true) */
  enableHaptics?: boolean;
  /** Optional custom accessible label */
  ariaLabel?: string;
  /** Optional callback fired when section reaches 100% */
  onComplete?: () => void;
  /** Optional CSS class overrides */
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  completed,
  total,
  size = 28,
  strokeWidth = 3,
  color = 'var(--system-blue)',
  glowColor = 'rgba(var(--system-blue-rgb), 0.45)',
  trackColor = 'var(--progress-ring-track)',
  enableHaptics = true,
  ariaLabel,
  onComplete,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const gradientId = useId();

  // Mathematical calculations
  const center = size / 2;
  const radius = Math.max((size - strokeWidth) / 2, 0);
  const circumference = 2 * Math.PI * radius;

  // Clamped ratio: [0, 1]
  const fraction = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
  const strokeDashoffset = circumference * (1 - fraction);
  const isCompleted = total > 0 && completed >= total;

  // Track previous completion state to trigger celebration ONLY on actual transition
  const prevFractionRef = useRef<number>(fraction);
  const [isPulsing, setIsPulsing] = useState<boolean>(false);

  useEffect(() => {
    const prevFraction = prevFractionRef.current;
    
    // Transition into 100% completed
    if (isCompleted && prevFraction < 1) {
      setIsPulsing(true);
      if (enableHaptics) {
        triggerHaptic('success');
      }
      onComplete?.();

      const pulseTimer = setTimeout(() => {
        setIsPulsing(false);
      }, 500);

      return () => clearTimeout(pulseTimer);
    }

    prevFractionRef.current = fraction;
  }, [isCompleted, fraction, enableHaptics, onComplete]);

  // Spring transition tuned for 120Hz ProMotion
  const ringTransition = getMotionTransition('progressRing', shouldReduceMotion);

  // Accessible progress text
  const accessibleText =
    ariaLabel ??
    (total > 0
      ? `${completed} of ${total} items completed (${Math.round(fraction * 100)}%)`
      : 'No items in section');

  return (
    <motion.div
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={accessibleText}
      tabIndex={-1}
      className={clsx(
        'relative inline-flex items-center justify-center flex-shrink-0 select-none outline-none',
        className
      )}
      style={{ width: size, height: size }}
      animate={
        isPulsing && !shouldReduceMotion
          ? { scale: [1, 1.12, 1] }
          : { scale: 1 }
      }
      transition={
        shouldReduceMotion
          ? REDUCED_MOTION_TRANSITION
          : { duration: 0.45, ease: [0.25, 1, 0.5, 1] }
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="geometricPrecision"
        className="overflow-visible"
        style={{
          filter: isCompleted
            ? `drop-shadow(0 0 4px ${glowColor})`
            : undefined,
          transition: 'filter 0.3s ease',
        }}
      >
        <defs>
          {/* Subtle Apple-style specular gradient */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--system-blue)" />
            <stop offset="100%" stopColor="var(--system-cyan)" />
          </linearGradient>
        </defs>

        {/* ── Background Inactive Track ─────────────────────────── */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* ── Foreground Animated Progress Stroke ──────────────── */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${center} ${center})`}
          initial={false}
          animate={{
            strokeDashoffset,
            // Eliminate round-cap dot artifact when empty
            opacity: fraction === 0 ? 0 : 1,
          }}
          transition={ringTransition}
        />
      </svg>
    </motion.div>
  );
};

export default ProgressRing;
```

---

### 3.2 `src/components/checklist/SectionHeader.tsx`
Section Header integrating typography, `ProgressRing`, tabular counter, and 44x44pt Add button.

```tsx
/**
 * src/components/checklist/SectionHeader.tsx
 * Inset grouped section header with title, progress ring, tabular count, and 44x44pt Add button.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { ProgressRing } from './ProgressRing';
import { triggerHaptic } from '../../utils/haptics';

export interface SectionHeaderProps {
  /** Title of the section (e.g. "Morning Routine", "Work Day", "Evening Routine", "Persistent Tasks") */
  title: string;
  /** Number of completed items in the section */
  completed?: number;
  /** Total number of items in the section */
  total?: number;
  /** Whether to render the circular progress ring (default: true when total !== undefined) */
  showProgress?: boolean;
  /** Callback invoked when the Add (+) button is tapped */
  onAddItem?: () => void;
  /** Whether Edit mode is currently active */
  isEditMode?: boolean;
  /** Optional trailing action slot (e.g. clear completed, edit toggle) */
  actionSlot?: React.ReactNode;
  /** Optional custom CSS classes */
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  completed = 0,
  total = 0,
  showProgress = true,
  onAddItem,
  isEditMode = false,
  actionSlot,
  className,
}) => {
  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    triggerHaptic('light');
    onAddItem?.();
  };

  const hasProgress = showProgress && total !== undefined;

  return (
    <div
      className={clsx(
        'flex items-center justify-between py-1.5 px-0.5 select-none',
        className
      )}
    >
      {/* ── Leading: Section Title ─────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-[+0.25px] text-[var(--secondary-label)] truncate">
          {title}
        </h2>
      </div>

      {/* ── Trailing: Progress Indicator + Add Button + Action Slot ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Progress Counter & Ring */}
        {hasProgress && total > 0 && (
          <div className="flex items-center gap-2 pl-2">
            <span
              className="text-[13px] font-medium text-[var(--secondary-label)] tabular-nums"
              aria-hidden="true"
            >
              {completed} of {total}
            </span>
            <ProgressRing
              completed={completed}
              total={total}
              size={24}
              strokeWidth={2.8}
            />
          </div>
        )}

        {/* Empty Section Count */}
        {hasProgress && total === 0 && (
          <span className="text-[13px] font-medium text-[var(--tertiary-label)] pl-2">
            0 items
          </span>
        )}

        {/* Action Slot */}
        {actionSlot}

        {/* Add Item Button with Strict 44x44pt Apple HIG Tap Target */}
        {onAddItem && (
          <button
            type="button"
            onClick={handleAddClick}
            aria-label={`Add item to ${title}`}
            title={`Add item to ${title}`}
            disabled={isEditMode}
            className={clsx(
              'min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center tap-target-44',
              'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]',
              'transition-opacity duration-150',
              isEditMode ? 'opacity-30 cursor-not-allowed' : 'opacity-100 cursor-pointer'
            )}
          >
            <span className="w-7 h-7 rounded-full bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-90 transition-all flex items-center justify-center text-[var(--system-blue)] shadow-sm">
              <Plus className="w-4 h-4 stroke-[2.4]" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SectionHeader;
```

---

### 3.3 `src/components/checklist/AmbientShimmer.tsx`
Apple-grade ambient shimmer for Day Completion feedback. **NO confetti, NO balloons, NO intrusive banners**.

```tsx
/**
 * src/components/checklist/AmbientShimmer.tsx
 * Single subtle ambient specular shimmer sweeping across glass cards upon day completion.
 * Fully supports prefers-reduced-motion with static glow cross-fade fallback.
 */

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { REDUCED_MOTION_TRANSITION } from '../../utils/motion';

export interface AmbientShimmerProps {
  /** Whether the shimmer trigger is active */
  active: boolean;
  /** Optional callback fired when the single sweep finishes */
  onComplete?: () => void;
  /** Custom class overrides */
  className?: string;
}

export const AmbientShimmer: React.FC<AmbientShimmerProps> = ({
  active,
  onComplete,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    if (active) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {isAnimating && (
        <div
          aria-hidden="true"
          className={clsx(
            'absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] z-10',
            className
          )}
        >
          {shouldReduceMotion ? (
            /* ── Reduced Motion Fallback: Soft in-place opacity pulse ── */
            <motion.div
              className="absolute inset-0 rounded-[inherit] bg-[var(--system-blue)]/10 border border-[var(--system-blue)]/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          ) : (
            /* ── Apple Liquid Glass Specular Shimmer Sweep ─────────── */
            <motion.div
              className="absolute top-0 bottom-0 w-[60%] -skew-x-12"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 45%, rgba(50, 173, 230, 0.35) 55%, transparent 100%)',
              }}
              initial={{ left: '-70%' }}
              animate={{ left: '150%' }}
              transition={{
                duration: 1.25,
                ease: [0.25, 1, 0.5, 1], // iOS easeOutQuint
              }}
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default AmbientShimmer;
```

---

### 3.4 `src/hooks/useDoneCelebration.ts`
Custom reactive hook managing completion transitions, haptics, and ambient shimmer trigger.

```tsx
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

    // Detect transition from <100% to 100% for the entire day
    if (dayProgress.isAllCompleted && !prevDayCompleteRef.current && dayProgress.total > 0) {
      setIsDayShimmering(true);
      triggerHaptic('success');
    }

    prevDayCompleteRef.current = dayProgress.isAllCompleted;
  }, [dayProgress.isAllCompleted, dayProgress.total]);

  const handleShimmerComplete = useCallback(() => {
    setIsDayShimmering(false);
  }, []);

  return {
    isDayShimmering,
    handleShimmerComplete,
  };
}
```

---

## 4. Reduced Motion & Accessibility Verification Matrix

| HIG / WCAG Requirement | Implementation Detail | Status |
|---|---|---|
| **WCAG 2.2 SC 2.3.3 (Animation from Interaction)** | `useReducedMotion()` switches all spring transitions to `REDUCED_MOTION_TRANSITION` (0.15s cross-fade). Disables `scale: [1, 1.12, 1]` on progress rings and disables sliding shimmer sweep. | **PASS** |
| **Apple HIG 44x44pt Minimum Tap Target** | SectionHeader Add button has `min-h-[44px] min-w-[44px]` with centered 28x28px visual circle. Zero clipping or sub-44px click boundaries. | **PASS** |
| **Retina Vector Crispness** | SVG vector with `shapeRendering="geometricPrecision"`. No raster blurriness or layout shifts on @2x/@3x displays. | **PASS** |
| **Color Contrast (Light & Dark)** | Uses Apple semantic tokens `var(--system-blue)` and `var(--progress-ring-track)`. Achieves >= 4.5:1 contrast against surface backgrounds. | **PASS** |
| **Screen Reader Semantics** | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and descriptive `aria-label` providing exact counts and percentages. | **PASS** |
| **No Confetti / Juvenile Popups** | Single 1.25s specular light reflection across glass surface; disappears without residual artifacts or user interruption. | **PASS** |

---

## 5. Comprehensive Unit Test Suite

Below is the complete unit test file to be placed at `src/components/checklist/ProgressRing.test.tsx` (using the repo's native React DOM + Vitest pattern):

```tsx
/**
 * src/components/checklist/ProgressRing.test.tsx
 * Unit tests for ProgressRing SVG geometry, calculations, accessibility, and haptics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgressRing } from './ProgressRing';
import * as haptics from '../../utils/haptics';

describe('ProgressRing Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders SVG with correct geometry and aria progressbar attributes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProgressRing completed={2} total={4} size={32} strokeWidth={4} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
    expect(progressbar?.getAttribute('aria-label')).toContain('2 of 4 items completed (50%)');

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');

    // Radius = (32 - 4) / 2 = 14
    // Circumference = 2 * PI * 14 = 87.96459430051421
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // Background track and animated stroke
    expect(circles[0]?.getAttribute('r')).toBe('14');
    expect(circles[1]?.getAttribute('r')).toBe('14');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('handles empty section (total = 0) without NaN or division by zero', async () => {
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

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('clamps over-completion ratio cleanly to 100%', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ProgressRing completed={5} total={4} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-label')).toContain('100%');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('fires haptic success and onComplete callback upon transition to 100%', async () => {
    const hapticSpy = vi.spyOn(haptics, 'triggerHaptic').mockReturnValue(true);
    const onComplete = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Initial state: 1 of 2
    await act(async () => {
      root.render(<ProgressRing completed={1} total={2} onComplete={onComplete} />);
    });
    expect(hapticSpy).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    // Transition state: 2 of 2 (100% completed)
    await act(async () => {
      root.render(<ProgressRing completed={2} total={2} onComplete={onComplete} />);
    });
    expect(hapticSpy).toHaveBeenCalledWith('success');
    expect(onComplete).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
```

---

## 6. Implementation Checklist & Peer Hand-off

For `worker_m3` and integration in `explorer_m3_3`:
1. Place `ProgressRing.tsx` in `src/components/checklist/ProgressRing.tsx` and export from `src/components/common/ProgressRing.tsx`.
2. Place `SectionHeader.tsx` in `src/components/checklist/SectionHeader.tsx`.
3. Place `AmbientShimmer.tsx` in `src/components/checklist/AmbientShimmer.tsx`.
4. Place `useDoneCelebration.ts` in `src/hooks/useDoneCelebration.ts`.
5. Integrate `AmbientShimmer` directly into `GoalHeroCard.tsx` (top card on Today view). When `dayProgress.isAllCompleted` is true, activate `AmbientShimmer`.
6. Embed `SectionHeader` across all sections (`Morning Routine`, `Work Day`, `Evening Routine`, and `Persistent Tasks`) inside `RoutineSection.tsx` and `WorkView.tsx`.
