# Handoff Report: UI/UX & Liquid Glass Specification

**Agent**: `spec_miner_ui`  
**Recipient**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e` (parent orchestrator)  
**Date**: 2026-10-17  
**Artifact Path**: `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui\analysis.md`

---

## 1. Observation

1. **User Request & Requirements**:
   - In `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md`, lines 5-6: "Build **Cadence**, a single-purpose, installable checklist web app (PWA) for one person. It must feel indistinguishable from a first-party Apple iOS 26 app ('Liquid Glass' design language) on an **iPhone 17 Air**, and also work beautifully on desktop... Almost all of the value is in the slickness, smoothness, prestige and class of the experience."
   - In lines 14-22 (R1): Today tab has 3 sections (Morning Routine, Work Day, Evening Routine) unchecking at user-adjustable rollover time (default 4:00 AM local); Goal hero card pinned at top with target date countdown; Work tab persistent list with strikethrough/dimmed items, per-item delete, swipe-to-delete, and Clear Completed with confirmation; mobile floating glass tab bar vs desktop (>=1024px) side-by-side layout with no tab bar; minimal Settings sheet.
   - In lines 23-30 (R2): Apple iOS 26 HIG Liquid Glass materials, collapsing large titles, inset grouped lists, semantic colors (systemBlue `#007AFF`/`#0A84FF`, systemCyan `#32ADE6`/`#64D2FF`), SF Pro system stack with Inter fallback, 44pt tap targets, safe area handling, spring physics, 120Hz ProMotion, prefers-reduced-motion, best-effort haptics, elimination of web-isms (tap highlight, text selection, input zoom, whole-page rubber-banding, layout shift, flashes).
   - In lines 41-49 (R4): React + TypeScript + Vite + Motion (Framer Motion); PWA installable from Safari to Home Screen, standalone mode, service worker precaching, iOS meta tags, and iPhone 17 Air splash screens (420x912 pt / 1260x2736 px).
   - In lines 70-87 (Acceptance Criteria): Mobile viewport 420x912, Desktop viewport 1440x900; Lighthouse Performance >= 90, Accessibility >= 95, Best Practices >= 95; CLS < 0.02; Initial JS <= 220 KB gzipped; axe-core 0 violations; prefers-reduced-motion: cross-fades only.

2. **Existing Workspace State**:
   - Inspected `c:\Users\shqai\Downloads\Repo\Checklist`: Directory is currently in clean discovery state with `.agents\teamwork` containing explorer directories.

---

## 2. Logic Chain

1. **Material Architecture & Light/Dark Parity**:
   - Because the user explicitly demands Apple iOS 26 "Liquid Glass" fidelity (Observation 1, line 5, line 24), optical glass requires multi-stop backdrop filters (`backdrop-filter: blur(24px) saturate(190%)`), hairline specular borders (`0.5px solid rgba(255, 255, 255, 0.45)` light / `0.12` dark), and subtle perimeter inset highlights.
   - We extracted and defined the complete CSS variable registry for light and dark modes in `analysis.md` Section 2, ensuring semantic token parity across systemBlue, systemCyan, grouped backgrounds, and label colors.

2. **Typography & Anti-Zoom Guard**:
   - iOS Safari automatically triggers an intrusive page zoom if any input element has a computed font-size `< 16px`.
   - By locking text inputs and checklist row text to `17px` (Apple HIG Body size), we guarantee both HIG typographic harmony and the permanent prevention of Safari input auto-zoom (Observation 1, line 28, line 80).

3. **Motion Physics & ProMotion Optimization**:
   - To achieve the requested Apple-grade spring physics without jank or overshoot (Observation 1, line 27), Framer Motion springs must be tuned with precise mass-spring-damper parameters (`damping: 32`, `stiffness: 340`, `mass: 0.9` for sheets; `stiffness: 500, damping: 24, mass: 0.6` for checkbox snap).
   - To satisfy the 120Hz ProMotion requirement and CLS < 0.02, animations are restricted to composite-only transforms (`translate3d`, `scale`) and `opacity`, avoiding layout thrashing.
   - For `prefers-reduced-motion`, all spring movements, slide-ups, and scale transforms fall back to clean 0.15s opacity cross-fades, satisfying line 86.

4. **Native Feel & Elimination of Web-Isms**:
   - Standard web views suffer from tap highlights, text selection on double-tap, and whole-page rubber-banding.
   - We specified `-webkit-tap-highlight-color: transparent`, `user-select: none` on interactive chrome, `position: fixed; overscroll-behavior: none;` on root window, and `-webkit-overflow-scrolling: touch; overscroll-behavior-y: contain;` on inner scroll containers to lock down native iOS feel.

5. **Responsive Layout Differentiation**:
   - Mobile (< 1024px) features a floating glass tab bar (Today / Work) with an active tab spring highlight and `padding-bottom` offset for safe clearance.
   - Desktop (>= 1024px) completely removes the tab bar, arranging the Goal Hero Card across the top and Today and Work checklists side-by-side, supporting hover styles and full keyboard navigation (Space, Enter, Arrow keys).

6. **PWA & iPhone 17 Air Asset Exactness**:
   - iPhone 17 Air has a logical viewport of 420x912 pt and physical resolution of 1260x2736 px (@3x).
   - We specified the exact `manifest.webmanifest`, iOS status-bar tags (`black-translucent`), standalone launch configuration, and `apple-touch-startup-image` media queries for both light and dark modes.

---

## 3. Caveats

1. **Live WebKit Haptics**: WebKit running in iOS Safari and PWA mode has restricted access to the Web Vibration API compared to Chrome on Android. The specification implements a best-effort, safe degradation wrapper (`triggerHaptic`) so the app never throws errors on unsupported environments.
2. **0.5px Hairline Borders**: Rendering 0.5px CSS borders requires a high-DPI display (@2x or @3x Retina) to render as a single physical device pixel. On 1x displays, standard browsers round this up to 1px.
3. **Database Migration Dependency**: The backend sync engine (Supabase) requires a user-run SQL migration. The UI specification assumes local-first rendering via IndexedDB so that the visual UI operates seamlessly even if the remote database is offline or unmigrated.

---

## 4. Conclusion

The visual, motion, typography, anti-web-ism, responsive, and PWA specifications for **Cadence** have been completely mined and documented in `analysis.md`. The specification includes:
- Complete CSS variable registry and Apple iOS 26 Liquid Glass tokens.
- Apple HIG typography scale with SF Pro system stack and Inter fallback.
- Component specs for Collapsing Nav Bar, Inset Grouped Lists, Circular Checkboxes, Goal Hero Card with Shimmer, Floating Glass Tab Bar, and Bottom Sheets.
- Framer Motion spring physics constants and 120Hz ProMotion optimization rules.
- Complete Anti-Web-Ism CSS resets.
- PWA manifest, service worker strategy, and iPhone 17 Air splash screen configurations.
- 37 fully discovered features and 25 edge cases documented in structured tables.

This document serves as the authoritative UI/UX blueprint for Phase 1 synthesis and implementation milestones.

---

## 5. Verification Method

1. **File Inspection**:
   - Inspect `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui\analysis.md` to confirm all sections, CSS tokens, Framer Motion parameters, and feature/edge case tables are present.
2. **Acceptance Criteria Cross-Reference**:
   - Check that all items in R1, R2, R4, and the 12 Apple HIG review items from `ORIGINAL_REQUEST.md` have explicit design specifications in `analysis.md`.
3. **Downstream Invalidation Conditions**:
   - Any modification to Apple iOS 26 color palettes, font scale values, or spring token configurations must be reconciled against `analysis.md`.
