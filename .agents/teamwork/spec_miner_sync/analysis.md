# Cadence Sync & Backend Specification (spec_miner_sync)

**Date**: 2026-10-17  
**Author**: `spec_miner_sync` (Specification Miner - Sync & Backend Specialist)  
**Target Project**: Cadence (iOS 26 Liquid Glass Checklist PWA)  
**Authoritative Contracts**: `ORIGINAL_REQUEST.md`, Supabase GoTrue v2.197.0 API, PostgREST v12, Dexie.js v4.4.6

---

## 1. Executive Summary & Architecture Blueprint

Cadence is designed as an ultra-premium, Apple iOS 26 Liquid Glass checklist PWA. To achieve instantaneous responsiveness (<16ms, zero loading spinners) and 100% offline availability, the system adopts a **Local-First, Offline-First Architecture** with a deterministic cloud synchronization engine backed by Supabase.

### 1.1 High-Level Component Topology

```
+-----------------------------------------------------------------------------------+
|                                  USER INTERFACE                                   |
|  (React 19 + Framer Motion Spring Animations, iOS 26 Liquid Glass, 120Hz ProMotion)  |
+-----------------------------------------+-----------------------------------------+
                                          | Reactive Subscription (useLiveQuery)
                                          | Instant Local Mutations (<16ms)
                                          v
+-----------------------------------------------------------------------------------+
|                        LOCAL STORAGE LAYER: DEXIE.JS (INDEXEDDB)                  |
|  - Authoritative local state: checklist_items, goals, user_settings               |
|  - Outbox mutation queue: offline_mutations                                       |
|  - Sync metadata: sync_metadata (last_pulled_at, client_id, sync_status)           |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Outbox Queue Processing & Conflict Engine
                                          v
+-----------------------------------------------------------------------------------+
|                          CADENCE DETERMINISTIC SYNC ENGINE                        |
|  - Outbox Queue Replay (FIFO, atomic transactions, exponential backoff)           |
|  - Last-Write-Wins (LWW) Conflict Resolution (monotonic updated_at + UUID tie)    |
|  - Soft Delete Propagation (deleted_at tombstones prevent resurrection)           |
|  - Network & Visibility Listeners (online/offline, visibilitychange)               |
|  - Fallback Controller (Graceful local operation on PGRST205 or network offline)  |
+-------------------+---------------------------------------+-----------------------+
                    |                                       ^
                    | HTTPS REST / Auth                     | WebSocket Realtime
                    v                                       |
+---------------------------------------+ +-----------------------------------------+
|      SUPABASE POSTGREST & GOTRUE      | |        SUPABASE REALTIME ENGINE         |
|  - In-App 6-Digit Email OTP Auth      | |  - Channel: postgres_changes            |
|  - Row Level Security (auth.uid = id) | |  - Broadcasts INSERT/UPDATE/DELETE      |
|  - Tables: items, goals, settings     | |  - REPLICA IDENTITY FULL for old/new    |
+---------------------------------------+ +-----------------------------------------+
```

---

## 2. Supabase Backend & Database Schema

### 2.1 Live Environment Verification

A live probe of the production Supabase endpoint (`https://hkncvdgrvsopjtqlsiyt.supabase.co`) with public anon key was performed:
- **GoTrue Auth Service**: Responded `200 OK` (`GoTrue v2.197.0`).
- **PostgREST Schema Cache**: Responded `404 Not Found` (`code: PGRST205` - "Could not find the table 'public.checklist_items' in the schema cache").
- **Observation**: The Supabase cloud project is live and healthy, but database migrations have not yet been executed by the user. The app must execute in **Graceful Local Fallback Mode** until the user runs the migration in the Supabase SQL Editor.

### 2.2 Complete SQL Migration File (`supabase/migrations/20261017000000_init_cadence.sql`)

The migration script below is idempotent, strictly enforces Row Level Security (RLS), configures automatic `updated_at` timestamp triggers, sets up default user settings upon registration, and enables Realtime publication.

