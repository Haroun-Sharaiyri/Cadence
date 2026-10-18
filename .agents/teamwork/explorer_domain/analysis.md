# Cadence — Domain Logic, Testing Architecture & Quality Budgets Specification

**Author**: `explorer_domain` (Specialist Domain & Testing Explorer)  
**Date**: 2026-10-17  
**Status**: Authoritative Domain & Test Specification  
**Integrates With**: `spec_miner_ui` (UI/Design Tokens) & `spec_miner_sync` (Supabase/Sync)

---

## Executive Summary

Cadence is an ultra-premium, single-purpose checklist Progressive Web Application (PWA) built to feel indistinguishable from a first-party Apple iOS 26 app on an iPhone 17 Air (420×912 pt viewport) and desktop (1440×900). This document formalizes:
1. **The Core Domain State & Algorithms**: Mathematical derivation of the 4:00 AM user-adjustable daily rollover without cron jobs, the 3 Today sections, the persistent Work tab, the Goal hero card countdown mechanics, native Edit mode, progress rings, and the minimalist settings sheet.
2. **The Testing & Quality Architecture**: Complete specifications for Vitest unit test suites (rollover edge cases, DST transitions, deterministic sync conflict resolution, delete propagation, offline outbox replay) and Playwright multi-tier E2E testing (WebKit and Chromium, iPhone 17 Air and Desktop).
3. **Automated Quality Budgets & Apple HIG Review Protocol**: Precise thresholds for Lighthouse CI, axe-core 0-violation accessibility, CLS < 0.02, initial JS bundle <= 220 KB gzipped, and the 12-item Apple HIG evaluation protocol with automated screenshot pipeline.

---

## 1. Domain Logic & State Mechanics

### 1.1 Checklist Architecture & Tab Topology

Cadence manages two distinct list types:
1. **Today (Daily Reset List)**: Contains exactly three sequential sections:
   - `today_morning`: Morning Routine
   - `today_work`: Work Day
   - `today_evening`: Evening Routine
   - *Invariants*: Items persist indefinitely across days. Only their completion state resets daily at the configured rollover time.
2. **Work (Persistent Side List)**:
   - `work`: Side checklist for persistent work tasks.
   - *Invariants*: Items do NOT reset at the rollover boundary. Checked items stay in place, struck through and dimmed, until explicitly deleted or bulk-cleared via "Clear Completed".

### 1.2 The Daily Rollover Algorithm: `localDate(now - rolloverHour)`

#### Mathematical Definition of Logical Day
Rather than relying on a fragile server-side cron or background daemon that fails when a device is offline or asleep, Cadence derives the **Logical Day** deterministically from the client's local wall-clock time and the user's `rollover_hour` setting.

Let:
- $t$: The current local wall-clock timestamp (milliseconds since Unix epoch).
- $H_{\text{rollover}} \in \{0, 1, 2, \dots, 23\}$: The user-configured rollover hour (default = 4).
- $D(t)$: The local date object corresponding to $t$.
- $L(t, H_{\text{rollover}})$: The logical date string formatted as `YYYY-MM-DD`.

The formula is:
$$L(t, H_{\text{rollover}}) = \text{formatDate}(\text{localDate}(t - H_{\text{rollover}} \times 3,600,000))$$

More precisely in local calendar arithmetic:
```ts
/**
 * Computes the logical day key (YYYY-MM-DD) for any timestamp and rollover hour.
 * Adjusts local wall-clock hours by subtracting rolloverHour.
 * Late night times (e.g., 03:59:59 with rolloverHour=4) evaluate to the previous calendar day.
 */
export function getLogicalDay(
  date: Date = new Date(),
  rolloverHour: number = 4
): string {
  // Clone date to prevent mutation of the input
  const d = new Date(date.getTime());
  
  // Subtract rolloverHour in local time coordinates
  d.setHours(d.getHours() - rolloverHour);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
```

#### Truth Table: 4:00 AM Default Boundary

