# Cadence Styling Architecture, Liquid Glass & Anti-Web-Ism Specification

**Specialist**: `explorer_m1_2`  
**Milestone**: M1 (App Shell & iOS 26 Liquid Glass Design System)  
**Date**: 2026-10-17  
**Scope**: CSS Variables & Design Tokens, iOS 26 Liquid Glass Optical Materials, Apple HIG Typography Scale & Anti-Zoom Guard, Safe-Area Architecture, Anti-Web-Ism Resets, and Tailwind CSS Configuration.

---

## 1. Executive Summary & Philosophy

**Cadence** is an Apple-grade daily checklist PWA engineered to be visually and tactilely indistinguishable from a first-party Apple iOS 26 application running on an **iPhone 17 Air** (420pt x 912pt viewport at @3x Retina, 1260px x 2736px), while scaling gracefully to desktop screens (>=1024px).

Almost all of the value in Cadence is in the slickness, smoothness, prestige, and class of the experience:
1. **Liquid Glass Optical Material**: Multi-stop backdrop blur, refraction saturation, 0.5px hairline specular perimeter borders, and soft layered elevation shadows.
2. **Semantic Color System with Parity**: Complete Light and Dark mode parity matching iOS 26 system tokens (`systemBlue`, `systemCyan`, `systemGroupedBackground`, `secondarySystemGroupedBackground`, etc.).
3. **Typography & Anti-Zoom Guard**: Apple San Francisco type hierarchy with exact tracking/letter-spacing, combined with a strict `17px` minimum input font-size to eliminate iOS Safari viewport auto-zoom.
4. **Anti-Web-Ism Resets**: Hard elimination of browser artifacts — zero grey tap flashes, zero accidental text selection on chrome, zero whole-page rubber-banding, and exact safe-area insets around the Dynamic Island and Home Indicator.

---

## 2. Design Tokens & CSS Custom Properties

The styling system is founded on CSS Custom Properties declared in `:root` and overridden in `@media (prefers-color-scheme: dark)` as well as `.dark` class selectors. This guarantees zero flashes of unstyled content (FOUC) while supporting both OS-level dark mode and explicit theme control.

### 2.1 Complete Semantic Color Tokens

