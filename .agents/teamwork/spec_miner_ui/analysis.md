# Cadence UI/UX & Liquid Glass Design Specification

**Author**: `spec_miner_ui` (Specification Miner)  
**Date**: 2026-10-17  
**Scope**: Apple iOS 26 "Liquid Glass" Design System, Motion Physics, Native Feel Resets, PWA & iPhone 17 Air Specifications, and Comprehensive Feature Discovery.

---

## 1. Executive Summary & Design Vision

**Cadence** is a single-purpose, installable checklist web application (PWA) designed to feel completely indistinguishable from a first-party Apple iOS 26 application running on an **iPhone 17 Air** (420pt x 912pt viewport at @3x Retina, 1260px x 2736px), while adapting seamlessly to desktop displays (>=1024px).

The design language embodies Apple's **"Liquid Glass"**:
- Multi-surface optical translucency with saturated backdrop refraction (`backdrop-filter: blur(...) saturate(...)`).
- 0.5px hairline perimeter specular borders.
- Responsive, physically based mass-spring-damper motion tuned for 120Hz ProMotion displays.
- Strict elimination of browser artifacts ("anti-web-isms"): zero tap grey flashes, zero unwanted rubber-banding, zero iOS Safari input zoom, and absolute safe-area compliance around the Dynamic Island and Home Indicator.
- Dual-mode fidelity: Light and Dark modes are engineered with identical visual dignity.

---

## 2. Apple iOS 26 Semantic Design Tokens & Color System

The color system conforms strictly to Apple iOS 26 Human Interface Guidelines, leveraging CSS Custom Properties with light and dark mode overrides (`prefers-color-scheme`).

### 2.1 CSS Variables Registry

```css
:root {
  /* System Accents */
  --system-blue: #007AFF;
  --system-blue-rgb: 0, 122, 255;
  --system-cyan: #32ADE6;
  --system-cyan-rgb: 50, 173, 230;
  --system-green: #34C759;
  --system-red: #FF3B30;
  --system-orange: #FF9500;

  /* Backgrounds */
  --system-background: #FFFFFF;
  --secondary-system-background: #F2F2F7;
  --tertiary-system-background: #FFFFFF;
  --system-grouped-background: #F2F2F7;
  --secondary-system-grouped-background: #FFFFFF;
  --tertiary-system-grouped-background: #F2F2F7;

  /* Labels (Text) */
  --label: #000000;
  --secondary-label: rgba(60, 60, 67, 0.60);
  --tertiary-label: rgba(60, 60, 67, 0.30);
  --quaternary-label: rgba(60, 60, 67, 0.18);

  /* Separators & Fills */
  --separator: rgba(60, 60, 67, 0.29);
  --opaque-separator: #C6C6C8;
  --system-fill: rgba(120, 120, 128, 0.20);
  --secondary-system-fill: rgba(120, 120, 128, 0.16);
  --tertiary-system-fill: rgba(118, 118, 128, 0.12);
  --quaternary-system-fill: rgba(116, 116, 128, 0.08);

  /* Liquid Glass Materials - Light Mode */
  --glass-surface-bg: rgba(255, 255, 255, 0.72);
  --glass-surface-border: rgba(255, 255, 255, 0.45);
  --glass-surface-specular: inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.85);
  --glass-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03);
  --glass-blur: blur(24px) saturate(190%);

  /* Navigation & Floating Tab Bar */
  --nav-bar-bg: rgba(255, 255, 255, 0.75);
  --tab-bar-bg: rgba(255, 255, 255, 0.82);
  --tab-bar-border: rgba(0, 0, 0, 0.08);
  --tab-bar-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --tab-active-indicator: rgba(0, 122, 255, 0.12);

  /* Goal Hero Card - Light Mode */
  --goal-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 248, 255, 0.75) 100%);
  --goal-card-border: rgba(0, 122, 255, 0.22);
  --goal-card-glow: 0 8px 32px -4px rgba(0, 122, 255, 0.14), 0 2px 12px -2px rgba(50, 173, 230, 0.16);

  /* Progress Ring */
  --progress-ring-track: rgba(120, 120, 128, 0.16);
  --progress-ring-fill: var(--system-blue);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* System Accents */
    --system-blue: #0A84FF;
    --system-blue-rgb: 10, 132, 255;
    --system-cyan: #64D2FF;
    --system-cyan-rgb: 100, 210, 255;
    --system-green: #30D158;
    --system-red: #FF453A;
    --system-orange: #FF9F0A;

    /* Backgrounds */
    --system-background: #000000;
    --secondary-system-background: #1C1C1E;
    --tertiary-system-background: #2C2C2E;
    --system-grouped-background: #000000;
    --secondary-system-grouped-background: #1C1C1E;
    --tertiary-system-grouped-background: #2C2C2E;

    /* Labels (Text) */
    --label: #FFFFFF;
    --secondary-label: rgba(235, 235, 245, 0.60);
    --tertiary-label: rgba(235, 235, 245, 0.30);
    --quaternary-label: rgba(235, 235, 245, 0.16);

    /* Separators & Fills */
    --separator: rgba(84, 84, 88, 0.60);
    --opaque-separator: #38383A;
    --system-fill: rgba(120, 120, 128, 0.36);
    --secondary-system-fill: rgba(120, 120, 128, 0.32);
    --tertiary-system-fill: rgba(118, 118, 128, 0.24);
    --quaternary-system-fill: rgba(118, 118, 128, 0.18);

    /* Liquid Glass Materials - Dark Mode */
    --glass-surface-bg: rgba(28, 28, 30, 0.75);
    --glass-surface-border: rgba(255, 255, 255, 0.12);
    --glass-surface-specular: inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0.5px 0 rgba(0, 0, 0, 0.5);
    --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.38);
    --glass-blur: blur(28px) saturate(200%);

    /* Navigation & Floating Tab Bar */
    --nav-bar-bg: rgba(28, 28, 30, 0.78);
    --tab-bar-bg: rgba(28, 28, 30, 0.85);
    --tab-bar-border: rgba(255, 255, 255, 0.14);
    --tab-bar-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);
    --tab-active-indicator: rgba(10, 132, 255, 0.22);

    /* Goal Hero Card - Dark Mode */
    --goal-card-bg: linear-gradient(135deg, rgba(30, 38, 50, 0.85) 0%, rgba(18, 24, 32, 0.75) 100%);
    --goal-card-border: rgba(10, 132, 255, 0.30);
    --goal-card-glow: 0 12px 40px -4px rgba(10, 132, 255, 0.24), 0 4px 16px -2px rgba(100, 210, 255, 0.20);

    /* Progress Ring */
    --progress-ring-track: rgba(120, 120, 128, 0.24);
    --progress-ring-fill: var(--system-blue);
  }
}
```

