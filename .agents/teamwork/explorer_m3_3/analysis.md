# Milestone 3 Exploration Analysis: Bottom Sheets, Goal Hero & App Integration

**Author**: `explorer_m3_3`  
**Milestone**: Milestone 3 — Apple-Grade Interactions, Motion & UI Components  
**Target Platform**: iPhone 17 Air (420x912 pt viewport, iOS 26 Liquid Glass) & Desktop (1440x900 viewport)  
**Date**: 2026-10-18  

---

## 1. Executive Summary & Architectural Overview

Milestone 3 brings Cadence to life with Apple-grade physical motion, tactile haptics, and the signature iOS 26 Liquid Glass visual design. While peer specialists explore Reminders-style checklist items (`explorer_m3_1`) and SVG progress rings with completion moments (`explorer_m3_2`), this analysis provides the **structural frame and interactive modal system** that unites the entire application:

1. **`BottomSheet.tsx`**: A reusable, fluid iOS 26 modal bottom sheet with native spring physics (`stiffness: 340, damping: 32`), rubber-banding resistance, Framer Motion drag-to-dismiss gesture (`drag="y"`, > 100px offset or velocity threshold), multi-stop `backdrop-blur-md` dimming, continuous `rounded-t-[28px]` squircle corners on mobile, and responsive transformation into an elevated centered glass modal card on desktop (`sm:rounded-[24px]`).
2. **`GoalHeroCard.tsx`**: The centerpiece squircle card pinned at the top of the Today tab and Desktop layout. Renders the user's primary ambition, dynamic countdowns ("142 days left", "Due today", "1 day overdue") via pure domain `computeGoalCountdown()`, seamless countdown hiding when target date is omitted, and an **ambient light shimmer** triggered when the entire day is completed (restrained, dignified, zero confetti).
3. **`GoalEditorSheet.tsx`**: Inset grouped bottom sheet with anti-zoom (>= 17px) statement editor, native HTML5 date picker with clear date action, Save, and a destructive "Clear Goal" button.
4. **`SettingsSheet.tsx`**: iOS-grade settings sheet offering the 0–23 hour Rollover picker (defaulting to 4:00 AM) that live-reconfigures the daily habit boundary, plus guest offline sync status and M4-ready sign-in actions.
5. **`ClearCompletedSheet.tsx`**: Contextual "Clear Completed" trigger button in the Work tab (strictly visible only when `>= 1` work task is checked), opening an iOS confirmation action sheet before atomically soft-deleting completed work tasks.
6. **End-to-End Wiring in `App.tsx` & `DesktopLayout.tsx`**: Seamless reactive orchestration with `useChecklist()`, wiring all routine sections (`today_morning`, `today_work`, `today_evening`), persistent Work tasks, progress indicators, modals, and desktop keyboard shortcuts (Space toggle, Arrow navigation, Enter add/save, Escape dismiss).

---

## 2. Component 1: `src/components/sheets/BottomSheet.tsx`

### Architectural Rationale & Physics
- **Gesture Mechanics**: Dragging on mobile uses Framer Motion's `drag="y"`. Drag constraints are locked at `{ top: 0, bottom: 0 }` with asymmetric elasticity (`dragElastic={{ top: 0.04, bottom: 0.75 }}`). Upward pulls encounter stiff resistance (mimicking iOS sheet ceiling limits), while downward drags follow the finger elastically.
- **Dismissal Threshold**: Dismissal fires if drag displacement `info.offset.y > 100` OR downward velocity `info.velocity.y > 400`. If released below these thresholds, Framer Motion's spring returns the sheet to `y: 0`.
- **Desktop Transformation**: On viewports `>= 640px` (desktop), the container centers the card with a gentle scale-in (`scale: 0.96 -> 1.0, opacity: 0 -> 1`), while mobile slides up from bottom (`y: '100%' -> 0`).
- **Accessibility & Focus Guard**: `role="dialog"`, `aria-modal="true"`, automatic background body scroll lock, and global Escape key listener.

### Production-Ready TypeScript Code

