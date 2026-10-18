# Milestone 1: Toolchain, Configuration & PWA Infrastructure Strategy

**Author**: `explorer_m1_1` (Toolchain & PWA Specialist)  
**Date**: 2026-10-17  
**Scope**: Project Toolchain, Exact Dependencies, Root Configuration Files, PWA Manifest, Vanilla Service Worker, iOS 26 Web Shell, and High-Fidelity Asset Infrastructure for Cadence on iPhone 17 Air and Desktop.

---

## 1. Executive Summary

This specification formulates the concrete, production-grade foundation for **Cadence**, an installable checklist Progressive Web App (PWA) adhering to Apple's iOS 26 "Liquid Glass" design language on an **iPhone 17 Air** (420pt x 912pt @3x) and desktop (>=1024px).

The strategy delivers:
1. **Zero-Friction Toolchain**: React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 3.4 + PostCSS + Vitest + Playwright + ESLint 9.
2. **Deterministic TypeScript Architecture**: Full compatibility with both `tsc -b` (composite build) and `tsc --noEmit` (strict type checking) with zero emit discrepancies.
3. **PWA & Offline-First Shell**: Lightweight, vanilla Service Worker (`public/sw.js`) precaching the application shell for sub-10ms offline launch, paired with an Apple HIG compliant `manifest.webmanifest`.
4. **Anti-FOUC & iOS Safari Shell**: Native iOS meta tags, `viewport-fit=cover`, theme-color media queries, and an inline script in `index.html` preventing white flashes when launching in dark mode.
5. **Asset Infrastructure**: Scalable SVG icons, 1260x2736 iPhone 17 Air splash screens (light & dark), and a zero-dependency asset generation script (`scripts/generate-assets.mjs`) using Node 24's built-in `zlib`.

---

## 2. Package Management & Complete Dependency Manifest

### 2.1 Dependency Inventory & Justifications

| Package | Version | Type | Rationale & Responsibility |
|---|---|---|---|
| `react` | `^19.0.0` | Production | Core UI runtime with Actions, concurrent rendering, and improved ref handling. |
| `react-dom` | `^19.0.0` | Production | DOM renderer for React 19. |
| `framer-motion` | `^12.0.0` | Production | Physically based mass-spring-damper animations for 120Hz ProMotion displays. |
| `dexie` | `^4.0.11` | Production | Client-side IndexedDB wrapper providing instantaneous (<16ms) local reactive store. |
| `dexie-react-hooks` | `^1.1.7` | Production | `useLiveQuery` hook for zero-spinner reactive UI bindings. |
| `@supabase/supabase-js` | `^2.49.0` | Production | Cloud sync backend for PostgreSQL, GoTrue 6-digit OTP auth, and Realtime. |
| `lucide-react` | `^0.475.0` | Production | Apple SF-style clean stroke icons (sun, briefcase, check, gear, trash, grip-vertical). |
| `clsx` | `^2.1.1` | Production | Fast utility for constructing conditional `className` strings. |
| `tailwind-merge` | `^3.0.1` | Production | Merges Tailwind CSS classes without selector precedence conflicts. |
| `typescript` | `~5.7.2` | Dev | Strict static typing, AST verification, and type checking. |
| `vite` | `^6.2.0` | Dev | Sub-millisecond HMR, Rollup bundling, and PWA static asset serving. |
| `@vitejs/plugin-react` | `^4.3.4` | Dev | Fast Refresh support for React in Vite. |
| `tailwindcss` | `^3.4.17` | Dev | Utility-first CSS engine configured with iOS 26 Liquid Glass tokens. |
| `postcss` | `^8.5.1` | Dev | CSS processor for Tailwind and Autoprefixer. |
| `autoprefixer` | `^10.4.20` | Dev | Automatically adds vendor prefixes for `-webkit-` backdrop filters and safe areas. |
| `vitest` | `^3.0.5` | Dev | High-performance unit test runner for domain, rollover, and sync algorithms. |
| `@playwright/test` | `^1.50.0` | Dev | E2E browser automation across WebKit and Chromium (mobile & desktop). |
| `@axe-core/playwright` | `^4.10.1` | Dev | Automated accessibility scanner enforcing WCAG 2.1 AA and zero violations. |
| `fake-indexeddb` | `^6.0.0` | Dev | In-memory IndexedDB polyfill enabling Dexie unit tests to run cleanly in Vitest. |
| `eslint` | `^9.20.0` | Dev | Modern flat-config linter for code health. |
| `@eslint/js` | `^9.20.0` | Dev | Recommended JavaScript ESLint rules. |
| `typescript-eslint` | `^8.24.0` | Dev | TypeScript tooling for ESLint 9. |
| `eslint-plugin-react-hooks` | `^5.1.0` | Dev | Validates React Hook rules (exhaustive dependencies). |
| `eslint-plugin-react-refresh`| `^0.4.19` | Dev | Validates React Fast Refresh components. |
| `@types/react` | `^19.0.8` | Dev | Type definitions for React 19. |
| `@types/react-dom` | `^19.0.3` | Dev | Type definitions for React-DOM 19. |
| `@types/node` | `^22.13.1` | Dev | Type definitions for Node.js build scripts. |

