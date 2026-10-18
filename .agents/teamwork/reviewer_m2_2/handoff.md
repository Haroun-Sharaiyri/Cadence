# Milestone 2 Independent Review & Adversarial Challenge Report

**Reviewer**: `reviewer_m2_2`  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### Verification Commands Executed
1. `npm test`:
   - Command: `vitest run`
   - Output: `10 test files passed (10)`, `60 passed (60)`. Duration: 6.51s.
2. `npm run typecheck`:
   - Command: `tsc -b --noEmit`
   - Output: Exited with code 0. Zero type errors.
3. `npm run lint`:
   - Command: `eslint .`
   - Output: Exited with code 0 (0 errors, 2 warnings in `tests/m1-stress.spec.ts` for `@typescript-eslint/no-explicit-any`).
4. `npm run build`:
   - Command: `tsc -b && vite build`
   - Output: Exited with code 0 in 5.54s. Generated bundle: `dist/assets/index-BbkbOo72.js` (69.87 kB gzipped).

### Code Inspection Observations
1. **Integrity Violations Check**:
   - Inspected `src/db/index.ts`, `src/db/repository.ts`, `src/hooks/useRollover.ts`, `src/hooks/useChecklist.ts`, `src/domain/types.ts`, `src/domain/rollover.ts`, `src/domain/countdown.ts`, and `src/domain/lww.ts`.
   - Verified that no hardcoded test outputs or facade implementations exist. The Dexie database commits to actual IndexedDB tables, transactions are genuine, the Lamport clock implements real monotonicity, and conflict resolution implements real LWW logic.
   - **Finding**: Zero integrity violations.

2. **Dexie Database Schema & Transactions (`src/db/index.ts` & `src/db/repository.ts`)**:
   - `src/db/index.ts:17-22`:
     ```ts
     this.version(1).stores({
       checklist_items: 'id, user_id, list_type, sort_order, is_completed, last_completed_day, updated_at, deleted_at',
       goals: 'id, user_id, updated_at, deleted_at',
       user_settings: 'user_id, rollover_hour, updated_at',
       outbox_mutations: '++id, table_name, record_id, timestamp',
     });
     ```
   - Primary keys (`id`, `user_id`, `++id`) and indexed fields match the project requirements.
   - All mutating operations (`addItem`, `toggleItem`, `renameItem`, `reorderItem`, `softDeleteItem`, `clearCompletedWorkItems`, `rolloverDailyItems`, `upsertGoal`, `updateUserSettings`) are wrapped in `await db.transaction('rw', [table, db.outbox_mutations], async () => { ... })`.
   - Soft-delete semantics correctly set `deleted_at = now`, `updated_at = now`, and enqueue an outbox mutation with `action: 'delete'`.

3. **Critical Defect Observed: `toggleItem` across rollover / offline gap (`src/db/repository.ts:108`)**:
   - In `src/db/repository.ts:104-120`:
     ```ts
     return await db.transaction('rw', [db.checklist_items, db.outbox_mutations], async () => {
       const existing = await db.checklist_items.get(id);
       if (!existing || existing.deleted_at !== null) return null;

       const isCompleted = !existing.is_completed;
       const updated: ChecklistItem = {
         ...existing,
         is_completed: isCompleted,
         completed_at: isCompleted ? now : null,
         last_completed_day: isCompleted
           ? existing.list_type === 'work'
             ? null
             : currentLogicalDay
           : null,
         updated_at: now,
       };
     ```
   - Notice line 108: `const isCompleted = !existing.is_completed;`.
   - Notice that `existing.is_completed` is the raw boolean stored in the database, NOT the effective completion status for `currentLogicalDay`.
   - In `src/domain/rollover.ts:36-44`, the authoritative logic is:
     ```ts
     export function isItemCheckedToday(item: ChecklistItem, logicalDay: string): boolean {
       if (item.list_type === 'work') {
         return item.is_completed;
       }
       return item.is_completed && item.last_completed_day === logicalDay;
     }
     ```
   - When an item was completed on day $D_1$ (`is_completed: true`, `last_completed_day: D_1`), and the user opens the app on day $D_2$ (or after an offline gap), the UI uses `isItemCheckedToday(item, D_2)` which evaluates to `false`. The checkbox appears UNCHECKED to the user.
   - When the user taps the checkbox to check it off for day $D_2$, `toggleItem(item.id, D_2)` evaluates `const isCompleted = !existing.is_completed`, which evaluates to `!true = false`!
   - Consequently, `updated.is_completed` becomes `false` and `updated.last_completed_day` becomes `null`.
   - In the UI, the item was unchecked before the click, and remains unchecked after the click! The user's action was completely dropped/swallowed, requiring a second click to actually mark it checked.
   - **Empirical Proof**: Executed `.agents/teamwork/reviewer_m2_2/reproduce_toggle_bug.mjs`:
     ```
     UI display state (isItemCheckedToday): false
     New isCompleted calculated by repository.ts: false
     UI display state after first click: false
     >>> BUG CONFIRMED: Clicking unchecked item did NOT check it! <<<
     ```