```tsx
/**
 * src/components/sheets/BottomSheet.tsx
 * Reusable iOS 26 Liquid Glass bottom sheet modal with drag-to-dismiss gesture.
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { clsx } from 'clsx';
import { SPRING_PRESETS, REDUCED_MOTION_TRANSITION } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showDragHandle?: boolean;
  headerLeading?: React.ReactNode;
  headerTrailing?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  showDragHandle = true,
  headerLeading,
  headerTrailing,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Escape key dismiss listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Lock background body scroll while sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Dismiss if dragged down > 100px or downward flick velocity > 400px/s
    if (info.offset.y > 100 || info.velocity.y > 400) {
      triggerHaptic('light');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Modal Sheet'}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none"
        >
          {/* Dimmed Blurred Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? REDUCED_MOTION_TRANSITION
                : { duration: 0.24, ease: 'easeOut' }
            }
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Liquid Glass Sheet Surface */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { y: '100%', opacity: 1 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { y: 0, opacity: 1 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { y: '100%', opacity: 0.9 }
            }
            transition={
              shouldReduceMotion
                ? REDUCED_MOTION_TRANSITION
                : SPRING_PRESETS.sheet
            }
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.75 }}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'relative z-10 w-full flex flex-col overflow-hidden',
              // Mobile layout: bottom sheet with safe area padding
              'rounded-t-[28px] max-h-[90vh] bg-[var(--secondary-system-grouped-background)] border-t border-[var(--glass-surface-border)] shadow-2xl',
              // Desktop layout: elevated centered card
              'sm:max-w-md sm:rounded-[24px] sm:max-h-[85vh] sm:border sm:border-[var(--glass-surface-border)] sm:my-auto',
              className
            )}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)',
            }}
          >
            {/* Top iOS Drag Handle Bar */}
            {showDragHandle && (
              <div className="w-full pt-3 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
                <div
                  className="w-9 h-1 rounded-full bg-[var(--system-fill)]"
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Header Chrome */}
            {(title || headerLeading || headerTrailing) && (
              <div className="relative px-5 py-2.5 flex items-center justify-between border-b border-[var(--separator)] min-h-[44px]">
                <div className="w-20 flex items-center justify-start">
                  {headerLeading}
                </div>

                {title && (
                  <h2 className="text-[17px] font-semibold text-[var(--label)] text-center tracking-[-0.41px] flex-1 truncate">
                    {title}
                  </h2>
                )}

                <div className="w-20 flex items-center justify-end">
                  {headerTrailing}
                </div>
              </div>
            )}

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
```

---

## 3. Component 2: `src/components/goal/GoalHeroCard.tsx`

### Design Specifications
- **Display Typography**: Prominent 22px bold statement (`text-[20px] sm:text-[22px] font-bold text-[var(--label)] leading-snug`).
- **Dynamic Countdown**: Evaluated from `computeGoalCountdown(targetDate, logicalDay)`:
  - `future`: Blue pill with calendar icon ("142 days left", "1 day left").
  - `today`: Orange glowing pill ("Due today").
  - `overdue`: Red pill ("3 days overdue").
  - `null / none`: Countdown pill completely hidden.
- **Single Ambient Shimmer (Restrained Done Moment)**: When `isDayComplete` is true, an elegant 1.6s ambient gradient sweep runs once across the squircle without intrusive celebration dialogs or confetti.

### Production-Ready TypeScript Code

