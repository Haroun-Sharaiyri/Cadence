## 2026-10-18T09:17:16Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are worker_m4, the implementation worker for Milestone 4: Supabase Sync Engine, 6-Digit Email OTP & Migration.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\worker_m4
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications and the three Explorer analysis files:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_1\analysis.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_2\analysis.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_3\analysis.md

YOUR EXCLUSIVE FILE OWNERSHIP:
- `supabase/migrations/20261017000000_init_cadence.sql`
- `.env.local`
- `.env.example`
- `.gitignore`
- `scripts/verify-supabase.mjs`
- `src/sync/supabaseClient.ts`
- `src/sync/syncEngine.ts`
- `src/hooks/useSyncState.ts`
- `src/components/auth/OtpInput.tsx`
- `src/components/auth/OtpInput.test.tsx`
- `src/components/auth/AuthModal.tsx`
- `src/sync/syncEngine.test.ts`
- `src/components/sheets/SettingsSheet.tsx`
- `src/components/desktop/DesktopLayout.tsx`
- `src/App.tsx`

YOUR MISSION & IMPLEMENTATION TASKS:
Implement the complete, production-ready Milestone 4 deliverables using the verified code formulated across the three explorer analyses:

1. SQL Migration & Schema (`supabase/migrations/20261017000000_init_cadence.sql`):
   - 100% idempotent SQL migration for Supabase SQL Editor.
   - Tables: `user_settings`, `goals`, `checklist_items` with UUID primary keys, foreign keys to `auth.users(id) ON DELETE CASCADE`.
   - Column naming: explicitly use `last_completed_day TEXT NULL` for routine reset tracking to match Dexie schema.
   - Automatic `updated_at` triggers via `set_updated_at()`.
   - Automatic user settings provisioning trigger on `auth.users` insert.
   - Row Level Security (RLS) policies enforcing `auth.uid() = user_id`.
   - Realtime publication: `ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items, goals, user_settings;`.

2. Environment Configuration & .gitignore:
   - Create `.env.local` containing exact user credentials:
     VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
   - Create `.env.example` with sanitized placeholders.
   - Ensure `.gitignore` ignores `.env.local`.

3. Standalone Verification Script (`scripts/verify-supabase.mjs`):
   - Pure Node.js script (zero external dependencies) reading `.env.local`.
   - Probes GoTrue health endpoint.
   - Checks schema cache status and handles `PGRST205` gracefully.
   - Checks Realtime WebSocket connection, using deferred `removeChannel` to prevent call stack overflow.
   - Exits 0 with actionable user guidance.

4. Supabase Client Wrapper (`src/sync/supabaseClient.ts`):
   - Lazy client initialization validating env credentials.
   - GoTrue 6-digit email OTP helpers: `signInWithOtp({ email, options: { shouldCreateUser: true } })`, `verifyOtp({ email, token, type: 'email' })`, `signOut()`, `getCurrentUser()`, `getSession()`, `onAuthStateChange()`.
   - Testing hook `setSupabaseClientForTesting(client)` and `resetSupabaseClient()`.

5. Sync Engine (`src/sync/syncEngine.ts`):
   - FIFO outbox queue drainer processing `db.outbox_mutations` in ID order.
   - Atomic Dexie transaction cleanup upon successful upsert/delete.
   - Exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s + jitter) on transient network errors.
   - Inbound pull with `resolveLWW` conflict resolution from `src/domain/lww.ts`.
   - Soft-delete tombstone propagation (`deleted_at !== null`) preventing item resurrection.
   - Graceful fallback mode on `PGRST205` or network offline: sets `fallbackMode = true`, continues 100% local operation without unhandled exceptions.
   - Anonymous-to-authenticated data promotion: upon user sign-in, reassigns local records (`user_id = 'local'`) to the authenticated user ID and queues outbox mutations for cloud sync.

6. Reactive Sync Hook (`src/hooks/useSyncState.ts`):
   - Powered by `useSyncExternalStore` for React 19 concurrent safety.
   - Returns `{ isOnline, isSyncing, lastSyncedAt, fallbackMode, user, isGuest, status, triggerSync }`.

7. In-App 6-Digit Email OTP UI (`src/components/auth/OtpInput.tsx` & `AuthModal.tsx`):
   - `OtpInput.tsx`: 6 discrete input boxes, auto-advance on digit input, backspace navigation, 6-digit paste parsing, 44x44pt tap target minimum, 22px font size anti-zoom, shake spring animation on error.
   - `OtpInput.test.tsx`: Vitest tests for auto-advance, backspace, and paste parsing.
   - `AuthModal.tsx`: iOS 26 Liquid Glass bottom sheet modal with email entry step, OTP verification step, 60s resend cooldown timer, and error display.

8. Sync Engine Unit Test Suite (`src/sync/syncEngine.test.ts`):
   - Vitest unit tests verifying:
     * Outbox FIFO replay and atomic deletion.
     * Exponential backoff and retry count incrementing.
     * Deterministic LWW reconciliation (remote newer, local newer, UUID tie-breaking).
     * Soft-delete tombstone anti-resurrection guarantees.
     * Graceful fallback mode on simulated PGRST205 error.

9. UI Integration (`SettingsSheet.tsx`, `DesktopLayout.tsx`, `App.tsx`):
   - `SettingsSheet.tsx`: bind live auth state (`user?.email` vs `"Guest / Local Storage"`), wire "Sign In" button to open `AuthModal`, wire "Sign Out" button.
   - `DesktopLayout.tsx`: wire status dot and label (`"Cloud Synced"`, `"Syncing..."`, `"Offline / Local"`).
   - `App.tsx`: wire `useSyncState()`, pass auth props to `SettingsSheet` and `DesktopLayout`, render `AuthModal`.

10. Verification:
   Run the following verification commands in PowerShell:
   - `node scripts/verify-supabase.mjs`
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   Verify that all commands pass with 0 errors!