---

## 3. Typography Scale & Font Hierarchy

The typography stack prioritizes Apple San Francisco (`SF Pro Display` for large headings, `SF Pro Text` for body, `SF Pro` system stack) with fallback to `Inter` on non-Apple devices.

### 3.1 Font Family Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Inter", system-ui, sans-serif;
```

### 3.2 Apple Type Hierarchy Table
| Style | Size (pt/px) | Line Height | Weight | Tracking (Letter Spacing) | Usage |
|---|---|---|---|---|---|
| **Large Title** | 34px | 41px (1.205) | Bold (700) | `+0.37px` | Prominent screen header ("Today", "Work") |
| **Title 1** | 28px | 34px (1.214) | Bold (700) | `+0.36px` | Hero Goal statement (desktop), Sheet headers |
| **Title 2** | 22px | 28px (1.272) | Bold (700) | `+0.35px` | Hero Goal statement (mobile) |
| **Title 3** | 20px | 25px (1.250) | Semibold (600) | `+0.38px` | Section titles in desktop side-by-side |
| **Headline** | 17px | 22px (1.294) | Semibold (600) | `-0.41px` | Navigation bar inline title, Primary action labels |
| **Body** | 17px | 22px (1.294) | Regular (400) | `-0.41px` | Checklist row titles, Text inputs (guarantees no iOS zoom) |
| **Callout** | 16px | 21px (1.312) | Regular (400) | `-0.32px` | Secondary buttons, Secondary form fields |
| **Subheadline** | 15px | 20px (1.333) | Regular (400) | `-0.24px` | Metadata, Date subheadings |
| **Footnote** | 13px | 18px (1.385) | Regular (400) / Semibold (600) | `-0.08px` | Section header uppercase titles ("MORNING ROUTINE"), Goal countdown badge |
| **Caption 1** | 12px | 16px (1.333) | Regular (400) | `0.0px` | Tab bar labels, micro-badges |
| **Caption 2** | 11px | 13px (1.182) | Semibold (600) | `+0.07px` | Hero card category label ("PRIMARY GOAL") |

### 3.3 Tabular Figures
For countdown counters ("142 days left") and progress fractions ("2/3"), apply:
```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

---

## 4. Liquid Glass Component Specifications

### 4.1 Collapsing Large Title Navigation Bar
- **Resting State (`scrollY === 0`)**:
  - Fixed top nav bar height: `44px + env(safe-area-inset-top)`.
  - Top nav bar background: `transparent`, zero border.
  - Centered inline title: `opacity: 0`, `transform: translateY(6px) scale(0.95)`.
  - Content container: Large Title (`34px`, bold) sits prominently at the top of scroll view with date subtitle (`13px`, semibold, uppercase, `secondaryLabel`).
- **Scroll Interpolation (`0 < scrollY <= 52px`)**:
  - Large title opacity: `Math.max(0, 1 - scrollY / 40)`.
  - Top bar background: fades in `var(--nav-bar-bg)` with `backdrop-filter: var(--glass-blur)`.
  - Bottom 0.5px hairline border (`var(--separator)`) fades in.
  - Centered inline title: `opacity: Math.min(1, Math.max(0, (scrollY - 28) / 20))`, `transform: translateY(0) scale(1.0)`.
- **Collapsed State (`scrollY > 52px`)**:
  - Large title is completely hidden/scrolled away.
  - Nav bar is fully glazed with centered 17pt Headline title ("Today" or "Work").
  - Trailing action button (Settings gear icon or Edit button) remains pinned at top right with 44x44pt tap target.