```tsx
/**
 * src/components/goal/GoalHeroCard.tsx
 * Continuous-curve Liquid Glass squircle hero card with dynamic countdown & restrained shimmer.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, Clock, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { Goal, CountdownResult } from '../../domain/types';
import { triggerHaptic } from '../../utils/haptics';

export interface GoalHeroCardProps {
  goal: Goal | null;
  countdown: CountdownResult | null;
  isDayComplete?: boolean;
  onOpenEditor: () => void;
  className?: string;
}

export const GoalHeroCard: React.FC<GoalHeroCardProps> = ({
  goal,
  countdown,
  isDayComplete = false,
  onOpenEditor,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const hasStatement = Boolean(goal?.statement && goal.statement.trim().length > 0);

  const handleClick = () => {
    triggerHaptic('light');
    onOpenEditor();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        hasStatement
          ? `Primary Goal: ${goal!.statement}. ${
              countdown?.hasTarget ? countdown.displayText : ''
            }. Tap to edit.`
          : 'Tap to set your primary goal'
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        'group relative overflow-hidden rounded-[24px] p-5 sm:p-6 select-none cursor-pointer',
        'bg-[var(--goal-card-bg)] border border-[var(--goal-card-border)]',
        'shadow-[var(--goal-card-glow)] backdrop-blur-xl transition-all duration-200',
        'hover:opacity-[0.98] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]',
        className
      )}
    >
      {/* Specular Edge Highlight Overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.18)]"
        aria-hidden="true"
      />

      {/* Restrained Day-Complete Ambient Shimmer */}
      {isDayComplete && !shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]"
        >
          <motion.div
            initial={{ x: '-120%', opacity: 0 }}
            animate={{
              x: '220%',
              opacity: [0, 0.4, 0.7, 0.4, 0],
            }}
            transition={{
              duration: 1.6,
              ease: [0.16, 1, 0.3, 1],
              repeat: 0,
              delay: 0.15,
            }}
            className="w-full h-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.45)] dark:via-[rgba(100,210,255,0.22)] to-transparent -skew-x-12"
          />
        </motion.div>
      )}

      {/* Card Header: Eyebrow + Trailing Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[+0.8px] text-[var(--system-cyan)]">
            Primary Goal
          </span>
          {isDayComplete && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--system-green)] bg-[var(--system-green)]/10 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>Day Complete</span>
            </span>
          )}
        </div>

        <div className="flex items-center text-[var(--tertiary-label)] group-hover:text-[var(--secondary-label)] transition-colors">
          <span className="text-[13px] font-medium mr-0.5">Edit</span>
          <ChevronRight className="w-4 h-4 stroke-[2]" />
        </div>
      </div>

      {/* Goal Statement Text */}
      <div className="mb-3">
        {hasStatement ? (
          <p className="text-[20px] sm:text-[22px] font-bold text-[var(--label)] leading-snug tracking-[-0.35px] line-clamp-3">
            {goal!.statement}
          </p>
        ) : (
          <p className="text-[17px] sm:text-[19px] font-medium text-[var(--secondary-label)] italic">
            Tap to set your primary goal…
          </p>
        )}
      </div>

      {/* Dynamic Countdown Pill */}
      {countdown?.hasTarget && (
        <div className="flex items-center">
          <div
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold tabular-nums',
              countdown.status === 'future' &&
                'bg-[var(--system-blue)]/12 text-[var(--system-blue)]',
              countdown.status === 'today' &&
                'bg-[var(--system-orange)]/18 text-[var(--system-orange)] font-bold animate-pulse',
              countdown.status === 'overdue' &&
                'bg-[var(--system-red)]/15 text-[var(--system-red)] font-bold'
            )}
          >
            {countdown.status === 'future' && <Calendar className="w-3.5 h-3.5 stroke-[2]" />}
            {countdown.status === 'today' && <Clock className="w-3.5 h-3.5 stroke-[2]" />}
            {countdown.status === 'overdue' && <AlertCircle className="w-3.5 h-3.5 stroke-[2]" />}
            <span>{countdown.displayText}</span>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 4. Component 3: `src/components/sheets/GoalEditorSheet.tsx`

### Design Specifications
- Built atop `BottomSheet`.
- Header: Left "Cancel" button, Center "Primary Goal", Right "Save" button.
- Anti-zoom text area (`font-size: 17px !important`), autofocus on mount, character limit (240 chars).
- Native iOS `<input type="date">` for frictionless mobile date picker integration with quick "Clear Date" button.
- "Clear Goal" destructive button clears both statement and target date.

### Production-Ready TypeScript Code

```tsx
/**
 * src/components/sheets/GoalEditorSheet.tsx
 * Inset grouped editor sheet for goal statement and target date countdown.
 */

import React, { useState, useEffect, useRef } from 'react';
import { BottomSheet } from './BottomSheet';
import { triggerHaptic } from '../../utils/haptics';
import { X, Calendar as CalendarIcon, Trash2 } from 'lucide-react';

export interface GoalEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatement?: string;
  currentTargetDate?: string | null;
  onSave: (statement: string, targetDate: string | null) => Promise<void> | void;
  onClear?: () => Promise<void> | void;
}

