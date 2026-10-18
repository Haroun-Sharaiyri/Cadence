## 2026-10-18T07:50:49Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are worker_m2, the implementation worker for Milestone 2: Checklist Domain, Offline Store & Rollover Engine.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\worker_m2
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications and explorer formulation:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m2\analysis.md

YOUR EXCLUSIVE FILE OWNERSHIP:
- `src/domain/types.ts`
- `src/domain/rollover.ts` & `src/domain/rollover.test.ts`
- `src/domain/countdown.ts` & `src/domain/countdown.test.ts`
- `src/domain/lww.ts` & `src/domain/lww.test.ts`
- `src/db/index.ts` & `src/db/repository.ts`
- `src/db/repository.test.ts`
- `src/hooks/useRollover.ts`
- `src/hooks/useChecklist.ts`

YOUR MISSION & IMPLEMENTATION TASKS:
Implement the complete, production-ready domain and offline local storage layer using the exact, verified code specified in `explorer_m2/analysis.md`:

1. `src/domain/types.ts`:
   - Define `ChecklistType` ('today_morning' | 'today_work' | 'today_evening' | 'work').
   - Define `ChecklistItem`, `Goal`, `UserSettings`, `OutboxMutation`, `CountdownResult`, `SectionProgress`, `DayProgress`.

2. `src/domain/rollover.ts` & `src/domain/rollover.test.ts`:
   - Implement `getLogicalDay(date: Date, rolloverHour: number): string` (`YYYY-MM-DD`).
   - Implement `isItemCheckedToday(item: ChecklistItem, logicalDay: string): boolean`.
   - Implement `msUntilNextRollover(now: Date, rolloverHour: number): number`.
   - Implement Vitest unit tests covering:
     * 3:59:59.999 AM vs 4:00:00.000 AM local time boundary.
     * User-adjustable rollover hours 0 through 23.
     * DST transitions: 23-hour spring forward day and 25-hour fall back day.
     * Multi-day offline gap: items unchecked immediately on reopen after days without background workers or network.
     * Work tab persistence: items in 'work' list do NOT reset at rollover.

3. `src/domain/countdown.ts` & `src/domain/countdown.test.ts`:
   - Implement `computeGoalCountdown(targetDate: string | null, logicalDay: string): CountdownResult | null`.
   - Implement Vitest unit tests for: "X days left", "1 day left", "Due today", "1 day overdue", "X days overdue", and null on clear.

4. `src/domain/lww.ts` & `src/domain/lww.test.ts`:
   - Implement monotonic `LamportClock` for timestamp generation preventing clock skew issues.
   - Implement deterministic `resolveLWW<T>` with timestamp comparison and UUID tie-breaker.
   - Implement Vitest unit tests verifying mathematical commutativity, associativity, and soft-delete tombstone precedence.

5. `src/db/index.ts` & `src/db/repository.ts` & `src/db/repository.test.ts`:
   - Implement Dexie.js database schema (`CadenceDatabase`).
   - Implement optimistic repository methods (< 16ms, zero loading spinners): `getItems`, `addItem`, `toggleItem`, `renameItem`, `reorderItems` (fractional indexing), `deleteItem` (soft delete `deleted_at = now()`), `clearCompleted`, `getGoal`, `saveGoal`, `getSettings`, `updateSettings`.
   - Atomic outbox mutation enqueuing inside the same Dexie transaction.
   - Implement unit test `src/db/repository.test.ts` verifying Dexie CRUD, soft deletes, atomic outbox, and reorder.

6. `src/hooks/useRollover.ts` & `src/hooks/useChecklist.ts`:
   - Implement `useRollover` live cascade hook triggering live uncheck across open sessions without page reload, with `visibilitychange` and `focus` guards.
   - Implement `useChecklist` subscribing reactively via `useLiveQuery` and providing items and section progress counts.

7. Verification:
   Run in PowerShell:
   - `npm run build`
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   Verify that all unit tests across all test suites pass with ZERO errors!