| Local Time | Calendar Date | $H_{\text{rollover}}$ | Evaluated Date Calculation | Logical Day Key | State for Day 2026-10-17 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-10-18 03:59:58` | Oct 18, 2026 | 4 | `03:59 - 4h = 23:59 (Oct 17)` | `2026-10-17` | **Checked items remain CHECKED** |
| `2026-10-18 03:59:59` | Oct 18, 2026 | 4 | `03:59 - 4h = 23:59 (Oct 17)` | `2026-10-17` | **Checked items remain CHECKED** |
| `2026-10-18 04:00:00` | Oct 18, 2026 | 4 | `04:00 - 4h = 00:00 (Oct 18)` | `2026-10-18` | **Items reset to UNCHECKED** |
| `2026-10-18 04:00:01` | Oct 18, 2026 | 4 | `04:00 - 4h = 00:00 (Oct 18)` | `2026-10-18` | **Items remain UNCHECKED** |

#### Custom Rollover Hour Edge Cases

1. **Midnight Rollover ($H_{\text{rollover}} = 0$)**:
   - `23:59:59`: $23 - 0 = 23 \rightarrow$ Day $N$.
   - `00:00:00`: $00 - 0 = 0 \rightarrow$ Day $N+1$.
   - Behavior matches standard calendar day rollover.
2. **Late Evening Rollover ($H_{\text{rollover}} = 23$)**:
   - `22:59:59`: $22 - 23 = -1 \rightarrow$ Day $N-1$ at 23:59.
   - `23:00:00`: $23 - 23 = 0 \rightarrow$ Day $N$ at 00:00.
   - Rollover triggers every evening at 11:00 PM.

#### Handling Daylight Saving Time (DST) Transitions
DST clock shifts present potential pitfalls for fixed-duration millisecond arithmetic. By anchoring the calculation on local `Date.prototype.setHours()` and local component accessors (`getFullYear`, `getMonth`, `getDate`), the logical day respects local civil time:

1. **Spring Forward (23-Hour Day, e.g. 01:59 AM jumps to 03:00 AM)**:
   - 01:59 AM local: `setHours(1 - 4)` rolls back to 21:59 of prior day $\rightarrow$ Prior day.
   - 03:00 AM local: `setHours(3 - 4)` rolls back to 23:00 of prior day $\rightarrow$ Prior day.
   - 03:59 AM local: `setHours(3 - 4)` rolls back to 23:59 of prior day $\rightarrow$ Prior day.
   - 04:00 AM local: `setHours(4 - 4)` evaluates to 00:00 of current day $\rightarrow$ New day uncheck triggers on time at 04:00 AM.
2. **Fall Back (25-Hour Day, e.g. 01:59 AM repeats 01:00 AM)**:
   - First 01:30 AM local: `setHours(1 - 4)` $\rightarrow$ Prior day.
   - Second 01:30 AM local: `setHours(1 - 4)` $\rightarrow$ Prior day.
   - 03:59 AM local: `setHours(3 - 4)` $\rightarrow$ Prior day.
   - 04:00 AM local: `setHours(4 - 4)` $\rightarrow$ New day uncheck triggers at 04:00 AM civil time.

#### Completion State Resolution: Declarative vs Live Cascade
To ensure zero data corruption and instant offline correctness:
1. **Item Completion Model**:
   Each `ChecklistItem` entity maintains:
   - `last_completed_day: string | null` (Format: `YYYY-MM-DD`, stored in IndexedDB and Supabase)
   - `is_completed: boolean` (Mirrored for SQL/Sync compatibility)
   
   **Derived Effective Completed Status**:
   ```ts
   export function isItemCheckedToday(
     item: ChecklistItem,
     currentLogicalDay: string
   ): boolean {
     if (item.list_type === 'work') {
       // Persistent list: completion is independent of logical day
       return item.is_completed;
     }
     // Daily list: only checked if completed during the current logical day
     return item.is_completed && item.last_completed_day === currentLogicalDay;
   }
   ```
   *Benefit*: If the user turns off their phone for three days and opens it at noon on Day 4, every daily item immediately renders unchecked without executing any background cron or sync round-trip.

2. **Live Rollover Timer & Gentle Cascade**:
   When the app is open across the 4:00 AM boundary:
   - A client scheduler monitors the time remaining until the next rollover event:
     ```ts
     export function getMillisecondsUntilNextRollover(
       now: Date = new Date(),
       rolloverHour: number = 4
     ): number {
       const next = new Date(now.getTime());
       next.setHours(rolloverHour, 0, 0, 0);
       if (next.getTime() <= now.getTime()) {
         next.setDate(next.getDate() + 1);
       }
       return next.getTime() - now.getTime();
     }
     ```
   - **Heartbeat & Resumption**: Because browser timers are throttled in inactive background tabs or OS sleep states, Cadence runs a 30-second interval heartbeat and listens to `document.addEventListener('visibilitychange')` and `window.addEventListener('focus')`. If `getLogicalDay()` has advanced upon wake, the rollover transition executes immediately.
   - **The Visual Reset Cascade**:
     * If one or more items in the Today sections are checked at rollover time:
     * Cadence triggers a staggered, gentle uncheck sequence:
       - Stagger delay: **45ms** per item from top to bottom.
       - The circular checkbox checkmark stroke animates out, background fill fades from `systemBlue` to transparent.
       - Text strikethrough smoothly retracts and text opacity springs from 0.6 back to 1.0.
       - The section progress rings smoothly animate their SVG stroke offsets back to zero.
       - No page reload, zero layout shift (CLS = 0).
       - Updates local IndexedDB and queues sync mutation with `is_completed = false`, `last_completed_day = null`.

---

### 1.3 Goal Hero Card Specification

The Goal Hero Card is pinned to the top of the Today view (and desktop header).

#### Data Model
```ts
export interface Goal {
  id: string; // UUID v4
  user_id?: string;
  statement: string; // e.g. "Launch Cadence with 100% test pass"
  target_date: string | null; // ISO Date "YYYY-MM-DD" or null
  updated_at: string; // ISO 8601 UTC
  deleted_at: string | null; // Soft delete
}
```

#### Countdown Mechanics
The countdown string is calculated dynamically relative to the current logical day:
```ts
export interface GoalCountdownResult {
  hasTarget: boolean;
  status: 'future' | 'today' | 'overdue' | 'none';
  daysRemaining: number;
  displayText: string;
}