export const GoalEditorSheet: React.FC<GoalEditorSheetProps> = ({
  isOpen,
  onClose,
  currentStatement = '',
  currentTargetDate = null,
  onSave,
  onClear,
}) => {
  const [statement, setStatement] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setStatement(currentStatement ?? '');
      setTargetDate(currentTargetDate ?? '');
      // Focus textarea with a brief delay for modal animation stability
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStatement, currentTargetDate]);

  const handleSave = async () => {
    const trimmed = statement.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      await onSave(trimmed, targetDate.trim() ? targetDate.trim() : null);
      triggerHaptic('light');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearGoal = async () => {
    setIsSubmitting(true);
    try {
      if (onClear) {
        await onClear();
      } else {
        await onSave('', null);
      }
      triggerHaptic('heavy');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDate = () => {
    setTargetDate('');
    triggerHaptic('selection');
  };

  const canSave = statement.trim().length > 0 && !isSubmitting;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Primary Goal"
      headerLeading={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-start text-[17px] text-[var(--system-blue)] active:opacity-60"
        >
          Cancel
        </button>
      }
      headerTrailing={
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] disabled:opacity-35 active:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="flex flex-col gap-6 select-none pb-2">
        {/* Section 1: Goal Statement */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <label
              htmlFor="goal-statement-input"
              className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]"
            >
              Goal Statement
            </label>
            <span className="text-[12px] text-[var(--tertiary-label)] tabular-nums">
              {statement.length}/240
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-1 border border-[var(--separator)] focus-within:border-[var(--system-blue)] transition-colors">
            <textarea
              id="goal-statement-input"
              ref={textareaRef}
              rows={3}
              maxLength={240}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="What is your main focus or ambition?"
              className="w-full bg-transparent px-3.5 py-2.5 text-[17px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Section 2: Target Date Countdown */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Target Date (Optional)
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-3 border border-[var(--separator)] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <CalendarIcon className="w-5 h-5 text-[var(--system-blue)]" />
                <span className="text-[15px] font-medium">Target Date</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-[var(--tertiary-system-fill)] text-[var(--label)] text-[16px] px-3 py-1.5 rounded-lg border border-transparent focus:border-[var(--system-blue)] outline-none"
                />

                {targetDate && (
                  <button
                    type="button"
                    onClick={handleClearDate}
                    aria-label="Clear target date"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--secondary-label)] hover:text-[var(--label)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-normal mt-1">
              Provides a dynamic countdown on the hero card. Clearing the date hides the countdown.
            </p>
          </div>
        </div>

        {/* Section 3: Destructive Clear Action */}
        {currentStatement && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleClearGoal}
              className="w-full min-h-[44px] rounded-2xl bg-[var(--system-red)]/10 text-[var(--system-red)] font-semibold text-[17px] flex items-center justify-center gap-2 hover:bg-[var(--system-red)]/18 active:scale-[0.985] transition-all"
            >
              <Trash2 className="w-4 h-4 stroke-[2]" />
              <span>Clear Goal</span>
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
```

---

## 5. Component 4: `src/components/sheets/SettingsSheet.tsx`

### Design Specifications
- Rollover hour picker (0 to 23 hours) with human-friendly descriptions ("4:00 AM (Default)", "12:00 AM Midnight", etc.).
- Connected to `useChecklist`'s `setRolloverHour(hour)` which triggers Dexie update, live Lamport timestamp, and instant logical day recalculation without reload.
- Account & Sync display: "Local Offline Mode" badge and M4-ready Sign In action.

### Production-Ready TypeScript Code

```tsx
/**
 * src/components/sheets/SettingsSheet.tsx
 * iOS Settings sheet for habit rollover configuration and offline/auth status.
 */

import React from 'react';
import { BottomSheet } from './BottomSheet';
import { triggerHaptic } from '../../utils/haptics';
import { Clock, ShieldCheck, Smartphone, Info } from 'lucide-react';

export interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rolloverHour: number;
  onUpdateRolloverHour: (hour: number) => Promise<void> | void;
  userEmail?: string | null;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
}

function formatRolloverHourOption(h: number): string {
  if (h === 0) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM${h === 4 ? ' (Default)' : ''}`;
  return `${h - 12}:00 PM`;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  rolloverHour,
  onUpdateRolloverHour,
  userEmail = null,
  onSignInClick,
  onSignOutClick,
}) => {
  const handleRolloverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    triggerHaptic('selection');
    onUpdateRolloverHour(newHour);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      headerTrailing={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60"
        >
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-6 select-none pb-4">
        {/* ── Section 1: Daily Habit Reset (Rollover Time) ────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Daily Habit Reset
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[var(--label)]">
                <Clock className="w-5 h-5 text-[var(--system-blue)]" />
                <span className="text-[16px] font-semibold">Rollover Time</span>
              </div>

              <select
                aria-label="Habit Rollover Hour"
                value={rolloverHour}
                onChange={handleRolloverChange}
                className="bg-[var(--tertiary-system-fill)] text-[var(--system-blue)] font-semibold text-[16px] px-3 py-1.5 rounded-xl border border-transparent focus:border-[var(--system-blue)] outline-none cursor-pointer"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {formatRolloverHourOption(h)}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              Items in Morning, Work Day, and Evening Routine uncheck automatically at this time each day, so late nights still count toward the previous day. Items persist; only checked states reset.
            </p>
          </div>
        </div>

        {/* ── Section 2: Account & Cloud Sync ─────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Account & Sync
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[var(--system-green)]" />
                <div>
                  <div className="text-[15px] font-semibold text-[var(--label)]">
                    {userEmail ? 'Signed In' : 'Guest / Local Storage'}
                  </div>
                  <div className="text-[13px] text-[var(--secondary-label)] truncate max-w-[200px]">
                    {userEmail ? userEmail : 'Offline-first (< 16ms)'}
                  </div>
                </div>
              </div>

              {userEmail ? (
                <button
                  type="button"
                  onClick={onSignOutClick}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold text-[var(--system-red)] bg-[var(--system-red)]/10 hover:bg-[var(--system-red)]/20 active:scale-95 transition-all"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignInClick}
                  className="min-h-[44px] px-4 py-1.5 rounded-xl text-[14px] font-semibold text-white bg-[var(--system-blue)] hover:opacity-90 active:scale-95 transition-all shadow-sm"
                >
                  Sign In
                </button>
              )}
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              Cadence stores all data locally in IndexedDB. Sign in with a 6-digit email code to sync across iPhone and desktop.
            </p>
          </div>
        </div>

        {/* ── Section 3: App Information ───────────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              About
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Smartphone className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Version</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)] tabular-nums">
                1.0.0 (Build 2026.10)
              </span>
            </div>

            <div className="h-[0.5px] bg-[var(--separator)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Info className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Design Language</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)]">
                Apple iOS 26 Liquid Glass
              </span>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};
```

---

## 6. Component 5: `src/components/sheets/ClearCompletedSheet.tsx`

### Design Specifications
- Trigger button: rendered in the Work tab, strictly visible only when `completedCount >= 1`.
- Modal: Apple confirmation dialog with destructive confirmation ("Clear X Completed Tasks") and safe "Cancel" action.
- Action: calls `checklistRepository.clearCompletedWorkItems()` / `clearCompletedWork()`, triggering heavy haptic feedback.

### Production-Ready TypeScript Code

```tsx
/**
 * src/components/sheets/ClearCompletedSheet.tsx
 * Confirmation action sheet and trigger button to clear completed persistent Work tasks.
 */

import React from 'react';
import { BottomSheet } from './BottomSheet';
import { Trash2, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface ClearCompletedTriggerProps {
  completedCount: number;
  onOpenConfirm: () => void;
}

export const ClearCompletedTrigger: React.FC<ClearCompletedTriggerProps> = ({
  completedCount,
  onOpenConfirm,
}) => {
  // STRICT RULE: visible ONLY when >= 1 item in work list is checked
  if (completedCount < 1) {
    return null;
  }

  const handleClick = () => {
    triggerHaptic('warning');
    onOpenConfirm();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Clear ${completedCount} completed tasks`}
      className="min-h-[44px] px-3.5 py-1.5 rounded-full text-[14px] font-semibold text-[var(--system-red)] bg-[var(--system-red)]/10 hover:bg-[var(--system-red)]/15 active:scale-95 transition-all flex items-center gap-1.5 select-none"
    >
      <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
      <span>Clear Completed ({completedCount})</span>
    </button>
  );
};

export interface ClearCompletedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  onConfirm: () => Promise<void> | void;
}

