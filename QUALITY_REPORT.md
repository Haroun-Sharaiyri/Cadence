# Cadence — Milestone 6 Quality Budgets & Lighthouse Production Report

**Date**: 2026-10-18  
**Target Viewport**: iPhone 17 Air (`420x912` pt @ 3x DPR) & Desktop (`1440x900`)  
**Verification Script**: `node scripts/verify-budgets.mjs`  
**Lighthouse Config**: `lighthouserc.json`

---

## 1. Executive Summary

| Quality Gate | Target Threshold | Empirical Measurement | Status |
|--------------|------------------|-----------------------|--------|
| **Initial Synchronous JS (Gzip)** | `<= 220.00 KB` (Strict target `<= 180.00 KB`) | **167.65 KB** (`171,673` bytes) | **PASS** |
| **Lighthouse Mobile Performance** | `>= 90` | **92 / 100** | **PASS** |
| **Lighthouse Mobile Accessibility** | `>= 95` | **100 / 100** | **PASS** |
| **Lighthouse Mobile Best Practices** | `>= 95` | **100 / 100** | **PASS** |
| **Cumulative Layout Shift (CLS)** | `< 0.02` | **0.00000** | **PASS** |
| **PWA Installability & Manifest** | Valid `manifest.webmanifest`, `standalone` | **HTTP 200, `standalone`, 4 icons** | **PASS** |
| **Service Worker Offline Launch** | `sw.js` active + HTTP 200 offline reload | **HTTP 200, Full UI rendered offline** | **PASS** |

---

## 2. JavaScript & CSS Bundle Size Breakdown (`dist/`)

### 2.1 Code-Splitting Architecture
To keep the startup path well below the `180 KB` strict initial JS target:
1. **Dynamic Cloud SDK Loading (`src/sync/supabaseClient.ts` & `src/sync/syncEngine.ts`)**: `@supabase/supabase-js` (`58.65 KB` gzipped) is loaded asynchronously via dynamic `import('@supabase/supabase-js')` inside `getSupabaseAsync()`, keeping the local-first Dexie startup path completely unblocked.
2. **Lazy-Loaded Modal & Bottom Sheet Chunks (`src/App.tsx`)**: `GoalEditorSheet`, `SettingsSheet`, `AuthModal`, and `ClearCompletedSheet` (plus shared `BottomSheet`) are split via `React.lazy` and mounted on demand wrapped in `<Suspense fallback={null}>`, preserving exit animations once opened while deferring `8.30 KB` gzipped from initial startup.

### 2.2 Initial Synchronous JS Chunks (`<script>` & `<link rel="modulepreload">` in `dist/index.html`)

| Asset File | Uncompressed Size | Gzipped Size (Level 9) | Exact Gzipped Bytes | Role |
|------------|-------------------|------------------------|---------------------|------|
| `/assets/index-CpVocA3l.js` | `271.94 KB` | **83.27 KB** | `85,266 B` | Application core, React DOM client, local-first UI |
| `/assets/vendor-motion-BkwWSVQs.js` | `144.78 KB` | **48.26 KB** | `49,418 B` | Framer Motion spring physics & layout engine |
| `/assets/vendor-db-CLySYOfP.js` | `95.44 KB` | **32.06 KB** | `32,829 B` | Dexie.js IndexedDB store & `useLiveQuery` hooks |
| `/assets/vendor-icons-CBwZeH6e.js` | `9.95 KB` | **2.48 KB** | `2,543 B` | Tree-shaken Lucide icons for initial chrome |
| `/assets/vendor-react-DRtvv6n0.js` | `4.17 KB` | **1.58 KB** | `1,617 B` | React 19 core runtime |
| **TOTAL INITIAL JS** | **526.28 KB** (`538,908 B`) | **167.65 KB** | **`171,673 B`** | **52.35 KB under 220 KB budget** |

### 2.3 Deferred Lazy-Loaded JS Chunks

| Asset File | Uncompressed Size | Gzipped Size (Level 9) | Exact Gzipped Bytes | Trigger |
|------------|-------------------|------------------------|---------------------|---------|
| `/assets/vendor-supabase-D3pWxcgM.js` | `223.32 KB` | **58.65 KB** | `60,061 B` | Background cloud sync / OTP auth when configured |
| `/assets/AuthModal-itAnc3wv.js` | `8.61 KB` | **2.90 KB** | `2,969 B` | Opening 6-Digit Email OTP Sign-In modal |
| `/assets/SettingsSheet-ihLAPcWY.js` | `5.65 KB` | **1.79 KB** | `1,831 B` | Opening Settings sheet |
| `/assets/GoalEditorSheet-C17howua.js` | `4.44 KB` | **1.59 KB** | `1,629 B` | Tapping Goal Hero Card to edit primary goal |
| `/assets/BottomSheet-CuA-v60a.js` | `2.52 KB` | **1.22 KB** | `1,249 B` | Shared iOS 26 Liquid Glass sheet container |
| `/assets/ClearCompletedSheet-D_DvGHVV.js` | `2.01 KB` | **0.89 KB** | `910 B` | Tapping "Clear Completed" in Work tab |
| **TOTAL DEFERRED JS** | **246.54 KB** (`252,460 B`) | **67.04 KB** | **`68,649 B`** | Loaded on demand |

### 2.4 CSS & HTML Assets

| Asset File | Uncompressed Size | Gzipped Size (Level 9) | Exact Gzipped Bytes |
|------------|-------------------|------------------------|---------------------|
| `/index.html` | `3.20 KB` | **1.17 KB** | `1,198 B` |
| `/assets/index-0lzhfI1T.css` | `33.48 KB` | **6.65 KB** | `6,807 B` |

---

## 3. Lighthouse Mobile Production Audit (`http://localhost:4173`)

Audited via Lighthouse CLI (`--form-factor=mobile --screenEmulation.width=420 --screenEmulation.height=912 --screenEmulation.deviceScaleFactor=3`) against the production `vite preview` server:

- **Performance**: **92 / 100** (Threshold: `>= 90`)
- **Accessibility**: **100 / 100** (Threshold: `>= 95`)
- **Best Practices**: **100 / 100** (Threshold: `>= 95`)
- **Cumulative Layout Shift (CLS)**: **0.00000** (Threshold: `< 0.02`)
- **First Contentful Paint (FCP)**: **2.4 s** (Simulated Mobile 4G) / **260.0 ms** (Unthrottled Playwright Mobile)
- **Largest Contentful Paint (LCP)**: **2.5 s** (Simulated Mobile 4G)
- **Total Blocking Time (TBT)**: **180 ms**
- **Speed Index**: **2.4 s**

---

## 4. PWA Installability & Offline Resilience Verification

Verified via automated Playwright Chromium mobile emulation (`scripts/verify-budgets.mjs`):
1. **Web App Manifest (`/manifest.webmanifest`)**: Returns `HTTP 200`, `display: "standalone"`, `theme_color` & `background_color` configured, 4 app icons (`favicon.svg`, `apple-touch-icon-180x180.png`, `icon-192x192.png`, `icon-512x512.png`).
2. **Service Worker (`/sw.js`)**: Registers cleanly on initial load (`scope: http://localhost:4173/`), precaches both `SHELL_ASSETS` and hashed `/assets/*` bundles referenced in `index.html`.
3. **Offline Launch (`context.setOffline(true)` + `page.reload()`)**: Reloading the page with network completely severed returns `HTTP 200` from Service Worker cache and renders the interactive Today & Work checklist UI with zero errors.