export function computeGoalCountdown(
  targetDateStr: string | null | undefined,
  currentLogicalDay: string
): GoalCountdownResult {
  if (!targetDateStr || targetDateStr.trim() === '') {
    return { hasTarget: false, status: 'none', daysRemaining: 0, displayText: '' };
  }

  // Parse YYYY-MM-DD parts in UTC to avoid timezone shift errors
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const [cY, cM, cD] = currentLogicalDay.split('-').map(Number);

  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const currentUtc = Date.UTC(cY, cM - 1, cD);

  const diffMs = targetUtc - currentUtc;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return {
      hasTarget: true,
      status: 'future',
      daysRemaining: diffDays,
      displayText: `${diffDays} days left`,
    };
  } else if (diffDays === 1) {
    return {
      hasTarget: true,
      status: 'future',
      daysRemaining: 1,
      displayText: '1 day left',
    };
  } else if (diffDays === 0) {
    return {
      hasTarget: true,
      status: 'today',
      daysRemaining: 0,
      displayText: 'Due today',
    };
  } else if (diffDays === -1) {
    return {
      hasTarget: true,
      status: 'overdue',
      daysRemaining: -1,
      displayText: '1 day overdue',
    };
  } else {
    const overdueDays = Math.abs(diffDays);
    return {
      hasTarget: true,
      status: 'overdue',
      daysRemaining: diffDays,
      displayText: `${overdueDays} days overdue`,
    };
  }
}
```

#### Goal Interactions & Bottom Sheet Editor
- **Tapping the Hero Card**: Opens the Goal Bottom Sheet editor with background scale-back (`scale: 0.94`, `border-radius: 16px`).
- **Editor Controls**:
  - Auto-focused multiline statement text field (`font-size: 17px` to prevent Safari zoom).
  - Target Date picker (iOS-styled date input) with a clear button ("Remove Target Date").
  - Done / Save button in sheet navigation bar; automatically persists on sheet dismiss.
- **Visuals**: Continuous-curve squircle (`border-radius: 20px`), subtle glass gradient, quiet blue-to-cyan ambient glow (`box-shadow: 0 8px 32px rgba(0, 122, 255, 0.12), 0 0 16px rgba(50, 173, 230, 0.08)`).

---

### 1.4 Work Tab (Persistent Side Checklist) Specification

The Work tab houses long-running, non-daily tasks.

#### Core Mechanics & Invariants
1. **Completion Behavior**:
   - Tapping an item marks it completed.
   - **Crucial Invariant**: The item **stays in place**. It does NOT jump to the bottom or rearrange the list.
   - Visual transition: Title receives a strike-through line (`text-decoration: line-through`) and fades to secondary label color (`color: var(--color-secondary-label)`).
   - Checkbox renders filled with `systemBlue` and an animated checkmark SVG stroke.
2. **Reordering Across Checked and Unchecked**:
   - Reordering via drag-and-drop is fully supported across any item, regardless of whether it is checked or unchecked.
   - Uses fractional indexing (`sort_order: number`, e.g. double-precision float) to enable $O(1)$ single-record updates on drag release.
3. **Swipe-to-Delete**:
   - On touch/mobile viewports (and pointer drag gestures), swiping an item left reveals a red destructive trash action.
   - Incorporates iOS rubber-banding physics: resistance increases exponentially once pulled beyond 80px.
   - Swiping past 60% of item width or tapping the revealed red delete button triggers deletion.
4. **"Clear Completed" Action**:
   - **Visibility Rule**: Visible **ONLY** if $\sum (\text{items where } \text{is\_completed} = \text{true}) \ge 1$. If 0 items are completed, the button is completely removed from the view.
   - **Confirmation Guard**: Tapping "Clear Completed" never deletes immediately. It displays an iOS action sheet / confirmation dialog:
     * Sheet Title: *"Clear Completed Items?"*
     * Description: *"This will permanently remove X completed items from your Work list."*
     * Destructive Action: *"Clear Completed"* (red font)
     * Cancel Action: *"Cancel"*
   - On confirmation: Marks completed items with `deleted_at = now()`, collapses their row heights with an iOS spring animation, and syncs downstream.

---

### 1.5 Native-Feeling Edit Mode

Cadence provides a first-party iOS Reminders-style Edit Mode for all lists.

#### State Machine & Transition
- Navigation bar displays a top-right action: `"Edit"` (transitions to `"Done"` when active).
- When entering Edit Mode:
  1. Circular checkboxes smoothly slide/fade out to the left.
  2. Red circular minus badges (`-`) slide in on the leading edge.
  3. Reorder handles (hamburger icon with 3 horizontal rules) slide in on the trailing edge.
  4. Content insets adjust seamlessly without layout jumps.
- **Inline Title Rename**:
  - Tapping an item title enters inline editing mode with an active text cursor.
  - Pressing `Enter` commits the rename and blurs.
  - Pressing `Escape` reverts changes.
- **Springy List Reflow**:
  - List items are animated using Framer Motion layout animations (`layout="position"`).
  - Removing an item or reordering triggers a smooth spring reflow (`stiffness: 350, damping: 30`) across sibling items.

---

### 1.6 Progress Feedback & Restrained Completion Moments

#### Section Progress Rings
Each Today section header contains an SVG progress ring:
- Radius: $r = 10\text{px}$, stroke width: $2.5\text{px}$.
- Circumference: $C = 2 \pi r \approx 62.8318\text{px}$.
- Stroke Dashoffset: $\text{offset} = C \times (1 - \frac{\text{completed}}{\text{total}})$.
- Colors:
  - Track: `rgba(120, 120, 128, 0.16)` (light) / `rgba(120, 120, 128, 0.24)` (dark).
  - Progress Stroke: `systemBlue` (`#007AFF` light / `#0A84FF` dark).
  - Transition: CSS / Framer Motion spring transition on stroke-dashoffset.