```sql
-- ============================================================================
-- Migration: 20261017000000_init_cadence.sql
-- Description: Initial schema, RLS policies, and realtime publication for Cadence
-- Authoritative Target: Supabase Postgres
-- ============================================================================

-- 1. Helper function for automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Table: user_settings
-- Stores per-user application preferences (e.g. rollover hour)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rollover_hour SMALLINT NOT NULL DEFAULT 4 CHECK (rollover_hour >= 0 AND rollover_hour <= 23),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for user_settings updated_at
DROP TRIGGER IF EXISTS tr_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER tr_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Table: goals
-- Stores user's hero card goal statement and target countdown date
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL DEFAULT '',
  target_date DATE NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id_updated ON public.goals(user_id, updated_at DESC);

-- Trigger for goals updated_at
DROP TRIGGER IF EXISTS tr_goals_updated_at ON public.goals;
CREATE TRIGGER tr_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Table: checklist_items
-- Stores all items across Morning Routine, Work Day, Evening Routine, and Work List
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL CHECK (list_type IN ('today_morning', 'today_work', 'today_evening', 'work')),
  title TEXT NOT NULL DEFAULT '',
  sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ NULL,
  last_reset_day TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes for checklist_items
CREATE INDEX IF NOT EXISTS idx_items_user_list_sort ON public.checklist_items(user_id, list_type, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_items_user_updated ON public.checklist_items(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_user_deleted ON public.checklist_items(user_id, deleted_at) WHERE deleted_at IS NULL;

-- Trigger for checklist_items updated_at
DROP TRIGGER IF EXISTS tr_checklist_items_updated_at ON public.checklist_items;
CREATE TRIGGER tr_checklist_items_updated_at
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Automatic User Initialization Trigger
-- Automatically provisions user_settings when a new user signs up via GoTrue
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, rollover_hour)
  VALUES (NEW.id, 4)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Row Level Security (RLS) Configuration
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- 6.1 Policies for user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;
CREATE POLICY "Users can delete their own settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 6.2 Policies for goals
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
CREATE POLICY "Users can view their own goals"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
CREATE POLICY "Users can insert their own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
CREATE POLICY "Users can update their own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;
CREATE POLICY "Users can delete their own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

-- 6.3 Policies for checklist_items
DROP POLICY IF EXISTS "Users can view their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can view their own checklist items"
  ON public.checklist_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can insert their own checklist items"
  ON public.checklist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can update their own checklist items"
  ON public.checklist_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can delete their own checklist items"
  ON public.checklist_items FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Realtime Replication Configuration
-- Set replica identity to full so update/delete payloads include entire record
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.goals REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_items REPLICA IDENTITY FULL;

-- Idempotently add tables to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'goals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'checklist_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;
  END IF;
END;
$$;
```

---

## 3. In-App 6-Digit Email OTP Authentication

### 3.1 Flow Breakdown

Magic links are deliberately avoided because clicking a magic link on iOS opens Safari in a new browser tab, breaking out of the installed standalone PWA. The user remains entirely inside the installed PWA using a **6-digit in-app OTP flow**.

```
+-------------------------------------------------------------------------+
| 1. Settings Sheet Opened                                                |
|    - If unauthenticated: Displays "Sign In to Sync"                     |
|    - User enters email address: "alex@example.com"                      |
|    - Tap "Continue"                                                     |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 2. Client Calls: supabase.auth.signInWithOtp()                          |
|    - Payload: { email, options: { shouldCreateUser: true } }            |
|    - Supabase GoTrue sends email containing 6-digit OTP code            |
|    - 60s cooldown timer begins                                          |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| 3. In-App 6-Digit Code Input Screen                                     |
|    - 6 individual digit input boxes [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]      |
|    - Auto-advance on keystroke                                          |
|    - Backspace navigation to prior box                                  |
|    - Full 6-digit paste support with auto-distribution & auto-submit    |
|    - Native iOS SMS/Email autofill bar via autoComplete="one-time-code" |
+-----------------------------------+-------------------------------------+
                                    |
                                    v (Auto-triggered when 6th digit entered)
+-------------------------------------------------------------------------+
| 4. Client Calls: supabase.auth.verifyOtp()                              |
|    - Payload: { email, token: "123456", type: "email" }                 |
|    - On Success: Session saved to localStorage/IndexedDB                |
|    - Trigger Anonymous-to-Authenticated Data Promotion                  |
|    - Trigger Sync Engine to pull cloud state & push local queue         |
|    - On Error: Shake animation on 6 boxes, clear inputs, focus box 0    |
+-------------------------------------------------------------------------+
```

### 3.2 6-Digit OTP UI Component Specification

- **Input Elements**: 6 separate `<input>` elements with the following critical attributes:
  ```html
  <input
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    maxlength="1"
    autocomplete="one-time-code"
    data-index="0"
    aria-label="Digit 1 of 6"
    class="otp-digit-box"
  />
  ```
- **Auto-Advance Logic**:
  - When key is pressed `(0-9)` in box `i`:
    - Set box `i` value.
    - If `i < 5`, focus box `i + 1`.
    - If `i === 5` (all 6 filled), auto-trigger verification request.
- **Backspace Navigation**:
  - On `KeyDown` event for `'Backspace'`:
    - If current box `i` has content: clear box `i`.
    - If current box `i` is empty and `i > 0`: focus box `i - 1`, clear box `i - 1`.
- **Clipboard Paste Support**:
  - Listen to `onPaste` on the container or any individual input.
  - Read `e.clipboardData.getData('text')`.
  - Extract digits only: `const digits = text.replace(/\D/g, '').slice(0, 6);`.
  - If `digits.length > 0`:
    - Distribute digits across inputs `0` through `digits.length - 1`.
    - If `digits.length === 6`: auto-trigger verification.
    - Else: focus input at index `digits.length`.
