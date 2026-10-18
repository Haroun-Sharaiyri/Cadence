## 2026-10-18T08:12:46Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are worker_m2_remediate, the remediation worker for Milestone 2: Checklist Domain, Offline Store & Rollover Engine.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\worker_m2_remediate
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the Reviewer and Challenger Gate reports:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\reviewer_m2_2\handoff.md
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\challenger_m2_2\handoff.md

YOUR FILE OWNERSHIP (Exclusive):
- `src/db/repository.ts`
- `src/hooks/useChecklist.ts`
- `src/domain/lww.ts`

YOUR MISSION & REMEDIATION TASKS:
Gate Iteration 1 of Milestone 2 identified 4 precise defects that must be remediated:

1. Fix `checklistRepository.toggleItem` in `src/db/repository.ts:108`:
   - Problem: `toggleItem` evaluates `const isCompleted = !existing.is_completed;` using the raw stored boolean. If an item was completed yesterday and opened today, it appears unchecked, but tapping it sets `is_completed: false`, swallowing the tap and requiring a 2nd click.
   - Solution: Import `isItemCheckedToday` from `../domain/rollover`. Compute:
     ```ts
     const currentlyCompleted = isItemCheckedToday(existing, currentLogicalDay);
     const isCompleted = !currentlyCompleted;
     ```
   - Update tests if needed to verify this behavior.

2. Fix `calculateNewSortOrder` boundary collision in `src/db/repository.ts:27`:
   - Problem: If `prevOrder === nextOrder`, `(prevOrder + nextOrder) / 2` returns `prevOrder`, causing duplicate sort order.
   - Solution:
     ```ts
     if (prevOrder !== null && nextOrder !== null) {
       if (prevOrder >= nextOrder) {
         return prevOrder + 1.0;
       }
       return (prevOrder + nextOrder) / 2.0;
     }
     ```

3. Fix `useChecklist` startup normalization and reconciliation in `src/hooks/useChecklist.ts`:
   - Problem: When launching the app after an offline gap, `rolloverDailyItems` has not yet been executed in IndexedDB, and `morningItems`, `todayWorkItems`, `eveningItems` pass raw items where `item.is_completed` is still `true` from yesterday, causing split-brain with section progress rings (which evaluate `isItemCheckedToday`).
   - Solution:
     a) Normalize items returned for Today sections so that `is_completed` matches `isItemCheckedToday(item, currentLogicalDay)`:
        ```ts
        const normalizeItem = (item: ChecklistItem): ChecklistItem => {
          if (item.list_type === 'work') return item;
          return {
            ...item,
            is_completed: isItemCheckedToday(item, currentLogicalDay),
          };
        };
        ```
        Apply `normalizeItem` to `morningItems`, `todayWorkItems`, and `eveningItems`.
     b) In a `useEffect` inside `useChecklist`, trigger startup rollover reconciliation:
        ```ts
        useEffect(() => {
          checklistRepository.rolloverDailyItems(currentLogicalDay);
        }, [currentLogicalDay]);
        ```

4. Fix `resolveLWW` identical tie-breaker commutativity in `src/domain/lww.ts:98-102`:
   - Problem: When `tieR.localeCompare(tieL) === 0` (e.g. if `user.id` or matching client tie-breakers are provided) and timestamps are identical, the code defaults to local, meaning `resolveLWW(A, B) !== resolveLWW(B, A)`.
   - Solution:
     ```ts
     const tieComparison = tieR.localeCompare(tieL);
     if (tieComparison > 0) {
       return { winner: 'remote', winningRecord: remote, reason: 'tie_breaker' };
     } else if (tieComparison < 0) {
       return { winner: 'local', winningRecord: local, reason: 'tie_breaker' };
     }

     // Tertiary tie-breaker: Content hash comparison when tie-breaker strings are identical
     const contentComparison = JSON.stringify(remote).localeCompare(JSON.stringify(local));
     if (contentComparison > 0) {
       return { winner: 'remote', winningRecord: remote, reason: 'tie_breaker' };
     } else {
       return { winner: 'local', winningRecord: local, reason: 'tie_breaker' };
     }
     ```

5. Verification:
   Run the following verification commands in PowerShell:
   - `npm test` (all test suites must pass, including `src/domain/rollover-adversarial.test.ts` and `src/test/empirical-m2.test.ts`)
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   Verify that all commands pass with 0 errors.

OUTPUT DELIVERABLES:
1. Write handoff report to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\worker_m2_remediate\handoff.md` with:
   - Detailed list of modifications made
   - Verbatim outputs of `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`
2. Update progress.md in your working directory.
3. Send a message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e when complete.