#### Subtle Completion Moments (Strictly No Confetti)
Apple HIG values restraint, prestige, and quiet satisfaction:
1. **Section Complete** (e.g. all 3 items in Morning Routine checked):
   - The section's progress ring emits a single gentle cyan pulse (`box-shadow: 0 0 12px rgba(50, 173, 230, 0.6)`).
   - A subtle haptic tap is triggered (`navigator.vibrate?.([10])` on supported devices).
   - No audio chimes, no banner popups.
2. **Day Complete** (all items across Morning, Work Day, and Evening checked):
   - The Goal Hero card executes a single, quiet blue-to-cyan ambient shimmer sweep across its glass surface over 1.2s.
   - The 3 progress rings pulse softly in unison.
   - **Strict Negative Constraint**: Absolutely NO confetti, NO cartoon stickers, NO sound horns, NO gamified streak badges.

---

### 1.7 Minimalist Settings Sheet

The Settings sheet is accessible via a gear icon in the navigation bar.

#### Exact Functional Scope
1. **Rollover Hour Selector**:
   - Clean iOS picker or segmented stepper from `0:00` (midnight) to `23:00` (11:00 PM).
   - Display format: Local time string (e.g. `"4:00 AM"`, `"5:00 AM"`). Default: `4:00 AM`.
   - Modifying this setting immediately recalculates the active logical day and updates the scheduled live rollover timer.
2. **User Authentication Status**:
   - If signed in: Displays `"Signed in as [user.email]"` and a red `"Sign Out"` button.
   - If not signed in: Displays `"Not signed in (Local mode)"` with a `"Sign In with Email"` action button.
3. **Zero Extra Features Guard**:
   - Specifically excluded: No streak trackers, no analytics graphs, no historical logs, no notification toggles, no custom theme pickers, no cloud storage tier upsells.

---

## 2. Quality Budgets & Testing Architecture

### 2.1 Testing Pyramid Overview

```
              ┌────────────────────────┐
              │ Apple HIG 12-Item Review│  (Independent Agent Judge)
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  Automated Quality     │  (Lighthouse CI >=90/95/95, axe-core 0 violations,
              │  Budgets & CI Gates    │   CLS < 0.02, Bundle <= 220 KB gzipped)
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  Playwright E2E Tests  │  (WebKit & Chromium, iPhone 17 Air 420x912 + Desktop)
              │  Tiers 1, 2, 3, 4      │  (>=5 cases/feature, boundaries, multi-context sync)
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   Vitest Unit Tests    │  (Rollover logic, DST transitions, LWW conflict resolution,
              │                        │   soft delete propagation, offline queue replay)
              └────────────────────────┘
```

---

### 2.2 Vitest Unit Testing Specification

Vitest is configured for blazing-fast, isolated domain logic testing with `@testing-library/react` and mocked system clocks.

#### Test Suite 1: Rollover Logic & Edge Cases (`rollover.test.ts`)
- **TC-ROLL-01: Default 4:00 AM Boundary**:
  - `now = 2026-10-18 03:59:59.999`: `getLogicalDay(now, 4)` returns `"2026-10-17"`.
  - `now = 2026-10-18 04:00:00.000`: `getLogicalDay(now, 4)` returns `"2026-10-18"`.
- **TC-ROLL-02: Midnight Rollover ($H_{\text{rollover}} = 0$)**:
  - `now = 2026-10-18 23:59:59`: returns `"2026-10-18"`.
  - `now = 2026-10-19 00:00:00`: returns `"2026-10-19"`.
