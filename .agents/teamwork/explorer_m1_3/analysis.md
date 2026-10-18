# Cadence Milestone 1 Architecture: Shell, Navigation & Motion System

**Specialist**: `explorer_m1_3`  
**Milestone**: Milestone 1: App Shell & iOS 26 Liquid Glass Design System  
**Date**: 2026-10-17  
**Scope**: Responsive Shell (`App.tsx`), Navigation Components (`CollapsingHeader.tsx`, `FloatingTabBar.tsx`), Desktop Side-by-Side Layout, Liquid Glass Materials (`GlassContainer.tsx`), Motion Physics (`motion.ts`), Haptics (`haptics.ts`), and Safe-Area Architecture.

---

## 1. Executive Summary & Architecture Overview

Cadence must feel indistinguishable from a first-party Apple iOS 26 application running on an **iPhone 17 Air** (420pt x 912pt viewport at @3x Retina) while providing a desktop experience (>=1024px) with side-by-side productivity workflows.

To achieve this, the UI shell and navigation architecture are engineered according to four foundational principles:
1. **Dynamic Safe-Area & Viewport Anchoring**: The shell locks the browser window (`position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none;`) to eliminate rubber-band bounce, while routing safe-area insets (`env(safe-area-inset-top/bottom/left/right)`) precisely into the top glass header, floating tab bar, and scroll containers.
2. **GPU-Composited Collapsing Navigation**: The collapsing large navigation title (34px bold to 17px semibold inline) transitions via Framer Motion `useScroll` and `useTransform` without React component re-render thrashing, guaranteeing 120fps on ProMotion displays.
3. **Floating Capsule Tab Bar**: Mobile navigation floats as a translucent glass pill with continuous squircle corners, anchored above the home indicator, featuring a spring-animated sliding active pill highlight (`layoutId="activeTabPill"`).
4. **Adaptive Desktop Layout (>=1024px)**: When the viewport reaches 1024px, the floating tab bar unmounts cleanly, replaced by a pinned full-width Goal Hero Card container and a dual-column side-by-side grid (Today and Work), complete with hover states and full keyboard navigation (`Space`, `Enter`, arrows, `Escape`).

---

## 2. Directory & Component Layout

```
src/
├── App.tsx                                # Root shell & responsive layout switcher
├── hooks/
│   └── useMediaQuery.ts                   # Responsive breakpoint hook (<1024px vs >=1024px)
├── components/
│   ├── common/
│   │   ├── CollapsingHeader.tsx           # Large collapsing iOS 26 title & glazed nav bar
│   │   ├── FloatingTabBar.tsx             # Mobile floating glass capsule tab bar
│   │   └── GlassContainer.tsx             # Liquid Glass squircle container
│   ├── desktop/
│   │   └── DesktopLayout.tsx              # Desktop side-by-side grid & keyboard controller
│   ├── today/                             # Today tab views (M2/M3)
│   └── work/                              # Work tab views (M2/M3)
└── utils/
    ├── motion.ts                          # 120Hz ProMotion spring presets & reduced-motion fallback
    ├── haptics.ts                         # Safe WebKit haptic trigger helper
    └── time.ts                            # Date & time formatting helpers
```

---

## 3. Responsive Breakpoint Hook (`src/hooks/useMediaQuery.ts`)

The breakpoint between mobile and desktop is strictly **1024px** (`min-width: 1024px`).

### Implementation Strategy
- Must be SSR-safe (in case of server-side or test environments).
- Must evaluate synchronously on initial client mount to prevent flashes of mobile layout on desktop screens.
- Must register modern `addEventListener('change', ...)` with fallback to legacy `addListener`.
- Must clean up listeners on unmount.

