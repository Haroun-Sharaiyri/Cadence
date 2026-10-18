/**
 * src/components/checklist/ChecklistItemRow.tsx
 * Inset grouped row with strikethrough, native Edit mode controls
 * (leading red minus, slide-out delete, 3-line drag handle, inline rename),
 * and touch swipe-to-delete.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion, type DragControls } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Checkbox, type SectionAccent } from './Checkbox';
import { triggerHaptic } from '../../utils/haptics';
import { getMotionTransition } from '../../utils/motion';
import type { ChecklistItem } from '../../domain/types';

export interface ChecklistItemRowProps {
  item: ChecklistItem;
  isEditMode: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  isLast?: boolean;
  dragControls?: DragControls;
  isSwipeable?: boolean; // Set true for Work tab when !isEditMode
  accent?: SectionAccent;
}

export const ChecklistItemRow: React.FC<ChecklistItemRowProps> = ({
  item,
  isEditMode,
  onToggle,
  onRename,
  onDelete,
  isLast = false,
  dragControls,
  isSwipeable = false,
  accent,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // State: Edit mode slide-out delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // State: Inline rename editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // State: Touch swipe-to-delete offset for Work tab
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  // Sync draft title if item title changes externally
  useEffect(() => {
    setDraftTitle(item.title);
  }, [item.title]);

  // Reset transient UI states when exiting Edit mode
  useEffect(() => {
    if (!isEditMode) {
      setShowDeleteConfirm(false);
      setIsEditingTitle(false);
    }
  }, [isEditMode]);

  // Focus input when entering inline rename mode
  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Save inline title rename
  const handleCommitRename = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(item.id, trimmed);
    } else {
      setDraftTitle(item.title);
    }
    setIsEditingTitle(false);
  }, [draftTitle, item.id, item.title, onRename]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDraftTitle(item.title);
        setIsEditingTitle(false);
      }
    },
    [handleCommitRename, item.title]
  );

  // Leading red minus click -> reveal trailing slide-out Delete button
  const handleMinusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    setShowDeleteConfirm((prev) => !prev);
  }, []);

  // Trailing delete confirmation click
  const handleDeleteCommit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic('heavy');
      onDelete(item.id);
    },
    [item.id, onDelete]
  );

  // Swipe-to-delete drag end handler (Work tab)
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
      setIsSwiping(false);
      if (!isSwipeable) return;
      const x = info.offset.x;
      const vx = info.velocity.x;

      // Full swipe threshold: > 150px or fast flick left
      if (x < -150 || (x < -80 && vx < -400)) {
        triggerHaptic('heavy');
        setSwipeOffset(-300);
        setTimeout(() => onDelete(item.id), 120);
      } else if (x < -65) {
        // Snap open to reveal action button
        triggerHaptic('light');
        setSwipeOffset(-96);
        setIsSwipeOpen(true);
      } else {
        // Spring back closed
        setSwipeOffset(0);
        setIsSwipeOpen(false);
      }
    },
    [isSwipeable, item.id, onDelete]
  );

  const handleCloseSwipe = useCallback(() => {
    if (isSwipeOpen) {
      setSwipeOffset(0);
      setIsSwipeOpen(false);
    }
  }, [isSwipeOpen]);

  const showSwipeLayer = isSwiping || isSwipeOpen || swipeOffset !== 0;

  return (
    <div
      data-checklist-row="true"
      tabIndex={0}
      className="relative overflow-hidden w-full select-none outline-none group"
      onClick={() => {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        if (isSwipeOpen) handleCloseSwipe();
      }}
    >
      {/* ── Background Action Layer (Swipe-to-Delete) ────────────────────── */}
      {isSwipeable && !isEditMode && (
        <div
          className={`absolute inset-0 bg-[var(--system-red)] flex items-center justify-end z-0 transition-opacity duration-150 ${
            showSwipeLayer ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!isSwipeOpen}
        >
          <button
            type="button"
            tabIndex={isSwipeOpen ? 0 : -1}
            aria-label={`Swipe delete ${item.title}`}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('heavy');
              onDelete(item.id);
            }}
            className="w-[96px] h-full flex items-center justify-center gap-1.5 text-white font-semibold text-[15px] bg-transparent border-none cursor-pointer outline-none p-0 min-h-[44px] min-w-[44px]"
          >
            <Trash2 className="w-4 h-4 stroke-[2.2] shrink-0" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* ── Foreground Content Row Layer ─────────────────────────────────── */}
      <motion.div
        drag={isSwipeable && !isEditMode ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={{ left: 0.15, right: 0.02 }}
        onDragStart={() => {
          if (isSwipeable && !isEditMode) setIsSwiping(true);
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: isSwipeable ? swipeOffset : 0 }}
        transition={getMotionTransition('checkboxSnap', shouldReduceMotion)}
        className={`relative z-10 flex items-center min-h-[52px] px-4 py-2.5 transition-colors duration-150 ${
          showSwipeLayer
            ? 'bg-[var(--secondary-system-grouped-background)] dark:bg-[#141828]'
            : 'bg-white/60 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.06]'
        }`}
      >
        {/* ── Leading Control (Edit Mode Red Minus vs Normal Checkbox) ─────── */}
        <div className="flex items-center shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {isEditMode ? (
              <motion.button
                key="edit-minus"
                type="button"
                aria-label={`Delete ${item.title}`}
                onClick={handleMinusClick}
                initial={{ width: 0, opacity: 0, scale: 0.7 }}
                animate={{ width: 44, opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.7 }}
                transition={getMotionTransition('checkboxSnap', shouldReduceMotion)}
                className="min-w-[44px] min-h-[44px] w-[44px] h-[44px] flex items-center justify-center p-0 m-0 bg-transparent border-none cursor-pointer outline-none"
              >
                <motion.div
                  className="w-[22px] h-[22px] rounded-full bg-[var(--system-red)] flex items-center justify-center shadow-sm"
                  animate={{ rotate: showDeleteConfirm ? 90 : 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="w-2.5 h-[2px] bg-white rounded-full" />
                </motion.div>
              </motion.button>
            ) : (
              <motion.div
                key="normal-checkbox"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Checkbox
                  checked={item.is_completed}
                  onChange={() => onToggle(item.id)}
                  label={item.title}
                  accent={accent}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Center Title / Inline Rename Field ───────────────────────────── */}
        <div className="flex-1 min-w-0 mx-2">
          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              aria-label={`Rename ${item.title}`}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={handleCommitRename}
              onKeyDown={handleInputKeyDown}
              className="w-full bg-transparent text-[17px] leading-[22px] text-[var(--label)] outline-none border-b border-[var(--system-blue)] py-1 font-normal tracking-[-0.41px]"
              style={{ fontSize: '17px' }}
            />
          ) : (
            <div
              onClick={() => {
                if (isEditMode) {
                  setIsEditingTitle(true);
                }
              }}
              className={`text-[17px] leading-[22px] tracking-[-0.41px] truncate transition-colors duration-200 ${
                item.is_completed
                  ? 'line-through text-[var(--tertiary-label)]'
                  : 'text-[var(--label)] font-normal'
              } ${isEditMode ? 'cursor-text hover:text-[var(--system-blue)]' : ''}`}
            >
              {item.title}
            </div>
          )}
        </div>

        {/* ── Trailing Actions: Slide-Out Delete & Reorder Handle ─────────── */}
        <div className="flex items-center shrink-0">
          <AnimatePresence>
            {/* Native Slide-Out Delete Button */}
            {isEditMode && showDeleteConfirm && (
              <motion.button
                type="button"
                aria-label={`Confirm delete ${item.title}`}
                onClick={handleDeleteCommit}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={getMotionTransition('checkboxSnap', shouldReduceMotion)}
                className="h-[36px] px-3.5 ml-2 bg-[var(--system-red)] text-white text-[15px] font-semibold rounded-[8px] flex items-center justify-center shrink-0 active:scale-95 transition-transform border-none cursor-pointer"
              >
                Delete
              </motion.button>
            )}
          </AnimatePresence>

          {/* 3-Line Reorder Drag Handle */}
          <AnimatePresence>
            {isEditMode && !showDeleteConfirm && (
              <motion.div
                role="button"
                tabIndex={0}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 44, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={getMotionTransition('checkboxSnap', shouldReduceMotion)}
                className="min-w-[44px] min-h-[44px] w-[44px] h-[44px] flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--tertiary-label)] hover:text-[var(--secondary-label)] touch-none select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  triggerHaptic('medium');
                  dragControls?.start(e);
                }}
                aria-label={`Reorder ${item.title}`}
              >
                {/* Authentic iOS 3-Bar Reorder Glyph */}
                <div className="w-[18px] h-[12px] flex flex-col justify-between py-[1px]">
                  <span className="w-full h-[1.5px] bg-current rounded-full" />
                  <span className="w-full h-[1.5px] bg-current rounded-full" />
                  <span className="w-full h-[1.5px] bg-current rounded-full" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Delete button on hover / focus (when !isEditMode) */}
          {!isEditMode && (
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('heavy');
                onDelete(item.id);
              }}
              className="opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 transition-opacity p-2 text-[var(--tertiary-label)] hover:text-[var(--system-red)] rounded-full hover:bg-[var(--system-red)]/10 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 stroke-[1.8]" />
            </button>
          )}
        </div>

        {/* ── Hairline Separator ───────────────────────────────────────────── */}
        {!isLast && (
          <div
            className="absolute bottom-0 left-[56px] right-0 h-[0.5px] bg-[var(--separator)] pointer-events-none"
            aria-hidden="true"
          />
        )}
      </motion.div>
    </div>
  );
};

export default ChecklistItemRow;
