/**
 * src/components/sheets/SettingsSheet.tsx
 * iOS Settings sheet for habit rollover configuration and live auth/sync status.
 * Apple iOS 26 Liquid Glass styling, 44pt touch targets, and instant feedback.
 */

import React from 'react';
import { BottomSheet } from './BottomSheet';
import { triggerHaptic } from '../../utils/haptics';
import { Clock, ShieldCheck, Smartphone, Info, CloudOff } from 'lucide-react';
import clsx from 'clsx';

export interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rolloverHour: number;
  onUpdateRolloverHour: (hour: number) => Promise<unknown> | void;
  userEmail?: string | null;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
  isOnline?: boolean;
  fallbackMode?: boolean;
}

function formatRolloverHourOption(h: number): string {
  if (h === 0) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM${h === 4 ? ' (Default)' : ''}`;
  return `${h - 12}:00 PM`;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  rolloverHour,
  onUpdateRolloverHour,
  userEmail = null,
  onSignInClick,
  onSignOutClick,
  isOnline = true,
  fallbackMode = false,
}) => {
  const handleRolloverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    triggerHaptic('selection');
    onUpdateRolloverHour(newHour);
  };

  const handleSignIn = () => {
    triggerHaptic('selection');
    onSignInClick?.();
  };

  const handleSignOut = () => {
    triggerHaptic('selection');
    onSignOutClick?.();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      headerTrailing={
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
        >
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-6 select-none pb-4">
        {/* ── Section 1: Daily Habit Reset (Rollover Time) ────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Daily Habit Reset
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[var(--label)]">
                <Clock className="w-5 h-5 text-[var(--system-blue)] shrink-0" />
                <span className="text-[16px] font-semibold">Rollover Time</span>
              </div>

              <select
                aria-label="Habit Rollover Hour"
                value={rolloverHour}
                onChange={handleRolloverChange}
                className="bg-[var(--secondary-system-grouped-background)] text-[var(--system-blue)] font-semibold text-[16px] px-3 py-1.5 rounded-xl border border-[var(--separator)] focus:border-[var(--system-blue)] outline-none cursor-pointer"
                style={{ fontSize: '16px' }}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {formatRolloverHourOption(h)}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              Items in Morning, Work Day, and Evening Routine uncheck automatically at this time each day, so late nights still count toward the previous day. Items persist; only checked states reset.
            </p>
          </div>
        </div>

        {/* ── Section 2: Account & Cloud Sync ─────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              Account & Sync
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {fallbackMode ? (
                  <CloudOff className="w-5 h-5 text-[var(--system-orange)] shrink-0" />
                ) : (
                  <ShieldCheck
                    className={clsx(
                      'w-5 h-5 shrink-0',
                      userEmail ? 'text-[var(--system-green)]' : 'text-[var(--system-blue)]'
                    )}
                  />
                )}
                <div className="truncate">
                  <div
                    data-testid="settings-auth-status"
                    className="text-[15px] font-semibold text-[var(--label)] truncate"
                  >
                    {userEmail ? 'Signed In' : 'Guest / Local Storage'}
                  </div>
                  <div
                    data-testid="settings-user-email"
                    className="text-[13px] text-[var(--secondary-label)] truncate max-w-[200px]"
                  >
                    {userEmail
                      ? userEmail
                      : isOnline
                      ? 'Offline-first (< 16ms)'
                      : 'Offline — local mode'}
                  </div>
                </div>
              </div>

              {userEmail ? (
                <button
                  type="button"
                  data-testid="settings-sign-out-btn"
                  onClick={handleSignOut}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-[14px] font-semibold text-[var(--system-red)] bg-[var(--system-red)]/10 hover:bg-[var(--system-red)]/20 active:scale-95 transition-all border-none cursor-pointer shrink-0"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="settings-sign-in-btn"
                  onClick={handleSignIn}
                  className="min-h-[44px] px-4 py-1.5 rounded-xl text-[14px] font-semibold text-white bg-[var(--system-blue)] hover:opacity-90 active:scale-95 transition-all shadow-sm border-none cursor-pointer shrink-0"
                >
                  Sign In
                </button>
              )}
            </div>

            <p className="text-[13px] text-[var(--secondary-label)] leading-relaxed">
              {fallbackMode
                ? 'Cloud migration is pending in Supabase (PGRST205). Cadence is running securely in local fallback mode.'
                : 'Cadence stores all data locally in IndexedDB. Sign in with a 6-digit email code to sync across iPhone and desktop.'}
            </p>
          </div>
        </div>

        {/* ── Section 3: App Information ───────────────────────────────── */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
              About
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--secondary-system-fill)] p-4 border border-[var(--separator)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Smartphone className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Version</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)] tabular-nums">
                1.0.0 (Build 2026.10)
              </span>
            </div>

            <div className="h-[0.5px] bg-[var(--separator)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--label)]">
                <Info className="w-4 h-4 text-[var(--secondary-label)]" />
                <span className="text-[15px]">Design Language</span>
              </div>
              <span className="text-[14px] font-medium text-[var(--secondary-label)]">
                Apple iOS 26 Liquid Glass
              </span>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default SettingsSheet;