```css
:root {
  /* System Accents */
  --system-blue: #007AFF;
  --system-blue-rgb: 0, 122, 255;
  --system-cyan: #32ADE6;
  --system-cyan-rgb: 50, 173, 230;
  --system-green: #34C759;
  --system-green-rgb: 52, 199, 89;
  --system-red: #FF3B30;
  --system-red-rgb: 255, 59, 48;
  --system-orange: #FF9500;
  --system-orange-rgb: 255, 149, 0;

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

  /* Goal Hero Card */
  --goal-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 248, 255, 0.75) 100%);
  --goal-card-border: rgba(0, 122, 255, 0.22);
  --goal-card-glow: 0 8px 32px -4px rgba(0, 122, 255, 0.14), 0 2px 12px -2px rgba(50, 173, 230, 0.16);

  /* Progress Ring */
  --progress-ring-track: rgba(120, 120, 128, 0.16);
  --progress-ring-fill: var(--system-blue);

  /* Safe Areas */
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}

/* Dark Mode Overrides */
@media (prefers-color-scheme: dark) {
  :root {
    /* System Accents */
    --system-blue: #0A84FF;
    --system-blue-rgb: 10, 132, 255;
    --system-cyan: #64D2FF;
    --system-cyan-rgb: 100, 210, 255;
    --system-green: #30D158;
    --system-green-rgb: 48, 209, 88;
    --system-red: #FF453A;
    --system-red-rgb: 255, 69, 58;
    --system-orange: #FF9F0A;
    --system-orange-rgb: 255, 159, 10;

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
    --glass-surface-bg: rgba(30, 30, 32, 0.72);
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

    /* Goal Hero Card */
    --goal-card-bg: linear-gradient(135deg, rgba(30, 38, 50, 0.85) 0%, rgba(18, 24, 32, 0.75) 100%);
    --goal-card-border: rgba(10, 132, 255, 0.30);
    --goal-card-glow: 0 12px 40px -4px rgba(10, 132, 255, 0.24), 0 4px 16px -2px rgba(100, 210, 255, 0.20);

    /* Progress Ring */
    --progress-ring-track: rgba(120, 120, 128, 0.24);
    --progress-ring-fill: var(--system-blue);
  }
}

/* Explicit .dark class synchronization */
.dark {
  --system-blue: #0A84FF;
  --system-blue-rgb: 10, 132, 255;
  --system-cyan: #64D2FF;
  --system-cyan-rgb: 100, 210, 255;
  --system-green: #30D158;
  --system-green-rgb: 48, 209, 88;
  --system-red: #FF453A;
  --system-red-rgb: 255, 69, 58;
  --system-orange: #FF9F0A;
  --system-orange-rgb: 255, 159, 10;

  --system-background: #000000;
  --secondary-system-background: #1C1C1E;
  --tertiary-system-background: #2C2C2E;
  --system-grouped-background: #000000;
  --secondary-system-grouped-background: #1C1C1E;
  --tertiary-system-grouped-background: #2C2C2E;

  --label: #FFFFFF;
  --secondary-label: rgba(235, 235, 245, 0.60);
  --tertiary-label: rgba(235, 235, 245, 0.30);
  --quaternary-label: rgba(235, 235, 245, 0.16);

  --separator: rgba(84, 84, 88, 0.60);
  --opaque-separator: #38383A;
  --system-fill: rgba(120, 120, 128, 0.36);
  --secondary-system-fill: rgba(120, 120, 128, 0.32);
  --tertiary-system-fill: rgba(118, 118, 128, 0.24);
  --quaternary-system-fill: rgba(118, 118, 128, 0.18);

  --glass-surface-bg: rgba(30, 30, 32, 0.72);
  --glass-surface-border: rgba(255, 255, 255, 0.12);
  --glass-surface-specular: inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0.5px 0 rgba(0, 0, 0, 0.5);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.38);
  --glass-blur: blur(28px) saturate(200%);

  --nav-bar-bg: rgba(28, 28, 30, 0.78);
  --tab-bar-bg: rgba(28, 28, 30, 0.85);
  --tab-bar-border: rgba(255, 255, 255, 0.14);
  --tab-bar-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);
  --tab-active-indicator: rgba(10, 132, 255, 0.22);

  --goal-card-bg: linear-gradient(135deg, rgba(30, 38, 50, 0.85) 0%, rgba(18, 24, 32, 0.75) 100%);
  --goal-card-border: rgba(10, 132, 255, 0.30);
  --goal-card-glow: 0 12px 40px -4px rgba(10, 132, 255, 0.24), 0 4px 16px -2px rgba(100, 210, 255, 0.20);

  --progress-ring-track: rgba(120, 120, 128, 0.24);
  --progress-ring-fill: var(--system-blue);
}
```

---

## 3. Liquid Glass Optical Material Specifications

The iOS 26 "Liquid Glass" optical aesthetic is defined by four interacting physical properties:
1. **Multi-Stop Refractive Backdrop Filter**: `backdrop-filter: blur(24px) saturate(190%)` (boosted to `blur(28px) saturate(200%)` in dark mode). Saturation boost is essential to recreate the optical luminosity of Apple glass.
2. **Semi-Translucent Glass Substrate**: In light mode, `rgba(255, 255, 255, 0.72)`; in dark mode, `rgba(30, 30, 32, 0.72)`.
3. **Specular Hairline Perimeter Border**: A crisp `0.5px solid rgba(255, 255, 255, 0.45)` in light mode, and `0.5px solid rgba(255, 255, 255, 0.12)` in dark mode.
4. **Specular Highlight Reflection**: An inset box shadow `inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.85)` creating the light bounce off the top chamfered edge.

### 3.1 Material Utility Classes

```css
/* Core Liquid Glass Surface */
.glass-surface {
  background-color: var(--glass-surface-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 0.5px solid var(--glass-surface-border);
  box-shadow: var(--glass-surface-specular), var(--glass-shadow);
}

/* Floating Navigation Bar (Collapsed state) */
.glass-nav-bar {
  background-color: var(--nav-bar-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 0.5px solid var(--separator);
}

/* Floating Tab Bar Pill */
.glass-tab-bar {
  background-color: var(--tab-bar-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 0.5px solid var(--tab-bar-border);
  box-shadow: var(--tab-bar-shadow);
}

/* Hairline Separator Inset */
.hairline-separator {
  height: 0.5px;
  background-color: var(--separator);
}
```

---

## 4. Typography Scale & Anti-Zoom System

