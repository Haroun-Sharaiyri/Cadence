/**
 * src/components/sheets/ClearCompletedTrigger.tsx
 * Trigger button to clear completed persistent Work tasks.
 * Separated from ClearCompletedSheet so the modal sheet can be lazy-loaded.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('warning');
    onOpenConfirm();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Clear completed (${completedCount}) tasks`}
      className="min-h-[44px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[var(--system-red)] bg-[var(--system-red)]/10 hover:bg-[var(--system-red)]/15 active:scale-95 transition-all flex items-center gap-1.5 select-none border-none cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
      <span>Clear Completed ({completedCount})</span>
    </button>
  );
};

export default ClearCompletedTrigger;