- **TC-ROLL-03: Custom Rollover Hours (0 through 23)**:
  - Iterates every integer hour $h \in [0..23]$, testing $h - 1\text{ms}$ vs $h + 0\text{ms}$.
- **TC-ROLL-04: DST Spring Forward (23-Hour Day)**:
  - Simulates clock moving from 01:59:59 straight to 03:00:00. Verifies that 03:59:59 remains the previous logical day and 04:00:00 advances to the new logical day.
- **TC-ROLL-05: DST Fall Back (25-Hour Day)**:
  - Simulates clock repeating 01:00:00 to 01:59:59. Verifies that both 1:30 AM instances evaluate to the previous day and rollover strictly occurs at the single 04:00:00 instance.
- **TC-ROLL-06: Multi-Day Offline Gap**:
  - Item checked on `"2026-10-15"`. Device powered on at `"2026-10-18 10:00:00"`.
  - `isItemCheckedToday(item, "2026-10-18")` returns `false`.
- **TC-ROLL-07: Work Tab Immunity**:
  - Work item checked on `"2026-10-15"`. Date advances to `"2026-10-18"`.
  - `isItemCheckedToday(workItem, "2026-10-18")` returns `true` (Work items never reset).
- **TC-ROLL-08: Timer Calculation**:
  - Verifies `getMillisecondsUntilNextRollover()` correctly returns exact milliseconds until next 4:00 AM across month and leap-year boundaries.

#### Test Suite 2: Sync Conflict Resolution & Convergence (`sync_conflict.test.ts`)
- **TC-SYNC-01: Deterministic Last-Write-Wins (LWW)**:
  - Client A edits title to `"Meditate 10 mins"` at `t = 1000`.
  - Client B edits title to `"Meditate 20 mins"` at `t = 1005`.
  - Reconciler deterministically picks Client B's update on both clients.
- **TC-SYNC-02: Monotonic Timestamp Tie-Breaker**:
  - Client A and Client B edit an item with exact identical timestamp `t = 2000`.
  - UUID tie-breaker: $\max(\text{UUID}_A, \text{UUID}_B)$ consistently prevails across both clients.
- **TC-SYNC-03: Reorder Convergence**:
  - Items with sort orders 10.0, 20.0, 30.0.
  - Client A moves item 30.0 between 10.0 and 20.0 (sort_order = 15.0).
  - Client B renames item 20.0.
  - Both states merge cleanly with no item loss or corrupted sequence.

#### Test Suite 3: Delete Propagation (`delete_propagation.test.ts`)
- **TC-DEL-01: Soft-Delete Precedence**:
  - Client A soft-deletes item (`deleted_at = 2026-10-18T10:00:00Z`).
  - Client B edits item title (`updated_at = 2026-10-18T09:59:59Z`).
  - Reconciler retains `deleted_at`. Item is purged from view and not resurrected.
- **TC-DEL-02: Simultaneous Delete**:
  - Both clients delete the same item offline. On reconnect, deletion reconciles without error.

#### Test Suite 4: Offline Mutation Queue Replay (`offline_queue.test.ts`)
- **TC-QUEUE-01: Chronological Outbox Execution**:
  - Enqueues: `[CREATE item 1, UPDATE item 1 title, CHECK item 1, DELETE item 1]`.
  - Replays against mock API; verifies actions execute in strict FIFO order.
- **TC-QUEUE-02: Idempotent Replay**:
  - Same mutation packet transmitted twice due to network timeout. Mock API / DB handles idempotency gracefully.
- **TC-QUEUE-03: Exponential Backoff & Retry**:
  - Simulates 503 Service Unavailable, then 200 OK. Queue retries with backoff and drains successfully.

---

### 2.3 Playwright E2E Testing Architecture

Playwright runs against production builds on both **WebKit** (Apple Safari engine) and **Chromium**.

#### Viewports Matrix
1. **iPhone 17 Air**:
   - `viewport: { width: 420, height: 912 }`
   - `deviceScaleFactor: 3`
   - `isMobile: true`
   - `hasTouch: true`
   - `userAgent`: Modern iOS Safari user agent
2. **Desktop Viewport**:
   - `viewport: { width: 1440, height: 900 }`
   - `isMobile: false`
   - `hasTouch: false`

#### Four-Tier Test Suite Decomposition

##### Tier 1: Feature Coverage (>= 5 Test Cases Per Feature)
1. **Feature 1: Today Tab 3 Sections**:
   - `T1-TODAY-01`: Add item to Morning Routine, Work Day, and Evening Routine.
   - `T1-TODAY-02`: Toggle check/uncheck updates circular checkbox and section progress ring.
   - `T1-TODAY-03`: Inline rename existing item via click/tap.
   - `T1-TODAY-04`: Delete item in edit mode.
   - `T1-TODAY-05`: Reorder items within section using drag handles.
