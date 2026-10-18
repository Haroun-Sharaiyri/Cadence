# Milestone 2 Remediation Report (Iteration 2)

**Worker**: `worker_m2_remediate_2`  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Milestone**: Milestone 2: Checklist Domain, Offline Store & Rollover Engine  
**Status**: `COMPLETE`

---

## 1. Observation

### 1.1 Remediation Context
The Reviewer Gate (Iteration 2) identified a Critical Data Loss Defect in `checklistRepository.rolloverDailyItems`:
- In `src/db/repository.ts:274`, the function signature had an unused parameter `_newLogicalDay: string`.
- In `src/db/repository.ts:279`, the Dexie filter queried:
  `filter((item) => item.list_type !== 'work' && item.deleted_at === null && item.is_completed)`
  This unconditionally matched all completed routine items across all days, including habits completed on the current day.
- When `useChecklist` mounted on application startup or page reload, it ran:
  `useEffect(() => { checklistRepository.rolloverDailyItems(currentLogicalDay); }, [currentLogicalDay]);`
  This wiped all habits completed today back to `is_completed: false, last_completed_day: null` and enqueued an outbox mutation pushing the reset to Supabase.

### 1.2 Code Modifications Made

1. **`src/db/repository.ts`**:
   - Updated `rolloverDailyItems` signature from `_newLogicalDay: string` to `newLogicalDay: string`.
   - Updated Dexie query filter to strictly target routine items whose `last_completed_day !== newLogicalDay`:
     ```ts
     const dailyItems = await db.checklist_items
       .filter(
         (item) =>
           item.list_type !== 'work' &&
           item.deleted_at === null &&
           item.is_completed &&
           item.last_completed_day !== newLogicalDay
       )
       .toArray();
     ```
   - Items completed on `newLogicalDay` are preserved in `is_completed: true` state without being overwritten or enqueued for outbox reset.

2. **`src/db/repository.test.ts`**:
   - Added unit test:
     `'preserves daily items completed on the current logical day while resetting older items'`
   - Asserts that when two items are toggled (one yesterday `'2026-10-17'` and one today `'2026-10-18'`), invoking `rolloverDailyItems('2026-10-18')`:
     - Resets only the yesterday item (`is_completed: false`, `last_completed_day: null`).
     - Preserves today's item (`is_completed: true`, `last_completed_day: '2026-10-18'`).
     - Leaves work items completed.
     - Returns `resetCount === 1`.

3. **`src/hooks/useChecklist.test.tsx`**:
   - Imported `getLogicalDay` from `'../domain/rollover'`.
   - Added unit test:
     `'preserves daily routine items completed today on mount/reload'`
   - Seeds an item completed today in IndexedDB with `last_completed_day: today` and `is_completed: true`.
   - Mounts `useChecklist` via React root render.
   - Asserts that `hookResult.morningItems[0].is_completed === true` and `morningProgress.completed === 1`.
   - Asserts that IndexedDB record remains `is_completed: true` and `last_completed_day: today` after mount rollover reconciliation executes.

---

### 1.3 Verbatim Verification Outputs

#### 1. `npm test` (`vitest run`)
```
> cadence@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/shqai/Downloads/Repo/Checklist

 ✓ src/utils/time.test.ts (3 tests) 97ms
 ✓ src/domain/lww.test.ts (10 tests) 310ms
 ✓ src/hooks/useMediaQuery.test.tsx (2 tests) 96ms
 ✓ src/hooks/useRollover.test.tsx (2 tests) 103ms
 ✓ src/db/repository.test.ts (18 tests) 428ms
stdout | src/test/empirical-m2.test.ts > Empirical Adversarial Stress Tests: Milestone 2 > 1. Monotonic LamportClock Strict Monotonicity & Burst Stress > generates 10,000 timestamps in rapid succession and asserts strict monotonic increase
[LamportClock] Generated 10000 timestamps in 53.07ms

 ✓ src/hooks/useChecklist.test.tsx (4 tests) 1710ms
   ✓ useChecklist hook > normalizes daily routine items completed yesterday to unchecked and triggers startup rollover reconciliation  745ms
   ✓ useChecklist hook > preserves daily routine items completed today on mount/reload  655ms
 ✓ src/domain/rollover-adversarial.test.ts (22 tests) 34ms
stdout | src/test/empirical-m2.test.ts > Empirical Adversarial Stress Tests: Milestone 2 > 2. Deterministic LWW Commutativity and Associativity Fuzz Testing > proves commutativity across 5,000 randomized pairs with distinct device tie-breakers
[LWW Fuzz] Successfully proved commutativity across 5000 random pairs with distinct device IDs

 ✓ src/domain/rollover.test.ts (14 tests) 16ms
 ✓ src/utils/haptics.test.ts (2 tests) 9ms
 ✓ src/domain/countdown.test.ts (8 tests) 12ms
stdout | src/test/empirical-m2.test.ts > Empirical Adversarial Stress Tests: Milestone 2 > 2. Deterministic LWW Commutativity and Associativity Fuzz Testing > proves commutativity across 5,000 randomized pairs when tie-breakers are omitted (intrinsic JSON hash comparison)
[LWW Fuzz] Successfully proved intrinsic commutativity across 5000 random pairs

 ✓ src/utils/motion.test.ts (3 tests) 11ms
stdout | src/test/empirical-m2.test.ts > Empirical Adversarial Stress Tests: Milestone 2 > 2. Deterministic LWW Commutativity and Associativity Fuzz Testing > proves commutativity even when tie-breaker strings are identical across 2,000 randomized pairs
[LWW Fuzz] Successfully proved commutativity across 2000 pairs with identical tie-breakers

stdout | src/test/empirical-m2.test.ts > Empirical Adversarial Stress Tests: Milestone 2 > 2. Deterministic LWW Commutativity and Associativity Fuzz Testing > proves associativity across 2,000 random triples and 6-permutation convergence
[LWW Fuzz] Successfully proved associativity and 6-permutation convergence across 2000 random triples

 ✓ src/test/empirical-m2.test.ts (12 tests) 4131ms

 Test Files  12 passed (12)
      Tests  100 passed (100)
   Start at  11:29:58
   Duration  8.28s (transform 1.10s, setup 2.04s, collect 3.94s, tests 6.96s, environment 21.52s, prepare 5.36s)
```

