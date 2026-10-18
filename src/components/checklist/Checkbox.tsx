/**
 * src/components/checklist/Checkbox.tsx
 * Reminders-style circular checkbox with SVG draw-in animation,
 * 44x44pt tap target, and Apple-grade spring physics.
 */

import React, { useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { triggerHaptic } from '../../utils/haptics';

export type SectionAccent = 'amber' | 'cyan' | 'purple' | 'emerald';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  accent?: SectionAccent;
  className?: string;
}

const ACCENT_CHECKED_CLASSES: Record<SectionAccent, string> = {
  amber:
    'bg-gradient-to-br from-[#F59E0B] to-[#F97316] border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.45)]',
  cyan:
    'bg-gradient-to-br from-[#0EA5E9] to-[#3B82F6] border-[#0EA5E9] shadow-[0_0_12px_rgba(14,165,233,0.45)]',
  purple:
    'bg-gradient-to-br from-[#A855F7] to-[#EC4899] border-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.45)]',
  emerald:
    'bg-gradient-to-br from-[#10B981] to-[#06B6D4] border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.45)]',
};

const ACCENT_UNCHECKED_CLASSES: Record<SectionAccent, string> = {
  amber: 'border-[#F59E0B]/45 dark:border-[#FBBF24]/45 hover:border-[#F59E0B]',
  cyan: 'border-[#0EA5E9]/45 dark:border-[#38BDF8]/45 hover:border-[#0EA5E9]',
  purple: 'border-[#A855F7]/45 dark:border-[#C084FC]/45 hover:border-[#A855F7]',
  emerald: 'border-[#10B981]/45 dark:border-[#34D399]/45 hover:border-[#10B981]',
};

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  accent,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const handleToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (disabled) return;
      triggerHaptic('light');
      onChange(!checked);
    },
    [checked, disabled, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle(e);
      }
    },
    [handleToggle]
  );

  const checkedStyle = accent
    ? ACCENT_CHECKED_CLASSES[accent]
    : 'bg-[var(--system-blue)] border-[var(--system-blue)] shadow-sm';

  const uncheckedStyle = accent
    ? ACCENT_UNCHECKED_CLASSES[accent]
    : 'border-[var(--separator)] dark:border-[rgba(255,255,255,0.32)] hover:border-[var(--system-blue)]';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ? `Mark "${label}" as ${checked ? 'incomplete' : 'complete'}` : 'Toggle checklist item'}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`relative min-w-[44px] min-h-[44px] w-[44px] h-[44px] flex items-center justify-center p-0 m-0 bg-transparent border-none outline-none cursor-pointer select-none rounded-full focus-visible:ring-2 focus-visible:ring-[var(--system-blue)] focus-visible:ring-offset-2 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* 22px Circular Checkbox Indicator */}
      <motion.div
        className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-200 border-[2px] ${
          checked ? checkedStyle : `bg-transparent ${uncheckedStyle}`
        }`}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.86 }}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: checked ? [1, 1.14, 1] : 1,
              }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.1 }
            : {
                duration: 0.28,
                ease: [0.25, 1, 0.5, 1],
              }
        }
      >
        {/* Animated Checkmark SVG */}
        <svg
          viewBox="0 0 14 14"
          fill="none"
          className="w-3.5 h-3.5 text-white"
          aria-hidden="true"
        >
          <motion.path
            d="M 3 7.2 L 5.8 10 L 11 4.5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{
              pathLength: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0.1 }
                : {
                    pathLength: {
                      type: 'spring',
                      stiffness: 550,
                      damping: 28,
                      mass: 0.5,
                    },
                    opacity: { duration: 0.12 },
                  }
            }
          />
        </svg>
      </motion.div>
    </button>
  );
};

export default Checkbox;
