## 2026-10-17T19:37:44Z
From: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e (parent)
Role: spec_miner_ui

You are spec_miner_ui, a specialist specification miner.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md

YOUR MISSION:
Mine, analyze, and specify all requirements, design specifications, architecture tokens, and interaction details for:
1. Apple iOS 26 "Liquid Glass" design language:
   - Materials, translucent glass layers (specular highlights, ultra-thin borders, refraction/blur, light and dark mode parity).
   - Semantic color system: systemBlue (#007AFF light / #0A84FF dark), systemCyan (#32ADE6 / #64D2FF) for subtle highlights, background system groupings (systemGroupedBackground, secondarySystemGroupedBackground, etc.).
   - Typography: SF Pro system stack with Inter fallback, Apple type scale (Large Title, Title 1-3, Headline, Body, Subheadline, Footnote, Caption), correct line heights, tracking.
   - Collapsing large titles: behavior on scroll, smooth transition from prominent screen title to centered inline title in navigation bar with backdrop blur.
   - Inset grouped lists: iOS Reminders style, rounded corners, separator insets, 44pt minimum tap targets.
   - Checkbox design: circular checkbox, accent fill (#007AFF / #0A84FF), checkmark stroke draw-in animation, struck-through and dimmed text transition.
   - Goal Hero Card: continuous-curve squircle (border-radius / clip-path), quiet blue-to-cyan glow, countdown typography, shimmer moment when day complete.
   - Floating glass tab bar on mobile (Today, Work); desktop layout (>=1024px) side-by-side with Goal on top, no tab bar.
   - Bottom sheets: Goal editor, Settings sheet, Confirmation dialogs (drag to dismiss, background dim and scale back).
2. Motion & Physics:
   - Physically based spring animations using Motion (Framer Motion). Specify spring parameters (damping, stiffness, mass) for sheet pop, checkmark draw, list reorder, swipe-to-delete.
   - 120Hz ProMotion optimization (GPU accelerated transforms, will-change, zero layout shifts, CLS < 0.02).
   - Strict `prefers-reduced-motion` compliance: disable spring/slide/scale, fall back to subtle cross-fades.
   - Best-effort iOS haptics (navigator.vibrate / WebKit haptic cues where feasible).
3. Anti-Web-Isms & Native Feel:
   - Elimination of tap highlight (-webkit-tap-highlight-color: transparent).
   - Prevention of accidental text selection (user-select: none on interactive elements).
   - Prevention of iOS Safari input zoom (font-size >= 16px on all inputs).
   - Safe areas: env(safe-area-inset-top), env(safe-area-inset-bottom), Dynamic Island and home indicator handling.
   - Viewport config: viewport-fit=cover, width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no.
   - Prevention of whole-page rubber-banding / bounce while preserving smooth inner list momentum scrolling (-webkit-overflow-scrolling: touch).
4. PWA & Asset Specifications:
   - Web App Manifest (standalone, theme-color, background-color, icons).
   - Service worker strategy (workbox or custom service worker for precaching app shell, offline launch).
   - iOS meta tags (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style: black-translucent, apple-mobile-web-app-title).
   - App icon & splash screens (light and dark) specs for iPhone 17 Air (420x912 pt / 1260x2736 px).

OUTPUT DELIVERABLES:
1. Write your detailed analysis and comprehensive design specification to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui\analysis.md
2. Write a self-contained handoff report to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui\handoff.md
3. Update progress.md in your working directory.
4. Send a message to your parent orchestrator (bead4d79-c7a2-42ab-8259-8e33bcf7fd9e) when finished.
