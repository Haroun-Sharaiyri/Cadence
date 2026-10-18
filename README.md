# Cadence

**Cadence** is a single-purpose, installable daily checklist Progressive Web App (PWA) crafted to feel indistinguishable from a first-party Apple iOS 26 application (**Liquid Glass** design language) on **iPhone 17 Air** (`420×912` pt viewport) and **Desktop** (`1440×900` viewport).

Built with an **offline-first architecture**, every interaction—checking items, editing inline, dragging to reorder, or swiping to delete—commits to local IndexedDB in under 16ms with zero loading spinners, then synchronizes deterministically across devices via Supabase in the background.

---

## 1. Overview & Architecture

### Core Capabilities
- **Today Checklist & 4:00 AM Logical-Day Rollover**: Three structured daily sections (**Morning Routine**, **Work Day**, **Evening Routine**) with per-section SVG progress rings and restrained completion feedback. Items automatically uncheck at a configurable daily rollover boundary (default **4:00 AM local time**, adjustable `0:00–23:00` in Settings) via a pure logical-day function (`localDate(now - rolloverHour)`), so late nights naturally count toward the previous day. Rollover transitions happen live without a page reload while preserving all checklist items.
- **Pinned Goal Hero Card**: Displays a primary goal statement and an optional target date with a live day countdown (`"142 days left"`, `"Due today"`). When all daily items are completed, the card plays a single, restrained specular shimmer.
- **Persistent Work Checklist**: A dedicated side checklist where completed items stay in place—struck through and dimmed—until explicitly deleted via touch swipe-to-delete (with iOS rubber-banding resistance), edit mode, or the confirmed **Clear Completed** action.
- **iOS 26 Liquid Glass Design System**: Multi-stop translucent backdrop blur (`backdrop-filter: blur(28px) saturate(190%)`), hairline specular borders, collapsing large navigation headers, spring-physics animations tuned for 120 Hz ProMotion (`framer-motion`), automatic system Light/Dark appearance parity, `prefers-reduced-motion` cross-fade path, and safe-area insets for the Dynamic Island and Home Indicator.
- **Responsive Viewport Architecture**:
  - **Mobile (`< 1024px`, optimized for iPhone 17 Air `420×912`)**: Single-column layout with a floating Liquid Glass tab bar switching between **Today** and **Work**.
  - **Desktop (`>= 1024px`, `1440×900`)**: Side-by-side workspace with the Goal Hero Card spanning the top and **Today** and **Work** rendered in parallel columns (no tab bar), complete with keyboard navigation (`Space` to toggle, `Enter` to add, `ArrowUp`/`ArrowDown` to move focus).
- **Offline-First Sync & Deterministic LWW Convergence**:
  - **Local Store**: Authoritative local persistence powered by **Dexie.js (IndexedDB)** (`checklist_items`, `goals`, `user_settings`, `outbox_mutations`).
  - **Conflict Resolution**: Monotonic Lamport timestamps paired with deterministic Last-Write-Wins (`LWW`) tie-breaking ensure concurrent offline edits across iPhone and desktop always converge to the exact same state.
  - **Soft-Delete Tombstones**: Deletions record `deleted_at` tombstones so deletions propagate reliably across offline devices without resurrecting deleted rows.
  - **Graceful Local Fallback**: If the cloud database is unmigrated (`PGRST205`), unreachable, or unauthenticated, Cadence operates 100% locally without crashes or intrusive error banners.

### High-Level Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│ UI Layer (React 19 + TypeScript + Framer Motion)                       │
│  • iOS 26 Liquid Glass Materials, Collapsing Header, Floating Tab Bar  │
│  • Reminders-style Checkboxes, Progress Rings, Goal Hero Card          │
│  • Native Edit Mode (Spring Drag Reorder, Inline Rename, Swipe Delete) │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                   Instant reactive reads & writes (<16ms)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Local Domain & Offline Store (Dexie.js / IndexedDB)                    │
│  • Tables: checklist_items, goals, user_settings, outbox_mutations     │
│  • Pure Logical-Day Engine: localDate(now - rolloverHour)              │
│  • Live 4:00 AM Rollover Cascade & Monotonic Lamport Clock             │
└────────────────────────────────────────────────────────────────────────┘
                                   │
             Async FIFO outbox push & delta pull when online
               Graceful local fallback if offline/unmigrated
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Sync Engine & Supabase Cloud (PostgreSQL + GoTrue + Realtime)          │
│  • In-App 6-Digit Email OTP Authentication (PWA standalone-safe)       │
│  • Deterministic Last-Write-Wins (LWW) + Soft-Delete Tombstones        │
│  • Row-Level Security (RLS) isolating rows via auth.uid() = user_id    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Local Development, Testing & Build Commands

