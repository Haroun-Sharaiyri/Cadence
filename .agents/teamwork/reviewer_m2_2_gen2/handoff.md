# Milestone 2 Independent Review & Adversarial Challenge Report (Iteration 2)

**Reviewer**: `reviewer_m2_2_gen2`  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Milestone**: Milestone 2: Checklist Domain, Offline Store & Rollover Engine  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Verification Commands Executed
1. `npm test`:
   - Command: `vitest run`
   - Result: 12 test files passed (12), 98 tests passed (98) in 7.76s.
2. `npm run typecheck`:
   - Command: `tsc -b --noEmit`
   - Result: Exited with code 0. Zero type errors.
3. `npm run lint`:
   - Command: `eslint .`
   - Result: Exited with code 0 (0 errors, 2 warnings in `tests/m1-stress.spec.ts` for `@typescript-eslint/no-explicit-any`).
4. `npm run build`:
   - Command: `tsc -b && vite build`
   - Result: Exited with code 0 in 20.98s. Production bundle: `dist/assets/index-BbkbOo72.js` (224.83 kB, gzip: 69.87 kB, well under 220 kB budget).

### 1.2 Verification of Remediation Fixes
1. **`checklistRepository.toggleItem` (`src/db/repository.ts:115-127`)**:
   - `const currentlyCompleted = isItemCheckedToday(existing, currentLogicalDay); const isCompleted = !currentlyCompleted;`
   - Correctly uses `isItemCheckedToday(existing, currentLogicalDay)` to invert completion status. When a daily habit was completed on day $D_1$ and the user taps it on day $D_2$, `currentlyCompleted` is `false`, so `isCompleted` becomes `true`. Single tap immediately checks the item for today.
   - Verified: **PASS**.

2. **`calculateNewSortOrder` (`src/db/repository.ts:28-33`)**:
   - `if (prevOrder !== null && nextOrder !== null) { if (prevOrder >= nextOrder) return prevOrder + 1.0; return (prevOrder + nextOrder) / 2.0; }`
   - Correctly prevents duplicate index collision when `prevOrder >= nextOrder` by returning `prevOrder + 1.0`.
   - Verified: **PASS**.

3. **`resolveLWW` tertiary tie-breaker (`src/domain/lww.ts:105-111`)**:
   - Tertiary comparison: `const contentComparison = JSON.stringify(remote).localeCompare(JSON.stringify(local));`
   - Ensures mathematical commutativity when tie-breaker strings are identical.
   - Verified: **PASS**.

4. **Integrity Violations Check**:
   - Inspected source code for hardcoded test results, facade implementations, and test-only shortcuts. Zero integrity violations detected.

### 1.3 Critical Defect Discovered: `rolloverDailyItems` unconditionally wipes today's completed habits on every app launch / reload (`src/db/repository.ts:274-304`, `src/hooks/useChecklist.ts:58-60`)

- In `src/hooks/useChecklist.ts:58-60`, `worker_m2_remediate` added a startup effect to reconcile rollover on launch:
  ```ts
  // Reconcile and reset daily routine items on startup or logical day change
  useEffect(() => {
    checklistRepository.rolloverDailyItems(currentLogicalDay);
  }, [currentLogicalDay]);
  ```
- In `src/db/repository.ts:274-304`:
  ```ts
  /**
   * Executes daily rollover reset in local store:
   * Sets is_completed = false on all active Today section items.
   */
  async rolloverDailyItems(_newLogicalDay: string): Promise<number> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const dailyItems = await db.checklist_items
        .filter((item) => item.list_type !== 'work' && item.deleted_at === null && item.is_completed)
        .toArray();

      if (dailyItems.length === 0) return 0;

      for (const item of dailyItems) {
        const resetItem: ChecklistItem = {
          ...item,
          is_completed: false,
          completed_at: null,
          last_completed_day: null,
          updated_at: now,
        };
        await db.checklist_items.put(resetItem);
        await db.outbox_mutations.add({
          table_name: 'checklist_items',
          record_id: item.id,
          action: 'upsert',
          payload: resetItem,
          timestamp: Date.now(),
          retry_count: 0,
        });
      }

      return dailyItems.length;
    });
  },
  ```
