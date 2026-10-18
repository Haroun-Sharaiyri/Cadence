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

export default BottomSheet;
