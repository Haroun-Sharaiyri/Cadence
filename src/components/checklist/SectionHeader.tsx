/**
 * src/components/checklist/SectionHeader.tsx
 * Inset grouped section header with title, progress ring, tabular count, and 44x44pt Add button.
 */

import React from 'react';
import { Plus, Sunrise, Zap, MoonStar, Layers } from 'lucide-react';
import clsx from 'clsx';
import { ProgressRing } from './ProgressRing';
import type { SectionAccent } from './Checkbox';
import { triggerHaptic } from '../../utils/haptics';

export interface SectionHeaderProps {
  /** Title of the section (e.g. "Morning Routine", "Work Day", "Evening Routine", "Work Tasks") */
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
  /** Section color accent */
  accent?: SectionAccent;
  /** Optional trailing action slot (e.g. clear completed, edit toggle) */
  actionSlot?: React.ReactNode;
  /** Optional custom CSS classes */
  className?: string;
}

const ACCENT_HEADER_CONFIG: Record<
  SectionAccent,
  {
    badgeBg: string;
    titleColor: string;
    plusBtn: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  amber: {
    badgeBg:
      'bg-gradient-to-br from-[#F59E0B] to-[#F97316] text-white shadow-[0_2px_10px_rgba(245,158,11,0.38)]',
    titleColor: 'text-[#B45309] dark:text-[#FBBF24]',
    plusBtn:
      'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#D97706] dark:text-[#FBBF24] border border-[#F59E0B]/30',
    Icon: Sunrise,
  },
  cyan: {
    badgeBg:
      'bg-gradient-to-br from-[#0EA5E9] to-[#3B82F6] text-white shadow-[0_2px_10px_rgba(14,165,233,0.38)]',
    titleColor: 'text-[#0369A1] dark:text-[#38BDF8]',
    plusBtn:
      'bg-[#0EA5E9]/15 hover:bg-[#0EA5E9]/25 text-[#0284C7] dark:text-[#38BDF8] border border-[#0EA5E9]/30',
    Icon: Zap,
  },
  purple: {
    badgeBg:
      'bg-gradient-to-br from-[#A855F7] to-[#EC4899] text-white shadow-[0_2px_10px_rgba(168,85,247,0.38)]',
    titleColor: 'text-[#7E22CE] dark:text-[#C084FC]',
    plusBtn:
      'bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#9333EA] dark:text-[#C084FC] border border-[#A855F7]/30',
    Icon: MoonStar,
  },
  emerald: {
    badgeBg:
      'bg-gradient-to-br from-[#10B981] to-[#06B6D4] text-white shadow-[0_2px_10px_rgba(16,185,129,0.38)]',
    titleColor: 'text-[#047857] dark:text-[#34D399]',
    plusBtn:
      'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#059669] dark:text-[#34D399] border border-[#10B981]/30',
    Icon: Layers,
  },
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  completed = 0,
  total = 0,
  showProgress = true,
  onAddItem,
  isEditMode = false,
  accent,
  actionSlot,
  className,
}) => {
  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    triggerHaptic('light');
    onAddItem?.();
  };

  const hasProgress = showProgress && total !== undefined;
  const cfg = accent ? ACCENT_HEADER_CONFIG[accent] : null;
  const BadgeIcon = cfg?.Icon;

  return (
    <div
      className={clsx(
        'flex items-center justify-between py-1.5 px-1 select-none',
        className
      )}
    >
      {/* ── Leading: Icon Badge + Section Title ────────────────────── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {cfg && BadgeIcon && (
          <span
            className={clsx(
              'w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0',
              cfg.badgeBg
            )}
            aria-hidden="true"
          >
            <BadgeIcon className="w-3.5 h-3.5 stroke-[2.3]" />
          </span>
        )}
        <h2
          className={clsx(
            'text-[13px] font-bold uppercase tracking-[+0.45px] truncate',
            cfg ? cfg.titleColor : 'text-[var(--secondary-label)]'
          )}
        >
          {title}
        </h2>
      </div>

      {/* ── Trailing: Progress Indicator + Add Button + Action Slot ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Progress Counter & Ring */}
        {hasProgress && total > 0 && (
          <div className="flex items-center gap-2 pl-2">
            <span
              className="text-[13px] font-semibold text-[var(--secondary-label)] tabular-nums"
              aria-hidden="true"
            >
              {completed} of {total}
            </span>
            <ProgressRing
              completed={completed}
              total={total}
              size={24}
              strokeWidth={2.8}
              accent={accent}
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
            <span
              className={clsx(
                'w-7 h-7 rounded-full active:scale-90 transition-all flex items-center justify-center shadow-sm',
                cfg
                  ? cfg.plusBtn
                  : 'bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] text-[var(--system-blue)]'
              )}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SectionHeader;