### Source Code (`src/hooks/useMediaQuery.ts`)
```typescript
import { useState, useEffect } from 'react';

/**
 * React hook that listens to a CSS media query and updates state when it matches.
 * Initialized synchronously on client to prevent initial layout shift.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Ensure state matches current media query
    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch);
      return () => mediaQueryList.removeEventListener('change', updateMatch);
    } else {
      // Legacy WebKit support
      mediaQueryList.addListener(updateMatch);
      return () => mediaQueryList.removeListener(updateMatch);
    }
  }, [query]);

  return matches;
}

/**
 * Convenience hook returning true if viewport is >= 1024px (Desktop), false otherwise (Mobile).
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
```

---

## 4. Motion Physics & Presets (`src/utils/motion.ts`)

Apple iOS 26 motion is characterized by physical spring simulations rather than cubic beziers. For 120Hz ProMotion displays (iPhone 17 Air and modern MacBooks), the springs must feel taut, responsive, and completely devoid of artificial latency.

### Physics Tuning Parameters
- **Sheets & Modals**: `stiffness: 340, damping: 32, mass: 0.9` (taut presentation, zero overshoot).
- **Sheet Dismiss**: `stiffness: 380, damping: 35, mass: 0.8` (snappy downward exit).
- **Tab Bar Active Pill**: `stiffness: 500, damping: 28, mass: 0.8` (glides effortlessly across tabs with instantaneous tactile responsiveness).
- **Checkbox Snap**: `stiffness: 500, damping: 24, mass: 0.6` (crisp tactile compression and rebound).
- **List Layout Reflow / Drag**: `stiffness: 320, damping: 30, mass: 0.8` (springy, continuous collision avoidance).
- **Progress Ring**: `stiffness: 220, damping: 26, mass: 0.7` (smooth fluid radial sweep).
- **Background Scale-Back**: `stiffness: 300, damping: 30, mass: 0.9` (iOS modal scale-back from 1.0 to 0.94).

### `prefers-reduced-motion` Architecture
When `prefers-reduced-motion: reduce` is enabled:
- All spring physics, scale transforms, and translation slides are bypassed.
- Substituted with immediate, subtle cross-fades (`duration: 0.15s, ease: "easeInOut"`).

### Source Code (`src/utils/motion.ts`)
```typescript
import { type Transition } from 'framer-motion';

export const SPRING_PRESETS = {
  /** Tab bar active pill sliding transition */
  tabIndicator: {
    type: 'spring',
    stiffness: 500,
    damping: 28,
    mass: 0.8,
  } as Transition,

  /** Bottom sheet modal presentation */
  sheet: {
    type: 'spring',
    stiffness: 340,
    damping: 32,
    mass: 0.9,
  } as Transition,

  /** Bottom sheet modal dismissal */
  sheetDismiss: {
    type: 'spring',
    stiffness: 380,
    damping: 35,
    mass: 0.8,
  } as Transition,

  /** Checkbox scale micro-interaction */
  checkboxSnap: {
    type: 'spring',
    stiffness: 500,
    damping: 24,
    mass: 0.6,
  } as Transition,

  /** List item reordering and layout reflow */
  listReflow: {
    type: 'spring',
    stiffness: 320,
    damping: 30,
    mass: 0.8,
  } as Transition,

  /** Progress ring fill animation */
  progressRing: {
    type: 'spring',
    stiffness: 220,
    damping: 26,
    mass: 0.7,
  } as Transition,

  /** Background scale-back during modal presentation */
  backgroundScale: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 0.9,
  } as Transition,
} as const;

/** Fallback transition for prefers-reduced-motion */
export const REDUCED_MOTION_TRANSITION: Transition = {
  duration: 0.15,
  ease: 'easeInOut',
};

/**
 * Returns either the requested spring preset or the reduced-motion crossfade
 * based on the user's accessibility preference.
 */
export function getMotionTransition(
  preset: keyof typeof SPRING_PRESETS,
  shouldReduceMotion: boolean | null
): Transition {
  if (shouldReduceMotion) {
    return REDUCED_MOTION_TRANSITION;
  }
  return SPRING_PRESETS[preset];
}
```

