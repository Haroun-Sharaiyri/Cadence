## 2026-10-18T09:08:37Z
You are explorer_m4_2, an exploration specialist for Milestone 4: Supabase Sync Engine, 6-Digit Email OTP & Migration.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_2
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications, domain LWW, and Dexie repository:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\analysis.md
c:\Users\shqai\Downloads\Repo\Checklist\src\domain\lww.ts
c:\Users\shqai\Downloads\Repo\Checklist\src\db\repository.ts

YOUR MISSION:
Formulate the concrete, production-ready implementation plan and complete TypeScript code for:
1. `src/sync/supabaseClient.ts`:
   - Supabase client initialization using `@supabase/supabase-js`.
   - Lazy client creation with validation of env variables.
   - Helper methods: `signInWithOtp(email)`, `verifyOtp(email, token)`, `signOut()`, `getCurrentUser()`, `getSession()`, `onAuthStateChange(callback)`.
2. `src/sync/syncEngine.ts`:
   - Outbox Queue Drain Engine: Processes `outbox_mutations` in FIFO order. Pushes mutations to Supabase via upsert/delete.
   - Atomic Dexie Transactions: Clears processed mutation records upon successful push.
   - Exponential Backoff: On network error or rate limit, pauses with exponential backoff (e.g. 1s, 2s, 4s, max 30s).
   - Inbound Sync & Conflict Resolution: Pulls changed rows since `last_synced_at`. Resolves conflicts using `resolveLWW` from `src/domain/lww.ts`. Soft-delete propagation (rows with `deleted_at` are persisted as soft-deleted in Dexie, never resurrected).
   - Graceful Fallback Mode: On `PGRST205` ("relation does not exist" before user migration) or offline status, enters `fallback_local` mode without throwing unhandled exceptions or breaking UI.
3. `src/hooks/useSyncState.ts`:
   - Reactive hook providing: `{ isOnline, isSyncing, lastSyncedAt, fallbackMode, user, isGuest }` with `triggerSync()` method.

OUTPUT DELIVERABLES:
1. Write analysis and complete production code to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_2\analysis.md`.
2. Write handoff report to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_2\handoff.md`.
3. Send completion message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e.