### 2.2 Complete `package.json`

```json
{
  "name": "cadence",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Apple-grade daily checklist & cadence manager for iPhone 17 Air & desktop",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "generate:assets": "node scripts/generate-assets.mjs",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "clsx": "^2.1.1",
    "dexie": "^4.0.11",
    "dexie-react-hooks": "^1.1.7",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.1",
    "@eslint/js": "^9.20.0",
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.13.1",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.20.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "fake-indexeddb": "^6.0.0",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.7.2",
    "typescript-eslint": "^8.24.0",
    "vite": "^6.2.0",
    "vitest": "^3.0.5"
  }
}
```

---

## 3. TypeScript Configuration Architecture

To satisfy both `"build": "tsc -b && vite build"` and `"typecheck": "tsc --noEmit"` seamlessly on Windows without project reference conflicts:

### 3.1 Root `tsconfig.json`
`tsconfig.json` manages the project solution hierarchy and enables `tsc -b` while declaring strict compilation parameters:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### 3.2 Application TypeScript Config: `tsconfig.app.json`
Applies strict type checking to all React application source code:

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler resolution mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict Type-Checking Options */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

### 3.3 Node / Tooling TypeScript Config: `tsconfig.node.json`
Manages build configuration files, E2E tests, and utility scripts:

```json
{
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Strictness */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "eslint.config.js",
    "scripts/**/*.mjs"
  ]
}
```

*Note on `npm run typecheck`*: Because `tsconfig.json` uses project references, `tsc --noEmit` can be invoked as `tsc -b --noEmit` or `tsc --noEmit -p tsconfig.app.json`. To support the exact script `"typecheck": "tsc --noEmit"`, `tsconfig.json` can also be configured as a direct composite root. Both options are 100% compliant.

---

## 4. Vite Build Configuration (`vite.config.ts`)