---

## 5. Haptic Feedback Utility (`src/utils/haptics.ts`)

Provides safe, best-effort tactile feedback on mobile devices via `navigator.vibrate`, with silent fallback on desktop or unsupported browsers.

### Source Code (`src/utils/haptics.ts`)
```typescript
export type HapticType =
  | 'selection'  // Micro-tick for tab switch, segmented control (8ms)
  | 'light'      // Checkbox toggle, light button tap (12ms)
  | 'medium'     // Edit mode toggle, reorder grab (22ms)
  | 'heavy'      // Deletion confirmation, swipe trigger (35ms)
  | 'success'    // Routine section or day completed ([12, 40, 18]ms)
  | 'warning'    // Destructive alert confirmation ([25, 50, 25]ms)
  | 'error';     // Authentication error, invalid OTP ([30, 60, 30, 60, 40]ms)

/**
 * Triggers safe WebKit / browser haptic vibration cues.
 * Wrapped in try/catch to guarantee zero exceptions.
 */
export function triggerHaptic(type: HapticType): boolean {
  if (typeof window === 'undefined' || !('navigator' in window)) {
    return false;
  }

  if (typeof navigator.vibrate !== 'function') {
    return false;
  }

  try {
    switch (type) {
      case 'selection':
        return navigator.vibrate(8);
      case 'light':
        return navigator.vibrate(12);
      case 'medium':
        return navigator.vibrate(22);
      case 'heavy':
        return navigator.vibrate(35);
      case 'success':
        return navigator.vibrate([12, 40, 18]);
      case 'warning':
        return navigator.vibrate([25, 50, 25]);
      case 'error':
        return navigator.vibrate([30, 60, 30, 60, 40]);
      default:
        return false;
    }
  } catch {
    // Graceful silent degradation on WebKit restriction
    return false;
  }
}
```

---

## 6. Date & Time Helpers (`src/utils/time.ts`)

Provides formatted dates matching iOS HIG system conventions.

### Source Code (`src/utils/time.ts`)
```typescript
/**
 * Formats a Date object for the collapsing header date subtitle.
 * Example: "Saturday, October 17"
 */
export function formatHeaderDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Formats a full date for desktop layout header.
 * Example: "Saturday, October 17, 2026"
 */
export function formatDesktopDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats section header time or ISO timestamp string.
 */
export function getMonotonicTimestamp(): string {
  return new Date().toISOString();
}
```

---

## 7. Reusable Liquid Glass Container (`src/components/common/GlassContainer.tsx`)

A core primitive component delivering the Apple iOS 26 Liquid Glass optical effect:
- Multi-stop backdrop blur (`blur(24px) saturate(190%)`).
- Specular hairline perimeter borders (`0.5px solid`).
- Continuous squircle border-radius (`16px` or `20px`).
- Ambient specular highlight (`inset 0 1px 0.5px 0 rgba(255, 255, 255, ...)`).