#### 2. `npm run typecheck` (`tsc -b --noEmit`)
```
> cadence@1.0.0 typecheck
> tsc -b --noEmit
```
(Exit code 0, zero errors)

#### 3. `npm run lint` (`eslint .`)
```
> cadence@1.0.0 lint
> eslint .

C:\Users\shqai\Downloads\Repo\Checklist\tests\m1-stress.spec.ts
  236:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  237:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 2 problems (0 errors, 2 warnings)
```
(Exit code 0, 0 errors)

#### 4. `npm run build` (`tsc -b && vite build`)
```
> cadence@1.0.0 build
> tsc -b && vite build

vite v6.4.4 building for production...
transforming...
✓ 2001 modules transformed.
Generated an empty chunk: "vendor-supabase".
rendering chunks...
computing gzip size...
dist/index.html                            2.98 kB │ gzip:  1.12 kB
dist/assets/index-CfYpRZA0.css            24.87 kB │ gzip:  5.29 kB
dist/assets/vendor-supabase-iCrOwI5K.js    0.05 kB │ gzip:  0.07 kB │ map:     0.11 kB
dist/assets/vendor-db-CC3wc2FY.js          0.08 kB │ gzip:  0.10 kB │ map:     0.10 kB
dist/assets/vendor-icons-CZBVk_ak.js       4.02 kB │ gzip:  1.35 kB │ map:    10.22 kB
dist/assets/vendor-react-C5IccjTL.js       4.27 kB │ gzip:  1.61 kB │ map:    13.98 kB
dist/assets/vendor-motion-CjuagMs_.js    140.34 kB │ gzip: 46.54 kB │ map:   773.73 kB
dist/assets/index-BbkbOo72.js            224.83 kB │ gzip: 69.87 kB │ map: 1,049.89 kB
✓ built in 6.76s
```
(Exit code 0, production build completed in 6.76s, bundle gzip 69.87 kB <= 220 kB budget)

---

## 2. Logic Chain

1. **Defect Mechanism**:
   - In `checklistRepository.rolloverDailyItems`, completed items were queried with `item.list_type !== 'work' && item.deleted_at === null && item.is_completed`.
   - The parameter `_newLogicalDay` was prefixed with an underscore and never evaluated against `item.last_completed_day`.
   - Consequently, any invocation of `rolloverDailyItems` unconditionally set `is_completed = false` and `last_completed_day = null` on all routine checklist items, regardless of whether they were completed today or on a prior day.
   - Because `useChecklist` invokes `rolloverDailyItems(currentLogicalDay)` on component mount, any app launch or page reload immediately erased the user's completed habits for today.

2. **Remediation**:
   - By adding `item.last_completed_day !== newLogicalDay` to the Dexie filter query, any item already completed for `newLogicalDay` is excluded from the reset batch.
   - Only items with missing `last_completed_day` or a `last_completed_day` from previous calendar days are reset to incomplete and queued for sync.
   - When the user opens or reloads the app on the same day, `rolloverDailyItems` finds 0 items needing reset and returns 0 without touching today's records.

3. **Validation & Coverage**:
   - In `src/db/repository.test.ts`, the new test verifies that `rolloverDailyItems('2026-10-18')` explicitly preserves items where `last_completed_day === '2026-10-18'` while resetting those from `'2026-10-17'`.
   - In `src/hooks/useChecklist.test.tsx`, the new test verifies that mounting `useChecklist` with a habit completed today retains `is_completed: true` in the reactive UI output and in IndexedDB.
   - Full test suite passed (100/100 tests across 12 test suites).

---

## 3. Caveats

No caveats. The fix is minimal, precise, directly addresses the root cause, and introduces no regressions.

---

## 4. Conclusion

The Critical Data Loss Defect in `checklistRepository.rolloverDailyItems` has been completely resolved. Habits completed today now reliably persist across page reloads and app restarts, satisfying all offline persistence and daily rollover requirements. All 100 tests pass, and TypeScript typechecking, ESLint, and production Vite builds execute with zero errors.

---

## 5. Verification Method

To independently verify this remediation:
1. Run all unit and stress tests:
   ```powershell
   npm test
   ```
2. Run TypeScript strict typecheck:
   ```powershell
   npm run typecheck
   ```
3. Run ESLint:
   ```powershell
   npm run lint
   ```
4. Run production build:
   ```powershell
   npm run build
   ```
5. Inspect the following specific tests:
   - `src/db/repository.test.ts` -> `'preserves daily items completed on the current logical day while resetting older items'`
   - `src/hooks/useChecklist.test.tsx` -> `'preserves daily routine items completed today on mount/reload'`