### 4.1 System Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Display", "SF Pro Text", "Inter", -apple-system, sans-serif;
```
This guarantees the native SF Pro display and text fonts on iOS and macOS, while falling back cleanly to `Inter` on Windows/Android/Linux.

### 4.2 Complete Apple HIG Type Scale

| Name | Font Size | Line Height | Weight | Letter Spacing (Tracking) | CSS Class |
|---|---|---|---|---|---|
| **Large Title** | 34px | 41px (1.205) | 700 (Bold) | `+0.37px` | `.type-large-title` |
| **Title 1** | 28px | 34px (1.214) | 700 (Bold) | `+0.36px` | `.type-title-1` |
| **Title 2** | 22px | 28px (1.272) | 700 (Bold) | `+0.35px` | `.type-title-2` |
| **Title 3** | 20px | 25px (1.250) | 600 (Semibold) | `+0.38px` | `.type-title-3` |
| **Headline** | 17px | 22px (1.294) | 600 (Semibold) | `-0.41px` | `.type-headline` |
| **Body** | 17px | 22px (1.294) | 400 (Regular) | `-0.41px` | `.type-body` |
| **Callout** | 16px | 21px (1.312) | 400 (Regular) | `-0.32px` | `.type-callout` |
| **Subheadline** | 15px | 20px (1.333) | 400 (Regular) | `-0.24px` | `.type-subheadline` |
| **Footnote** | 13px | 18px (1.385) | 400 (Regular) / 600 (Semibold) | `-0.08px` | `.type-footnote` |
| **Caption 1** | 12px | 16px (1.333) | 400 (Regular) | `0.0px` | `.type-caption-1` |
| **Caption 2** | 11px | 13px (1.182) | 600 (Semibold) | `+0.07px` | `.type-caption-2` |

### 4.3 Strict Anti-Zoom Lock Rule
On iOS Safari, focusing any input element with a font size smaller than 16px triggers an automatic, jarring viewport zoom that breaks app layout and PWA presentation.
To guarantee complete immunity:
```css
/* Anti-Zoom Lock on all input fields */
input, textarea, select {
  font-size: 17px !important; /* Matches iOS Body text, >= 16px threshold */
  line-height: 22px;
}
```

### 4.4 Tabular Figures
For countdowns (e.g. "142 days left") and numeric counters:
```css
.tabular-nums {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
```

---

## 5. Anti-Web-Ism Resets & Safe-Area Architecture

To achieve absolute fidelity where Cadence feels like a native Swift/SwiftUI application:

### 5.1 Anti-Web-Ism Resets

```css
/* 1. Eliminate tap highlight grey box */
* {
  -webkit-tap-highlight-color: transparent !important;
}

/* 2. Prevent accidental text selection across UI chrome */
body, button, [role="button"], [role="tab"], nav, header {
  -webkit-user-select: none;
  user-select: none;
}

/* Allow text selection strictly inside text inputs */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}

/* 3. Disable iOS long-press callout preview menus on links/buttons */
* {
  -webkit-touch-callout: none;
}

/* 4. Prevent whole-page rubber-banding bounce on iOS */
html, body, #root {
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: fixed;
  inset: 0;
  overscroll-behavior: none;
  background-color: var(--system-grouped-background);
}

/* 5. Smooth inner momentum scrolling for list containers */
.momentum-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  height: 100%;
}

/* 6. Touch action manipulation prevents double-tap zoom delay */
button, a, input, [role="button"], [role="tab"] {
  touch-action: manipulation;
}