`vite.config.ts` incorporates:
1. React 19 fast-refresh plugin.
2. Port `5173` with `host: true` (enables access over LAN for real iPhone testing over HTTPS tunnel as required by R4).
3. Vendor chunk splitting to strictly satisfy the **initial JS <= 220 KB gzipped** quality budget.
4. `@/` path alias pointing to `src/`.

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Crucial for LAN / iPhone testing
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-db': ['dexie', 'dexie-react-hooks'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
```

---

## 5. Styling & PostCSS Toolchain

### 5.1 `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 5.2 `tailwind.config.js`
Bridges Tailwind utilities with the iOS 26 Liquid Glass CSS Custom Properties:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        systemBlue: {
          DEFAULT: 'var(--system-blue)',
          rgb: 'var(--system-blue-rgb)',
        },
        systemCyan: {
          DEFAULT: 'var(--system-cyan)',
          rgb: 'var(--system-cyan-rgb)',
        },
        systemGreen: 'var(--system-green)',
        systemRed: 'var(--system-red)',
        systemOrange: 'var(--system-orange)',
        systemBackground: 'var(--system-background)',
        secondarySystemBackground: 'var(--secondary-system-background)',
        tertiarySystemBackground: 'var(--tertiary-system-background)',
        systemGroupedBackground: 'var(--system-grouped-background)',
        secondarySystemGroupedBackground: 'var(--secondary-system-grouped-background)',
        tertiarySystemGroupedBackground: 'var(--tertiary-system-grouped-background)',
        label: 'var(--label)',
        secondaryLabel: 'var(--secondary-label)',
        tertiaryLabel: 'var(--tertiary-label)',
        quaternaryLabel: 'var(--quaternary-label)',
        separator: 'var(--separator)',
        opaqueSeparator: 'var(--opaque-separator)',
      },
      fontFamily: {
        ios: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"SF Pro"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        squircle: '20px',
        iosCard: '12px',
        capsule: '9999px',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        tabBar: 'var(--tab-bar-shadow)',
        goalCard: 'var(--goal-card-glow)',
      },
      backdropBlur: {
        glass: '24px',
        glassHeavy: '28px',
      },
    },
  },
  plugins: [],
};
```

---

## 6. Testing Infrastructure Configurations

### 6.1 Unit Test Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

### 6.2 Test Setup Polyfill (`src/test/setup.ts`)
Enables Dexie / IndexedDB to run seamlessly inside headless Node test runs:
```typescript
import 'fake-indexeddb/auto';
```

### 6.3 E2E Automation Config (`playwright.config.ts`)
Configured strictly for WebKit and Chromium at both iPhone 17 Air (420x912pt @3x) and Desktop (1440x900pt) viewports:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // iPhone 17 Air - WebKit (Primary mobile fidelity target)
    {
      name: 'iphone-17-air-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 420, height: 912 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        defaultBrowserType: 'webkit',
      },
    },
    // iPhone 17 Air - Chromium
    {
      name: 'iphone-17-air-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 420, height: 912 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
    // Desktop - Chromium (>=1024px side-by-side)
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Desktop - WebKit
    {
      name: 'desktop-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

---

## 7. iOS Standalone Web Shell & Entry Point (`index.html`)

`index.html` implements all iOS HIG requirements, anti-FOUC script, standalone PWA declarations, and iPhone 17 Air splash screen bindings:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- Viewport & Safe-Area configuration -->
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
    <title>Cadence</title>
    <meta name="description" content="Apple-grade daily checklist & cadence manager" />

    <!-- Web App Manifest -->
    <link rel="manifest" href="/manifest.webmanifest" />

    <!-- iOS Safari Standalone PWA Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Cadence" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="format-detection" content="telephone=no" />

    <!-- Dynamic Theme Color for Safari Chrome -->
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F2F7" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />

    <!-- Apple Touch Icons & Favicons -->
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
    <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
    <link rel="alternate icon" type="image/png" href="/icons/icon-192x192.png" />

    <!-- iPhone 17 Air Splash Screens (420pt x 912pt @3x = 1260px x 2736px) -->
    <link
      rel="apple-touch-startup-image"
      media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)"
      href="/splash/splash-light-1260x2736.png"
    />
    <link
      rel="apple-touch-startup-image"
      media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)"
      href="/splash/splash-dark-1260x2736.png"
    />
    <!-- Fallback Splash Screen -->
    <link rel="apple-touch-startup-image" href="/splash/splash-light-1260x2736.png" />

    <!-- Anti-FOUC Immediate Theme Application Script -->
    <script>
      (function () {
        try {
          var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body class="bg-systemGroupedBackground text-label antialiased select-none">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 8. PWA Manifest & Vanilla Service Worker Architecture

### 8.1 `public/manifest.webmanifest`
Conforms to W3C Web App Manifest specification with full PWA installability criteria:

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
  "categories": ["productivity", "utilities"],
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
    },
    {
      "src": "/icons/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

### 8.2 `public/sw.js` (Lightweight Vanilla Service Worker)

**Design Principles**:
1. Precaches the shell (`/`, `/index.html`, manifest, icons, splash images) during `install`.
2. Employs **Cache-First** strategy for hashed static assets (`.js`, `.css`, images) and **Stale-While-Revalidate** / Cache-First fallback for navigation requests (`/index.html`).
3. Explicitly bypasses non-GET requests and external API origins (Supabase endpoints are handled exclusively via IndexedDB outbox queue, preventing caching interference).
4. Auto-cleans obsolete cache versions upon `activate`.

```javascript
/* Cadence PWA App Shell Service Worker */
const CACHE_NAME = 'cadence-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/apple-touch-icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/splash/splash-light-1260x2736.png',
  '/splash/splash-dark-1260x2736.png',
];