### 4.2 Inset Grouped Lists (iOS Reminders Style)
- **Geometry**:
  - Horizontal margin: `16px` on mobile, clipped inside the card container.
  - Card Border Radius: `12px` (Apple continuous squircle curve).
  - Background: `var(--secondary-system-grouped-background)`.
  - Shadow: `0 1px 3px rgba(0, 0, 0, 0.04)`.
- **Section Headers**:
  - Text: `13px` Footnote, uppercase, semibold, `color: var(--secondary-label)`, letter spacing `+0.2px`.
  - Padding: `16px 16px 6px 16px`.
  - Flex layout containing section title on the left and **Refined Progress Ring** on the right.
- **List Rows**:
  - Height: `52px` (ensures generous touch area exceeding 44pt minimum).
  - Row Padding: `0 16px`.
  - Separators: `0.5px solid var(--separator)`.
  - Separator Inset: begins at the label left edge (`52px` from left edge of row, leaving checkbox uncrossed), extends to `right: 0`.
  - The last row in a section card has NO bottom separator.
- **Empty States**:
  - When a section has 0 items: An elegant inset container showing a muted outline icon, a 15pt Subheadline "No items", and an inline "+ Add item" prompt in `var(--system-blue)`.

### 4.3 Circular Checkbox & Micro-Interaction
- **Dimensions**:
  - Outer circle: `24px x 24px`, `border-radius: 50%`.
  - Tap target wrapper: `44px x 44px` centered hit-box (`display: flex; align-items: center; justify-content: center;`).
- **Unchecked State**:
  - Border: `1.5px solid var(--separator)`.
  - Fill: `transparent`.
  - Checkmark SVG: `opacity: 0`, `pathLength: 0`.
- **Checked State**:
  - Border: `1.5px solid var(--system-blue)`.
  - Fill: `var(--system-blue)`.
  - Checkmark SVG: White `#FFFFFF`, stroke width `2.2px`, `stroke-linecap: round`, `stroke-linejoin: round`.
- **Micro-Interaction Physics**:
  1. **Scale Snap**: On tap, the circle compresses to `scale: 0.88`, then springs back to `1.0` with Framer Motion spring (`stiffness: 500, damping: 24, mass: 0.6`).
  2. **Draw-in**: Checkmark path length animates from `0` to `1` over `0.20s` (`ease: [0.16, 1, 0.3, 1]`).
  3. **Text Transition**:
     - Today tab: text dims to `var(--secondary-label)` (`opacity: 0.55`).
     - Work tab: text dims to `var(--secondary-label)` and an animated horizontal strikethrough line sweeps across the text from left to right (`pathLength: [0, 1]`). Item remains in place.
  4. **Progress Ring Reactivity**: Section progress ring updates immediately via spring interpolation.

### 4.4 Section Progress Ring
- **Geometry**:
  - SVG circle: `22px x 22px`.
  - Radius: `8.5px`, Stroke width: `2.2px`, Circumference: `2 * Math.PI * 8.5 ≈ 53.4px`.
- **Visuals**:
  - Background track: `var(--progress-ring-track)`.
  - Foreground fill: `var(--system-blue)` (or `var(--system-green)` when 100% complete).
  - Animation: `strokeDashoffset` smoothly transitions via spring interpolation.
  - Micro-check icon inside ring when section reaches 100%.

### 4.5 Goal Hero Card
- **Geometry**:
  - Continuous squircle: `border-radius: 20px;` (Apple squircle contour).
  - Padding: `20px 20px 18px 20px`.
  - Margin: `12px 16px 20px 16px`.
  - Material: `var(--goal-card-bg)`, with `backdrop-filter: blur(24px) saturate(180%)`.
  - Border: `0.5px solid var(--goal-card-border)`.
  - Ambient Glow: `var(--goal-card-glow)` (quiet blue-to-cyan ambient illumination).
- **Typography & Content**:
  - Category Badge: "PRIMARY GOAL" in `11px` semibold, tracking `+0.8px`, uppercase, `color: var(--system-cyan)`.
  - Goal Statement: `22px` Title 2 (mobile) / `26px` Title 1 (desktop), bold, `color: var(--label)`, line height `1.28`.
  - Countdown Pill Badge:
    - Displayed when target date is defined (e.g. "142 days left", "Today", "Tomorrow").
    - Background: `rgba(0, 122, 255, 0.12)` (light) / `rgba(10, 132, 255, 0.20)` (dark).
    - Text: `13px` Footnote, semibold, tabular numbers, `color: var(--system-blue)`.
    - If target date is not set: countdown is hidden.
  - Empty State: When no goal is set, displays "Tap to define your primary goal" with a subtle dashed accent indicator.