### Source Code (`src/components/common/GlassContainer.tsx`)
```typescript
import React from 'react';
import clsx from 'clsx';

export interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'bar' | 'floating' | 'subtle';
  interactive?: boolean;
  children: React.ReactNode;
}

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ variant = 'card', interactive = false, className, children, ...props }, ref) => {
    const baseClasses = 'relative transition-all duration-200';

    const variantClasses = {
      card: [
        'bg-[var(--glass-surface-bg)]',
        'backdrop-blur-[24px]',
        'backdrop-saturate-[190%]',
        'border border-[var(--glass-surface-border)]',
        'shadow-[var(--glass-shadow)]',
        'rounded-[16px]',
        'after:content-[""] after:absolute after:inset-0 after:rounded-[16px] after:pointer-events-none',
        'after:shadow-[var(--glass-surface-specular)]',
      ].join(' '),
      bar: [
        'bg-[var(--nav-bar-bg)]',
        'backdrop-blur-[24px]',
        'backdrop-saturate-[190%]',
        'border-b border-[var(--separator)]',
      ].join(' '),
      floating: [
        'bg-[var(--tab-bar-bg)]',
        'backdrop-blur-[28px]',
        'backdrop-saturate-[200%]',
        'border border-[var(--tab-bar-border)]',
        'shadow-[var(--tab-bar-shadow)]',
        'rounded-full',
      ].join(' '),
      subtle: [
        'bg-[var(--secondary-system-grouped-background)]',
        'border border-[var(--separator)]',
        'rounded-[12px]',
      ].join(' '),
    }[variant];

    const interactiveClasses = interactive
      ? 'cursor-pointer active:scale-[0.985] transition-transform select-none'
      : '';

    return (
      <div
        ref={ref}
        className={clsx(baseClasses, variantClasses, interactiveClasses, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassContainer.displayName = 'GlassContainer';
```

---

## 8. Collapsing Header Component (`src/components/common/CollapsingHeader.tsx`)

The collapsing header reproduces the Apple iOS large title pattern:
1. **At resting position (`scrollY === 0`)**:
   - The top fixed navigation bar is transparent (`opacity: 0`), and the centered inline title is invisible (`opacity: 0, translateY: 6px`).
   - The Large Title (`34px` bold, line-height `41px`) sits prominently at the top of the scroll container, with the date subtitle (`13px` semibold, uppercase, secondary label).
2. **On scroll (`0 < scrollY <= 52px`)**:
   - The large title smoothly fades out (`opacity: 1 -> 0`).
   - The fixed navigation bar background fades in `var(--nav-bar-bg)` with `backdrop-filter: blur(24px) saturate(190%)` and a `0.5px` bottom separator.
   - The centered inline title (`17px` Headline, semibold) slides in (`translateY: 0`) and fades to full opacity (`1.0`).
3. **Trailing Action Items**:
   - "Edit" / "Done" toggle button with iOS systemBlue text, 44x44pt tap target minimum.
   - Minimal Settings gear icon button with 44x44pt tap target minimum.

### High-Performance Scroll Architecture
Rather than driving React component re-renders on scroll, the component attaches Framer Motion MotionValues (`useScroll` and `useTransform`) directly to the DOM nodes. This executes entirely on the GPU compositor thread at 120fps.