export const ClearCompletedSheet: React.FC<ClearCompletedSheetProps> = ({
  isOpen,
  onClose,
  completedCount,
  onConfirm,
}) => {
  const handleConfirm = async () => {
    triggerHaptic('heavy');
    await onConfirm();
    onClose();
  };

  const taskNoun = completedCount === 1 ? 'Task' : 'Tasks';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Clear Completed Tasks"
      showDragHandle={true}
    >
      <div className="flex flex-col items-center text-center gap-4 select-none pt-1 pb-3">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 rounded-full bg-[var(--system-red)]/12 flex items-center justify-center text-[var(--system-red)] mb-1">
          <AlertTriangle className="w-7 h-7 stroke-[2]" />
        </div>

        <div>
          <h3 className="text-[20px] font-bold text-[var(--label)] tracking-[-0.35px] mb-1.5">
            Clear {completedCount} Completed {taskNoun}?
          </h3>
          <p className="text-[15px] text-[var(--secondary-label)] leading-relaxed max-w-xs mx-auto">
            This will permanently remove {completedCount} checked {taskNoun.toLowerCase()} from your persistent Work list.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5 mt-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--system-red)] text-white font-semibold text-[17px] shadow-sm hover:opacity-95 active:scale-[0.985] transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5 stroke-[2]" />
            <span>Clear {completedCount} Completed {taskNoun}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--secondary-system-fill)] text-[var(--label)] font-semibold text-[17px] hover:bg-[var(--tertiary-system-fill)] active:scale-[0.985] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