### Prerequisites
- **Node.js** `>= 20.x` (verified on Node `24.13.0`)
- **npm** `>= 10.x` (verified on npm `11.10.0`)

### Environment Variables
Copy `.env.example` to `.env.local` in the project root:

```powershell
Copy-Item .env.example .env.local
```

Configure your Supabase project credentials in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
```

> **Note:** The Supabase `anon` key is a public client key by design; security is enforced server-side via PostgreSQL Row Level Security (RLS).

### Command Reference

| Command | Description |
| :--- | :--- |
| `npm install` | Install all project dependencies. |
| `npm run dev` | Start the local Vite development server at `http://localhost:5173` with Hot Module Replacement (HMR). |
| `npm test` | Run the Vitest unit & adversarial test suites (logical-day rollover at `3:59 AM` vs `4:00 AM`, DST boundaries, custom rollover hours, countdown calculations, LWW conflict convergence, tombstone propagation, and outbox queue replay). |
| `npx playwright test` | Run the full end-to-end Playwright suite across **WebKit** and **Chromium** at both **iPhone 17 Air (`420×912`)** and **Desktop (`1440×900`)** viewports, including `axe-core` accessibility audits. |
| `npm run typecheck` | Run strict TypeScript checking (`tsc -b --noEmit`) with zero errors. |
| `npm run lint` | Run ESLint static analysis across the codebase. |
| `npm run build` | Type-check and compile the optimized production bundle into `dist/`. |
| `npm run preview` | Serve the production `dist/` build locally (default `http://localhost:4173`). |
| `node scripts/verify-supabase.mjs` | Run the live Supabase readiness check (probes GoTrue Auth health, PostgREST schema cache for all 3 tables, RLS enforcement, and Realtime WebSocket connectivity). |

---

## 3. Supabase Setup (Step-by-Step)