- **Line 274**: Notice that the parameter is named `_newLogicalDay` with an underscore prefix, completely unreferenced in the function body.
- **Line 279**: The Dexie filter queries:
  `filter((item) => item.list_type !== 'work' && item.deleted_at === null && item.is_completed)`
- **Line 285-292**: It unconditionally resets **every** completed routine habit in the database to `is_completed = false` and `last_completed_day = null`.
- **The Failure Mode**:
  1. A user opens the app on Monday (`2026-10-18`) at 8:00 AM.
  2. The user checks off "Morning Habit". In IndexedDB, the item is stored with:
     `is_completed: true, last_completed_day: '2026-10-18'`.
  3. The user closes the app, or refreshes the page, or returns at 10:00 AM on the same Monday (`2026-10-18`).
  4. On mount, `useChecklist` executes `useEffect`:
     `checklistRepository.rolloverDailyItems('2026-10-18')`.
  5. `rolloverDailyItems` queries all daily items with `is_completed === true`. It matches the habit the user just checked this morning!
  6. `rolloverDailyItems` overwrites the item in IndexedDB with `is_completed: false, last_completed_day: null`, and enqueues an outbox mutation pushing the reset to Supabase!
  7. In the UI, the user's completed habit is completely unchecked and lost!
- **Empirical Proof**:
  Tested against Dexie store with fake-indexeddb:
  ```
  State after checking today: { is_completed: true, last_completed_day: '2026-10-18' }
  Simulating app reload on SAME day (triggering useChecklist mount effect: rolloverDailyItems)...
  itemToday after mount rollover: { is_completed: false, last_completed_day: null }
  >>> CRITICAL DEFECT: item checked today was incorrectly reset! <<<
  ```
- **Why Existing Tests Missed This**:
  In `src/hooks/useChecklist.test.tsx:88`, the test only seeded an item completed *yesterday* (`last_completed_day: '2020-01-01'`). There was zero test coverage for opening the app with items already completed *today*. Because all completed items were reset, the yesterday test passed while hiding the destructive wipe of today's completed items.

---

## 2. Logic Chain

1. **Premise**: In Cadence, daily routine items completed today must remain completed throughout the logical day, surviving app reloads and restarts (R1, Acceptance Criteria: *"Persistence & offline: data survives reload. With the network disabled, all actions work and survive reload."*).
2. **Observation**: `useChecklist` executes `checklistRepository.rolloverDailyItems(currentLogicalDay)` on mount.
3. **Observation**: In `src/db/repository.ts:274-304`, `rolloverDailyItems` takes `_newLogicalDay` as an unused parameter and resets all daily items where `is_completed === true`.
4. **Deduction**: Whenever a user reloads or re-opens the app on the same day, `rolloverDailyItems` resets all items completed today to `is_completed: false, last_completed_day: null`.
5. **Conclusion**: Any daily habit completed by the user is erased the moment the user refreshes or reopens the app on the same day. This is a critical data-loss defect that must be remediated before Milestone 2 can be approved.

---

## 3. Review Findings & Actionable Recommendations

### [Critical] Finding 1: `rolloverDailyItems` unconditionally wipes today's completed habits on app reload / startup reconciliation
- **Where**: `src/db/repository.ts:274-282`
- **Why**: `rolloverDailyItems` ignores the passed `newLogicalDay` argument and queries `db.checklist_items.filter((item) => item.list_type !== 'work' && item.deleted_at === null && item.is_completed)`. When invoked on app startup via `useChecklist`'s mount `useEffect`, it resets habits completed *today* back to incomplete, causing 100% data loss of same-day habit completions upon page reload.
- **Actionable Fix**:
  In `src/db/repository.ts:274-282`, use `newLogicalDay` and filter only for items that were completed on a *different* day (`last_completed_day !== newLogicalDay`):
  ```ts
  /**
   * Executes daily rollover reset in local store:
   * Sets is_completed = false on active Today section items whose last_completed_day is not newLogicalDay.
   */
  async rolloverDailyItems(newLogicalDay: string): Promise<number> {
    const now = lamportClock.now();

    return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
      const dailyItems = await db.checklist_items
        .filter(
          (item) =>
            item.list_type !== 'work' &&
            item.deleted_at === null &&
            item.is_completed &&
            item.last_completed_day !== newLogicalDay
        )
        .toArray();

      if (dailyItems.length === 0) return 0;

      for (const item of dailyItems) {
        const resetItem: ChecklistItem = {
          ...item,
          is_completed: false,
          completed_at: null,
          last_completed_day: null,
          updated_at: now,
        };
        await db.checklist_items.put(resetItem);
        await db.outbox_mutations.add({
          table_name: 'checklist_items',
          record_id: item.id,
          action: 'upsert',
          payload: resetItem,
          timestamp: Date.now(),
          retry_count: 0,
        });
      }

      return dailyItems.length;
    });
  },
  ```