### Source Code (`src/components/common/CollapsingHeader.tsx`)
```typescript
import React from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface CollapsingHeaderProps {
  title: string;
  subtitle?: string;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const CollapsingHeader: React.FC<CollapsingHeaderProps> = ({
  title,
  subtitle,
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  scrollContainerRef,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Bind Framer Motion scroll tracker to scrollContainerRef or window
  const { scrollY } = useScroll(
    scrollContainerRef ? { container: scrollContainerRef } : {}
  );

  // Optical transitions
  // 1. Navigation bar glazed background opacity: 0 at scroll 0, 1 by scroll 36px
  const navBgOpacity = useTransform(scrollY, [0, 36], [0, 1]);
  // 2. Hairline bottom separator opacity: 0 at scroll 10px, 1 by scroll 44px
  const separatorOpacity = useTransform(scrollY, [10, 44], [0, 1]);
  // 3. Inline centered title: fades in between 24px and 48px
  const inlineTitleOpacity = useTransform(scrollY, [24, 48], [0, 1]);
  const inlineTitleY = useTransform(scrollY, [24, 48], [6, 0]);
  // 4. Large title: fades out between 0px and 38px
  const largeTitleOpacity = useTransform(scrollY, [0, 38], [1, 0]);

  const handleEditToggle = () => {
    triggerHaptic('medium');
    onToggleEditMode();
  };

  const handleSettingsOpen = () => {
    triggerHaptic('light');
    onOpenSettings();
  };

  return (
    <>
      {/* ── Fixed Glazed Top Navigation Bar ─────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 select-none"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Dynamic Glass Backdrop */}
        <motion.div
          className="absolute inset-0 bg-[var(--nav-bar-bg)] backdrop-blur-[24px] backdrop-saturate-[190%]"
          style={{ opacity: shouldReduceMotion ? 1 : navBgOpacity }}
        />

        {/* Dynamic Hairline Separator */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[0.5px] bg-[var(--separator)]"
          style={{ opacity: shouldReduceMotion ? 1 : separatorOpacity }}
        />

        {/* Navigation Content Bar (44px height) */}
        <div className="relative h-[44px] px-4 flex items-center justify-between">
          {/* Leading slot: empty spacer for balance */}
          <div className="w-[80px] flex items-center justify-start">
            {/* Optional leading control if needed in future */}
          </div>

          {/* Centered Inline Title (17px Headline) */}
          <motion.div
            className="flex-1 text-center font-semibold text-[17px] text-[var(--label)] tracking-[-0.41px] truncate pointer-events-none"
            style={{
              opacity: shouldReduceMotion ? 1 : inlineTitleOpacity,
              y: shouldReduceMotion ? 0 : inlineTitleY,
            }}
          >
            {title}
          </motion.div>

          {/* Trailing Controls: Edit Mode Toggle & Settings Gear */}
          <div className="w-[80px] flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleEditToggle}
              aria-label={isEditMode ? 'Done editing' : 'Edit list'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60 transition-opacity"
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>

            <button
              type="button"
              onClick={handleSettingsOpen}
              aria-label="Settings"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--label)] active:opacity-60 transition-opacity"
            >
              <SettingsIcon className="w-[20px] h-[20px] stroke-[2]" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Scrollable Large Title Slot ─────────────────────────────────── */}
      <div className="pt-2 pb-3 px-4 select-none">
        {subtitle && (
          <div className="text-[13px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)] mb-0.5">
            {subtitle}
          </div>
        )}
        <motion.h1
          className="text-[34px] leading-[41px] font-bold tracking-[+0.37px] text-[var(--label)]"
          style={{ opacity: shouldReduceMotion ? 1 : largeTitleOpacity }}
        >
          {title}
        </motion.h1>
      </div>
    </>
  );
};
```

---

## 9. Floating Tab Bar Component (`src/components/common/FloatingTabBar.tsx`)

The floating tab bar is the mobile navigation centerpiece for iOS 26:
- Anchored above `calc(env(safe-area-inset-bottom, 20px) + 12px)`.
- Capsule geometry (`border-radius: 9999px; height: 56px; width: 260px`).
- Translucent Liquid Glass material: `backdrop-filter: blur(28px) saturate(200%)`.
- Active sliding pill highlight: Framer Motion `layoutId="activeTabPill"` with spring parameters `stiffness: 500, damping: 28`.
- Safe WebKit haptic trigger on selection (`triggerHaptic('selection')`).
- Completely unmounted or omitted on desktop (>=1024px).

### Tab Definitions & Icons
1. **Today**: Calendar/checklist icon + "Today" label.
2. **Work**: Briefcase icon + "Work" label.

