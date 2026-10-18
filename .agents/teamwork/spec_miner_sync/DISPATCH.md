## 2026-10-17T19:37:44Z
You are spec_miner_sync, a specialist specification miner.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md

YOUR MISSION:
Mine, analyze, and specify all requirements, data schemas, sync algorithms, and architecture details for:
1. Supabase Backend & Database Schema:
   - Project URL: https://hkncvdgrvsopjtqlsiyt.supabase.co
   - Public Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
   - Define complete relational tables:
     * `user_settings`: user_id (PK, FK auth.users), rollover_hour (int, default 4), created_at, updated_at
     * `goals`: id (UUID PK), user_id (FK auth.users), statement (text), target_date (date/timestamptz nullable), updated_at, deleted_at (timestamptz nullable)
     * `checklist_items`: id (UUID PK), user_id (FK auth.users), list_type (enum/text: 'today_morning', 'today_work', 'today_evening', 'work'), title (text), sort_order (double precision / int), is_completed (boolean), completed_at (timestamptz nullable), last_reset_day (text/date nullable for daily items), updated_at, deleted_at (soft delete for propagation)
   - Row Level Security (RLS) policies: strictly isolate user data so `auth.uid() = user_id` for select, insert, update, delete.
   - Realtime replication setup: publication for `checklist_items`, `goals`, `user_settings`.
   - Complete SQL migration file structure (`supabase/migrations/20261017000000_init_cadence.sql`) runnable in Supabase SQL Editor.
2. In-App 6-Digit Email OTP Authentication:
   - Flow: User enters email in minimal Settings sheet -> Supabase `signInWithOtp({ email, options: { shouldCreateUser: true } })`.
   - UI shows 6-digit input: auto-advance between input boxes, paste support (splitting 6 digits across boxes), backspace navigation.
   - Supabase `verifyOtp({ email, token, type: 'email' })`.
   - Single device sign-in, persistent auth session in localStorage/IndexedDB.
   - Sign-out action with local cache handling.
3. Offline-First Architecture & Deterministic Sync Engine:
   - Local storage layer: Dexie.js (IndexedDB) as authoritative instant UI data store.
   - Local-first mutations: UI updates IndexedDB immediately (<16ms, zero spinners), then enqueues to an `offline_mutations` outbox.
   - Sync reconciliation algorithm:
     * Deterministic Last-Write-Wins (LWW) conflict resolution using monotonic client/server timestamps (`updated_at`) and UUID tie-breaker.
     * Soft deletes (`deleted_at` timestamp): deletions must propagate reliably across devices so resurrected items never appear.
     * Offline queue replay: on network reconnect (`window.addEventListener('online')`), drain mutation queue sequentially with exponential backoff on retry.
     * Concurrent edits on two independent browser contexts must converge to identical state.
4. Graceful Fallback & Local Operation:
   - When offline, credentials missing, or migration not yet applied in Supabase: app must function 100% locally without errors or unhandled promise rejections.
   - `.env.local` configuration and `.env.example` template.
   - Live DB verification script (opt-in script to verify schema against live Supabase when migration is applied).

OUTPUT DELIVERABLES:
1. Write your detailed analysis and comprehensive sync specification to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\analysis.md
2. Write a self-contained handoff report to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\handoff.md
3. Update progress.md in your working directory.
4. Send a message to your parent orchestrator (bead4d79-c7a2-42ab-8259-8e33bcf7fd9e) when finished.
