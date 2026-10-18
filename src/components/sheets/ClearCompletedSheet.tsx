/**
 * src/components/sheets/ClearCompletedSheet.tsx
 * Confirmation action sheet and trigger button to clear completed persistent Work tasks.
 */

import React from 'react';
import { BottomSheet } from './BottomSheet';
import { Trash2, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
export { ClearCompletedTrigger, type ClearCompletedTriggerProps } from './ClearCompletedTrigger';

export interface ClearCompletedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  onConfirm: () => Promise<unknown> | void;
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
            className="w-full min-h-[48px] rounded-2xl bg-[var(--system-red)] text-white font-semibold text-[17px] shadow-sm hover:opacity-95 active:scale-[0.985] transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
          >
            <Trash2 className="w-5 h-5 stroke-[2]" />
            <span>Clear {completedCount} Completed {taskNoun}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--secondary-system-fill)] text-[var(--label)] font-semibold text-[17px] hover:bg-[var(--tertiary-system-fill)] active:scale-[0.985] transition-all border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default ClearCompletedSheet;
