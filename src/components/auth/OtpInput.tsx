/**
 * src/components/auth/OtpInput.tsx
 * Discrete 6-digit OTP code entry component with iOS 26 Liquid Glass styling.
 * 
 * Features:
 * - 6 discrete numeric input boxes.
 * - Auto-advances focus on digit entry.
 * - Backspace navigation: if current box is empty, jumps to previous box and clears it.
 * - Full clipboard paste support: extracts 6 digits (handles formatted "123-456" or "123456").
 * - Tap targets >= 44x44pt (48x56px on mobile, 44x56px minimum).
 * - Font size >= 16px (22px) preventing iOS Safari viewport zooming.
 * - Framer Motion 3-cycle error shake animation on invalid submission.
 * - Respects prefers-reduced-motion.
 */

import React, { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../utils/haptics';

export interface OtpInputProps {
  value: string; // 0 to 6 characters
  onChange: (val: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }).map((_, i) => value[i] || '');

  // Auto-focus first empty input or initial input on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 5 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When error triggers, shake and refocus box 0
  useEffect(() => {
    if (hasError && !disabled) {
      triggerHaptic('heavy');
      inputRefs.current[0]?.focus();
    }
  }, [hasError, disabled]);

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleaned = rawVal.replace(/\D/g, '');
    if (!cleaned) {
      // Clear this index
      const newDigits = [...digits];
      newDigits[index] = '';
      const updated = newDigits.join('').trim();
      onChange(updated);
      return;
    }

    // Take the last entered character if multiple characters arrived
    const char = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const updated = newDigits.join('');
    onChange(updated);
    triggerHaptic('selection');

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updated.length === 6 && onComplete) {
      onComplete(updated);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is empty, jump to previous box and clear it
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
        triggerHaptic('light');
      } else if (digits[index]) {
        // Clear current box
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
        triggerHaptic('light');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const pastedDigits = pasteData.replace(/\D/g, '').slice(0, 6);
    if (!pastedDigits) return;

    onChange(pastedDigits);
    triggerHaptic('medium');

    if (pastedDigits.length === 6) {
      inputRefs.current[5]?.focus();
      if (onComplete) {
        onComplete(pastedDigits);
      }
    } else {
      inputRefs.current[pastedDigits.length]?.focus();
    }
  };

  return (
    <motion.div
      className="flex items-center justify-between gap-2 w-full max-w-sm mx-auto"
      animate={
        hasError && !shouldReduceMotion
          ? { x: [-12, 12, -8, 8, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const isFilled = Boolean(digits[i]);
        return (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            disabled={disabled}
            value={digits[i] || ''}
            onChange={(e) => handleInputChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1} of 6`}
            data-testid={`otp-box-${i}`}
            className={clsx(
              // Tap target >= 44x44pt (48x56px on mobile)
              'w-11 h-14 sm:w-12 sm:h-14 min-w-[44px] min-h-[44px]',
              'flex items-center justify-center text-center font-bold text-[22px] sm:text-[24px] tabular-nums',
              'rounded-xl border transition-all duration-150 outline-none select-none',
              // Font-size anti-zoom safeguard (>= 16px)
              'text-[22px]',
              hasError
                ? 'border-[var(--system-red)] bg-[var(--system-red)]/10 text-[var(--system-red)]'
                : isFilled
                ? 'border-[var(--system-blue)] bg-[var(--secondary-system-fill)] text-[var(--label)] shadow-sm'
                : 'border-[var(--separator)] bg-[var(--tertiary-system-fill)] text-[var(--label)] focus:border-[var(--system-blue)] focus:bg-[var(--secondary-system-fill)]',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
            style={{ fontSize: '22px' }}
          />
        );
      })}
    </motion.div>
  );
};

export default OtpInput;
