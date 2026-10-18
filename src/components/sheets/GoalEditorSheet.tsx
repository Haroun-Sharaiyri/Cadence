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
  onSave: (statement: string, targetDate: string | null) => Promise<unknown> | void;
  onClear?: () => Promise<unknown> | void;
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
      // Focus textarea with a brief delay for modal animation stability,
      // unless the user has already focused an input or textarea.
      const timer = setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          textareaRef.current?.focus();
        }
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
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-start text-[17px] text-[var(--system-blue)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
        >
          Cancel
        </button>
      }
      headerTrailing={
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] disabled:opacity-35 active:opacity-60 bg-transparent border-none cursor-pointer p-0"
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
              className="w-full bg-transparent px-3.5 py-2.5 text-[17px] text-[var(--label)] placeholder:text-[var(--tertiary-label)] outline-none resize-none leading-relaxed border-none"
              style={{ fontSize: '17px' }}
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
                  aria-label="Target Date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-[var(--tertiary-system-fill)] text-[var(--label)] text-[16px] px-3 py-1.5 rounded-lg border border-transparent focus:border-[var(--system-blue)] outline-none min-h-[44px]"
                  style={{ fontSize: '16px' }}
                />

                {targetDate && (
                  <button
                    type="button"
                    onClick={handleClearDate}
                    aria-label="Clear target date"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--secondary-label)] hover:text-[var(--label)] bg-transparent border-none cursor-pointer p-0"
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
              className="w-full min-h-[44px] rounded-2xl bg-[var(--system-red)]/10 text-[var(--system-red)] font-semibold text-[17px] flex items-center justify-center gap-2 hover:bg-[var(--system-red)]/18 active:scale-[0.985] transition-all border-none cursor-pointer"
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

export default GoalEditorSheet;