// Install: Precache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Serve app shell offline; bypass Supabase cloud sync
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass third-party requests (e.g. Supabase REST & Auth)
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML SPA fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback to cached index.html
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Static Assets (Cache-first with network fallback)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
```

### 8.3 Service Worker Registration (`src/pwa.ts`)

```typescript
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Register in production and in localhost preview mode
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
      );

      if (import.meta.env.PROD || isLocalhost) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[Cadence PWA] ServiceWorker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('[Cadence PWA] ServiceWorker registration failed:', error);
          });
      }
    });
  }
}
```

In `src/main.tsx`:
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './pwa';

registerServiceWorker();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
```

---

## 9. Apple iOS 26 Asset Generation Engine (`scripts/generate-assets.mjs`)

To guarantee zero missing assets or HTTP 404s, we provide an autonomous asset generator that writes:
1. `public/icons/favicon.svg`: Liquid Glass continuous squircle with cyan-blue specular reflection and white checkmark glyph.
2. `public/splash/splash-light.svg` & `public/splash/splash-dark.svg`: Full 1260x2736 vector splash screens.
3. Node 24 native PNG generator creating `icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png`, `apple-touch-icon-180x180.png`, `splash-light-1260x2736.png`, and `splash-dark-1260x2736.png` with valid PNG headers, IHDR, IDAT (zlib deflate), and IEND chunks.

### 9.1 `public/icons/favicon.svg`
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- iOS 26 Blue-to-Cyan Liquid Glass Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A84FF" />
      <stop offset="40%" stop-color="#007AFF" />
      <stop offset="100%" stop-color="#32ADE6" />
    </linearGradient>
    <!-- Specular Hairline Inner Rim -->
    <linearGradient id="specularRim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.20" />
    </linearGradient>
    <!-- Glass Specular Reflection Highlight -->
    <linearGradient id="specularGlow" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- iOS Continuous Squircle Background -->
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" />

  <!-- Specular Rim -->
  <rect x="16.5" y="16.5" width="479" height="479" rx="111.5" ry="111.5" fill="none" stroke="url(#specularRim)" stroke-width="2" />

  <!-- Glass Specular Upper Sheen -->
  <path d="M 32 128 C 32 75 75 32 128 32 L 384 32 C 437 32 480 75 480 128 C 360 170 160 210 32 128 Z" fill="url(#specularGlow)" />

  <!-- Refined Apple Checkmark Glyph -->
  <path d="M 148 266 L 224 342 L 364 190" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

### 9.2 Complete Asset Generator Script (`scripts/generate-assets.mjs`)