/* 7. Strict 44pt tap target minimum enforcement */
.tap-target-44 {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### 5.2 Safe Areas & Inset Utility Classes

```css
/* Safe Area Padding Utilities */
.pt-safe {
  padding-top: var(--sat);
}

.pb-safe {
  padding-bottom: var(--sab);
}

.pl-safe {
  padding-left: var(--sal);
}

.pr-safe {
  padding-right: var(--sar);
}

/* Clearance for Floating Tab Bar on mobile */
/* Floating bar is 56px high + bottom offset of calc(sab + 12px) = 68px + sab */
/* We allocate 88px + sab to ensure generous breathing room above tab bar */
.pb-tab-clearance {
  padding-bottom: calc(var(--sab) + 88px);
}
```

---

## 6. Squircle Continuous Corner Radius System

Apple does not use standard circular `border-radius`, but rather continuous cubic super-ellipses ("squircles"). We replicate this curvature using calibrated radii:
- **Hero Goal Card**: `border-radius: 20px;` (desktop: `24px;`)
- **Inset Grouped Section Card**: `border-radius: 12px;`
- **Bottom Sheet Modal**: `border-top-left-radius: 20px; border-top-right-radius: 20px;`
- **Floating Tab Bar**: `border-radius: 9999px;` (Pill)
- **Checkbox**: `border-radius: 50%;` (True circle)
- **Action Buttons / Badges**: `border-radius: 8px;`

---

## 7. Tailwind CSS Configuration Extension (`tailwind.config.js`)

Here is the exact Tailwind configuration mapping all CSS custom properties and type scales:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        system: {
          blue: "var(--system-blue)",
          cyan: "var(--system-cyan)",
          green: "var(--system-green)",
          red: "var(--system-red)",
          orange: "var(--system-orange)",
          bg: "var(--system-background)",
          secondaryBg: "var(--secondary-system-background)",
          tertiaryBg: "var(--tertiary-system-background)",
          groupedBg: "var(--system-grouped-background)",
          secondaryGroupedBg: "var(--secondary-system-grouped-background)",
          tertiaryGroupedBg: "var(--tertiary-system-grouped-background)",
          fill: "var(--system-fill)",
          secondaryFill: "var(--secondary-system-fill)",
          tertiaryFill: "var(--tertiary-system-fill)",
          quaternaryFill: "var(--quaternary-system-fill)",
        },
        label: {
          DEFAULT: "var(--label)",
          secondary: "var(--secondary-label)",
          tertiary: "var(--tertiary-label)",
          quaternary: "var(--quaternary-label)",
        },
        separator: {
          DEFAULT: "var(--separator)",
          opaque: "var(--opaque-separator)",
        },
      },
      fontFamily: {
        apple: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro"',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          "-apple-system",
          "sans-serif",
        ],
      },
      fontSize: {
        "large-title": ["34px", { lineHeight: "41px", letterSpacing: "0.37px", fontWeight: "700" }],
        "title-1": ["28px", { lineHeight: "34px", letterSpacing: "0.36px", fontWeight: "700" }],
        "title-2": ["22px", { lineHeight: "28px", letterSpacing: "0.35px", fontWeight: "700" }],
        "title-3": ["20px", { lineHeight: "25px", letterSpacing: "0.38px", fontWeight: "600" }],
        "headline": ["17px", { lineHeight: "22px", letterSpacing: "-0.41px", fontWeight: "600" }],
        "body": ["17px", { lineHeight: "22px", letterSpacing: "-0.41px", fontWeight: "400" }],
        "callout": ["16px", { lineHeight: "21px", letterSpacing: "-0.32px", fontWeight: "400" }],
        "subheadline": ["15px", { lineHeight: "20px", letterSpacing: "-0.24px", fontWeight: "400" }],
        "footnote": ["13px", { lineHeight: "18px", letterSpacing: "-0.08px", fontWeight: "400" }],
        "caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0.0px", fontWeight: "400" }],
        "caption-2": ["11px", { lineHeight: "13px", letterSpacing: "0.07px", fontWeight: "600" }],
      },
      borderRadius: {
        "squircle-hero": "20px",
        "squircle-card": "12px",
        "squircle-sheet": "20px",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        "tab-bar": "var(--tab-bar-shadow)",
        "goal-glow": "var(--goal-card-glow)",
      },
      spacing: {
        sat: "var(--sat)",
        sab: "var(--sab)",
        sal: "var(--sal)",
        sar: "var(--sar)",
      },
    },
  },
  plugins: [],
};
```

---

## 8. Complete Drop-in `src/index.css` Implementation

This is the exact production stylesheet ready to be placed at `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ==========================================================================
   Apple iOS 26 Design Tokens & Color Palette
   ========================================================================== */
