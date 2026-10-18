/**
 * src/components/auth/AuthModal.tsx
 * In-App 6-Digit Email OTP Authentication Modal for Cadence.
 * Implements two-step flow:
 *   1. Email entry -> calls GoTrue signInWithOtp
 *   2. Discrete 6-digit PIN entry -> calls GoTrue verifyOtp
 * Strictly in-app (no magic link redirection to Safari).
 */

import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../sheets/BottomSheet';
import { OtpInput } from './OtpInput';
import { sendEmailOtp, verifyEmailOtp } from '../../sync/supabaseClient';
import { triggerHaptic } from '../../utils/haptics';
import { Mail, KeyRound, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export type AuthStep = 'email' | 'otp';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setOtpCode('');
      setErrorMessage(null);
      setIsLoading(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP code to email
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      triggerHaptic('heavy');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('light');

    try {
      const result = await sendEmailOtp(cleanEmail);
      if (result.success) {
        setStep('otp');
        setOtpCode('');
        setResendCooldown(60);
        triggerHaptic('medium');
      } else {
        setErrorMessage(result.error || 'Failed to send verification code. Please try again.');
        triggerHaptic('heavy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setErrorMessage(msg);
      triggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP code
  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits.');
      triggerHaptic('heavy');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const result = await verifyEmailOtp(email, code);
      if (result.success) {
        triggerHaptic('success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(result.error || 'Invalid or expired code. Please try again.');
        setOtpCode(''); // Clear OTP on error so user can re-enter
        triggerHaptic('heavy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to verify code. Please try again.';
      setErrorMessage(msg);
      setOtpCode('');
      triggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend action
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('light');

    try {
      const result = await sendEmailOtp(email);
      if (result.success) {
        setResendCooldown(60);
        setOtpCode('');
        triggerHaptic('medium');
      } else {
        setErrorMessage(result.error || 'Failed to resend code.');
        triggerHaptic('heavy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code.';
      setErrorMessage(msg);
      triggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  // Switch back to email step
  const handleChangeEmail = () => {
    setStep('email');
    setOtpCode('');
    setErrorMessage(null);
    triggerHaptic('light');
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'email' ? 'Sign In to Sync' : 'Enter 6-Digit Code'}
      headerTrailing={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
        >
          Cancel
        </button>
      }
    >
      <div className="flex flex-col gap-5 pb-4 select-none">
        {step === 'email' ? (
          /* ── Step 1: Email Form ───────────────────────────────────────── */
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center mb-1">
                <Mail className="w-6 h-6" />
              </div>
              <p className="text-[14px] text-[var(--secondary-label)] leading-relaxed">
                Sign in with a 6-digit email code to sync your routines and goals across iPhone and desktop. No password needed.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-email-input"
                className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)] px-1"
              >
                Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                autoFocus
                className="w-full min-h-[48px] px-4 rounded-xl bg-[var(--secondary-system-fill)] border border-[var(--separator)] text-[var(--label)] placeholder-[var(--tertiary-label)] outline-none focus:border-[var(--system-blue)] transition-colors"
                style={{ fontSize: '17px' }}
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--system-red)]/10 text-[var(--system-red)] text-[13px] leading-snug"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full min-h-[48px] rounded-xl bg-[var(--system-blue)] text-white font-semibold text-[16px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm mt-1"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Send 6-Digit Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ── Step 2: 6-Digit OTP Form ─────────────────────────────────── */
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <p className="text-[14px] text-[var(--secondary-label)] leading-relaxed">
                Enter the 6-digit code sent to <strong className="text-[var(--label)] font-semibold">{email}</strong>.
              </p>
            </div>

            {/* Discrete 6-digit inputs with auto-advance and paste */}
            <div className="py-2">
              <OtpInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onComplete={(code) => handleVerifyCode(code)}
                disabled={isLoading}
                hasError={Boolean(errorMessage)}
                autoFocus
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--system-red)]/10 text-[var(--system-red)] text-[13px] leading-snug"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyCode()}
              disabled={isLoading || otpCode.length !== 6}
              className="w-full min-h-[48px] rounded-xl bg-[var(--system-blue)] text-white font-semibold text-[16px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Verify & Sync</span>
                </>
              )}
            </button>

            {/* Sub-actions: Resend & Change Email */}
            <div className="flex items-center justify-between text-[13px] pt-1 border-t border-[var(--separator)]">
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={isLoading}
                className="min-h-[44px] flex items-center text-[var(--secondary-label)] hover:text-[var(--label)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
              >
                Use different email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoading}
                className="min-h-[44px] flex items-center text-[var(--system-blue)] font-medium disabled:text-[var(--tertiary-label)] disabled:cursor-not-allowed active:opacity-60 bg-transparent border-none cursor-pointer p-0"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default AuthModal;