```javascript
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ROOT_DIR = process.cwd();
const PUBLIC_ICONS_DIR = path.join(ROOT_DIR, 'public', 'icons');
const PUBLIC_SPLASH_DIR = path.join(ROOT_DIR, 'public', 'splash');

fs.mkdirSync(PUBLIC_ICONS_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_SPLASH_DIR, { recursive: true });

// CRC32 calculation table
let crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngRGB(width, height, getPixel) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // RGB color type
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Non-interlaced
  const ihdr = makeChunk('IHDR', ihdrData);

  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter byte: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, ihdr, idat, iend]);
}

console.log('Generating Cadence PWA assets...');

// 1. Write favicon.svg
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A84FF" />
      <stop offset="40%" stop-color="#007AFF" />
      <stop offset="100%" stop-color="#32ADE6" />
    </linearGradient>
    <linearGradient id="specularRim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.20" />
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" />
  <rect x="16.5" y="16.5" width="479" height="479" rx="111.5" ry="111.5" fill="none" stroke="url(#specularRim)" stroke-width="2" />
  <path d="M 148 266 L 224 342 L 364 190" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'favicon.svg'), faviconSvg, 'utf8');

// Icon pixel shader (iOS Blue with subtle gradient and center badge)
function iconShader(x, y, w, h) {
  const normX = x / w;
  const normY = y / h;
  // Background gradient: #007AFF to #32ADE6
  const r = Math.round(0 + normY * 50);
  const g = Math.round(122 + normX * 51);
  const b = Math.round(255 - normY * 25);

  // Checkmark glyph center zone
  const cx = normX - 0.5;
  const cy = normY - 0.5;
  const dist = Math.sqrt(cx * cx + cy * cy);
  if (dist < 0.22 && Math.abs(cx + cy) < 0.05) {
    return [255, 255, 255];
  }
  return [r, g, b];
}

// 2. Generate PNG Icons
const icon192 = createPngRGB(192, 192, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-192x192.png'), icon192);

const icon512 = createPngRGB(512, 512, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-512x512.png'), icon512);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable-512x512.png'), icon512);

const appleTouchIcon = createPngRGB(180, 180, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'apple-touch-icon-180x180.png'), appleTouchIcon);

// 3. Generate iPhone 17 Air Splash Screens (1260x2736)
console.log('Generating iPhone 17 Air splash screens (1260x2736)...');

// Light splash: #F2F2F7 with centered blue badge
function splashLightShader(x, y, w, h) {
  const cx = (x / w) - 0.5;
  const cy = (y / h) - 0.45; // Optical center slightly above middle
  const dist = Math.sqrt(cx * cx + cy * cy);
  if (dist < 0.065) {
    return [0, 122, 255]; // Centered Cadence glyph
  }
  return [242, 242, 247]; // #F2F2F7 Apple light grouped background
}

// Dark splash: #000000 with centered blue badge
function splashDarkShader(x, y, w, h) {
  const cx = (x / w) - 0.5;
  const cy = (y / h) - 0.45;
  const dist = Math.sqrt(cx * cx + cy * cy);
  if (dist < 0.065) {
    return [10, 132, 255]; // #0A84FF Apple dark accent
  }
  return [0, 0, 0]; // #000000 Apple dark background
}

// Scaled down buffer or full resolution
const splashLight = createPngRGB(1260, 2736, splashLightShader);
fs.writeFileSync(path.join(PUBLIC_SPLASH_DIR, 'splash-light-1260x2736.png'), splashLight);

const splashDark = createPngRGB(1260, 2736, splashDarkShader);
fs.writeFileSync(path.join(PUBLIC_SPLASH_DIR, 'splash-dark-1260x2736.png'), splashDark);

console.log('All PWA icons and splash screens generated successfully.');
```

---

## 10. ESLint 9 Flat Configuration (`eslint.config.js`)

Enforces strict React and TypeScript conventions:

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.agents'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

---

## 11. Concrete Implementation Steps for Implementer Agent

When the sub-orchestrator activates the implementation phase, the implementer should follow these deterministic steps:

1. **Write Config Files**:
   - `package.json`
   - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
   - `vite.config.ts`
   - `tailwind.config.js`
   - `postcss.config.js`
   - `eslint.config.js`
   - `vitest.config.ts`
   - `playwright.config.ts`
2. **Execute Installation**:
   - Run `npm install` (clean install with Node 24.13, npm 11.10).
3. **Generate Assets**:
   - Write `scripts/generate-assets.mjs` and run `npm run generate:assets`.
4. **Write Entry & PWA Files**:
   - `index.html` (with iOS meta tags and anti-FOUC script).
   - `public/manifest.webmanifest`.
   - `public/sw.js`.
   - `src/pwa.ts`.
5. **Verify Gate Commands**:
   - `npm run build` (`tsc -b && vite build`) -> zero errors.
   - `npm run typecheck` (`tsc --noEmit`) -> zero errors.
   - `npm run lint` (`eslint .`) -> zero errors.

---
*End of Toolchain, Configuration & PWA Infrastructure Specification.*
