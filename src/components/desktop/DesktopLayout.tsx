/**
 * src/components/desktop/DesktopLayout.tsx
 * Apple iOS 26 Liquid Glass Desktop side-by-side layout (>= 1024px).
 * Desktop top header with status dot and discrete sync labels:
 * "Cloud Synced" | "Syncing..." | "Offline / Local"
 */

import React, { useEffect, useCallback } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { formatDesktopDate } from '../../utils/time';
import { triggerHaptic } from '../../utils/haptics';
import clsx from 'clsx';

export interface DesktopLayoutProps {
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenSettings: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  isGuest?: boolean;
  fallbackMode?: boolean;
  syncLabel?: string;
  goalHeroSlot?: React.ReactNode;
  todaySlot: React.ReactNode;
  workSlot: React.ReactNode;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  onOpenSettings,
  isOnline = true,
  isSyncing = false,
  isGuest = true,
  fallbackMode = false,
  syncLabel,
  goalHeroSlot,
  todaySlot,
  workSlot,
}) => {
  // Global desktop keyboard navigation listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Space key toggles checked state of focused checklist row
      if (e.key === ' ' || e.code === 'Space') {
        const activeElement = document.activeElement as HTMLElement | null;
        const checkboxButton =
          activeElement?.querySelector<HTMLButtonElement>('[role="checkbox"]') ||
          (activeElement?.getAttribute('role') === 'checkbox'
            ? (activeElement as HTMLButtonElement)
            : null);

        if (checkboxButton) {
          e.preventDefault();
          checkboxButton.click();
          triggerHaptic('light');
        }
      }

      // Arrow navigation between interactive rows
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const focusableRows = Array.from(
          document.querySelectorAll<HTMLElement>('[data-checklist-row="true"]')
        );
        if (focusableRows.length === 0) return;

        const currentIndex = focusableRows.findIndex(
          (el) => el === document.activeElement || el.contains(document.activeElement)
        );

        e.preventDefault();
        if (e.key === 'ArrowDown') {
          const nextIndex = currentIndex < focusableRows.length - 1 ? currentIndex + 1 : 0;
          focusableRows[nextIndex]?.focus();
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableRows.length - 1;
          focusableRows[prevIndex]?.focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Determine desktop sync badge status, dot color, and label
  const getSyncBadgeConfig = () => {
    if (syncLabel) {
      return {
        dotClass: 'bg-[var(--system-blue)]',
        label: syncLabel,
        tooltip: syncLabel,
      };
    }
    if (isSyncing) {
      return {
        dotClass: 'bg-[var(--system-blue)] animate-pulse',
        label: 'Syncing...',
        tooltip: 'Syncing changes with Supabase Cloud...',
      };
    }
    if (!isOnline || isGuest || fallbackMode) {
      return {
        dotClass: !isOnline ? 'bg-[var(--system-orange)]' : 'bg-[var(--system-gray)]',
        label: 'Offline / Local',
        tooltip: !isOnline
          ? 'Offline — local changes will sync when online'
          : fallbackMode
          ? 'Local fallback mode (cloud migration pending)'
          : 'Guest mode — data stored locally in IndexedDB',
      };
    }
    return {
      dotClass: 'bg-[var(--system-green)]',
      label: 'Cloud Synced',
      tooltip: 'All changes saved locally & synced to Supabase Cloud',
    };
  };

  const syncBadge = getSyncBadgeConfig();

  return (
    <div className="w-full max-w-[1240px] mx-auto px-8 py-8 flex flex-col gap-6">
      {/* ── Desktop Top Navigation Bar ──────────────────────────────────── */}
      <header className="flex items-center justify-between pb-4 border-b border-[var(--separator)]">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)]">
            {formatDesktopDate()}
          </div>
          <h1 className="text-[34px] font-bold text-[var(--label)] tracking-[-0.41px]">
            Cadence
          </h1>
        </div>

        {/* Desktop Trailing Utilities */}
        <div className="flex items-center gap-3">
          {/* Desktop Sync Indicator Dot & Label */}
          <div
            data-testid="desktop-sync-status"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[var(--tertiary-system-fill)] text-[var(--secondary-label)] select-none transition-colors"
            title={syncBadge.tooltip}
          >
            <span
              data-testid="desktop-sync-dot"
              className={clsx('w-2 h-2 rounded-full shrink-0', syncBadge.dotClass)}
            />
            <span data-testid="desktop-sync-label" className="tabular-nums">
              {syncBadge.label}
            </span>
          </div>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            aria-label="Settings"
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[var(--label)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none cursor-pointer border-none"
          >
            <SettingsIcon className="w-[18px] h-[18px] stroke-[2]" />
          </button>
        </div>
      </header>

      {/* ── Pinned Goal Hero Card Container ─────────────────────────────── */}
      {goalHeroSlot && (
        <section aria-label="Primary Goal" className="w-full">
          {goalHeroSlot}
        </section>
      )}

      {/* ── Side-by-Side Dual Column Grid ───────────────────────────────── */}
      <main className="grid grid-cols-2 gap-8 items-start">
        {/* Column 1: Today Tab Checklist */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold text-[var(--label)] tracking-[-0.35px]">
              Today
            </h2>
          </div>
          {todaySlot}
        </div>

        {/* Column 2: Work Tab Persistent Checklist */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold text-[var(--label)] tracking-[-0.35px]">
              Work
            </h2>
          </div>
          {workSlot}
        </div>
      </main>
    </div>
  );
};

export default DesktopLayout;