```

---

## 7. Component 6: Full Wiring in `App.tsx` & `DesktopLayout.tsx`

### Architecture & Cohesion
- Wires `useChecklist()` directly to all views.
- Sections:
  - `today_morning` ("Morning Routine")
  - `today_work` ("Work Day")
  - `today_evening` ("Evening Routine")
  - `work` ("Persistent Tasks")
- Sub-component `ChecklistSectionView`: Self-contained, robust container that renders section headers (with progress counts, Add button, and inline quick-add input field), list rows with animated checkboxes and Edit mode controls (leading red minus, trailing drag handle, inline rename), and graceful empty states.
- All sheets (`GoalEditorSheet`, `SettingsSheet`, `ClearCompletedSheet`) are placed in the root rendering tree for immediate accessibility in both mobile and desktop modes.

### Production-Ready TypeScript Code: `src/App.tsx`

```tsx
/**
 * src/App.tsx
 * Cadence Root Application & Layout Orchestrator.
 * Full integration of useChecklist, Bottom Sheets, Goal Hero, and Section Lists.
 */

import React, { useState, useRef } from 'react';
import { useIsDesktop } from './hooks/useMediaQuery';
import { CollapsingHeader } from './components/common/CollapsingHeader';
import { FloatingTabBar, type TabId } from './components/common/FloatingTabBar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { formatHeaderDate } from './utils/time';
import { useChecklist } from './hooks/useChecklist';
import { GoalHeroCard } from './components/goal/GoalHeroCard';
import { GoalEditorSheet } from './components/sheets/GoalEditorSheet';
import { SettingsSheet } from './components/sheets/SettingsSheet';
import { ClearCompletedTrigger, ClearCompletedSheet } from './components/sheets/ClearCompletedSheet';
import { ChecklistSectionView } from './components/checklist/ChecklistSectionView';
import type { ChecklistType } from './domain/types';