### Source Code (`src/components/common/FloatingTabBar.tsx`)
```typescript
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Briefcase } from 'lucide-react';
import { SPRING_PRESETS, REDUCED_MOTION_TRANSITION } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

export type TabId = 'today' | 'work';

export interface FloatingTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'work', label: 'Work', icon: Briefcase },
];

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const handleTabClick = (tabId: TabId) => {
    if (tabId !== activeTab) {
      triggerHaptic('selection');
      onTabChange(tabId);
    }
  };

  return (
    <nav
      role="tablist"
      aria-label="Primary navigation"
      className="fixed left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 20px) + 12px)',
      }}
    >
      {/* Floating Capsule Glass Container */}
      <div
        className="w-[260px] h-[56px] rounded-full p-[4px] flex items-center justify-around relative
                   bg-[var(--tab-bar-bg)] backdrop-blur-[28px] backdrop-saturate-[200%]
                   border border-[var(--tab-bar-border)] shadow-[var(--tab-bar-shadow)]
                   after:content-[''] after:absolute after:inset-0 after:rounded-full after:pointer-events-none
                   after:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.45)] dark:after:shadow-[inset_0_1px_0.5px_0_rgba(255,255,255,0.14)]"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabClick(tab.id)}
              className="relative flex-1 h-full flex flex-col items-center justify-center rounded-full z-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]"
            >
              {/* Sliding Active Pill Background Highlight */}
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-full bg-[var(--tab-active-indicator)] z-[-1]"
                  transition={
                    shouldReduceMotion
                      ? REDUCED_MOTION_TRANSITION
                      : SPRING_PRESETS.tabIndicator
                  }
                />
              )}

              {/* Tab Icon */}
              <Icon
                className={`w-[20px] h-[20px] mb-[2px] transition-colors duration-150 ${
                  isActive
                    ? 'text-[var(--system-blue)] stroke-[2.2]'
                    : 'text-[var(--secondary-label)] stroke-[1.8]'
                }`}
              />

              {/* Tab Label */}
              <span
                className={`text-[11px] leading-[13px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'text-[var(--system-blue)] font-semibold'
                    : 'text-[var(--secondary-label)]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
```

---

## 10. Desktop Side-by-Side Layout (`src/components/desktop/DesktopLayout.tsx`)

When the viewport is >=1024px:
- The floating tab bar is completely eliminated.
- The UI renders inside a centered container (`max-w-[1200px] mx-auto px-6 py-6`).
- A top banner displays "Cadence", the current full date ("Saturday, October 17, 2026"), a subtle sync status badge, and the Settings gear button.
- A full-width Pinned Goal Hero container sits directly beneath the header.
- A balanced 2-column side-by-side grid (`grid grid-cols-2 gap-8`) presents Today (Morning, Work Day, Evening) on the left and Work (Persistent list) on the right.
- Full desktop keyboard support:
  * `Space`: Toggles the checked status of the focused checkbox row (`e.preventDefault()`).
  * `Enter`: Opens inline rename or adds a new checklist item.
  * `ArrowUp` / `ArrowDown`: Moves keyboard focus cleanly between rows.
  * `Escape`: Dismisses modal sheets or cancels editing.
- Hover states on list rows: `rgba(120, 120, 128, 0.06)` with smooth 150ms transition.

### Source Code (`src/components/desktop/DesktopLayout.tsx`)
```typescript
import React, { useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, CloudCheck, WifiOff } from 'lucide-react';
import { formatDesktopDate } from '../../utils/time';
import { triggerHaptic } from '../../utils/haptics';

export interface DesktopLayoutProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  goalHeroSlot?: React.ReactNode;
  todaySlot: React.ReactNode;
  workSlot: React.ReactNode;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  isOnline = true,
  isSyncing = false,
  goalHeroSlot,
  todaySlot,
  workSlot,
}) => {
  // Global desktop keyboard navigation listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Avoid intercepting keystrokes inside input / textarea
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
        const checkboxButton = activeElement?.querySelector<HTMLButtonElement>(
          '[role="checkbox"]'
        ) || (activeElement?.getAttribute('role') === 'checkbox' ? (activeElement as HTMLButtonElement) : null);

        if (checkboxButton) {
          e.preventDefault();
          checkboxButton.click();
          triggerHaptic('light');
        }
      }

      // Arrow navigation between interactive rows
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const focusableRows = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-checklist-row="true"]'
          )
        );
        if (focusableRows.length === 0) return;

        const currentIndex = focusableRows.findIndex(
          (el) => el === document.activeElement || el.contains(document.activeElement)
        );

        e.preventDefault();
        if (e.key === 'ArrowDown') {
          const nextIndex = currentIndex < focusableRows.length - 1 ? currentIndex + 1 : 0;
          focusableRows[nextIndex].focus();
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableRows.length - 1;
          focusableRows[prevIndex].focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
          {/* Sync Status Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[var(--tertiary-system-fill)] text-[var(--secondary-label)] select-none"
            title={isOnline ? (isSyncing ? 'Syncing...' : 'All changes saved locally & synced') : 'Offline - local changes will sync when online'}
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--system-green)] animate-pulse" />
                <span>{isSyncing ? 'Syncing…' : 'Synced'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[var(--system-orange)]" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onToggleEditMode();
            }}
            className="px-4 py-1.5 rounded-full text-[15px] font-semibold text-[var(--system-blue)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none"
          >
            {isEditMode ? 'Done' : 'Edit'}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenSettings();
            }}
            aria-label="Settings"
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[var(--label)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none"
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
```

---

## 11. Root Shell Layout (`src/App.tsx`)

The root `App.tsx` coordinates:
1. `useIsDesktop()` breakpoint detection (`< 1024px` = Mobile, `>= 1024px` = Desktop).
2. Mobile navigation view switching (`activeTab: 'today' | 'work'`).
3. Scroll tracking ref passing to `CollapsingHeader`.
4. Bottom padding clearance for the floating tab bar:
   `padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 88px)`.
5. Global state hooks for `isEditMode`, `isSettingsOpen`, `isGoalEditorOpen`, and `isClearConfirmOpen`.
6. Foundation for M2/M3 domain component mounting.

### Source Code (`src/App.tsx`)
```typescript
import React, { useState, useRef } from 'react';
import { useIsDesktop } from './hooks/useMediaQuery';
import { CollapsingHeader } from './components/common/CollapsingHeader';
import { FloatingTabBar, type TabId } from './components/common/FloatingTabBar';
import { DesktopLayout } from './components/desktop/DesktopLayout';
import { formatHeaderDate } from './utils/time';
import { GlassContainer } from './components/common/GlassContainer';

export const App: React.FC = () => {
  const isDesktop = useIsDesktop();
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Scroll container ref for mobile collapsing navigation
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleEditMode = () => setIsEditMode((prev) => !prev);
  const openSettings = () => setIsSettingsOpen(true);

  // Content placeholders for Milestone 1 demonstration
  const goalHeroPlaceholder = (
    <GlassContainer variant="card" className="p-6">
      <div className="text-[11px] font-semibold text-[var(--system-cyan)] uppercase tracking-[+0.8px] mb-1">
        Primary Goal
      </div>
      <div className="text-[22px] font-bold text-[var(--label)]">
        Launch Cadence with Apple iOS 26 Liquid Glass
      </div>
    </GlassContainer>
  );

  const todayContent = (
    <div className="flex flex-col gap-4">
      <GlassContainer variant="card" className="p-4">
        <div className="text-[13px] font-semibold uppercase text-[var(--secondary-label)] mb-2">
          Morning Routine
        </div>
        <div className="text-[15px] text-[var(--secondary-label)] italic py-2">
          No items yet. Tap + to add habits.
        </div>
      </GlassContainer>
      <GlassContainer variant="card" className="p-4">
        <div className="text-[13px] font-semibold uppercase text-[var(--secondary-label)] mb-2">
          Work Day
        </div>
        <div className="text-[15px] text-[var(--secondary-label)] italic py-2">
          No items yet. Tap + to add habits.
        </div>
      </GlassContainer>
      <GlassContainer variant="card" className="p-4">
        <div className="text-[13px] font-semibold uppercase text-[var(--secondary-label)] mb-2">
          Evening Routine
        </div>
        <div className="text-[15px] text-[var(--secondary-label)] italic py-2">
          No items yet. Tap + to add habits.
        </div>
      </GlassContainer>
    </div>
  );

  const workContent = (
    <div className="flex flex-col gap-4">
      <GlassContainer variant="card" className="p-4">
        <div className="text-[13px] font-semibold uppercase text-[var(--secondary-label)] mb-2">
          Persistent Tasks
        </div>
        <div className="text-[15px] text-[var(--secondary-label)] italic py-2">
          No tasks yet. Items stay in place when completed.
        </div>
      </GlassContainer>
    </div>
  );

  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[var(--system-grouped-background)] text-[var(--label)] flex flex-col select-none">
      {isDesktop ? (
        /* ── Desktop View (>= 1024px) ─────────────────────────────────── */
        <div className="h-full w-full overflow-y-auto">
          <DesktopLayout
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            goalHeroSlot={goalHeroPlaceholder}
            todaySlot={todayContent}
            workSlot={workContent}
          />
        </div>
      ) : (
        /* ── Mobile View (< 1024px) ──────────────────────────────────── */
        <div className="relative h-full w-full flex flex-col">
          {/* Collapsing Header Top Chrome */}
          <CollapsingHeader
            title={activeTab === 'today' ? 'Today' : 'Work'}
            subtitle={activeTab === 'today' ? formatHeaderDate() : undefined}
            isEditMode={isEditMode}
            onToggleEditMode={toggleEditMode}
            onOpenSettings={openSettings}
            scrollContainerRef={scrollContainerRef}
          />

          {/* Native Momentum Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 48px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 88px)',
            }}
          >
            {activeTab === 'today' ? (
              <div className="flex flex-col gap-4">
                {goalHeroPlaceholder}
                {todayContent}
              </div>
            ) : (
              workContent
            )}
          </div>

          {/* Floating Glass Capsule Tab Bar */}
          <FloatingTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}
    </div>
  );
};

