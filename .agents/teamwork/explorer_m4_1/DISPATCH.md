## 2026-10-18T09:08:37Z
You are explorer_m4_1, an exploration specialist for Milestone 4: Supabase Sync Engine, 6-Digit Email OTP & Migration.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_1
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications and prior sync survey:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\analysis.md

YOUR MISSION:
Formulate the concrete, production-ready implementation plan and complete code for:
1. `supabase/migrations/20261017000000_init_cadence.sql`:
   - Complete, idempotent SQL migration for Supabase SQL Editor.
   - Tables: `user_settings`, `goals`, `checklist_items` with UUID primary keys, foreign keys to `auth.users(id) ON DELETE CASCADE`.
   - Automatic `updated_at` triggers via `set_updated_at()`.
   - Row Level Security (RLS) policies enforcing `auth.uid() = user_id`.
   - Realtime publication: `ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items, goals, user_settings;`.
2. Environment Configuration:
   - `.env.local` containing exact provided user credentials:
     VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
   - `.env.example` with sanitized placeholders.
3. Verification Script:
   - `scripts/verify-supabase.mjs` verifying connection to Supabase endpoint, detecting table existence, and handling PGRST205 gracefully.
4. In-App 6-Digit Email OTP UI:
   - `src/components/auth/AuthModal.tsx` & `src/components/auth/OtpInput.tsx`:
   - Discrete 6-digit input boxes with auto-advance, backspace navigation, paste parsing ("123456" auto-fills all boxes), 44x44pt tap target minimum, and font-size >= 16px (17px) anti-zoom protection.
   - Email submission step -> OTP verification step -> session persistence. (NOT magic links!).

OUTPUT DELIVERABLES:
1. Write analysis and complete production code to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_1\analysis.md`.
2. Write handoff report to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m4_1\handoff.md`.
3. Send completion message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e.
