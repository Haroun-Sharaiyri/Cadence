# Scope: Milestone 1 — App Shell & iOS 26 Liquid Glass Design System

## Reference Documents
- Authoritative User Request: `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Master Plan & Code Layout: `c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md`
- UI/UX & Liquid Glass Analysis: `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_ui\analysis.md`

## Milestone Objective
Establish the foundational project structure, toolchain, PWA configuration, and complete iOS 26 "Liquid Glass" design system, shell components, and responsive layouts.

## Assigned Features (from PROJECT.md Feature Inventory)
1. iOS 26 Liquid Glass Design System: multi-stop backdrop blur, specular borders, light/dark mode parity
2. Typography Scale & Anti-Zoom Guard: SF Pro system stack with Inter fallback, input font-size >= 16px
3. Safe-Area & Viewport Locks: Dynamic Island & home indicator safe padding, no whole-page bounce
4. Collapsing Large Navigation Bar: Smooth transition from prominent screen title to inline blurred header
5. Mobile Floating Glass Tab Bar: Floating pill with Today and Work tabs, spring highlight, safe clearance
6. Desktop Side-by-Side Layout: >=1024px layout with Goal on top and Today & Work side by side, no tab bar
7. Desktop Hover & Keyboard Navigation: Space toggles checkbox, Enter adds item, arrows navigate list
8. PWA Manifest & App Shell Caching: Installable PWA manifest (standalone), Service Worker offline cache
9. iPhone 17 Air Icons & Splash Screens: Light and dark home screen icons & splash screens (420x912pt @3x)
10. Anti-Web-Ism Locks: No tap highlights, no text selection, touch-action controls

## File Ownership for M1
- Root configs: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `eslint.config.js`
- Public assets: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`, `public/splash/*`
- Styles: `src/index.css`
- Core UI: `src/main.tsx`, `src/App.tsx`
- Components: `src/components/common/GlassContainer.tsx`, `src/components/common/CollapsingHeader.tsx`, `src/components/common/FloatingTabBar.tsx`, `src/utils/motion.ts`, `src/utils/haptics.ts`

## Quality & Verification Gates
1. `npm install` runs cleanly with zero dependency conflicts.
2. `npm run build` succeeds with zero errors.
3. `npm run typecheck` (strict TypeScript) succeeds with zero errors.
4. `npm run lint` succeeds with zero errors.
5. No horizontal overflow at 420px width.
6. Mobile tap targets are >= 44x44 pt.
7. Input font sizes are >= 16px.