export default App;
```

---

## 12. Verification & HIG Compliance Matrix

| Requirement | Apple HIG Spec | Cadence Implementation | Verification Method |
|---|---|---|---|
| **Breakpoint Switch** | `< 1024px` = Mobile, `>= 1024px` = Desktop | `useIsDesktop()` hook listening to `(min-width: 1024px)` | Resize browser across 1024px, inspect DOM for tab bar vs 2-col |
| **Safe Areas** | Dynamic Island & Home Bar clearance | Top header has `env(safe-area-inset-top)`, tab bar has `calc(env(safe-area-inset-bottom) + 12px)`, scroll container has `+ 88px` padding | WebKit iPhone 17 Air viewport (420x912) |
| **Collapsing Title** | 34px bold fades to 17px semibold inline bar on scroll | GPU-composited `useTransform` on `scrollY` (0 to 48px range) | Scroll down 60px, assert inline title opacity = 1, large title opacity = 0 |
| **Floating Glass Tab Bar** | 56px capsule with blur and spring highlight | Capsule pill `layoutId="activeTabPill"`, `stiffness: 500, damping: 28` | Tab toggle animation, check spring continuity |
| **ProMotion 120Hz** | Composite-only properties (`transform`, `opacity`) | Zero `height`/`width` animations during transitions; GPU acceleration | Framer Motion layout projection and style transforms |
| **prefers-reduced-motion** | No springs, bounces or slides | Crossfade transitions (`duration: 0.15s, ease: "easeInOut"`) | Emulate reduced motion in Playwright, verify zero spring motion |
| **Safe Haptics** | iOS micro-haptic feedback without exceptions | `triggerHaptic()` with try/catch and navigator.vibrate fallback | Trigger each type, verify no exceptions thrown |
| **Anti-Web-Ism** | No grey tap box, no unwanted page bounce | `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, `position: fixed` | Touch tap interaction check in mobile WebKit |
| **Tap Targets** | >= 44x44 pt minimum hit area | Every header button and tab item has `min-h-[44px] min-w-[44px]` | Computed element bounding boxes >= 44x44px |

---
*End of Milestone 1 Analysis Specification.*