- **The "Day Complete" Shimmer Moment**:
  - Triggered strictly when all items across Morning Routine, Work Day, and Evening Routine are checked.
  - **Single Restrained Specular Sweep**:
    - An oblique 45° specular reflection band traverses across the card from left to right.
    - Duration: `1.2s`, `ease: "easeInOut"`.
    - Keyframes: `transform: translateX(-120%) rotate(25deg)` to `translateX(220%) rotate(25deg)`.
    - Shimmer gradient: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)`.
    - Accompanied by a gentle glow pulse (`box-shadow` expands by 30% and settles) and a medium haptic tap.
    - **No confetti**, no childish popups, no looping distractions. Tasteful Apple elegance.

### 4.6 Navigation & Layout: Mobile vs Desktop
- **Mobile (< 1024px) Floating Glass Tab Bar**:
  - Capsule pill floating above the bottom edge:
    ```css
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 20px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 56px;
    border-radius: 9999px;
    background: var(--tab-bar-bg);
    backdrop-filter: blur(28px) saturate(200%);
    border: 0.5px solid var(--tab-bar-border);
    box-shadow: var(--tab-bar-shadow);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 4px;
    z-index: 100;
    ```
  - Two Tabs:
    1. **Today**: Icon (sun/checklist calendar) + label "Today".
    2. **Work**: Icon (briefcase/tray) + label "Work".
  - Active Tab Sliding Highlight:
    - Pill background sliding behind the active tab using Framer Motion `layoutId="activeTabPill"`.
    - Spring transition: `stiffness: 420, damping: 32`.
  - Scroll bottom clearance:
    - Scroll containers have `padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 88px)` to ensure the lowest items scroll cleanly above the floating tab bar.
- **Desktop (>= 1024px) Side-by-Side Layout**:
  - Floating tab bar is **completely omitted** (`display: none;`).
  - Container: Max width `1200px`, centered with `margin: 0 auto; padding: 32px 24px;`.
  - Top Bar: App title ("Cadence"), current full date, Sync status indicator, Settings icon button.
  - Goal Hero Card: Spans across the top of the workspace.
  - Two-Column Grid:
    - `grid-template-columns: 1fr 1fr; gap: 32px;`
    - Column 1: **Today** (Morning Routine, Work Day, Evening Routine).
    - Column 2: **Work** (Persistent list, "Clear Completed" toolbar action).
  - Desktop Interactions:
    - Row hover: subtle background tint `rgba(120, 120, 128, 0.06)` with `transition: background 0.15s ease`.
    - Keyboard Navigation:
      - `Space`: Toggle checkbox of focused row.
      - `Enter`: Submit inline edit or open new item input.
      - `ArrowUp` / `ArrowDown`: Move row focus.
      - `Escape`: Cancel edit / dismiss sheet.

### 4.7 Bottom Sheets & Confirmation Dialogs
- **Three Core Sheets**:
  1. **Goal Editor Sheet**: Textarea for goal statement, target date picker, "Clear Date" button, Save and Cancel controls.
  2. **Settings Sheet**: Rollover hour selector (e.g. 4:00 AM), signed-in email display, Sign Out action button, offline status badge.
  3. **Confirmation Dialog**: Triggered by "Clear Completed" in Work tab: "Clear X completed items? This action cannot be undone." with "Clear Completed" (destructive red) and "Cancel".
- **Presentation & Physics**:
  - Presentation: Springs up from screen bottom (`y: "100%"` to `y: 0`).
  - Sheet Container:
    - `border-top-left-radius: 20px; border-top-right-radius: 20px;`
    - Background: `var(--secondary-system-grouped-background)`.
    - Top grabber handle: `width: 36px; height: 5px; border-radius: 2.5px; background: var(--tertiary-label); margin: 8px auto 16px auto;`.
  - Gesture: `drag="y"`, `dragConstraints={{ top: 0 }}`, `dragElastic={0.2}`.
  - Dismissal: Dragging down > 120px or fling velocity > 500px/s dismisses sheet.
  - **Background Scale-Back**:
    - The underlying app view scales back to `scale: 0.94`, translates down `y: 10px`, and rounds top corners `border-radius: 16px`, exactly mimicking native iOS modal presentation.
    - Backdrop overlay: `background: rgba(0, 0, 0, 0.4)` (light) / `rgba(0, 0, 0, 0.65)` (dark).

### 4.8 Swipe-to-Delete & Edit Mode
- **Swipe-to-Delete (Touch)**:
  - Row translates horizontally: `drag="x"`, `dragConstraints={{ left: -84, right: 0 }}`, `dragElastic: 0.15` (iOS rubber-band resistance).
  - Trailing reveal: Destructive red background (`var(--system-red)`) with centered trash icon.
  - Quick fling / drag past -160px: triggers automatic delete with row height collapse spring.
- **Edit Mode**:
  - Toggled via "Edit" button in navigation bar.
  - Leading edge: red minus delete circle slides in from left (`width: 32px, opacity: 1`).
  - Trailing edge: 3-bar drag reorder handle slides in from right (`width: 32px, opacity: 1`).
  - Dragging reorder handle uses Framer Motion `<Reorder.Group>` and `<Reorder.Item>` with smooth layout reflow.

---

## 5. Motion & Physics Specification

All animations use Framer Motion physics-based springs. Never use linear timing curves or sudden transitions.

### 5.1 Framer Motion Spring Parameters
```typescript
export const MOTION_SPRINGS = {
  // Sheet presentation: responsive, taut, zero overshoot
  sheet: {
    type: "spring",
    damping: 32,
    stiffness: 340,
    mass: 0.9,
  },
  // Sheet dismissal
  sheetDismiss: {
    type: "spring",
    damping: 35,
    stiffness: 380,
    mass: 0.8,
  },
  // Checkbox scale bounce on toggle
  checkboxSnap: {
    type: "spring",
    stiffness: 500,
    damping: 24,
    mass: 0.6,
  },
  // Row layout reflow / reordering
  listReflow: {
    type: "spring",
    damping: 30,
    stiffness: 320,
    mass: 0.8,
  },
  // Tab bar sliding active pill
  tabSwitcher: {
    type: "spring",
    stiffness: 420,
    damping: 34,
    mass: 0.8,
  },
  // Progress ring stroke interpolation
  progressRing: {
    type: "spring",
    stiffness: 220,
    damping: 26,
    mass: 0.7,
  },
  // Background scale-back during sheet presentation
  backgroundScale: {
    type: "spring",
    damping: 30,
    stiffness: 300,
    mass: 0.9,
  },
} as const;
```

### 5.2 120Hz ProMotion Optimization
- Strictly animate composite-only properties: `transform` (`translate3d`, `scale`) and `opacity`.
- Zero layout thrashing: no animating `height` or `margin` during drag gestures. Use `layout` projection.
- Cumulative Layout Shift (CLS) budget `< 0.02`:
  - Fixed aspect ratio containers for icons and badges.
  - Skeletons or pre-dimensioned placeholders for async data.
- Immediate Theme Application:
  - An inline script in `index.html` checks `window.matchMedia('(prefers-color-scheme: dark)')` before the first paint, applying `.dark` or `.light` class to document root. Zero flash of unstyled/white content.

### 5.3 Strict `prefers-reduced-motion` Compliance
When the user has enabled reduced motion in system preferences:
- All spring animations, slide-ups, scale transforms, and layout reflow animations are **disabled**.
- Fallback: clean opacity cross-fades (`duration: 0.15s, ease: "easeInOut"`).
- Checkbox fills instantly with subtle fade; no scale bounce.
- Goal Hero Card shimmer is disabled; replaced by a static accent border glow.
- Sheets appear with simple fade-in overlay rather than rising from the bottom.
- Implementation pattern:
  ```typescript
  import { useReducedMotion } from "framer-motion";
  // In component:
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0.15 } : MOTION_SPRINGS.sheet;
  ```

### 5.4 iOS Haptics Engine
WebKit on iOS does not support full web-vibrate in all contexts, but best-effort micro-haptic feedback is provided:
```typescript
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error') {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      switch (type) {
        case 'selection':
        case 'light':
          navigator.vibrate(8);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
        case 'warning':
          navigator.vibrate(35);
          break;
        case 'success':
          navigator.vibrate([12, 40, 18]);
          break;
        case 'error':
          navigator.vibrate([30, 60, 30, 60, 40]);
          break;
      }
    } catch {
      // Degrades silently
    }
  }
}
```

---

## 6. Anti-Web-Ism & Native Feel Engineering

To achieve absolute fidelity where the app is indistinguishable from a native Swift/SwiftUI app, the following CSS rules and behaviors must be enforced:

### 6.1 Global CSS Reset & Native Locks
```css
/* 1. Eliminate tap grey highlight box */
* {
  -webkit-tap-highlight-color: transparent !important;
}

