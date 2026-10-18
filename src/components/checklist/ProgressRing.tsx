/**
 * src/components/checklist/ProgressRing.tsx
 * Apple-grade circular SVG progress indicator with spring physics and Retina crispness.
 */

import React, { useEffect, useRef, useState, useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../utils/haptics';
import { getMotionTransition, REDUCED_MOTION_TRANSITION } from '../../utils/motion';

import type { SectionAccent } from './Checkbox';

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
  /** Section accent theme */
  accent?: SectionAccent;
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

const ACCENT_RING_STOPS: Record<SectionAccent, { start: string; end: string; glow: string }> = {
  amber: {
    start: '#FBBF24',
    end: '#F97316',
    glow: 'rgba(245, 158, 11, 0.55)',
  },
  cyan: {
    start: '#38BDF8',
    end: '#6366F1',
    glow: 'rgba(14, 165, 233, 0.55)',
  },
  purple: {
    start: '#C084FC',
    end: '#EC4899',
    glow: 'rgba(168, 85, 247, 0.55)',
  },
  emerald: {
    start: '#34D399',
    end: '#06B6D4',
    glow: 'rgba(16, 185, 129, 0.55)',
  },
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  completed,
  total,
  size = 28,
  strokeWidth = 3,
  accent,
  glowColor = 'rgba(var(--system-blue-rgb, 0, 122, 255), 0.45)',
  trackColor = 'var(--progress-ring-track, rgba(120, 120, 128, 0.16))',
  enableHaptics = true,
  ariaLabel,
  onComplete,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const gradientId = useId();
  const ringTheme = accent ? ACCENT_RING_STOPS[accent] : null;
  const effectiveGlow = ringTheme ? ringTheme.glow : glowColor;

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
            ? `drop-shadow(0 0 5px ${effectiveGlow})`
            : undefined,
          transition: 'filter 0.3s ease',
        }}
      >
        <defs>
          {/* Subtle Apple-style specular gradient */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ringTheme ? ringTheme.start : 'var(--system-blue)'} />
            <stop offset="100%" stopColor={ringTheme ? ringTheme.end : 'var(--system-cyan)'} />
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