4. **Major Defect Observed: `useChecklist` lack of initial startup rollover reconciliation & raw item property leakage (`src/hooks/useChecklist.ts:58-80`, `src/hooks/useRollover.ts:26-60`)**:
   - In `src/hooks/useRollover.ts:26-28`:
     ```ts
     const [currentLogicalDay, setCurrentLogicalDay] = useState<string>(() =>
       getLogicalDay(new Date(), rolloverHour)
     );
     ```
   - In `src/hooks/useRollover.ts:56-60`:
     ```ts
     const now = new Date();
     const evaluatedDay = getLogicalDay(now, rolloverHour);

     if (evaluatedDay !== currentLogicalDay) {
       executeRollover(evaluatedDay);
     }
     ```
   - On initial mount, `currentLogicalDay` is already initialized to `getLogicalDay(now, rolloverHour)`.
   - Therefore, `evaluatedDay !== currentLogicalDay` is `false`, and `executeRollover(evaluatedDay)` is NEVER called on startup!
   - Because `executeRollover` is never called on startup, `handleRolloverCascade` -> `checklistRepository.rolloverDailyItems` NEVER runs on app launch!
   - In `src/hooks/useChecklist.ts:58-75`, `morningItems`, `todayWorkItems`, and `eveningItems` are sliced directly from `allItems` (the raw records from IndexedDB) without projecting `is_completed: isItemCheckedToday(item, currentLogicalDay)`.
   - Result: `dayProgress` and `morningProgress` evaluate to 0% (because they use `isItemCheckedToday`), while the raw `item.is_completed` property on the items remains `true` from yesterday. Any UI component consuming `item.is_completed` directly will suffer split-brain inconsistency with the section progress ring!
   - **Empirical Proof**: Executed `.agents/teamwork/reviewer_m2_2/test_usechecklist_gap.mjs`:
     ```
     dbItem.is_completed raw property: true
     isItemCheckedToday(dbItem, currentLogicalDay): false
     Discrepancy: true
     ```

5. **Minor Defect Observed: Fractional Indexing collision on identical bounds (`src/db/repository.ts:14-28`)**:
   - In `calculateNewSortOrder(prevOrder, nextOrder)`:
     If `prevOrder === nextOrder`, `(prevOrder + nextOrder) / 2 === prevOrder`, which generates a duplicate sort order.

---

## 2. Logic Chain

1. **Premise**: In an offline-first daily checklist app, the single most critical user workflow is opening the app each morning and checking off morning habits.
2. **Observation**: A daily routine item checked on day $D_1$ retains `is_completed = true` and `last_completed_day = D_1` in IndexedDB.
3. **Observation**: When opened on day $D_2$, `isItemCheckedToday(item, D_2)` returns `false`. The UI correctly displays the habit as unchecked.
4. **Observation**: When the user taps the checkbox, the UI invokes `toggleItem(item.id, currentLogicalDay)`.
5. **Observation**: In `src/db/repository.ts:108`, `toggleItem` calculates `const isCompleted = !existing.is_completed;`. Because `existing.is_completed` was `true`, `isCompleted` becomes `false`.
6. **Deduction**: The database record is updated to `is_completed = false, last_completed_day = null`. In the UI, the item was unchecked before the tap and remains unchecked after the tap.
7. **Conclusion**: The user's tap fails to check off the item. The user is forced to tap a second time. This is a severe functional regression in the core checklist loop.
8. **Solution**: `toggleItem` must compute `isCompleted = !isItemCheckedToday(existing, currentLogicalDay)`. Additionally, `useChecklist` should project `is_completed: isItemCheckedToday(item, currentLogicalDay)` on Today routine items and reconcile unrolled daily items on startup.

---

## 3. Review Findings & Actionable Recommendations

### [Critical] Finding 1: `toggleItem` ignores logical day and drops user taps on morning habits
- **Where**: `src/db/repository.ts:108`
- **Why**: `toggleItem` calculates new completion using `!existing.is_completed` instead of checking if the item is currently completed for today (`!isItemCheckedToday(existing, currentLogicalDay)`). Any item completed on a previous logical day requires two taps to check off on a new day.
- **Suggestion**:
  ```ts
  import { isItemCheckedToday } from '../domain/rollover';
  // ...
  const currentlyCompleted = isItemCheckedToday(existing, currentLogicalDay);
  const isCompleted = !currentlyCompleted;
  ```