2. **Feature 2: Work Tab (Persistent List)**:
   - `T1-WORK-01`: Add multiple persistent items; verify no daily section tags.
   - `T1-WORK-02`: Check item: verify struck through, dimmed, and remains in place.
   - `T1-WORK-03`: Swipe-to-delete item on mobile viewport (420px).
   - `T1-WORK-04`: "Clear Completed" button appears only when >= 1 item checked.
   - `T1-WORK-05`: "Clear Completed" triggers confirmation sheet; confirming removes only checked items.
3. **Feature 3: Goal Hero Card**:
   - `T1-GOAL-01`: Set goal statement without target date; verify hero renders statement with no countdown.
   - `T1-GOAL-02`: Set target date 10 days in future; verify `"10 days left"` displays.
   - `T1-GOAL-03`: Set target date matching current day; verify `"Due today"` displays.
   - `T1-GOAL-04`: Clear target date; verify countdown badge disappears immediately.
   - `T1-GOAL-05`: Drag down Goal bottom sheet to dismiss.
4. **Feature 4: Native Edit Mode**:
   - `T1-EDIT-01`: Tap "Edit" in nav bar; verify red minus and drag handles appear.
   - `T1-EDIT-02`: Tap red minus; verify slide-out delete button appears.
   - `T1-EDIT-03`: Tap drag handle and move item; verify spring reflow.
   - `T1-EDIT-04`: Tap "Done"; verify edit controls slide away and normal checkboxes return.
   - `T1-EDIT-05`: Edit mode works identically in Today and Work tabs.
5. **Feature 5: Daily Rollover Boundary**:
   - `T1-ROLL-01`: Advance time from 03:59:50 to 04:00:05 via Playwright clock API; verify checked items reset live without reload.
   - `T1-ROLL-02`: Verify items persist across rollover (only checked status resets).
   - `T1-ROLL-03`: Change rollover hour in Settings to 06:00; verify 04:00 does not reset and 06:00 resets.
   - `T1-ROLL-04`: Work tab checked items do not reset at 04:00.
   - `T1-ROLL-05`: Progress rings reset to 0% after rollover.
6. **Feature 6: In-App 6-Digit Email OTP Auth**:
   - `T1-AUTH-01`: Open Settings, enter email address, submit OTP request.
   - `T1-AUTH-02`: Verify 6 individual digit input boxes appear.
   - `T1-AUTH-03`: Type digits one by one; verify auto-advance to next box.
   - `T1-AUTH-04`: Paste 6-digit code `"123456"`; verify code splits across all 6 inputs.
   - `T1-AUTH-05`: Complete sign-in; verify email displays in Settings; tap Sign Out.
7. **Feature 7: Responsive Navigation & Layout**:
   - `T1-NAV-01`: At 420px (mobile), floating glass tab bar is visible with Today and Work tabs.
   - `T1-NAV-02`: At 1440px (desktop), floating tab bar is hidden; Today and Work display side-by-side.
   - `T1-NAV-03`: Safe area padding respected on mobile (`env(safe-area-inset-bottom)`).
   - `T1-NAV-04`: Desktop keyboard shortcuts (Space toggles item, Enter adds item).
   - `T1-NAV-05`: No horizontal scrollbar at 420px.

##### Tier 2: Boundary & Corner Cases
- `T2-BOUND-01`: Empty state aesthetics: empty lists show elegant, subtle placeholder inviting first item.
- `T2-BOUND-02`: Extremely long item title (300+ characters): wraps cleanly, no horizontal overflow, no clipping.
- `T2-BOUND-03`: Midnight & rollover boundary micro-interactions: adding item at 03:59:59.999.
- `T2-BOUND-04`: Rapid multi-click stress test: toggling a checkbox 30 times in 1 second; state settles cleanly with zero sync drift.
- `T2-BOUND-05`: Network disconnect: toggle offline mode in browser context, add/check/delete items, reload page; data remains intact.

##### Tier 3: Cross-Feature Combinations
- `T3-COMB-01`: Active Edit Mode during a live 4:00 AM rollover event: UI unchecks items without crashing or dropping out of Edit Mode.
- `T3-COMB-02`: Multi-Context Concurrent Sync: Two browser contexts (Context A and Context B) connected to sync mock. Context A adds item; Context B checks it; Context A deletes another; both contexts converge to identical state.
- `T3-COMB-03`: Goal countdown update across midnight: target date due in 1 day updates to "Due today" as time crosses boundary.
- `T3-COMB-04`: Clear Completed executed while offline, followed by reconnect and sync replay.

##### Tier 4: Real-World Workload Scenarios
- `T4-SCEN-01: Full Day Lifecycle`:
  - 07:00 AM: User opens app, checks 3 Morning Routine items. Progress ring reaches 100%, section pulse fires.
  - 10:00 AM: User navigates to Work tab, adds 4 work tasks, completes 2.
  - 08:00 PM: User checks 2 Evening Routine items.
  - 11:30 PM: User checks final Evening item. Day Complete shimmer triggers on Goal card.
  - 04:00 AM (Next Day): Rollover triggers. Today sections uncheck via gentle cascade. Work tab completed tasks remain struck through.
