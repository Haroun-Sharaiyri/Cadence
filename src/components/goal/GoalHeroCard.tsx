/**
 * src/components/goal/GoalHeroCard.tsx
 * Continuous-curve Liquid Glass squircle hero card with dynamic countdown & restrained shimmer.
 */

import React from 'react';
import { Calendar, Clock, AlertCircle, ChevronRight, Sparkles, Compass } from 'lucide-react';
import { clsx } from 'clsx';
import { AmbientShimmer } from '../checklist/AmbientShimmer';
import type { Goal, CountdownResult } from '../../domain/types';
import { triggerHaptic } from '../../utils/haptics';

export interface GoalHeroCardProps {
  goal: Goal | null;
  countdown: CountdownResult | null;
  isDayComplete?: boolean;
  isShimmering?: boolean;
  onOpenEditor: () => void;
  className?: string;
}

export const GoalHeroCard: React.FC<GoalHeroCardProps> = ({
  goal,
  countdown,
  isDayComplete = false,
  isShimmering = false,
  onOpenEditor,
  className,
}) => {
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
          ? `Primary Goal ${isDayComplete ? 'Day Complete ' : ''}Edit ${goal!.statement}${
              countdown?.hasTarget ? ` ${countdown.displayText}` : ''
            }`
          : `Primary Goal ${isDayComplete ? 'Day Complete ' : ''}Edit Tap to set your primary goal…`
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        'group relative overflow-hidden rounded-[24px] p-5 sm:p-6 select-none cursor-pointer',
        'bg-[var(--goal-card-bg)] border border-[var(--goal-card-border)]',
        'shadow-[var(--goal-card-glow)] backdrop-blur-xl transition-all duration-200',
        'hover:opacity-[0.99] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]',
        className
      )}
    >
      {/* Top Prism Gradient Accent Bar */}
      <div
        className={clsx(
          'pointer-events-none absolute top-0 left-0 right-0 h-[3px] opacity-90',
          isDayComplete
            ? 'bg-gradient-to-r from-[#10B981] via-[#38BDF8] to-[#F59E0B]'
            : 'bg-gradient-to-r from-[#38BDF8] via-[#6366F1] to-[#EC4899]'
        )}
        aria-hidden="true"
      />

      {/* Ambient Internal Color Glow Orbs */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#38BDF8]/20 dark:bg-[#38BDF8]/25 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-[#A855F7]/15 dark:bg-[#A855F7]/22 blur-2xl"
        aria-hidden="true"
      />

      {/* Specular Edge Highlight Overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.22)]"
        aria-hidden="true"
      />

      {/* Restrained Day-Complete Ambient Shimmer */}
      <AmbientShimmer active={isDayComplete || isShimmering} />

      {/* Card Header: Eyebrow + Trailing Indicator */}
      <div className="relative z-10 flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-[8px] flex items-center justify-center bg-gradient-to-br from-[#0EA5E9] via-[#6366F1] to-[#A855F7] text-white shadow-[0_2px_10px_rgba(99,102,241,0.45)]"
            aria-hidden="true"
          >
            <Compass className="w-3.5 h-3.5 stroke-[2.3]" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[+0.8px] text-[#0284C7] dark:text-[#70D7FF]">
            Primary Goal{' '}
          </span>
          {isDayComplete && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#059669] dark:text-[#34D399] bg-[#10B981]/15 border border-[#10B981]/30 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>Day Complete </span>
            </span>
          )}
        </div>

        <div className="flex items-center text-[var(--secondary-label)] group-hover:text-[var(--label)] transition-colors">
          <span className="text-[13px] font-semibold mr-0.5">Edit </span>
          <ChevronRight className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>

      {/* Goal Statement Text */}
      <div className="relative z-10 mb-3">
        {hasStatement ? (
          <p className="text-[20px] sm:text-[22px] font-bold text-[var(--label)] leading-snug tracking-[-0.35px] line-clamp-3">
            {goal!.statement}{' '}
          </p>
        ) : (
          <p className="text-[17px] sm:text-[19px] font-medium text-[var(--secondary-label)] italic">
            Tap to set your primary goal…
          </p>
        )}
      </div>

      {/* Dynamic Countdown Pill */}
      {countdown?.hasTarget && (
        <div className="relative z-10 flex items-center">
          <div
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold tabular-nums',
              countdown.status === 'future' &&
                'bg-[#0EA5E9]/15 text-[#0369A1] dark:text-[#70D7FF] border border-[#0EA5E9]/30',
              countdown.status === 'today' &&
                'bg-[#F59E0B]/20 text-[#B45309] dark:text-[#FBBF24] border border-[#F59E0B]/35 font-bold animate-pulse',
              countdown.status === 'overdue' &&
                'bg-[var(--system-red)]/18 text-[var(--system-red)] border border-[var(--system-red)]/35 font-bold'
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

export default GoalHeroCard;