/* 2. Prevent accidental text selection across interactive elements */
body, button, input[type="checkbox"], nav, header, [role="button"], [role="tab"] {
  -webkit-user-select: none;
  user-select: none;
}

/* Allow text selection strictly inside text inputs */
input[type="text"], input[type="email"], textarea {
  -webkit-user-select: text;
  user-select: text;
}

/* 3. Disable iOS long-press callout preview menus on links/buttons */
* {
  -webkit-touch-callout: none;
}

/* 4. Enforce font-size >= 16px on ALL inputs to prevent iOS Safari auto-zoom */
input, textarea, select {
  font-size: 17px !important; /* Matches iOS Body text */
  line-height: 22px;
}

/* 5. Prevent whole-page rubber-banding / bounce */
html, body, #root {
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: fixed;
  overscroll-behavior: none;
}

/* 6. Smooth inner momentum scrolling for list containers */
.native-scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  height: 100%;
}
```

### 6.2 Safe Areas & Viewport Configuration
- **HTML Meta Tag**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  ```
- **Safe Area Insets**:
  - `env(safe-area-inset-top)`: clears the Dynamic Island / notch (approx. 59px on iPhone 17 Air).
  - `env(safe-area-inset-bottom)`: clears the Home Indicator bar (approx. 34px).
  - `env(safe-area-inset-left)`, `env(safe-area-inset-right)`: handles landscape rotation.
  - Floating tab bar offset: `bottom: calc(env(safe-area-inset-bottom, 20px) + 12px)`.

---

## 7. PWA, Manifest, Service Worker & Splash Screen Specifications

### 7.1 Web App Manifest (`manifest.webmanifest`)
```json
{
  "name": "Cadence",
  "short_name": "Cadence",
  "description": "Apple-grade daily checklist & cadence manager",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "fullscreen"],
  "orientation": "portrait-primary",
  "theme_color": "#F2F2F7",
  "background_color": "#F2F2F7",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 7.2 iOS Apple Meta Tags (`index.html`)
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Cadence" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
<meta name="mobile-web-app-capable" content="yes" />

<!-- iPhone 17 Air Splash Screens (420pt x 912pt @3x = 1260px x 2736px) -->
<link rel="apple-touch-startup-image" 
      media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)" 
      href="/splash/splash-light-1260x2736.png" />
<link rel="apple-touch-startup-image" 
      media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)" 
      href="/splash/splash-dark-1260x2736.png" />
```