:root {
  /* System Accents */
  --system-blue: #007AFF;
  --system-blue-rgb: 0, 122, 255;
  --system-cyan: #32ADE6;
  --system-cyan-rgb: 50, 173, 230;
  --system-green: #34C759;
  --system-green-rgb: 52, 199, 89;
  --system-red: #FF3B30;
  --system-red-rgb: 255, 59, 48;
  --system-orange: #FF9500;
  --system-orange-rgb: 255, 149, 0;

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

  /* Goal Hero Card */
  --goal-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 248, 255, 0.75) 100%);
  --goal-card-border: rgba(0, 122, 255, 0.22);
  --goal-card-glow: 0 8px 32px -4px rgba(0, 122, 255, 0.14), 0 2px 12px -2px rgba(50, 173, 230, 0.16);

  /* Progress Ring */
  --progress-ring-track: rgba(120, 120, 128, 0.16);
  --progress-ring-fill: var(--system-blue);

  /* Safe Areas */
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* System Accents */
    --system-blue: #0A84FF;
    --system-blue-rgb: 10, 132, 255;
    --system-cyan: #64D2FF;
    --system-cyan-rgb: 100, 210, 255;
    --system-green: #30D158;
    --system-green-rgb: 48, 209, 88;
    --system-red: #FF453A;
    --system-red-rgb: 255, 69, 58;
    --system-orange: #FF9F0A;
    --system-orange-rgb: 255, 159, 10;

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
    --glass-surface-bg: rgba(30, 30, 32, 0.72);
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

    /* Goal Hero Card */
    --goal-card-bg: linear-gradient(135deg, rgba(30, 38, 50, 0.85) 0%, rgba(18, 24, 32, 0.75) 100%);
    --goal-card-border: rgba(10, 132, 255, 0.30);
    --goal-card-glow: 0 12px 40px -4px rgba(10, 132, 255, 0.24), 0 4px 16px -2px rgba(100, 210, 255, 0.20);

    /* Progress Ring */
    --progress-ring-track: rgba(120, 120, 128, 0.24);
    --progress-ring-fill: var(--system-blue);
  }
}

.dark {
  --system-blue: #0A84FF;
  --system-blue-rgb: 10, 132, 255;
  --system-cyan: #64D2FF;
  --system-cyan-rgb: 100, 210, 255;
  --system-green: #30D158;
  --system-green-rgb: 48, 209, 88;
  --system-red: #FF453A;
  --system-red-rgb: 255, 69, 58;
  --system-orange: #FF9F0A;
  --system-orange-rgb: 255, 159, 10;

  --system-background: #000000;
  --secondary-system-background: #1C1C1E;
  --tertiary-system-background: #2C2C2E;
  --system-grouped-background: #000000;
  --secondary-system-grouped-background: #1C1C1E;
  --tertiary-system-grouped-background: #2C2C2E;

  --label: #FFFFFF;
  --secondary-label: rgba(235, 235, 245, 0.60);
  --tertiary-label: rgba(235, 235, 245, 0.30);
  --quaternary-label: rgba(235, 235, 245, 0.16);

  --separator: rgba(84, 84, 88, 0.60);
  --opaque-separator: #38383A;
  --system-fill: rgba(120, 120, 128, 0.36);
  --secondary-system-fill: rgba(120, 120, 128, 0.32);
  --tertiary-system-fill: rgba(118, 118, 128, 0.24);
  --quaternary-system-fill: rgba(118, 118, 128, 0.18);

  --glass-surface-bg: rgba(30, 30, 32, 0.72);
  --glass-surface-border: rgba(255, 255, 255, 0.12);
  --glass-surface-specular: inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0.5px 0 rgba(0, 0, 0, 0.5);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.38);
  --glass-blur: blur(28px) saturate(200%);

  --nav-bar-bg: rgba(28, 28, 30, 0.78);
  --tab-bar-bg: rgba(28, 28, 30, 0.85);
  --tab-bar-border: rgba(255, 255, 255, 0.14);
  --tab-bar-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);
  --tab-active-indicator: rgba(10, 132, 255, 0.22);

  --goal-card-bg: linear-gradient(135deg, rgba(30, 38, 50, 0.85) 0%, rgba(18, 24, 32, 0.75) 100%);
  --goal-card-border: rgba(10, 132, 255, 0.30);
  --goal-card-glow: 0 12px 40px -4px rgba(10, 132, 255, 0.24), 0 4px 16px -2px rgba(100, 210, 255, 0.20);

  --progress-ring-track: rgba(120, 120, 128, 0.24);
  --progress-ring-fill: var(--system-blue);
}

/* ==========================================================================
   Anti-Web-Ism Resets & Native iOS Locks
   ========================================================================== */
* {
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none;
  box-sizing: border-box;
}

html, body, #root {
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: fixed;
  inset: 0;
  overscroll-behavior: none;
  background-color: var(--system-grouped-background);
  color: var(--label);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Display", "SF Pro Text", "Inter", -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Prevent accidental text selection on UI elements */