- `T4-SCEN-02: Multi-Device Cross-Usage`:
  - User starts on iPhone viewport, adds morning routine. Switches to Desktop viewport, sees identical data, marks items done, updates goal.

---

### 2.4 Automated Quality Budgets Setup

#### 1. Lighthouse CI Configuration (`lighthouserc.json`)
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "settings": {
        "formFactor": "mobile",
        "screenEmulation": {
          "mobile": true,
          "width": 420,
          "height": 912,
          "deviceScaleFactor": 3,
          "disabled": false
        },
        "throttlingMethod": "simulate"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.90 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:pwa": ["error", { "minScore": 0.90 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.02 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "interactive": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

#### 2. Bundle Size Budget
- Target: Initial JavaScript bundle $\le 220\text{ KB}$ gzipped.
- Verification via Vite `rollup-plugin-visualizer` and `size-limit`:
```json
[
  {
    "path": "dist/assets/*.js",
    "limit": "220 KB",
    "gzip": true
  }
]
```

#### 3. Automated Accessibility Scanner (`axe-core`)
Integrated directly into the Playwright test runner:
- Strict assertion: **0 serious or critical accessibility violations** on every screen.
- Evaluated in both **Light Mode** and **Dark Mode**.
- Checks:
  - Minimum touch target size: $\ge 44 \times 44\text{ pt}$ on mobile.
  - Font sizes on inputs: $\ge 16\text{px}$ to prevent iOS Safari auto-zoom.
  - Color contrast ratio: $\ge 4.5:1$ for body text; $\ge 3:1$ for large display titles and active control states.
  - ARIA attributes: Checkboxes have `role="checkbox"`, `aria-checked="true|false"`, and accessible labels.
  - Motion reduction: When `@media (prefers-reduced-motion: reduce)` is active, animations fall back to instant transitions or gentle opacity fades.

---

### 2.5 Apple HIG 12-Item Review Protocol

An independent agent reviewer evaluates the running application against the 12 criteria below, supported by an automated screenshot and video capture pipeline.

#### Automated Artifact Capture Pipeline
The Playwright harness captures high-resolution screenshots into `.agents/teamwork/evidence/` across all 4 permutations (Light/Dark $\times$ Mobile/Desktop):
1. `today_empty_[mode]_[viewport].png`
2. `today_populated_[mode]_[viewport].png`
3. `today_checked_[mode]_[viewport].png`
4. `today_edit_mode_[mode]_[viewport].png`
5. `work_empty_[mode]_[viewport].png`
6. `work_populated_strikethrough_[mode]_[viewport].png`
7. `work_swipe_delete_[mode]_[viewport].png`
8. `work_clear_confirm_sheet_[mode]_[viewport].png`
9. `goal_editor_sheet_[mode]_[viewport].png`
10. `settings_sheet_[mode]_[viewport].png`
11. `auth_otp_modal_[mode]_[viewport].png`
12. `section_complete_moment_[mode]_[viewport].png`
13. `day_complete_shimmer_[mode]_[viewport].png`

#### The 12 Formal Criteria & Scoring Rubric

| # | Evaluation Item | Pass Criteria | Fail Indicators |
| :- | :--- | :--- | :--- |
| **1** | **Liquid Glass & Materials** | Translucent backdrop blur (`backdrop-filter: blur(20px)`), specular hairline borders (`0.5px solid rgba(255,255,255,0.15)`), multi-layered depth, floating glass tab bar. | Opaque solid flat bars, muddy dark shadows, harsh 1px black borders, plastic appearance. |
| **2** | **Typography Scale & Hierarchy** | Native Apple system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"` / Inter fallback). Correct Apple line heights, letter tracking, weight hierarchy. | Generic sans-serif defaults, misaligned baselines, improper bold weights, unstyled headings. |
| **3** | **Grid, Spacing & Insets** | Strict 8pt spatial grid, iOS standard 16pt screen margins, 10pt list row padding, aligned separators. | Inconsistent padding, ragged horizontal alignment, cramped row heights (<44pt). |
| **4** | **Semantic Color Parity** | `systemBlue` (`#007AFF` light / `#0A84FF` dark), `systemCyan` (`#32ADE6` / `#64D2FF`), grouped background hierarchy (`systemGroupedBackground`, `secondarySystemGroupedBackground`). High contrast in both modes. | Hardcoded gray hex codes, washed out dark mode, inverted or low-contrast text. |
| **5** | **Safe Area Handling** | Dynamic Island clearance (`env(safe-area-inset-top)`), Home indicator clearance (`env(safe-area-inset-bottom)`), no clipped headers or tab bars. | Content tucked behind camera notch or cut off by iOS home indicator bar. |
| **6** | **Spring Motion & Physics** | Framer Motion physically based springs (`damping: 25-30, stiffness: 300-350`), interruptible gestures, ProMotion 120Hz smooth. Reduced motion respected. | Linear or cubic-bezier CSS web transitions, janky reorders, jerky sheet opens, bouncing balloons. |
| **7** | **Elimination of Web-Isms** | `-webkit-tap-highlight-color: transparent`, `user-select: none` on controls, input font-size $\ge 16$px (no iOS zoom), no page-level rubber bounce. | Gray tap flash, accidental text selection on drag, viewport zooming on input focus, double-tap zoom. |
| **8** | **Intentional Empty States** | Minimalist, elegant iconography and subtle typography inviting the user to create their first item. | Ugly default "No data" text, blank empty voids, cluttered promotional graphics. |
| **9** | **Restrained Completion Moments** | Quiet blue-to-cyan glow, single shimmer sweep on Goal card, section progress ring pulse. Strictly zero confetti. | Confetti cannons, fireworks, audio fanfare, gamified badge popups. |
| **10** | **Desktop Layout Polish** | Responsive side-by-side view (Goal top, Today and Work side-by-side), floating tab bar cleanly hidden, keyboard navigation support. | Stretched 420px mobile column centered on a 1440px monitor with huge empty gutters. |
| **11** | **App Icon & Splash Screens** | iOS 26 Liquid Glass Cadence icon with squircle mask, dark and light splash screen variants, PWA manifest standalone setup. | Default Vite favicon, white flash on dark mode launch, missing splash screens. |
| **12** | **Overall First-Party Authenticity** | "Would this pass as an Apple first-party app?" Polished, premium, zero rough edges. | Feels like a standard React web prototype rather than an iOS system application. |

---

## 3. Data Flow & State Synchronization Interfaces

### 3.1 Type Definitions (`src/types/domain.ts`)

```ts
export type ListType = 'today_morning' | 'today_work' | 'today_evening' | 'work';

export interface ChecklistItem {
  id: string; // UUID v4
  user_id?: string;
  list_type: ListType;
  title: string;
  sort_order: number; // Fractional index (e.g. 1000.0)
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 UTC
  last_completed_day: string | null; // "YYYY-MM-DD" for daily items
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC (used for LWW sync)
  deleted_at: string | null; // Soft-delete marker
}

export interface UserSettings {
  user_id?: string;
  rollover_hour: number; // 0..23 (default 4)
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id?: string;
  statement: string;
  target_date: string | null; // "YYYY-MM-DD"
  updated_at: string;
  deleted_at: string | null;
}
```

### 3.2 State Store Contract (`useChecklistStore`)

```ts
export interface ChecklistStoreState {
  // Data collections
  items: ChecklistItem[];
  goal: Goal | null;
  settings: UserSettings;
  
  // Navigation & UI state
  activeTab: 'today' | 'work';
  isEditMode: boolean;
  isSettingsOpen: boolean;
  isGoalEditorOpen: boolean;
  
  // Computed getters
  logicalDay: string;
  todayMorningItems: ChecklistItem[];
  todayWorkItems: ChecklistItem[];
  todayEveningItems: ChecklistItem[];
  workItems: ChecklistItem[];
  completedWorkCount: number;
  
  // Actions
  setActiveTab: (tab: 'today' | 'work') => void;
  setEditMode: (enabled: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setGoalEditorOpen: (open: boolean) => void;
  
  // Domain mutations (Local-First -> enqueues sync)
  addItem: (listType: ListType, title: string) => Promise<string>;
  toggleItem: (id: string) => Promise<void>;
  renameItem: (id: string, newTitle: string) => Promise<void>;
  reorderItem: (id: string, newSortOrder: number) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearCompletedWork: () => Promise<void>;
  updateGoal: (statement: string, targetDate: string | null) => Promise<void>;
  setRolloverHour: (hour: number) => Promise<void>;
  
  // Rollover lifecycle
  checkAndTriggerRollover: () => Promise<boolean>;
}
```

---

## 4. Key Verification Guidelines & Next Steps

1. **Unit Test Verification**: Run `npm test` using Vitest to verify that `rollover.test.ts`, `sync_conflict.test.ts`, `delete_propagation.test.ts`, and `offline_queue.test.ts` pass with 100% assertion success.
2. **E2E Playwright Verification**: Execute `npx playwright test` targeting both WebKit and Chromium across mobile (`420x912`) and desktop (`1440x900`) viewports.
3. **Lighthouse Audit**: Run `npx lhci autorun` against production build (`npm run build && npm run preview`).
4. **Accessibility Scan**: Ensure zero serious or critical violations are returned by `axe-core`.
5. **Apple HIG Design Review**: Independent reviewer agent uses the 12-item rubric against captured screenshots in `.agents/teamwork/evidence/`.