### 7.3 Service Worker Caching Strategy
- **Service Worker Lifecycle**:
  - `install`: Pre-cache core app shell assets (HTML, compiled Vite JS, CSS, icons, fonts).
  - `activate`: Clean up obsolete cache versions.
  - `fetch`:
    - Static assets & navigation: **Cache-First**, falling back to network.
    - Offline fallback: If offline navigation fails, immediately return cached `/index.html` (SPA fallback).
    - Supabase API calls: Handled by client sync engine with IndexedDB persistence; service worker does not intercept Supabase REST/WebSocket calls, allowing IndexedDB to be the single offline source of truth.

---

## 8. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Today Checklist | Morning Routine Section | Inset grouped list of daily morning habits; unchecks automatically at rollover time | User taps checkbox / reorders / adds item | Checked state toggle, progress ring update | Retains previous state if error | R1, R2 |
| 2 | Today Checklist | Work Day Section | Inset grouped list of daily work habits; unchecks automatically at rollover time | User taps checkbox / reorders / adds item | Checked state toggle, progress ring update | Retains previous state if error | R1, R2 |
| 3 | Today Checklist | Evening Routine Section | Inset grouped list of daily evening habits; unchecks automatically at rollover time | User taps checkbox / reorders / adds item | Checked state toggle, progress ring update | Retains previous state if error | R1, R2 |
| 4 | Today Checklist | Section Progress Ring | Circular ring tracking completed fraction (e.g. 2/3) in section header | Section item check/uncheck events | Smooth SVG strokeDashoffset animation | Falls back to static circle | R1, R2 |
| 5 | Rollover Engine | Logical Day Calculation | Automatically resets daily checked states at custom hour (default 4:00 AM) without server cron | System clock time vs rollover hour | Daily items reset to unchecked live in UI | Preserves items, never deletes | R1, Acceptance Criteria |
| 6 | Goal Card | Hero Goal Card | Pinned card at top of Today tab displaying goal statement + optional countdown badge | Tap card to edit; goal state | Formatted statement, countdown pill badge | Empty state if blank | R1, R2 |
| 7 | Goal Card | Target Date Countdown | Calculates and displays remaining days (e.g. "142 days left", "Today", "Tomorrow") | Target date string | Formatted countdown string | Hides badge if date cleared | R1, R2 |
| 8 | Goal Card | Day Complete Shimmer Moment | Single restrained specular highlight sweep when all 3 daily sections reach 100% | 100% completion trigger across Today | 1.2s specular gradient sweep + haptic pulse | Disabled in reduced-motion | R1, R2 |
| 9 | Work Checklist | Persistent Work Checklist | Side checklist of persistent tasks; checked items stay in place, struck-through & dimmed | Tap checkbox | Strikethrough line animation, opacity dim | Retains previous state if error | R1, R2 |
| 10 | Work Checklist | Swipe-to-Delete | Touch gesture dragging row left to reveal red delete button or full swipe delete | Horizontal touch drag on mobile | Row deletion with spring reflow | Snaps back on canceled swipe | R1, R2 |
| 11 | Work Checklist | Clear Completed Action | Toolbar button visible only when >= 1 item is checked; prompts confirmation | Tap "Clear Completed" button | Opens confirmation dialog sheet | Button hidden when 0 checked | R1, R2 |
| 12 | Work Checklist | Clear Completed Confirmation | Bottom sheet dialog asking to confirm deletion of completed items | User taps "Clear" or "Cancel" | Batch deletes completed items or dismisses | Reverts without changes if canceled | R1, R2 |
| 13 | List Editing | Inline Item Add | Native-feeling input row at bottom of section with "+ Add item" prompt | Enter key / tap add | Appends new item with focus retention | Ignores empty string | R1, R2 |
| 14 | List Editing | Inline Item Rename | Tap row text in Edit mode to edit item title in-place | Text input change | Updates item title in local store | Reverts to prior title if empty | R1, R2 |
| 15 | List Editing | Drag-to-Reorder | Interactive dragging of items via trailing reorder handle in Edit mode | Pointer / touch drag | Updates item ordering sequence | Reverts to original position on cancel | R1, R2 |
| 16 | List Editing | Empty States | Elegant inset card inviting the user to add the first item when a list has 0 items | Empty items array | Muted icon + Subheadline prompt | N/A | R1, R2 |
| 17 | Navigation | Floating Glass Tab Bar (Mobile) | Floating capsule bar at bottom with Today & Work tabs and sliding highlight pill | Tap tab / viewport < 1024px | Active tab switch with spring indicator | Fallback to standard tab bar | R1, R2 |
| 18 | Navigation | Desktop Side-by-Side Grid | 2-column layout (Goal top, Today left, Work right) with tab bar omitted for >=1024px | Viewport width >= 1024px | Side-by-side view with hover states | Graceful responsive reflow | R1, R2 |
| 19 | Navigation | Collapsing Large Title | Screen title collapses to inline centered title in blurred nav bar on scroll | Scroll position `scrollY` | Fades large title, reveals glass nav bar | Fixed fallback if no scroll | R1, R2 |
| 20 | Bottom Sheets | Goal Editor Sheet | Bottom sheet modal to edit goal statement and target date | Tap Goal Hero card | Presents sheet with background scale-back | Validates date format | R1, R2 |
| 21 | Bottom Sheets | Settings Sheet | Sheet containing rollover hour selector, signed-in email, sign-out button | Tap Settings gear icon | Presents sheet with background scale-back | N/A | R1, R2 |
| 22 | Bottom Sheets | Drag-to-Dismiss Gesture | Drag down on sheet grabber handle to dismiss modal | Drag gesture down > 120px | Springs back to bottom and unmounts | Rebounds to open if drag < 120px | R1, R2 |
| 23 | Motion Physics | Framer Motion Springs | Physically based spring parameters for sheet pop, checkbox snap, list reflow | Interaction triggers | Natural, taut, non-linear Apple animations | Replaces with cross-fade in reduced-motion | R2 |
| 24 | Motion Physics | ProMotion 120Hz Optimization | GPU-accelerated transforms, zero layout shifts, CLS < 0.02 | 120Hz display refresh | Fluid 120fps frame rate without jank | Degrades gracefully on 60Hz | R2 |
| 25 | Motion Physics | Prefers-Reduced-Motion Fallback | Disables spring, slide, and scale animations when user prefers reduced motion | System accessibility preference | Clean opacity cross-fades only | N/A | R2, Acceptance Criteria |
| 26 | Haptics | Micro-Haptics Engine | Best-effort tactile feedback on tap, checkmark snap, and completion moments | User interaction | Vibration pulse via navigator.vibrate | Fails silently on unsupported devices | R2 |
| 27 | Anti-Web-Ism | Elimination of Tap Highlight | Disables grey rectangular flash on touch | Touch start / tap | Completely invisible tap feedback | N/A | R2, R3 |
| 28 | Anti-Web-Ism | Prevention of Text Selection | Disables accidental blue text highlighting on drag / double-tap | User drag / double tap | Text selection prevented on UI elements | Text remains selectable in inputs | R2 |
| 29 | Anti-Web-Ism | iOS Safari Input Zoom Lock | All inputs configured with font-size >= 16px to prevent viewport auto-zoom | Input focus | Viewport remains fixed at scale 1.0 | N/A | R2, Acceptance Criteria |
| 30 | Anti-Web-Ism | Safe Area & Dynamic Island Clearance | Insets configured via env(safe-area-inset-top/bottom) and viewport-fit=cover | Device notch / Dynamic Island / Home Bar | Full-bleed background with padded content | Fallbacks to 16px/20px padding | R2, Acceptance Criteria |
| 31 | Anti-Web-Ism | Whole-Page Bounce Prevention | Disables white browser bounce while keeping inner momentum scrolling | Vertical swipe on window | Body scroll locked; inner list scrolls | Inner list preserves momentum | R2 |
| 32 | PWA | Web App Manifest & Standalone Mode | Manifest configured for standalone PWA with theme colors and icons | Add to Home Screen | Full-screen app experience without Safari chrome | Normal browser mode if not installed | R4 |
| 33 | PWA | Service Worker Shell Precaching | Offline cache of HTML, CSS, JS, and image assets for instant launch | Service worker registration | Instant offline launch without network | Updates cache in background | R4 |
| 34 | PWA | iPhone 17 Air Splash Screens | Light and dark launch splash screens (1260x2736px / 420x912pt @3x) | PWA launch from Home Screen | Native launch image matching system theme | Fallback to blank background | R4 |
| 35 | Authentication | 6-Digit Email OTP In-App Flow | In-app 6-digit code entry with auto-advance and paste support (no magic links) | User email + 6-digit verification code | Authenticated session token | Displays inline error for invalid code | R3, Acceptance Criteria |
| 36 | Offline Storage | Instant Local-First Data Store | Instant UI responsiveness backed by local store (IndexedDB); zero loading spinners | Any user mutation | Updates local state synchronously | Local persistence survives restart | R3 |
| 37 | Desktop UX | Keyboard Navigation & Focus Ring | Full accessibility support (Space to toggle, Enter to add, Arrows to navigate) | Keyboard keystrokes | Accessible focus ring and action execution | Ignores invalid keystrokes | R1, Acceptance Criteria |