Cadence works immediately out-of-the-box in local-first mode. To enable multi-device cloud sync and 6-digit email OTP authentication against your Supabase project (`https://hkncvdgrvsopjtqlsiyt.supabase.co`), complete the following four steps in the [Supabase Dashboard](https://supabase.com/dashboard/project/hkncvdgrvsopjtqlsiyt):

### Step 1: Run the Database Migration in the SQL Editor
1. Open your Supabase project dashboard and navigate to **SQL Editor** ([Direct Link](https://supabase.com/dashboard/project/hkncvdgrvsopjtqlsiyt/sql)).
2. Click **New query**.
3. Open [`supabase/migrations/20261017000000_init_cadence.sql`](supabase/migrations/20261017000000_init_cadence.sql), copy its entire contents, paste it into the SQL Editor, and click **Run**.
4. This idempotent migration provisions:
   - **Tables**: `public.user_settings`, `public.goals`, and `public.checklist_items` with soft-delete tombstone (`deleted_at`) columns and composite indexes.
   - **Triggers**: Automatic `updated_at` UTC timestamp maintenance (`public.set_updated_at()`) and automatic user settings initialization (`public.handle_new_user()` on `auth.users` insert).
   - **Row Level Security (RLS)**: Strict per-user isolation policies (`auth.uid() = user_id`) for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` across all tables.
   - **Realtime Publication**: Configures `REPLICA IDENTITY FULL` and adds all three tables to the `supabase_realtime` publication for live cross-device push updates.

### Step 2: Configure Email Provider & 6-Digit OTP Length
1. In the Supabase Dashboard, go to **Authentication → Sign In / Providers** (or **Authentication → Providers → Email**).
2. Ensure **Email** provider is **Enabled**.
3. Enable **Email OTP** (One-Time Password).
4. Set **Email OTP Length** to **`6`** digits (default in some projects is 6 or 8—ensure it is explicitly set to `6` to match Cadence's 6-box verification UI).
5. Optionally adjust **Email OTP Expiration** (e.g. `3600` seconds / 1 hour) and click **Save**.

### Step 3: Update the Magic Link Email Template to Display `{{ .Token }}`
**Why 6-Digit OTP Instead of Magic Links on iOS?**
> On iOS, an installed Home Screen PWA runs in an isolated standalone WebKit context separate from mobile Safari. Clicking a traditional email magic link (`{{ .ConfirmationURL }}`) inside the Apple Mail app opens a new tab in mobile Safari instead of launching the installed Home Screen PWA—leaving the installed app unauthenticated. Entering a **6-digit one-time code (`{{ .Token }}`)** directly inside Cadence's Settings sheet completes authentication natively inside the standalone PWA session.

1. Navigate to **Authentication → Email Templates** in your Supabase Dashboard.
2. Select the **Magic Link** template (Supabase uses the Magic Link template whenever `signInWithOtp({ email })` is called for an existing user, and **Confirm signup** if `shouldCreateUser: true` triggers for a brand-new user—update **both** *Magic Link* and *Confirm signup* templates with the template below).
3. Set the **Subject** to:
   ```text
   Your Cadence sign-in code: {{ .Token }}
   ```
4. Set the **Body (HTML)** to:
   ```html
   <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; color: #1c1c1e;">
     <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Sign in to Cadence</h2>
     <p style="font-size: 15px; line-height: 1.5; color: #636366; margin: 0 0 24px;">
       Enter the 6-digit verification code below inside the Cadence app to sync your checklists across devices:
     </p>
     <div style="background: #f2f2f7; border-radius: 14px; padding: 20px; text-align: center; letter-spacing: 8px; font-size: 32px; font-weight: 700; color: #007aff; margin-bottom: 24px;">
       {{ .Token }}
     </div>
     <p style="font-size: 13px; color: #8e8e93; margin: 0;">
       This code expires shortly. If you did not request this code, you can safely ignore this email.
     </p>
   </div>
   ```
5. Click **Save**.

### Step 4: Configure Site URL & Redirect URLs
1. Navigate to **Authentication → URL Configuration**.
2. Set **Site URL** to your production Vercel URL (e.g., `https://cadence.vercel.app`) or `http://localhost:5173` during local development.
3. Under **Redirect URLs**, add your allowed origins:
   - `http://localhost:5173/**`
   - `http://localhost:4173/**`
   - `https://*.vercel.app/**`
   - `https://*.trycloudflare.com/**` (if testing on iPhone via Cloudflare Quick Tunnel)
4. Click **Save**.

### Step 5: Verify Live Supabase Readiness
Once Steps 1–4 are complete, run the built-in verification script from your terminal:

```powershell
node scripts/verify-supabase.mjs
```

When the migration is applied, all four probes will report green (`✅ GoTrue Auth Service`, `✅ Schema Cache Valid & Accessible` for `user_settings`, `goals`, and `checklist_items`, `✅ Row Level Security (RLS): Enforced`, and `✅ Supabase Realtime WebSocket: Connected`).

---

## 4. Vercel Deployment Steps

Cadence is pre-configured for zero-configuration deployment on **Vercel**.

### Step 1: Push Repository to GitHub
Initialize or push your local Git repository to a private or public GitHub repository:

```powershell
git remote add origin https://github.com/<your-username>/cadence.git
git branch -M main
git push -u origin main
```

### Step 2: Import Project into Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import your `cadence` GitHub repository.
2. Confirm the build settings (Vercel auto-detects these from `package.json` and `vite.config.ts`):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 3: Configure Environment Variables
Expand the **Environment Variables** section in Vercel before deploying and add both variables for **Production**, **Preview**, and **Development** environments:

| Name | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://hkncvdgrvsopjtqlsiyt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs` |

### Step 4: Deploy
Click **Deploy**. Vercel will build the production bundle (`dist/`), serve `manifest.webmanifest`, app icons, iPhone 17 Air splash screens, and `sw.js` over global HTTPS edge nodes, and provide a production `.vercel.app` URL ready to be installed directly to your iPhone 17 Air Home Screen.

---

## 5. Testing on a Real iPhone 17 Air from a Windows PC over HTTPS

### Why HTTPS is Required on iOS
On iOS Safari, WebKit enforces a strict **Secure Context (`HTTPS`)** policy for all origins other than `localhost`. If you open a plain `http://192.168.x.x:5173` LAN address on a physical iPhone:
- `navigator.serviceWorker` and the Cache Storage API are disabled by WebKit.
- Offline standalone launch and full PWA installation behaviors are restricted.

To test Cadence with full Service Worker caching and Home Screen standalone installation on a physical **iPhone 17 Air** from a **Windows PC** prior to deploying to Vercel, use either **Option A** (fastest) or **Option B** (local LAN certificate).

---

### Option A: One-Command Cloudflare Quick Tunnel (Recommended)
A Cloudflare Quick Tunnel exposes your local Windows dev/preview server over a publicly trusted `https://*.trycloudflare.com` certificate with zero router or certificate configuration.

1. **Start Cadence on your Windows PC**:
   ```powershell
   npm run dev -- --host
   ```
   *(Or for a production build test: `npm run build && npm run preview -- --host --port 5173`)*
2. **Open a second PowerShell terminal and launch the HTTPS tunnel**:
   ```powershell
   npx cloudflared tunnel --url http://localhost:5173
   ```
3. Copy the generated `https://<random-words>.trycloudflare.com` URL printed in the terminal and open it in **Safari** on your **iPhone 17 Air**.

---

### Option B: Local Trusted Certificate via `mkcert` on Windows + iOS Root CA
If you want purely local Wi-Fi testing without an external tunnel, generate a locally trusted TLS certificate using `mkcert`:

1. **Install `mkcert` on Windows (PowerShell as Administrator)**:
   ```powershell
   winget install FiloSottile.mkcert
   mkcert -install
   ```
2. **Find your Windows PC's Wi-Fi LAN IPv4 address**:
   ```powershell
   ipconfig
   # Look for "IPv4 Address" under Wireless LAN adapter Wi-Fi, e.g. 192.168.1.50
   ```
3. **Generate a local certificate covering `localhost` and your LAN IP**:
   ```powershell
   mkdir .certs
   mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 ::1 192.168.1.50
   ```
4. **Install and Trust the Root CA Profile on your iPhone 17 Air**:
   - Run `mkcert -CAROOT` in PowerShell to locate `rootCA.pem`.
   - Transfer `rootCA.pem` to your iPhone (via iCloud Drive, AirDrop, or email) and open it to download the configuration profile.
   - On your iPhone, go to **Settings → Profile Downloaded** (near the top) and tap **Install**.
   - **Crucial iOS step**: Go to **Settings → General → About → Certificate Trust Settings** (at the very bottom) and toggle **ON** full trust for the `mkcert` root certificate under *"Enable Full Trust for Root Certificates"*.
5. **Serve the built app over HTTPS on your LAN IP**:
   ```powershell
   npm run build
   npx http-server dist -p 5173 -S -C .certs/cert.pem -K .certs/key.pem
   ```
6. On your iPhone 17 Air (connected to the same Wi-Fi network), open `https://192.168.1.50:5173` in **Safari**.

---

### Installing Cadence to the iPhone 17 Air Home Screen
1. Open your HTTPS URL (Vercel deployment, Cloudflare Quick Tunnel, or `mkcert` LAN URL) in **Safari** on your **iPhone 17 Air**.
2. Tap the **Share** button in the Safari toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Verify the title reads **Cadence** with the custom Liquid Glass icon and tap **Add**.
5. Launch **Cadence** from your Home Screen:
   - It launches in **standalone full-screen mode** (`display: standalone`) with zero Safari browser chrome.
   - Custom light and dark splash screens (`1260×2736` px `@3x` for the `420×912` pt iPhone 17 Air viewport) transition smoothly into the app.
   - Safe areas automatically respect the **Dynamic Island** at the top and the **Home Indicator** below the floating glass tab bar.
   - Enable **Airplane Mode** at any time to verify instant `<16ms` offline operation and reload persistence via `sw.js` + IndexedDB.