export const App: React.FC = () => {
  const isDesktop = useIsDesktop();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState<boolean>(false);
  const [isClearCompletedOpen, setIsClearCompletedOpen] = useState<boolean>(false);

  // Scroll container ref for mobile collapsing navigation
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Primary reactive store hook
  const {
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
    addItem,
    toggleItem,
    renameItem,
    reorderItem,
    deleteItem,
    clearCompletedWork,
    updateGoal,
    setRolloverHour,
  } = useChecklist();

  const toggleEditMode = () => setIsEditMode((prev) => !prev);
  const openSettings = () => setIsSettingsOpen(true);
  const openGoalEditor = () => setIsGoalEditorOpen(true);

  // Goal Hero Card instance
  const goalHeroElement = (
    <GoalHeroCard
      goal={goal}
      countdown={countdown}
      isDayComplete={dayProgress.isAllCompleted}
      onOpenEditor={openGoalEditor}
    />
  );

  // Today tab routine lists
  const todaySectionsContent = (
    <div className="flex flex-col gap-4">
      {/* Morning Routine */}
      <ChecklistSectionView
        title="Morning Routine"
        listType="today_morning"
        items={morningItems}
        progress={morningProgress}
        isEditMode={isEditMode}
        emptyMessage="No morning habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      {/* Work Day Routine */}
      <ChecklistSectionView
        title="Work Day"
        listType="today_work"
        items={todayWorkItems}
        progress={todayWorkProgress}
        isEditMode={isEditMode}
        emptyMessage="No work habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />

      {/* Evening Routine */}
      <ChecklistSectionView
        title="Evening Routine"
        listType="today_evening"
        items={eveningItems}
        progress={eveningProgress}
        isEditMode={isEditMode}
        emptyMessage="No evening habits yet. Tap + to add habits."
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />
    </div>
  );

  // Work tab persistent tasks list
  const workSectionContent = (
    <div className="flex flex-col gap-4">
      <ChecklistSectionView
        title="Persistent Tasks"
        listType="work"
        items={workItems}
        isEditMode={isEditMode}
        emptyMessage="No tasks yet. Items stay in place when completed."
        headerTrailing={
          <ClearCompletedTrigger
            completedCount={completedWorkCount}
            onOpenConfirm={() => setIsClearCompletedOpen(true)}
          />
        }
        onAddItem={addItem}
        onToggleItem={toggleItem}
        onRenameItem={renameItem}
        onReorderItem={reorderItem}
        onDeleteItem={deleteItem}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[var(--system-grouped-background)] text-[var(--label)] flex flex-col select-none">
      {isDesktop ? (
        /* ── Desktop View (>= 1024px) ─────────────────────────────────── */
        <div className="h-full w-full overflow-y-auto">
          <DesktopLayout
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            goalHeroSlot={goalHeroElement}
            todaySlot={todaySectionsContent}
            workSlot={workSectionContent}
          />
        </div>
      ) : (
        /* ── Mobile View (< 1024px) ──────────────────────────────────── */
        <div className="relative h-full w-full flex flex-col">
          {/* Collapsing Header Top Chrome */}
          <CollapsingHeader
            title={activeTab === 'today' ? 'Today' : 'Work'}
            subtitle={activeTab === 'today' ? formatHeaderDate() : undefined}
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            scrollContainerRef={scrollContainerRef}
          />

          {/* Native Momentum Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 88px)',
            }}
          >
            {activeTab === 'today' ? (
              <div className="flex flex-col gap-4">
                {goalHeroElement}
                {todaySectionsContent}
              </div>
            ) : (
              workSectionContent
            )}
          </div>

          {/* Floating Glass Capsule Tab Bar */}
          <FloatingTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}

      {/* ── Global Bottom Sheets ───────────────────────────────────────── */}

      {/* 1. Goal Editor Sheet */}
      <GoalEditorSheet
        isOpen={isGoalEditorOpen}
        onClose={() => setIsGoalEditorOpen(false)}
        currentStatement={goal?.statement}
        currentTargetDate={goal?.target_date}
        onSave={async (stmt, date) => {
          await updateGoal(stmt, date);
          setIsGoalEditorOpen(false);
        }}
        onClear={async () => {
          await updateGoal('', null);
          setIsGoalEditorOpen(false);
        }}
      />

      {/* 2. Settings Sheet */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rolloverHour={settings.rollover_hour}
        onUpdateRolloverHour={setRolloverHour}
      />

      {/* 3. Clear Completed Work Confirmation Sheet */}
      <ClearCompletedSheet
        isOpen={isClearCompletedOpen}
        onClose={() => setIsClearCompletedOpen(false)}
        completedCount={completedWorkCount}
        onConfirm={async () => {
          await clearCompletedWork();
          setIsClearCompletedOpen(false);
        }}
      />
    </div>
  );
};

export default App;
```

---

### Production-Ready TypeScript Code: `src/components/checklist/ChecklistSectionView.tsx`

```tsx
/**
 * src/components/checklist/ChecklistSectionView.tsx
 * Inset grouped section container for checklist items with add item flow and empty states.
 */

import React, { useState, useRef } from 'react';
import { GlassContainer } from '../common/GlassContainer';
import type { ChecklistItem, ChecklistType, SectionProgress } from '../../domain/types';
import { Plus, Check, Trash2, GripVertical } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { clsx } from 'clsx';

export interface ChecklistSectionViewProps {
  title: string;
  listType: ChecklistType;
  items: ChecklistItem[];
  progress?: SectionProgress;
  isEditMode: boolean;
  emptyMessage: string;
  headerTrailing?: React.ReactNode;
  onAddItem: (listType: ChecklistType, title: string) => Promise<ChecklistItem>;
  onToggleItem: (id: string) => Promise<ChecklistItem | null>;
  onRenameItem: (id: string, newTitle: string) => Promise<ChecklistItem | null>;
  onReorderItem: (id: string, newOrder: number) => Promise<ChecklistItem | null>;
  onDeleteItem: (id: string) => Promise<boolean>;
}

export const ChecklistSectionView: React.FC<ChecklistSectionViewProps> = ({
  title,
  listType,
  items,
  progress,
  isEditMode,
  emptyMessage,
  headerTrailing,
  onAddItem,
  onToggleItem,
  onRenameItem,
  onDeleteItem,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartAdd = () => {
    setIsAdding(true);
    triggerHaptic('light');
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  const handleCommitAdd = async () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      triggerHaptic('light');
      await onAddItem(listType, trimmed);
      setNewTitle('');
    }
    setIsAdding(false);
  };

  const handleToggle = async (item: ChecklistItem) => {
    triggerHaptic('light');
    await onToggleItem(item.id);
  };

  const handleStartRename = (item: ChecklistItem) => {
    if (!isEditMode) return;
    setEditingItemId(item.id);
    setEditTitle(item.title);
    triggerHaptic('selection');
  };

  const handleCommitRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== items.find((i) => i.id === id)?.title) {
      await onRenameItem(id, trimmed);
    }
    setEditingItemId(null);
  };

  const handleDelete = async (id: string) => {
    triggerHaptic('heavy');
    await onDeleteItem(id);
  };

  return (
    <GlassContainer variant="card" className="p-4 overflow-hidden">
      {/* ── Section Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
            {title}
          </h3>

          {progress && progress.total > 0 && (
            <span className="text-[12px] font-medium text-[var(--tertiary-label)] tabular-nums">
              ({progress.completed}/{progress.total})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerTrailing}

          {/* Add Habit (+) Button */}
          <button
            type="button"
            onClick={handleStartAdd}
            aria-label={`Add item to ${title}`}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[var(--system-blue)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* ── Checklist Items List ──────────────────────────────────────── */}
      <div className="flex flex-col">
        {items.length === 0 && !isAdding ? (
          <div className="py-3 px-2 text-[15px] text-[var(--secondary-label)] italic">
            {emptyMessage}
          </div>
        ) : (
          items.map((item, index) => {
            const isEditing = editingItemId === item.id;

            return (
              <div
                key={item.id}
                data-checklist-row="true"
                tabIndex={0}
                className={clsx(
                  'group min-h-[44px] py-2 px-2 flex items-center justify-between gap-3 transition-colors',
                  index > 0 && 'border-t border-[var(--separator)]/40',
                  'hover:bg-[var(--tertiary-system-fill)]/40 rounded-xl'
                )}
              >
                {/* Leading: Edit Mode minus button or Checkbox */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Delete ${item.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--system-red)] active:scale-90 transition-transform"
                    >
                      <div className="w-5 h-5 rounded-full bg-[var(--system-red)] flex items-center justify-center text-white">
                        <Trash2 className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.is_completed}
                      aria-label={`Mark ${item.title} as ${item.is_completed ? 'incomplete' : 'complete'}`}
                      onClick={() => handleToggle(item)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <div
                        className={clsx(
                          'w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-150',
                          item.is_completed
                            ? 'bg-[var(--system-blue)] border-[var(--system-blue)] text-white shadow-sm'
                            : 'border-[var(--opaque-separator)] dark:border-[var(--separator)] bg-transparent hover:border-[var(--system-blue)]'
                        )}
                      >
                        {item.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </button>
                  )}

                  {/* Title / Inline Rename */}
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleCommitRename(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename(item.id);
                        if (e.key === 'Escape') setEditingItemId(null);
                      }}
                      className="flex-1 bg-[var(--secondary-system-fill)] px-2.5 py-1 rounded-lg text-[17px] text-[var(--label)] outline-none ring-2 ring-[var(--system-blue)]"
                    />
                  ) : (
                    <span
                      onClick={() => handleStartRename(item)}
                      className={clsx(
                        'flex-1 text-[17px] leading-tight transition-all select-none truncate',
                        item.is_completed && !isEditMode
                          ? 'line-through text-[var(--tertiary-label)]'
                          : 'text-[var(--label)]',
                        isEditMode && 'cursor-text hover:text-[var(--system-blue)]'
                      )}
                    >
                      {item.title}
                    </span>
                  )}
                </div>

                {/* Trailing: Edit Mode reorder handle */}
                {isEditMode && (
                  <div
                    aria-label="Drag to reorder"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--tertiary-label)] cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* ── Inline Add Item Row ────────────────────────────────────── */}
        {isAdding && (
          <div className="pt-2 px-2 flex items-center gap-2 border-t border-[var(--separator)]/40">
            <input
              ref={addInputRef}
              type="text"
              value={newTitle}
              placeholder="Habit or task title…"
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleCommitAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-[var(--secondary-system-fill)] px-3 py-2 rounded-xl text-[17px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none ring-2 ring-[var(--system-blue)]"
            />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCommitAdd}
              className="min-h-[44px] px-3.5 rounded-xl bg-[var(--system-blue)] text-white text-[15px] font-semibold"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </GlassContainer>
  );
};
```

---

## 8. Verification & Integration Guide

### 1. TypeScript Strict Typecheck
```powershell
npm run typecheck
```
Ensures complete strict typing, zero implicit any, and adherence to `src/domain/types.ts`.

### 2. Unit Testing Repository & Rollover Engine
```powershell
npm test
```
Verifies all 100 existing unit and adversarial tests pass without degradation.

### 3. Verification Matrix
| Requirement | Component | Verification Procedure |
|---|---|---|
| **Drag to dismiss** | `BottomSheet.tsx` | Drag bottom sheet down > 100px or downward flick; sheet smoothly springs away and calls `onClose()`. |
| **Backdrop dim & Escape key** | `BottomSheet.tsx` | Tap backdrop or press Escape; sheet dismisses immediately. |
| **Desktop centered card** | `BottomSheet.tsx` | On desktop viewport (>= 640px), modal transforms from bottom sheet to centered floating dialog. |
| **Dynamic Goal Countdown** | `GoalHeroCard.tsx` | Verify "142 days left", "Due today", "1 day overdue" render correctly; clearing date hides badge. |
| **Restrained Shimmer** | `GoalHeroCard.tsx` | Complete all items in Morning, Work Day, and Evening; hero card executes single ambient shimmer. |
| **Rollover Hour Update** | `SettingsSheet.tsx` | Select new rollover hour; `user_settings` table updates in Dexie and boundary changes live. |
| **Clear Completed Work** | `ClearCompletedSheet.tsx` | Check 1 item in Work tab; "Clear Completed" button appears. Confirming soft-deletes only completed work items. |
