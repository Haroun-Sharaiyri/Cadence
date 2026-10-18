## 2026-10-18T09:08:37Z
You are explorer_m4_3, an exploration specialist for Milestone 4: Supabase Sync Engine, 6-Digit Email OTP & Migration.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_3
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications, sync survey, and settings UI:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\analysis.md
c:\Users\shqai\Downloads\Repo\Checklist\src\components\sheets\SettingsSheet.tsx
c:\Users\shqai\Downloads\Repo\Checklist\src\components\desktop\DesktopLayout.tsx

YOUR MISSION:
Formulate the concrete, production-ready implementation plan and complete code for:
1. `src/sync/syncEngine.test.ts`:
   - Vitest unit tests verifying:
     * Outbox FIFO queue replay and atomic mutation deletion.
     * Exponential backoff and retry count incrementing on network errors.
     * LWW reconciliation: local vs remote timestamp comparisons, UUID tie-breaking.
     * Soft-delete tombstone propagation: remote delete overrides older local update.
     * Graceful fallback: simulated `PGRST205` error enters local fallback mode without throwing unhandled errors or crashing.
2. Integration with `SettingsSheet.tsx` & Desktop Header:
   - Wire `SettingsSheet.tsx` with live auth state: display user's email if signed in, or "Guest / Local Storage", and connect Sign In / Sign Out buttons to open `AuthModal` or execute `signOut()`.
   - Wire desktop sync indicator in `DesktopLayout.tsx` showing subtle status dot and label (Cloud Synced, Syncing..., Offline / Local).

OUTPUT DELIVERABLES:
1. Write analysis and complete production code to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_3\analysis.md`.
2. Write handoff report to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_3\handoff.md`.
3. Send completion message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e.
