## 2026-10-18T07:43:10Z
You are explorer_m2, an exploration specialist for Milestone 2: Checklist Domain, Offline Store & Rollover Engine.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m2
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications and prior explorer findings:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_domain\analysis.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\spec_miner_sync\analysis.md

YOUR MISSION:
Formulate the concrete, production-ready implementation plan and complete TypeScript code for Milestone 2:
1. `src/domain/types.ts`:
   - Exact interfaces for `ChecklistType`, `ChecklistItem`, `Goal`, `UserSettings`, `OutboxMutation`.
2. `src/domain/rollover.ts` and `src/domain/rollover.test.ts`:
   - `getLogicalDay(date: Date, rolloverHour: number): string` (`YYYY-MM-DD`).
   - `isItemCheckedToday(item: ChecklistItem, logicalDay: string): boolean`.
   - `msUntilNextRollover(now: Date, rolloverHour: number): number`.
   - Complete Vitest test suite covering:
     * 3:59:59 AM vs 4:00:00 AM local time boundary.
     * Full 0-23 user-adjustable rollover hour sweep.
     * DST transitions: 23-hour spring forward day and 25-hour fall back day.
     * Multi-day offline gap: items unchecked immediately on reopen after days without active timer or server cron.
3. `src/domain/countdown.ts` and `src/domain/countdown.test.ts`:
   - `computeGoalCountdown(targetDate: string | null, logicalDay: string): CountdownResult | null`.
   - Vitest unit tests verifying countdown text ("X days left", "1 day left", "Due today", "X days overdue", and null when cleared).
4. `src/domain/lww.ts` and `src/domain/lww.test.ts`:
   - Deterministic Last-Write-Wins conflict resolution algorithm with monotonic Lamport timestamps and UUID tie-breaker.
   - Vitest unit tests proving mathematical convergence across concurrent offline edits.
5. `src/db/index.ts` and `src/db/repository.ts`:
   - Dexie.js database schema definition (`checklist_items`, `goals`, `user_settings`, `outbox_mutations`).
   - Optimistic mutations (< 16ms, zero spinners).
   - Soft-delete semantics (`deleted_at = now()`) for delete propagation.
   - Fractional indexing for item reordering.
   - Atomic outbox mutation enqueuing in a single Dexie transaction.
6. `src/hooks/useRollover.ts` and `src/hooks/useChecklist.ts`:
   - Live rollover cascade hook firing at the rollover boundary to trigger a gentle UI uncheck cascade without page reload.
   - Reactive Dexie subscriptions via `useLiveQuery` providing items and section progress counts.

OUTPUT DELIVERABLES:
1. Write detailed implementation plan and code specifications to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m2\analysis.md
2. Write handoff report to:
   c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m2\handoff.md
3. Send completion message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e.