body, button, [role="button"], [role="tab"], nav, header, span {
  -webkit-user-select: none;
  user-select: none;
}

/* Permit text selection strictly inside editable text fields */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}

/* Strict Anti-Zoom Lock on all inputs */
input, textarea, select {
  font-size: 17px !important;
  line-height: 22px;
}

/* Touch Action manipulation eliminates 300ms double-tap zoom delay */
button, a, input, [role="button"], [role="tab"] {
  touch-action: manipulation;
}

/* ==========================================================================
   Apple HIG Typography System
   ========================================================================== */
.type-large-title {
  font-size: 34px;
  line-height: 41px;
  font-weight: 700;
  letter-spacing: 0.37px;
}

.type-title-1 {
  font-size: 28px;
  line-height: 34px;
  font-weight: 700;
  letter-spacing: 0.36px;
}

.type-title-2 {
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  letter-spacing: 0.35px;
}

.type-title-3 {
  font-size: 20px;
  line-height: 25px;
  font-weight: 600;
  letter-spacing: 0.38px;
}

.type-headline {
  font-size: 17px;
  line-height: 22px;
  font-weight: 600;
  letter-spacing: -0.41px;
}

.type-body {
  font-size: 17px;
  line-height: 22px;
  font-weight: 400;
  letter-spacing: -0.41px;
}

.type-callout {
  font-size: 16px;
  line-height: 21px;
  font-weight: 400;
  letter-spacing: -0.32px;
}

.type-subheadline {
  font-size: 15px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: -0.24px;
}

.type-footnote {
  font-size: 13px;
  line-height: 18px;
  font-weight: 400;
  letter-spacing: -0.08px;
}

.type-footnote-semibold {
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  letter-spacing: -0.08px;
}

.type-caption-1 {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0px;
}

.type-caption-2 {
  font-size: 11px;
  line-height: 13px;
  font-weight: 600;
  letter-spacing: 0.07px;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

/* ==========================================================================
   Liquid Glass Materials & Custom Utilities
   ========================================================================== */
.glass-surface {
  background-color: var(--glass-surface-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 0.5px solid var(--glass-surface-border);
  box-shadow: var(--glass-surface-specular), var(--glass-shadow);
}

.glass-nav-bar {
  background-color: var(--nav-bar-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 0.5px solid var(--separator);
}

.glass-tab-bar {
  background-color: var(--tab-bar-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 0.5px solid var(--tab-bar-border);
  box-shadow: var(--tab-bar-shadow);
}

.hairline-separator {
  height: 0.5px;
  background-color: var(--separator);
}

.momentum-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  height: 100%;
}

.tap-target-44 {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pt-safe {
  padding-top: var(--sat);
}

.pb-safe {
  padding-bottom: var(--sab);
}

.pl-safe {
  padding-left: var(--sal);
}

.pr-safe {
  padding-right: var(--sar);
}

.pb-tab-clearance {
  padding-bottom: calc(var(--sab) + 88px);
}
```

---

## 9. Verification & Audit Strategy

To ensure zero regressions against the quality targets specified in `PROJECT.md` and `ORIGINAL_REQUEST.md`:

1. **Anti-Zoom Verification**:
   - In Playwright WebKit test, focus every `<input>` and `<textarea>`.
   - Assert `window.visualViewport.scale === 1.0`.
   - Assert `window.getComputedStyle(el).fontSize === '17px'`.
2. **Safe Area Clearance Verification**:
   - In mobile viewports (`420x912`), assert the floating tab bar has `bottom >= env(safe-area-inset-bottom) + 12px`.
   - Assert scroll container padding leaves >= 88px clearance above bottom edge.
3. **Color Contrast & Accessibility (axe-core)**:
   - Run `@axe-core/playwright` across light and dark modes.
   - Assert `systemBlue` (#007AFF light / #0A84FF dark) against `secondarySystemGroupedBackground` meets WCAG 2.1 AA (>= 4.5:1 for normal text, >= 3:1 for large text and interactive components).
   - Assert `label` and `secondaryLabel` meet contrast ratios.
4. **44pt Tap Target Verification**:
   - Assert all buttons, checkbox wrappers, and tab bar items have `boundingBox.width >= 44` and `boundingBox.height >= 44`.
5. **No Whole-Page Rubber-Banding**:
   - Assert `window.getComputedStyle(document.body).position === 'fixed'` and `overscrollBehavior === 'none'`.