---

## 9. Edge Cases & Boundary Conditions

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Rollover Engine | User operating app at 3:59:59 AM crossing to 4:00:00 AM | At exactly 4:00 AM, all items across Morning, Work Day, and Evening uncheck live with a gentle cascade without requiring a page reload. Item names, ordering, and counts remain intact. |
| 2 | Rollover Engine | User changes rollover time in Settings (e.g. from 4:00 AM to 1:00 AM) | The logical day boundary recalculates immediately based on local time. If the current time has passed the new rollover hour, uncheck occurs; otherwise, checks persist. |
| 3 | Rollover Engine | Daylight Saving Time (DST) spring forward / fall back | Calculated using Date arithmetic (`now.getTime() - rolloverHour * 3600000`) anchored to local calendar date, preventing double resets or missed rollovers. |
| 4 | Goal Hero Card | Target date set to today's date | Countdown badge displays "Today" rather than "0 days left". |
| 5 | Goal Hero Card | Target date set to tomorrow's date | Countdown badge displays "Tomorrow" (or "1 day left"). |
| 6 | Goal Hero Card | Target date set in the past (e.g. yesterday) | Badge displays "Expired" or "Overdue by X days" in `var(--system-red)` footnote text. |
| 7 | Goal Hero Card | Target date cleared/deleted in Goal Editor | Countdown badge smoothly disappears from card; goal statement displays cleanly without empty pill. |
| 8 | Goal Hero Card | Very long goal statement (e.g. 200 characters) | Text wraps gracefully with line-clamp or dynamic font scaling (`17px` - `22px`), preserving card padding and layout. |
| 9 | Goal Hero Card | Day complete shimmer trigger when 0 items in daily sections | Shimmer does NOT trigger if any section has 0 items. It only triggers when >= 1 item exists in all configured sections and 100% are checked. |
| 10 | Work Checklist | 0 items checked in Work tab | "Clear Completed" button in header/toolbar is hidden / omitted from DOM. |
| 11 | Work Checklist | 1 item checked in Work tab | "Clear Completed" button appears with spring fade-in; tapping shows confirmation dialog "Clear 1 completed item?". |
| 12 | Work Checklist | User cancels "Clear Completed" dialog | Dialog dismisses; checked items remain completely untouched. |
| 13 | Work Checklist | User confirms "Clear Completed" | All checked items exit with spring collapse animation; unchecked items remain in their original positions. |
| 14 | List Editing | Empty string submitted when adding item | Add action is silently ignored; input resets or maintains focus without creating ghost items. |
| 15 | List Editing | Rapid multiple taps on checkbox | Debounced or optimistic idempotent toggle; no visual desynchronization or double-toggle animation. |
| 16 | List Editing | Reorder item dragged outside the list boundary | Drag automatically clamps to list boundaries; canceling snaps item back to its starting index. |
| 17 | Responsive Layout | Browser resized across 1024px breakpoint | Seamless transition between mobile single-tab layout with floating tab bar and desktop two-column side-by-side grid without state loss or page reload. |
| 18 | Bottom Sheet | User drags sheet down slightly (e.g. 40px) and releases | Sheet springs back up to fully open resting position (`damping: 32, stiffness: 340`). |
| 19 | Bottom Sheet | User flings sheet down with high velocity (> 500px/s) | Sheet dismisses even if total drag distance was less than 120px. |
| 20 | Bottom Sheet | Background page interaction while sheet is open | Background interaction is blocked by the modal backdrop overlay; tapping backdrop dismisses sheet. |
| 21 | Anti-Web-Ism | iPhone virtual keyboard appears when editing item | Viewport shifts cleanly; input remains visible above virtual keyboard; no horizontal page scroll or broken layout. |
| 22 | Accessibility | System `prefers-reduced-motion: reduce` enabled | All spring animations, slide-ups, and list reflows are disabled; cross-fades (`0.15s`) used exclusively. |
| 23 | Accessibility | High Contrast / Dark Mode toggle while app is running | Color tokens instantly update to dark mode equivalents without needing a reload. |
| 24 | Offline PWA | Airplane mode / device offline at launch | Service worker loads cached `/index.html` shell; local IndexedDB initializes data immediately; app is 100% usable offline. |
| 25 | Auth Flow | User enters 6-digit code via paste | Paste event is intercepted; all 6 digits populate the input boxes automatically; form auto-submits for verification. |