- **Required Test Additions**:
  1. In `src/db/repository.test.ts`:
     Add a test asserting that `rolloverDailyItems(today)` preserves items where `last_completed_day === today` while resetting items where `last_completed_day !== today`.
  2. In `src/hooks/useChecklist.test.tsx`:
     Add a test asserting that mounting `useChecklist` with a habit completed today retains `is_completed: true` in both the hook output and IndexedDB.

---

## 4. Adversarial Challenge Report

### Overall Risk Assessment: HIGH

| Challenge | Dimension | Assumption Challenged | Attack Scenario | Blast Radius | Mitigation | Status |
|-----------|-----------|------------------------|-----------------|--------------|------------|--------|
| **C1** | Data Persistence & Reload | Completed daily items persist across app reload on the same day | User checks habits at 8:00 AM on Oct 18. Closes app. Reopens at 10:00 AM on Oct 18. `useChecklist` mount effect calls `rolloverDailyItems('2026-10-18')`. | 100% loss of same-day completed habits on reload; outbox push resets remote state. | Add `item.last_completed_day !== newLogicalDay` filter to `rolloverDailyItems`. | **CONFIRMED CRITICAL DEFECT** |
| **C2** | Edge Case Mining | `toggleItem` works across days without swallowing clicks | User completes habit on Oct 17. Opens Oct 18. Clicks habit to complete it. | First tap fails if evaluating raw DB boolean. | Verified: `toggleItem` correctly evaluates `!isItemCheckedToday(existing, currentLogicalDay)`. | **PASS (Resolved)** |
| **C3** | Concurrency / Sort Order | Fractional indexing under equal bounds `prevOrder === nextOrder` | Two items have identical order (1000.0, 1000.0). | Duplicate sort index collision. | Verified: returns `prevOrder + 1.0` (1001.0). | **PASS (Resolved)** |
| **C4** | Convergence / Commutativity | LWW resolution with identical timestamps and identical tie-breaker strings | Device A and Device B sync entities with identical timestamp and identical `tieBreaker` string. | Non-deterministic winner or split-brain divergence. | Verified: tertiary comparison `JSON.stringify(remote).localeCompare(...)` guarantees commutativity. | **PASS (Resolved)** |

---

## 5. Caveats

- No caveats. The issue was isolated, traced through both static analysis and dynamic empirical execution against IndexedDB, and verified to be a regression introduced when hooking `rolloverDailyItems` into `useChecklist`'s mount lifecycle without adding the day-filter condition.

---

## 6. Conclusion

While `worker_m2_remediate` successfully resolved the single-tap toggle bug, fractional sort collisions, and LWW tie-breaker commutativity, the addition of the startup rollover effect in `useChecklist` (`useEffect(() => checklistRepository.rolloverDailyItems(currentLogicalDay), [currentLogicalDay])`) introduced a **Critical Data Loss Defect**: `rolloverDailyItems` unconditionally wipes all completed habits on mount even when completed on the current logical day.

**Verdict**: `REQUEST_CHANGES`

---

## 7. Verification Method

1. Run the test verifying reload data loss:
   Seed an item with `last_completed_day === today` and `is_completed: true`. Call `checklistRepository.rolloverDailyItems(today)`.
   Invalidation condition: `item.is_completed` becomes `false`.
2. Run standard suite:
   ```powershell
   npm test
   npm run typecheck
   npm run lint
   npm run build
   ```