### [Major] Finding 2: `useChecklist` leaks raw `is_completed` and misses startup rollover reconciliation
- **Where**: `src/hooks/useChecklist.ts:58-75`, `src/hooks/useRollover.ts:56-60`
- **Why**: When launching the app on a new day (offline gap), `useRollover` does not fire `onRollover` because `currentLogicalDay` is already initialized to the new day. Consequently, `rolloverDailyItems` never runs in IndexedDB. Because `morningItems`, `todayWorkItems`, and `eveningItems` pass through raw `ChecklistItem` objects where `item.is_completed` is still `true`, UI components reading `item.is_completed` will disagree with `progress` rings (which read `isItemCheckedToday`).
- **Suggestion**:
  1. In `src/hooks/useChecklist.ts`, normalize items for daily sections:
     ```ts
     const normalizeItem = (item: ChecklistItem): ChecklistItem => ({
       ...item,
       is_completed: isItemCheckedToday(item, currentLogicalDay),
     });
     ```
  2. In `src/hooks/useChecklist.ts`, trigger a reconciliation sweep on mount:
     ```ts
     useEffect(() => {
       checklistRepository.rolloverDailyItems(currentLogicalDay);
     }, [currentLogicalDay]);
     ```
     Or ensure `rolloverDailyItems` resets any daily items where `last_completed_day !== currentLogicalDay`.

### [Minor] Finding 3: Fractional sort order collision when `prevOrder === nextOrder`
- **Where**: `src/db/repository.ts:27`
- **Why**: If two items share identical sort orders (e.g. from imported data or concurrent adds), `(prevOrder + nextOrder) / 2` returns `prevOrder`, causing index collision.
- **Suggestion**: Add a small offset if `prevOrder >= nextOrder`:
  ```ts
  if (prevOrder !== null && nextOrder !== null) {
    if (prevOrder >= nextOrder) {
      return prevOrder + 1.0;
    }
    return (prevOrder + nextOrder) / 2.0;
  }
  ```

---

## 4. Adversarial Challenge Report

### Overall Risk Assessment: HIGH

| Challenge | Dimension | Assumption Challenged | Attack Scenario | Blast Radius | Mitigation | Status |
|-----------|-----------|------------------------|-----------------|--------------|------------|--------|
| **C1** | Edge Case Mining | `toggleItem` works across days | User completes habits on Oct 17. Closes app. Opens Oct 18. Clicks habit to complete it. | First tap fails to check habit; tap is swallowed. Requires 2 taps. | Calculate `isCompleted = !isItemCheckedToday(existing, currentLogicalDay)` in `toggleItem`. | **CONFIRMED DEFECT** |
| **C2** | State Sync | `item.is_completed` matches section progress | App opened after 24h offline gap. Section progress ring shows 0%, but raw items have `is_completed: true`. | Split-brain UI state between progress rings and checkbox rows. | Normalize item lists with `isItemCheckedToday` in `useChecklist`. | **CONFIRMED DEFECT** |
| **C3** | Resource / Timer | JavaScript `setTimeout` 32-bit limit | Rollover scheduled 24 hours in future. | `msRemaining` could exceed 32-bit signed int ($2^{31}-1 \approx 24.8$ days). | Evaluated: Max delay is 24h = 86.4M ms, well below 2.14B ms. | **PASS (Safe)** |
| **C4** | Concurrency | Lamport clock under burst load | 1,000 rapid calls within 1ms. | Duplicate timestamps or clock drift. | Evaluated: Verified strictly increasing timestamps over 1,000 rapid calls. | **PASS (Robust)** |
| **C5** | Storage Integrity | Outbox mutation atomicity | Crash or abort during item mutation. | Record saved in Dexie but outbox entry missing. | Evaluated: All mutations use `db.transaction('rw', [table, db.outbox_mutations])`. | **PASS (Robust)** |

---

## 5. Caveats
- No caveats. All domain calculations, Dexie database tables, repository mutations, and React hooks were directly inspected and verified against the authoritative user request and architectural specifications.

---

## 6. Conclusion
The foundation of Milestone 2 is well-structured: Dexie schemas, Lamport clocks, deterministic LWW resolution, and calendar arithmetic algorithms are properly implemented.
However, a **Critical Finding** exists in `checklistRepository.toggleItem` (line 108) where toggling an item inverts the raw database boolean rather than `isItemCheckedToday`, causing checkboxes to swallow user taps after a rollover or offline gap. Coupled with the lack of startup rollover reconciliation in `useChecklist`, this breaks core checklist functionality.

**Verdict**: `REQUEST_CHANGES`

---

## 7. Verification Method
To independently reproduce and verify:
1. Run `.agents/teamwork/reviewer_m2_2/reproduce_toggle_bug.mjs`:
   ```powershell
   npx tsx .agents/teamwork/reviewer_m2_2/reproduce_toggle_bug.mjs
   ```
   Observes `>>> BUG CONFIRMED: Clicking unchecked item did NOT check it! <<<`.
2. Run standard suite:
   ```powershell
   npm test
   npm run typecheck
   npm run lint
   npm run build
   ```