---

## 10. Implementation Guidance & Architecture Checkpoints

1. **Component Hierarchy**:
   - `AppLayout`: Root container managing safe areas, theme detection, and viewports.
   - `HeaderNav`: Collapsing large title and top navigation bar with Liquid Glass material.
   - `GoalHeroCard`: Pinned goal card with squircle border, ambient glow, and completion shimmer.
   - `TodayView`: Container for Morning Routine, Work Day, and Evening Routine sections.
   - `WorkView`: Persistent checklist container with "Clear Completed" toolbar action.
   - `InsetGroupedList`: Reusable list component with 12px squircle, separator insets, and progress ring.
   - `ChecklistRow`: Row component with 24px circular checkbox, draw-in SVG checkmark, text dim/strikethrough, and swipe-to-delete.
   - `FloatingTabBar`: Fixed capsule bar with sliding pill indicator (mobile only).
   - `DesktopLayout`: Side-by-side grid wrapper for >=1024px.
   - `BottomSheet`: Generic modal container supporting drag-to-dismiss and background scaling.
2. **Quality Budgets**:
   - **Lighthouse**: Mobile Performance >= 90, Accessibility >= 95, Best Practices >= 95.
   - **CLS**: < 0.02 (Strictly enforce fixed dimensions on cards, rings, and avatars).
   - **axe-core**: 0 violations (44pt tap targets, contrast ratios >= 4.5:1, ARIA roles for lists and checkboxes).
   - **Bundle Size**: Initial JS <= 220 KB gzipped.

---
*End of Analysis Specification.*