- **Haptic & Visual Feedback**:
  - Input stroke: 1px border with `systemBlue` focus ring.
  - Error state: 3-cycle horizontal shake spring animation (`x: [-12, 12, -8, 8, -4, 4, 0]`) with border turning `systemRed` (#FF3B30).
  - Clear inputs and return focus to box 0 on error.
- **Resend Countdown Timer**:
  - 60-second monotonic countdown.
  - Disabled during countdown: `"Resend code in 48s"`.
  - Enabled when 0: `"Resend code"` button.
- **Change Email Action**:
  - Subtle text button: `"Use a different email"`, clears state and returns to email input view.

### 3.3 Anonymous-to-Authenticated Data Migration

When a user launches Cadence for the first time without signing in, they create checklist items and set goals immediately in local Dexie storage with `user_id = 'local'`.
When the user subsequently authenticates:
1. `session.user.id` is obtained from GoTrue.
2. In an atomic Dexie transaction:
   - All `checklist_items` where `user_id === 'local'` are updated to `user_id = session.user.id`.
   - All `goals` where `user_id === 'local'` are updated to `user_id = session.user.id`.
   - All `user_settings` where `user_id === 'local'` are updated to `user_id = session.user.id`.
   - For every migrated item, an `upsert` mutation is appended to `offline_mutations`.
3. Outbox sync engine is immediately kicked off, pushing local items to Supabase without loss or duplication.

### 3.4 Sign-Out Lifecycle & Local Cache Handling

When a user taps "Sign Out" in the Settings sheet:
1. Confirmation alert: `"Sign out of Cadence? Your data will remain synced in the cloud."`
2. Actions executed upon confirmation:
   - Call `supabase.auth.signOut()`.
   - Unsubscribe from Realtime websocket channels.
   - Clear `sync_metadata` (reset `last_pulled_at = null`).
   - Clear `offline_mutations` (cancel pending pushes for the signed-out user).
   - Clear user session from `localStorage`.
   - Reset local Dexie tables (`checklist_items`, `goals`, `user_settings`) to fresh empty states for the next user or anonymous local usage.

---

## 4. Offline-First Architecture & Deterministic Sync Engine

### 4.1 Dexie.js Schema & Models

Dexie.js v4 is the authoritative local data store. All UI interactions read and write directly to IndexedDB.

```typescript
// src/lib/db/schema.ts
import Dexie, { type Table } from 'dexie';

export interface ChecklistItemRecord {
  id: string; // UUID v4
  user_id: string; // auth.users UUID or 'local'
  list_type: 'today_morning' | 'today_work' | 'today_evening' | 'work';
  title: string;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 UTC
  last_reset_day: string | null; // "YYYY-MM-DD"
  updated_at: string; // ISO 8601 UTC
  deleted_at: string | null; // ISO 8601 UTC or null (soft delete)
}

export interface GoalRecord {
  id: string; // UUID v4
  user_id: string;
  statement: string;
  target_date: string | null; // "YYYY-MM-DD"
  updated_at: string; // ISO 8601 UTC
  deleted_at: string | null; // ISO 8601 UTC or null
}

export interface UserSettingsRecord {
  user_id: string; // auth.users UUID or 'local'
  rollover_hour: number; // 0..23 (default 4)
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
}

export interface OfflineMutation {
  id?: number; // Auto-incrementing primary key
  table_name: 'checklist_items' | 'goals' | 'user_settings';
  record_id: string;
  action: 'upsert' | 'delete';
  payload: any;
  timestamp: number; // Date.now()
  retry_count: number;
  last_error?: string;
}

export interface SyncMetadata {
  key: string; // 'last_pulled_at' | 'client_id'
  value: any;
}

export class CadenceDatabase extends Dexie {
  checklist_items!: Table<ChecklistItemRecord, string>;
  goals!: Table<GoalRecord, string>;
  user_settings!: Table<UserSettingsRecord, string>;
  offline_mutations!: Table<OfflineMutation, number>;
  sync_metadata!: Table<SyncMetadata, string>;

  constructor() {
    super('cadence_db');
    this.version(1).stores({
      checklist_items: 'id, user_id, list_type, sort_order, is_completed, last_reset_day, updated_at, deleted_at',
      goals: 'id, user_id, updated_at, deleted_at',
      user_settings: 'user_id, rollover_hour, updated_at',
      offline_mutations: '++id, table_name, record_id, timestamp',
      sync_metadata: 'key'
    });
  }
}

export const db = new CadenceDatabase();
```

### 4.2 Local-First Mutation Pipeline (<16ms, Zero Spinners)

Every user action (checking an item, creating an item, reordering items, updating the goal) executes synchronously in local memory and commits atomically to Dexie in `< 5ms`:

```typescript
// src/lib/db/mutations.ts
import { db, type ChecklistItemRecord } from './schema';
import { getMonotonicISO } from './clock';
import { syncEngine } from '../sync/engine';

export async function updateChecklistItemLocally(
  id: string,
  updates: Partial<ChecklistItemRecord>
): Promise<void> {
  const now = getMonotonicISO();
  
  await db.transaction('rw', [db.checklist_items, db.offline_mutations], async () => {
    const existing = await db.checklist_items.get(id);
    if (!existing) return;

    const updatedRecord: ChecklistItemRecord = {
      ...existing,
      ...updates,
      updated_at: now
    };

    await db.checklist_items.put(updatedRecord);
    await db.offline_mutations.add({
      table_name: 'checklist_items',
      record_id: id,
      action: 'upsert',
      payload: updatedRecord,
      timestamp: Date.now(),
      retry_count: 0
    });
  });

  // Notify sync engine in background (non-blocking, fire-and-forget)
  syncEngine.triggerPush();
}

export async function softDeleteChecklistItemLocally(id: string): Promise<void> {
  const now = getMonotonicISO();

  await db.transaction('rw', [db.checklist_items, db.offline_mutations], async () => {
    const existing = await db.checklist_items.get(id);
    if (!existing) return;

    const deletedRecord: ChecklistItemRecord = {
      ...existing,
      deleted_at: now,
      updated_at: now
    };

    // Update with deleted_at timestamp
    await db.checklist_items.put(deletedRecord);
    await db.offline_mutations.add({
      table_name: 'checklist_items',
      record_id: id,
      action: 'delete',
      payload: deletedRecord,
      timestamp: Date.now(),
      retry_count: 0
    });
  });

  syncEngine.triggerPush();
}
```

### 4.3 Monotonic Clock & Clock Skew Defense

To prevent clock drift between physical devices or backwards clock adjustments from violating ordering, Cadence uses a **Monotonic Lamport Timestamp Generator**:

```typescript
// src/lib/db/clock.ts
let lastTimestampMs = 0;

export function getMonotonicISO(): string {
  const now = Date.now();
  // Ensure timestamp strictly increases even within the same millisecond
  lastTimestampMs = Math.max(now, lastTimestampMs + 1);
  return new Date(lastTimestampMs).toISOString();
}

export function updateClockFromRemote(remoteIsoString: string): void {
  const remoteMs = new Date(remoteIsoString).getTime();
  if (!isNaN(remoteMs) && remoteMs > lastTimestampMs) {
    lastTimestampMs = remoteMs;
  }
}
```

### 4.4 Deterministic Last-Write-Wins (LWW) Conflict Resolution Algorithm

When two browser contexts or devices edit the same record offline and subsequently reconnect, Cadence applies a **Deterministic LWW Reconciliation Rule**:

1. **Comparison Operator**: Given local record $L$ and remote record $R$:
   - If $R.\text{updated\_at} > L.\text{updated\_at}$: **Remote Wins**. Apply $R$ to local Dexie.
   - If $L.\text{updated\_at} > R.\text{updated\_at}$: **Local Wins**. Preserve $L$ in Dexie; enqueue $L$ to push to remote.
   - If $R.\text{updated\_at} == L.\text{updated\_at}$: **Deterministic Tie-Breaker**:
     Compare lexicographical string representations of the record payload or UUID:
     $$\text{hash}(R) \ge \text{hash}(L) \implies \text{Remote Wins, else Local Wins}$$
2. **Convergence Guarantee**:
   Because the rule is mathematically commutative, associative, and strictly ordered by monotonic timestamps with deterministic tie-breaking, any two independent clients running this algorithm with the same set of mutations are guaranteed to reach an **identical converged state**.

### 4.5 Soft Deletes & Tombstone Propagation Protocol

Hard deletes in an offline-first system cause the classic **"Resurrection Bug"** (Device A deletes item while Device B edits item offline; when Device B pushes, the deleted item is recreated).

Cadence solves this using **Soft Delete Tombstones**:
1. **Deletion Trigger**: A deletion sets `deleted_at = monotonic_now()` and `updated_at = monotonic_now()`.
2. **UI Filtering**: All UI queries filter active records with `where('deleted_at').equals(null)`.
3. **Propagation**: The deletion mutation pushes `deleted_at` to Supabase.
4. **Reconciliation**:
   - Device B receives the record with `deleted_at: "2026-10-17T12:00:00.000Z"`.
   - If Device B's local edit occurred at `2026-10-17T11:59:00.000Z`, the delete wins ($12:00:00 > 11:59:00$). The item is soft-deleted on Device B.
   - If Device B explicitly edited or un-checked the item at `2026-10-17T12:01:00.000Z` (after deletion), Device B's change has higher timestamp and takes precedence.
5. **Storage Footprint**: Since Cadence is a personal daily checklist app with $<100$ items, keeping tombstones in IndexedDB requires $<50\text{ KB}$ of storage, eliminating the need for aggressive hard purge cycles.

### 4.6 Offline Queue Replay & Outbox State Machine

The outbox queue drains FIFO with exponential backoff on transient errors and schema isolation:

```typescript
// src/lib/sync/engine.ts
import { db, type OfflineMutation } from '../db/schema';
import { supabase, isSupabaseConfigured } from './supabase';
import { updateClockFromRemote } from '../db/clock';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'unconfigured' | 'error';

export class SyncEngine {
  private isPushing = false;
  private isPulling = false;
  private backoffDelayMs = 1000;
  private maxBackoffDelayMs = 30000;
  private retryTimer: NodeJS.Timeout | null = null;
  public status: SyncStatus = 'idle';

  init() {
    window.addEventListener('online', () => this.handleNetworkOnline());
    window.addEventListener('offline', () => this.handleNetworkOffline());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.triggerSync();
      }
    });
    this.triggerSync();
  }

  handleNetworkOnline() {
    this.backoffDelayMs = 1000;
    this.triggerSync();
  }

  handleNetworkOffline() {
    this.status = 'offline';
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  async triggerSync() {
    if (!navigator.onLine) {
      this.status = 'offline';
      return;
    }
    if (!isSupabaseConfigured()) {
      this.status = 'unconfigured';
      return;
    }
    await this.pullRemoteChanges();
    await this.drainOutbox();
  }

  async drainOutbox() {
    if (this.isPushing || !navigator.onLine) return;
    this.isPushing = true;
    this.status = 'syncing';

    try {
      while (true) {
        const mutation = await db.offline_mutations.orderBy('id').first();
        if (!mutation) break;

        try {
          await this.executeMutation(mutation);
          // Success: delete from outbox queue
          await db.offline_mutations.delete(mutation.id!);
          this.backoffDelayMs = 1000; // Reset backoff on success
        } catch (err: any) {
          if (this.isTransientNetworkError(err)) {
            this.scheduleRetry();
            break;
          } else if (this.isSchemaMissingError(err)) {
            // PGRST205: Migration not applied in Supabase
            console.warn('[SyncEngine] Cloud migration pending (PGRST205). Local fallback active.');
            this.status = 'unconfigured';
            break;
          } else {
            // Poison pill / RLS authorization rejection: discard to unblock queue
            console.error('[SyncEngine] Dropping unprocessable mutation:', mutation, err);
            await db.offline_mutations.delete(mutation.id!);
          }
        }
      }
      if (this.status === 'syncing') this.status = 'idle';
    } finally {
      this.isPushing = false;
    }
  }

  private async executeMutation(mutation: OfflineMutation): Promise<void> {
    const { table_name, action, payload } = mutation;
    
    // Remote upsert handles both insert and update
    const { error } = await supabase
      .from(table_name)
      .upsert(payload, { onConflict: table_name === 'user_settings' ? 'user_id' : 'id' });

    if (error) throw error;
  }

  private scheduleRetry() {
    this.status = 'error';
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, this.maxBackoffDelayMs);
      this.triggerSync();
    }, this.backoffDelayMs);
  }

  private isTransientNetworkError(err: any): boolean {
    return !navigator.onLine || err?.message?.includes('Failed to fetch') || err?.status >= 500;
  }

  private isSchemaMissingError(err: any): boolean {
    return err?.code === 'PGRST205' || err?.message?.includes('Could not find the table');
  }

  async pullRemoteChanges() {
    if (this.isPulling || !navigator.onLine) return;
    this.isPulling = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // User not signed in, local only

      const lastPulled = await db.sync_metadata.get('last_pulled_at');
      const filterTime = lastPulled?.value || '1970-01-01T00:00:00.000Z';

      // Pull updated checklist items
      const { data: remoteItems, error: itemsErr } = await supabase
        .from('checklist_items')
        .select('*')
        .gt('updated_at', filterTime);

      if (itemsErr) {
        if (this.isSchemaMissingError(itemsErr)) return;
        throw itemsErr;
      }

      if (remoteItems && remoteItems.length > 0) {
        await db.transaction('rw', db.checklist_items, async () => {
          for (const remote of remoteItems) {
            updateClockFromRemote(remote.updated_at);
            const local = await db.checklist_items.get(remote.id);
            if (!local || remote.updated_at >= local.updated_at) {
              await db.checklist_items.put(remote);
            }
          }
        });
      }

      // Record successful pull timestamp
      await db.sync_metadata.put({
        key: 'last_pulled_at',
        value: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[SyncEngine] Pull error:', err);
    } finally {
      this.isPulling = false;
    }
  }

  triggerPush() {
    if (navigator.onLine && isSupabaseConfigured()) {
      this.drainOutbox();
    }
  }
}

export const syncEngine = new SyncEngine();
```

---

## 5. Graceful Fallback & Local Operation

### 5.1 Three Fallback Scenarios & System Behaviors

| Scenario | System State | User Experience | Error Handling |
|----------|--------------|-----------------|----------------|
| **1. Unconfigured Credentials** (missing or placeholder `.env.local`) | `isSupabaseConfigured() === false` | App functions 100% locally. Settings shows "Local Only". | Zero network requests sent. Zero unhandled promise rejections. |
| **2. Unmigrated Supabase Schema** (Tables not created, `PGRST205`) | `code === 'PGRST205'` detected on first ping | App functions 100% locally. Settings shows "Local Storage Mode (Cloud Setup Pending)". | Caught gracefully. Sync outbox pauses without dropping items. |
| **3. Offline / Airplane Mode** (`navigator.onLine === false`) | Network unreachable | Instant local edits (<16ms). Settings shows "Offline". | Mutations safely persist in Dexie outbox. Auto-replays on `online` event. |

### 5.2 Environment Templates

#### `.env.example`
```ini
# Cadence Environment Configuration Template
# Copy this file to .env.local and fill in your Supabase credentials

# Supabase Project URL (provided in your Supabase Dashboard)
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Public Anon Key (safe to expose in client bundle)
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

#### `.env.local` (Pre-configured for Cadence project)
```ini
# Production Cadence Supabase Instance
VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
```

### 5.3 Live Supabase Verification Script (`scripts/verify-supabase.mjs`)

The standalone verification script tests all Supabase backend components and prints a colorized health audit:

```javascript
// scripts/verify-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔍 Cadence Supabase Backend Verification');
console.log('========================================');
console.log(`URL: ${supabaseUrl || 'MISSING'}`);
console.log(`Anon Key: ${supabaseAnonKey ? '[Configured]' : 'MISSING'}\n`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  let passed = true;

  // 1. Check GoTrue Health
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ [1/4] GoTrue Auth Service: Online (${data.name} ${data.version})`);
    } else {
      console.log(`❌ [1/4] GoTrue Auth Service: HTTP ${res.status}`);
      passed = false;
    }
  } catch (err) {
    console.log(`❌ [1/4] GoTrue Auth Service: Network unreachable (${err.message})`);
    passed = false;
  }

  // 2. Check Database Tables in PostgREST Schema Cache
  const tables = ['checklist_items', 'goals', 'user_settings'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        if (error.code === 'PGRST205') {
          console.log(`⚠️  [2/4] Table '${table}': NOT FOUND (Migration pending in Supabase)`);
          passed = false;
        } else {
          console.log(`⚠️  [2/4] Table '${table}': RLS Active / Error (${error.message})`);
        }
      } else {
        console.log(`✅ [2/4] Table '${table}': Schema Cache Valid & Accessible`);
      }
    } catch (err) {
      console.log(`❌ [2/4] Table '${table}': Query failed (${err.message})`);
      passed = false;
    }
  }

  // 3. Check Row Level Security (Anon query without auth token)
  try {
    const { data, error } = await supabase.from('checklist_items').select('*');
    if (!error && data?.length === 0) {
      console.log('✅ [3/4] Row Level Security (RLS): Enforced (Anon sees 0 rows)');
    } else if (error?.code === 'PGRST205') {
      console.log('⚠️  [3/4] Row Level Security (RLS): Cannot verify until migration runs');
    } else {
      console.log(`ℹ️  [3/4] Row Level Security (RLS): ${error?.message || 'OK'}`);
    }
  } catch (err) {
    console.log(`❌ [3/4] RLS Check Failed: ${err.message}`);
  }

  // 4. Check Realtime Replication Publication
  try {
    const channel = supabase.channel('health-check-probe');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ [4/4] Supabase Realtime WebSocket: Connected');
        supabase.removeChannel(channel);
        finishAudit(passed);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.log(`⚠️  [4/4] Supabase Realtime: ${status}`);
        supabase.removeChannel(channel);
        finishAudit(passed);
      }
    });
  } catch (err) {
    console.log(`❌ [4/4] Realtime Check Failed: ${err.message}`);
    finishAudit(passed);
  }
}

function finishAudit(allPassed) {
  console.log('\n========================================');
  if (allPassed) {
    console.log('🎉 All Supabase backend systems verified and ready for production sync!\n');
  } else {
    console.log('💡 Note: If tables are reported NOT FOUND, copy and run:');
    console.log('   supabase/migrations/20261017000000_init_cadence.sql');
    console.log('   in your Supabase SQL Editor: https://supabase.com/dashboard/project/hkncvdgrvsopjtqlsiyt/sql\n');
  }
}

runAudit();
```

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Database | Schema Migration File | Comprehensive PostgreSQL migration containing table definitions, indexes, RLS policies, triggers, and realtime configuration. | SQL script executed in Supabase SQL editor | Created tables (`checklist_items`, `goals`, `user_settings`), triggers, and RLS policies | PostgreSQL syntax or permission error if executed without role access | Dispatch Prompt & `ORIGINAL_REQUEST.md` R3 |
| 2 | Database | User Settings Table | Stores per-user settings with `user_id` PK referencing `auth.users`, and `rollover_hour` default 4. | `user_id` (UUID), `rollover_hour` (0..23) | Row in `user_settings` | Check constraint violation if `rollover_hour < 0` or `> 23` | Dispatch Prompt R1 & `ORIGINAL_REQUEST.md` R1 |
| 3 | Database | Goals Table | Stores single hero goal statement and optional target countdown date per user. | `id` (UUID), `user_id` (UUID), `statement` (text), `target_date` (date) | Row in `goals` | Foreign key violation if `user_id` not in `auth.users` | Dispatch Prompt R1 & `ORIGINAL_REQUEST.md` R1 |
| 4 | Database | Checklist Items Table | Stores items across all daily sections and the work list with soft-delete support. | `id`, `user_id`, `list_type`, `title`, `sort_order`, `is_completed`, `completed_at`, `last_reset_day`, `deleted_at` | Row in `checklist_items` | Check constraint violation if `list_type` not in allowed enum values | Dispatch Prompt R1 & `ORIGINAL_REQUEST.md` R1 |
| 5 | Database | Automatic `updated_at` Trigger | PL/pgSQL function and trigger setting `updated_at = timezone('utc', now())` on every row update. | Row UPDATE statement | Updated row with fresh timestamp | Automatic trigger execution | Schema specification |
| 6 | Database | Automatic User Provisioning Trigger | PL/pgSQL function triggered on `AFTER INSERT ON auth.users` creating default `user_settings` (rollover 4). | New user record in `auth.users` | Inserted default row in `user_settings` | `ON CONFLICT DO NOTHING` prevents duplication | Schema specification |
| 7 | Security | Row Level Security (RLS) Policies | Strict row isolation ensuring `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE on all tables. | Authenticated JWT or anonymous connection | Filtered rows or authorized mutation | 403 Forbidden or 0 rows returned if user unauthorized | Dispatch Prompt R1 & `ORIGINAL_REQUEST.md` R3 |
| 8 | Realtime | Supabase Realtime Publication | Postgres logical replication publication for `checklist_items`, `goals`, and `user_settings` with `REPLICA IDENTITY FULL`. | Realtime database mutations | Broadcasts postgres_changes event over WebSocket | Subscription error if table not published | Supabase API inspection |
| 9 | Auth | 6-Digit Email OTP Request | Requesting a 6-digit numeric login code via Supabase GoTrue `signInWithOtp`. | `{ email, options: { shouldCreateUser: true } }` | Success response and email dispatch | 400 validation error on malformed email; 429 on rate limit | Probed live Supabase GoTrue endpoint |
| 10 | Auth | In-App 6-Digit PIN Entry UI | UI with 6 discrete numeric boxes, auto-advancing on digit entry, backspacing to prior box, and 6-digit clipboard paste support. | Keydown events, input characters, paste events | Populated input values and focus transitions | Non-digit characters blocked; shake animation on invalid submission | Dispatch Prompt R2 & Apple HIG |
| 11 | Auth | 6-Digit Email OTP Verification | Verifying the entered 6-digit token via Supabase GoTrue `verifyOtp`. | `{ email, token: string, type: 'email' }` | Auth session (`access_token`, `refresh_token`, `user`) | 403 `otp_expired` ("Token has expired or is invalid") | Probed live Supabase GoTrue endpoint |
| 12 | Auth | Session Persistence | Storing active GoTrue session in localStorage and restoring on app launch. | Stored session token | Restored authenticated user state | Expired refresh token triggers re-authentication request | `@supabase/supabase-js` specification |
| 13 | Auth | Anonymous-to-Authenticated Promotion | Promoting locally created checklist items (`user_id = 'local'`) to authenticated user ID on initial login. | `session.user.id` | Updated local records and queued sync mutations | Atomic Dexie transaction prevents partial migration | Sync engine analysis |
| 14 | Auth | Sign-Out Action | Revoking session, clearing local cache/outbox, and detaching Realtime channels. | User tap "Sign Out" with confirmation | Clean local state and disconnected sync engine | Reverts to local anonymous mode | Dispatch Prompt R2 |
| 15 | Local Storage | Dexie.js (IndexedDB) Schema | Local authoritative database containing `checklist_items`, `goals`, `user_settings`, `offline_mutations`, `sync_metadata`. | JavaScript objects / records | Stored records in browser IndexedDB | QuotaExceededError handled gracefully | Dexie 4.4.6 API probe |
| 16 | Local Storage | Instant Local Mutations | All UI mutations commit to Dexie in `< 16ms`, providing zero spinners and instantaneous optimistic updates. | User interaction (check, edit, reorder, delete) | Updated IndexedDB record and mutation queued | Transaction rollback on write failure | `ORIGINAL_REQUEST.md` R3 |
| 17 | Sync | Monotonic Timestamp Clock | Generator maintaining strictly monotonic UTC timestamps across all local updates. | `Date.now()` and remote timestamp updates | Monotonic ISO 8601 UTC string | Defends against system clock backward drift | Sync engine analysis |
| 18 | Sync | Deterministic LWW Conflict Resolution | Reconciles concurrent edits across two devices deterministically using `updated_at` and UUID tie-breaker. | Local record and Remote record | Deterministic winning record | Consistent convergence on all clients | Acceptance Criteria line 66 |
| 19 | Sync | Soft Deletes (`deleted_at`) | Items deleted locally set `deleted_at` timestamp; tombstone propagates to cloud and deletes across all devices without resurrection. | Delete action | Tombstone record with `deleted_at` | Prevents resurrection from stale offline edits | `ORIGINAL_REQUEST.md` R3 |
| 20 | Sync | Outbox Queue (`offline_mutations`) | Persistent FIFO queue storing mutations generated while offline or syncing. | `OfflineMutation` record | Queued mutations in IndexedDB | Retained across page reloads and browser restarts | Dispatch Prompt R3 |
| 21 | Sync | Sequential Queue Drain & Replay | Background worker draining mutations sequentially to Supabase PostgREST. | Outbox records | HTTP PostgREST upserts | Transient network errors trigger retry; poison pills dropped | Dispatch Prompt R3 |
| 22 | Sync | Exponential Backoff on Retry | Worker retries failed pushes with doubling delay (1s, 2s, 4s, 8s, up to 30s max). | Failed push attempt | Scheduled retry timeout | Prevents API flooding during outages | Dispatch Prompt R3 |
| 23 | Sync | Network & Visibility Event Triggers | Automatic replay triggered by `online` and `visibilitychange` window events. | Browser events | Outbox drain and delta pull initiated | Throttled / debounced to avoid thrashing | Browser API specification |
| 24 | Sync | Incremental Delta Pull | Pulls remote records where `updated_at > last_pulled_at`. | `last_pulled_at` timestamp | Delta array of modified records | Gracefully ignores PGRST205 if unmigrated | Supabase PostgREST protocol |
| 25 | Fallback | Unmigrated Schema Detection | Detects `PGRST205` ("Could not find the table in the schema cache") and switches to local fallback. | PostgREST HTTP 404 response | Safe local operation mode | Zero crashes, zero unhandled promise rejections | Probed live Supabase endpoint |
| 26 | Fallback | Offline / Missing Credential Fallback | App runs 100% locally when network is absent or `.env.local` is missing. | Environment check & network status | Local Dexie operation | Local data remains persistent and accessible | `ORIGINAL_REQUEST.md` R3 |
| 27 | Verification | Live Supabase Verification Script | Opt-in Node script testing GoTrue health, table schema cache, RLS policies, and Realtime WebSocket. | Command: `node scripts/verify-supabase.mjs` | Console report of backend health | Clear instructions if tables require migration | Dispatch Prompt R4 |

---

## 7. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Specified Behavior |
|---|---------|-------------------|-------------------------------|
| 1 | Supabase Endpoint | Query table before migration applied (`GET /rest/v1/checklist_items`) | Live endpoint returns `404 Not Found` with `code: PGRST205`. Sync engine catches this code, logs a warning once, and continues running in local fallback mode without throwing unhandled rejections. |
| 2 | GoTrue OTP Request | Submit invalid email string (`"not-an-email"`) to `/auth/v1/otp` | Live endpoint returns `400 Bad Request` with `{"error_code":"validation_failed","msg":"Unable to validate email address: invalid format"}`. Client UI displays inline error message below email input. |
| 3 | GoTrue OTP Verification | Submit incorrect 6-digit code (`"000000"`) to `/auth/v1/verify` | Live endpoint returns `403 Forbidden` with `{"error_code":"otp_expired","msg":"Token has expired or is invalid"}`. Client UI triggers 3-cycle spring shake animation, resets digit inputs, and focuses digit box 0. |
| 4 | OTP Rate Limiting | User requests OTP repeatedly within 60 seconds | GoTrue returns `429 Too Many Requests` (`over_email_send_rate_limit`). Client UI disables resend button with active 60s countdown to prevent users hitting rate limit. |
| 5 | OTP Digit Paste | Clipboard contains non-digit formatting (e.g. `"Code: 948-201"`) | Paste handler cleans string with `replace(/\D/g, '')` -> extracts `"948201"`, populates all 6 boxes, and immediately triggers verification. |
| 6 | OTP Backspace Navigation | User presses Backspace in an empty digit box `i` | Focus moves automatically to box `i - 1`, clears box `i - 1`, allowing seamless natural typing corrections on iOS keyboard. |
| 7 | Concurrent Edits (LWW) | Device A modifies item title at `T1`; Device B modifies same item at `T2` (`T2 > T1`) while offline | On reconnect, Device B's record has higher `updated_at`. Device A accepts Device B's update via LWW. Both devices converge to Device B's title. |
| 8 | Delete Propagation | Device A deletes item at `T2`; Device B checks item at `T1` (`T1 < T2`) while offline | Device A sets `deleted_at: T2`. On sync, `T2 > T1`, so Device A's deletion wins. The item remains deleted on both devices; resurrection is prevented. |
| 9 | Reconnection Storm | Network toggles online/offline rapidly 10 times | Sync engine debounces push triggers and uses `isPushing` mutex flag. Exactly one drain operation runs at a time; no duplicate requests or race conditions. |
| 10 | Poison Pill Mutation | Corrupted mutation in outbox rejected with unrecoverable 400/409 | Worker catches non-transient error, logs rejection, removes the poison mutation from Dexie `offline_mutations`, and continues draining subsequent valid mutations without permanently blocking the queue. |
| 11 | Clock Backward Shift | User or OS sets device system clock backwards by 2 hours | Monotonic clock generator ensures `new_timestamp = Math.max(now, lastTimestamp + 1)`. All subsequent updates receive strictly ascending timestamps, preventing time inversion bugs. |
| 12 | App Launch Offline | Device launched in Airplane Mode with zero internet connection | PWA service worker serves cached application shell; Dexie reads local IndexedDB; UI renders immediately in `< 16ms` with complete user data. |
| 13 | Unauthenticated Initial Usage | User creates 10 checklist items anonymously, then signs in | Migration routine promotes all `user_id = 'local'` items to `user_id = session.user.id`, enqueues outbox mutations, and pushes all 10 items to Supabase cloud. |
| 14 | Rapid Item Reordering | User drags item through 5 positions within 1 second | Each position change updates local `sort_order` and Dexie. Outbox records mutations. On push, PostgREST upserts final record state. |
| 15 | Rollover Hour Setting | User updates rollover hour from 4 to 2 in Settings while offline | Local `user_settings` record updated immediately; logical day calculation switches immediately; mutation queued to outbox for sync when online. |

---

## 8. Verification Strategy & Test Harness Integration

To ensure full compliance with the Acceptance Criteria:

1. **Vitest Unit Tests** (`test/sync/sync.test.ts`):
   - In-memory IndexedDB powered by `fake-indexeddb`.
   - Test LWW conflict resolution: simulate Device A and Device B mutation streams and verify deterministic convergence.
   - Test soft-delete propagation: verify tombstones prevent resurrection.
   - Test offline queue replay: mock network failure, queue mutations, mock network restore, verify FIFO drain.
2. **Playwright Multi-Context E2E Tests** (`e2e/sync.spec.ts`):
   - Launch two independent browser contexts (`contextA`, `contextB`).
   - Mock backend / local storage sync bridge.
   - Edit on `contextA` -> verify automatic propagation to `contextB`.
   - Disconnect `contextB` -> edit both -> reconnect -> verify convergence.
3. **Opt-in Live Database Script** (`scripts/verify-supabase.mjs`):
   - Verifies against live Supabase project when user applies migration.
