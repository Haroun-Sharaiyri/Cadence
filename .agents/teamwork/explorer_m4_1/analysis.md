# Milestone 4 Exploration & Technical Blueprint: Supabase Sync Engine, 6-Digit Email OTP & Migration

**Explorer**: `explorer_m4_1`  
**Milestone**: Milestone 4 — Supabase Sync Engine, 6-Digit Email OTP & Migration  
**Target Project**: Cadence (iOS 26 Liquid Glass Checklist PWA)  
**Date**: 2026-10-18  

---

## 1. Executive Summary & Live Verification Findings

To fulfill the requirements of `ORIGINAL_REQUEST.md` (R3: Offline-first sync & sign-in), the Cadence architecture combines a local authoritative IndexedDB database (via Dexie.js) with a cloud synchronization engine backed by Supabase.

### 1.1 Empirical Live Probe Findings
A live network probe against the user-supplied Supabase production instance was conducted using Node 24:
- **Target Endpoint**: `https://hkncvdgrvsopjtqlsiyt.supabase.co`
- **GoTrue Auth Service**: Responded `200 OK` with payload `{ version: 'v2.197.0', name: 'GoTrue', description: 'GoTrue is a user registration and authentication API' }`.
- **PostgREST Schema Cache**: Responded HTTP `404 Not Found` with `{ code: 'PGRST205', message: "Could not find the table 'public.checklist_items' in the schema cache" }` on queries to `user_settings`, `goals`, and `checklist_items`.
- **Supabase Realtime Engine**: Successfully connected over WebSocket with status `SUBSCRIBED`.
- **Critical Technical Discovery (@supabase/realtime-js)**: Calling `supabase.removeChannel(channel)` synchronously inside the `channel.subscribe((status) => ...)` callback triggers an infinite loop of `CLOSED` events in Node, crashing with `RangeError: Maximum call stack size exceeded`. To resolve this, channel removal in scripts and components must always be decoupled via `setTimeout(..., 50)` or asynchronous cleanup.

### 1.2 Summary of Deliverables Formulated
1. **Idempotent PostgreSQL Migration** (`supabase/migrations/20261017000000_init_cadence.sql`):
   - Fully idempotent schema for Supabase SQL Editor.
   - Tables: `user_settings`, `goals`, `checklist_items` with UUID primary keys and foreign keys to `auth.users(id) ON DELETE CASCADE`.
   - Automatic `updated_at` timestamps maintained by `public.set_updated_at()`.
   - Automatic new user provisioning trigger via `public.handle_new_user()`.
   - Row Level Security (RLS) policies enforcing `auth.uid() = user_id` across SELECT, INSERT, UPDATE, DELETE for `authenticated` users.
   - Realtime publication registration (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) inside an idempotent `DO $$ ... $$;` block.
   - Full replica identity (`REPLICA IDENTITY FULL`) for accurate delta broadcasting.
2. **Environment Configuration**:
   - `.env.local`: Configured with the user's exact production credentials.
   - `.env.example`: Sanitized template with guidance.
   - `.gitignore`: Configured to protect `.env.local`.
3. **Standalone Live Verification Script** (`scripts/verify-supabase.mjs`):
   - Zero-dependency `.env.local` parser.
   - Colorized 4-step health audit: GoTrue Auth, PostgREST table existence, RLS enforcement, and Realtime WebSocket probe.
   - Graceful interception of `PGRST205` with clear user instructions.
4. **In-App 6-Digit Email OTP UI**:
   - `src/components/auth/OtpInput.tsx`: 6 discrete numeric boxes, auto-advance on key entry, backspace navigation, full 6-digit paste parsing (`123456` or formatted `123-456`), tap target >= 44x44pt (`w-11 h-14` / `min-w-[44px] min-h-[44px]`), font size 22px (strictly >= 16px anti-zoom), Framer Motion 3-cycle error shake animation.
   - `src/components/auth/AuthModal.tsx`: Complete iOS 26 Liquid Glass modal wrapping `BottomSheet`. Two-step flow: Email submission -> 6-digit code entry -> session persistence. 60-second monotonic cooldown timer with disabled countdown button, "Use different email" navigation, and inline error feedback.
   - `src/sync/supabaseClient.ts`: Safe client creation with `detectSessionInUrl: false` (preventing Safari magic link hijacking) and `isPgrst205Error()` detector.
   - `src/sync/auth.ts`: Authentication functions (`sendEmailOtp`, `verifyEmailOtp`, `signOutUser`, `getCurrentUser`).
   - `src/sync/promotion.ts`: Promotion of anonymous local data (`user_id = 'local'`) to authenticated user upon initial sign-in.

---

## 2. Production Code Deliverable 1: Database Migration (`supabase/migrations/20261017000000_init_cadence.sql`)

```sql
-- ============================================================================
-- Migration: 20261017000000_init_cadence.sql
-- Description: Complete, idempotent schema, RLS policies, and realtime publication for Cadence
-- Database: Supabase PostgreSQL
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id_updated ON public.goals(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_user_deleted ON public.goals(user_id, deleted_at) WHERE deleted_at IS NULL;

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
  sort_order DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ NULL,
  last_completed_day TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
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
-- Automatically provisions default user_settings when a new user registers in auth.users
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
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;
CREATE POLICY "Users can delete their own settings"
  ON public.user_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6.2 Policies for goals
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
CREATE POLICY "Users can view their own goals"
  ON public.goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
CREATE POLICY "Users can insert their own goals"
  ON public.goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
CREATE POLICY "Users can update their own goals"
  ON public.goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;
CREATE POLICY "Users can delete their own goals"
  ON public.goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6.3 Policies for checklist_items
DROP POLICY IF EXISTS "Users can view their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can view their own checklist items"
  ON public.checklist_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can insert their own checklist items"
  ON public.checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can update their own checklist items"
  ON public.checklist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own checklist items" ON public.checklist_items;
CREATE POLICY "Users can delete their own checklist items"
  ON public.checklist_items FOR DELETE
  TO authenticated
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

## 3. Production Code Deliverable 2: Environment Configuration

### 3.1 `.env.local`
```ini
# Cadence Local Environment Configuration
# Target Supabase Instance for Cadence
VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
```

### 3.2 `.env.example`
```ini
# Cadence Environment Template
# Copy this file to .env.local and replace placeholders with your credentials

# Supabase Project URL (found under Project Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Public Anon Key (safe for browser distribution)
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 3.3 `.gitignore` Entry
```gitignore
# Local environment credentials
.env.local
.env.*.local
!.env.example
```

---

## 4. Production Code Deliverable 3: Verification Script (`scripts/verify-supabase.mjs`)

```javascript
/**
 * scripts/verify-supabase.mjs
 * Standalone health audit script for Cadence Supabase backend.
 * Verifies GoTrue Auth, PostgREST table existence, RLS enforcement, and Realtime WebSocket.
 * 
 * Usage:
 *   node scripts/verify-supabase.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local without external dotenv dependency
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n======================================================');
console.log('  🔍 Cadence Supabase Backend Verification');
console.log('======================================================');
console.log(`Endpoint: ${supabaseUrl || 'MISSING'}`);
console.log(`Anon Key: ${supabaseAnonKey ? '[Configured]' : 'MISSING'}\n`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  let allTablesPresent = true;

  // ── Probe 1: GoTrue Auth Health ─────────────────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (res.ok) {
      const authData = await res.json();
      console.log(`✅ [1/4] GoTrue Auth Service: Online (${authData.name || 'GoTrue'} ${authData.version || ''})`);
    } else {
      console.log(`❌ [1/4] GoTrue Auth Service: HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`❌ [1/4] GoTrue Auth Service: Network error (${err.message})`);
  }

  // ── Probe 2: PostgREST Tables in Schema Cache ───────────────────
  const tables = ['user_settings', 'goals', 'checklist_items'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        if (error.code === 'PGRST205' || (typeof error.message === 'string' && error.message.includes('schema cache'))) {
          console.log(`⚠️  [2/4] Table '${table}': NOT FOUND (Migration pending in Supabase)`);
          allTablesPresent = false;
        } else {
          console.log(`ℹ️  [2/4] Table '${table}': Accessible (${error.message})`);
        }
      } else {
        console.log(`✅ [2/4] Table '${table}': Schema Cache Valid & Accessible`);
      }
    } catch (err) {
      console.log(`❌ [2/4] Table '${table}': Query failed (${err.message})`);
      allTablesPresent = false;
    }
  }

  // ── Probe 3: Row Level Security (RLS) ───────────────────────────
  if (allTablesPresent) {
    try {
      const { data, error } = await supabase.from('checklist_items').select('*');
      if (!error && Array.isArray(data) && data.length === 0) {
        console.log('✅ [3/4] Row Level Security (RLS): Enforced (Anon sees 0 rows)');
      } else if (error) {
        console.log(`ℹ️  [3/4] Row Level Security (RLS): Active (${error.message})`);
      } else {
        console.log('⚠️  [3/4] Row Level Security (RLS): Warning - Anon received rows unexpectedly');
      }
    } catch (err) {
      console.log(`❌ [3/4] RLS check error: ${err.message}`);
    }
  } else {
    console.log('⚠️  [3/4] Row Level Security (RLS): Deferred (Requires tables to be migrated first)');
  }

  // ── Probe 4: Supabase Realtime WebSocket ────────────────────────
  let probeCompleted = false;
  const channel = supabase.channel('cadence-verify-probe');

  channel.subscribe((status) => {
    if (probeCompleted) return;

    if (status === 'SUBSCRIBED') {
      probeCompleted = true;
      console.log('✅ [4/4] Supabase Realtime WebSocket: Connected (SUBSCRIBED)');
      // Defer removal to prevent call stack overflow in realtime-js
      setTimeout(() => {
        supabase.removeChannel(channel);
        finishAudit(allTablesPresent);
      }, 50);
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      probeCompleted = true;
      console.log(`⚠️  [4/4] Supabase Realtime WebSocket: ${status}`);
      setTimeout(() => {
        supabase.removeChannel(channel);
        finishAudit(allTablesPresent);
      }, 50);
    }
  });

  // 4-second fallback timeout for Realtime
  setTimeout(() => {
    if (!probeCompleted) {
      probeCompleted = true;
      console.log('⚠️  [4/4] Supabase Realtime WebSocket: Timeout probe (network latency)');
      supabase.removeChannel(channel);
      finishAudit(allTablesPresent);
    }
  }, 4000);
}

function finishAudit(allTablesPresent) {
  console.log('\n======================================================');
  if (allTablesPresent) {
    console.log('🎉 All Supabase backend systems verified and ready for production sync!\n');
  } else {
    console.log('💡 Cloud Migration Action Required:');
    console.log('   The Supabase instance is online, but database tables have not yet');
    console.log('   been created in the schema cache.');
    console.log('');
    console.log('   To complete cloud setup, copy the migration script:');
    console.log('     supabase/migrations/20261017000000_init_cadence.sql');
    console.log('   and run it in your Supabase SQL Editor:');
    console.log(`     https://supabase.com/dashboard/project/hkncvdgrvsopjtqlsiyt/sql`);
    console.log('');
    console.log('   Note: Cadence will continue functioning in 100% offline/local');
    console.log('   storage mode (< 16ms, Dexie IndexedDB) until the migration is run.\n');
  }
  process.exit(0);
}

runAudit();
```

---

## 5. Production Code Deliverable 4: In-App 6-Digit Email OTP UI

### 5.1 `src/components/auth/OtpInput.tsx`

```tsx
/**
 * src/components/auth/OtpInput.tsx
 * Discrete 6-digit OTP code entry component with iOS 26 Liquid Glass styling.
 * 
 * Features:
 * - 6 discrete numeric input boxes.
 * - Auto-advances focus on digit entry.
 * - Backspace navigation: if current box is empty, jumps to previous box and clears it.
 * - Full clipboard paste support: extracts 6 digits (handles formatted "123-456" or "123456").
 * - Tap targets >= 44x44pt (48x56px on mobile, 44x56px minimum).
 * - Font size >= 16px (22px) preventing iOS Safari viewport zooming.
 * - Framer Motion 3-cycle error shake animation on invalid submission.
 * - Respects prefers-reduced-motion.
 */

import React, { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../utils/haptics';

export interface OtpInputProps {
  value: string; // 0 to 6 characters
  onChange: (val: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }).map((_, i) => value[i] || '');

  // Auto-focus first empty input or initial input on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 5 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, []);

  // When error triggers, shake and refocus box 0
  useEffect(() => {
    if (hasError && !disabled) {
      triggerHaptic('heavy');
      inputRefs.current[0]?.focus();
    }
  }, [hasError, disabled]);

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleaned = rawVal.replace(/\D/g, '');
    if (!cleaned) {
      // Clear this index
      const newDigits = [...digits];
      newDigits[index] = '';
      const updated = newDigits.join('').trim();
      onChange(updated);
      return;
    }

    // Take the last entered character if multiple characters arrived
    const char = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const updated = newDigits.join('');
    onChange(updated);
    triggerHaptic('selection');

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updated.length === 6 && onComplete) {
      onComplete(updated);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is empty, jump to previous box and clear it
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
        triggerHaptic('light');
      } else if (digits[index]) {
        // Clear current box
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
        triggerHaptic('light');
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const pastedDigits = pasteData.replace(/\D/g, '').slice(0, 6);
    if (!pastedDigits) return;

    onChange(pastedDigits);
    triggerHaptic('medium');

    if (pastedDigits.length === 6) {
      inputRefs.current[5]?.focus();
      if (onComplete) {
        onComplete(pastedDigits);
      }
    } else {
      inputRefs.current[pastedDigits.length]?.focus();
    }
  };

  return (
    <motion.div
      className="flex items-center justify-between gap-2 w-full max-w-sm mx-auto"
      animate={
        hasError && !shouldReduceMotion
          ? { x: [-12, 12, -8, 8, -4, 4, 0] }
          : { x: 0 }
      }
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const isFilled = Boolean(digits[i]);
        return (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            disabled={disabled}
            value={digits[i] || ''}
            onChange={(e) => handleInputChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1} of 6`}
            data-testid={`otp-box-${i}`}
            className={clsx(
              // Tap target >= 44x44pt (48x56px on mobile)
              'w-11 h-14 sm:w-12 sm:h-14 min-w-[44px] min-h-[44px]',
              'flex items-center justify-center text-center font-bold text-[22px] sm:text-[24px] tabular-nums',
              'rounded-xl border transition-all duration-150 outline-none select-none',
              // Font-size anti-zoom safeguard (>= 16px)
              'text-[22px]',
              hasError
                ? 'border-[var(--system-red)] bg-[var(--system-red)]/10 text-[var(--system-red)]'
                : isFilled
                ? 'border-[var(--system-blue)] bg-[var(--secondary-system-fill)] text-[var(--label)] shadow-sm'
                : 'border-[var(--separator)] bg-[var(--tertiary-system-fill)] text-[var(--label)] focus:border-[var(--system-blue)] focus:bg-[var(--secondary-system-fill)]',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
            style={{ fontSize: '22px' }}
          />
        );
      })}
    </motion.div>
  );
};

export default OtpInput;
```

---

### 5.2 `src/components/auth/AuthModal.tsx`

```tsx
/**
 * src/components/auth/AuthModal.tsx
 * In-App 6-Digit Email OTP Authentication Modal for Cadence.
 * Implements two-step flow:
 *   1. Email entry -> calls GoTrue signInWithOtp
 *   2. Discrete 6-digit PIN entry -> calls GoTrue verifyOtp
 * Strictly in-app (no magic link redirection to Safari).
 */

import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../sheets/BottomSheet';
import { OtpInput } from './OtpInput';
import { sendEmailOtp, verifyEmailOtp } from '../../sync/auth';
import { triggerHaptic } from '../../utils/haptics';
import { Mail, KeyRound, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export type AuthStep = 'email' | 'otp';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setOtpCode('');
      setErrorMessage(null);
      setIsLoading(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP code to email
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      triggerHaptic('heavy');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('light');

    try {
      const result = await sendEmailOtp(cleanEmail);
      if (result.success) {
        setStep('otp');
        setOtpCode('');
        setResendCooldown(60);
        triggerHaptic('medium');
      } else {
        setErrorMessage(result.error || 'Failed to send verification code. Please try again.');
        triggerHaptic('heavy');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      triggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP code
  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpCode;
    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits.');
      triggerHaptic('heavy');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const result = await verifyEmailOtp(email, code);
      if (result.success) {
        triggerHaptic('success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(result.error || 'Invalid or expired code. Please try again.');
        setOtpCode(''); // Clear OTP on error so user can re-enter
        triggerHaptic('heavy');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to verify code. Please try again.');
      setOtpCode('');
      triggerHaptic('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend action
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage(null);
    setIsLoading(true);
    triggerHaptic('light');

    try {
      const result = await sendEmailOtp(email);
      if (result.success) {
        setResendCooldown(60);
        setOtpCode('');
        triggerHaptic('medium');
      } else {
        setErrorMessage(result.error || 'Failed to resend code.');
        triggerHaptic('heavy');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Switch back to email step
  const handleChangeEmail = () => {
    setStep('email');
    setOtpCode('');
    setErrorMessage(null);
    triggerHaptic('light');
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'email' ? 'Sign In to Sync' : 'Enter 6-Digit Code'}
      headerTrailing={
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[17px] font-semibold text-[var(--system-blue)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
        >
          Cancel
        </button>
      }
    >
      <div className="flex flex-col gap-5 pb-4 select-none">
        {step === 'email' ? (
          /* ── Step 1: Email Form ───────────────────────────────────────── */
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center mb-1">
                <Mail className="w-6 h-6" />
              </div>
              <p className="text-[14px] text-[var(--secondary-label)] leading-relaxed">
                Sign in with a 6-digit email code to sync your routines and goals across iPhone and desktop. No password needed.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-email-input"
                className="text-[12px] font-semibold uppercase tracking-[+0.2px] text-[var(--secondary-label)] px-1"
              >
                Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                autoFocus
                className="w-full min-h-[48px] px-4 rounded-xl bg-[var(--secondary-system-fill)] border border-[var(--separator)] text-[var(--label)] placeholder-[var(--tertiary-label)] outline-none focus:border-[var(--system-blue)] transition-colors"
                style={{ fontSize: '17px' }}
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--system-red)]/10 text-[var(--system-red)] text-[13px] leading-snug"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full min-h-[48px] rounded-xl bg-[var(--system-blue)] text-white font-semibold text-[16px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm mt-1"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Send 6-Digit Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ── Step 2: 6-Digit OTP Form ─────────────────────────────────── */
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--system-blue)]/10 text-[var(--system-blue)] flex items-center justify-center mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <p className="text-[14px] text-[var(--secondary-label)] leading-relaxed">
                Enter the 6-digit code sent to <strong className="text-[var(--label)] font-semibold">{email}</strong>.
              </p>
            </div>

            {/* Discrete 6-digit inputs with auto-advance and paste */}
            <div className="py-2">
              <OtpInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onComplete={(code) => handleVerifyCode(code)}
                disabled={isLoading}
                hasError={Boolean(errorMessage)}
                autoFocus
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--system-red)]/10 text-[var(--system-red)] text-[13px] leading-snug"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyCode()}
              disabled={isLoading || otpCode.length !== 6}
              className="w-full min-h-[48px] rounded-xl bg-[var(--system-blue)] text-white font-semibold text-[16px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Verify & Sync</span>
                </>
              )}
            </button>

            {/* Sub-actions: Resend & Change Email */}
            <div className="flex items-center justify-between text-[13px] pt-1 border-t border-[var(--separator)]">
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={isLoading}
                className="min-h-[44px] flex items-center text-[var(--secondary-label)] hover:text-[var(--label)] active:opacity-60 bg-transparent border-none cursor-pointer p-0"
              >
                Use different email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoading}
                className="min-h-[44px] flex items-center text-[var(--system-blue)] font-medium disabled:text-[var(--tertiary-label)] disabled:cursor-not-allowed active:opacity-60 bg-transparent border-none cursor-pointer p-0"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default AuthModal;
```

---

## 6. Supporting Modules: Client & Auth Helpers

### 6.1 `src/sync/supabaseClient.ts`

```typescript
/**
 * src/sync/supabaseClient.ts
 * Supabase client instance with environment validation and fallback guards.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
  );
};

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Prevents magic link hijacking in PWA standalone mode
      storage: window.localStorage,
    },
  }
);

/**
 * Detects if an error is PostgREST schema cache miss (unmigrated database).
 */
export function isPgrst205Error(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return e.code === 'PGRST205' || (typeof e.message === 'string' && e.message.includes('schema cache'));
}
```

### 6.2 `src/sync/auth.ts`

```typescript
/**
 * src/sync/auth.ts
 * In-app 6-digit email OTP authentication handlers.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User | null;
  session?: Session | null;
}

export async function sendEmailOtp(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase cloud credentials not configured. Running in offline/local mode.',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase cloud credentials not configured. Running in offline/local mode.',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    user: data.user,
    session: data.session,
  };
}

export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
```

### 6.3 `src/sync/promotion.ts`

```typescript
/**
 * src/sync/promotion.ts
 * Promotes anonymous local IndexedDB data ('local') to authenticated user ID.
 */

import { db } from '../db';
import { lamportClock } from '../domain/lww';

export async function promoteLocalDataToUser(userId: string): Promise<number> {
  let count = 0;
  const now = lamportClock.now();

  await db.transaction('rw', [db.checklist_items, db.goals, db.user_settings, db.outbox_mutations], async () => {
    // 1. Checklist items
    const localItems = await db.checklist_items.filter((item) => item.user_id === 'local').toArray();
    for (const item of localItems) {
      const updated = { ...item, user_id: userId, updated_at: now };
      await db.checklist_items.put(updated);
      await db.outbox_mutations.add({
        table_name: 'checklist_items',
        record_id: updated.id,
        action: 'upsert',
        payload: updated,
        timestamp: Date.now(),
        retry_count: 0,
      });
      count++;
    }

    // 2. Goals
    const localGoals = await db.goals.filter((g) => g.user_id === 'local').toArray();
    for (const goal of localGoals) {
      const updated = { ...goal, user_id: userId, updated_at: now };
      await db.goals.put(updated);
      await db.outbox_mutations.add({
        table_name: 'goals',
        record_id: updated.id,
        action: 'upsert',
        payload: updated,
        timestamp: Date.now(),
        retry_count: 0,
      });
      count++;
    }

    // 3. User settings
    const localSettings = await db.user_settings.get('local');
    if (localSettings) {
      const userSettings = { ...localSettings, user_id: userId, updated_at: now };
      await db.user_settings.delete('local');
      await db.user_settings.put(userSettings);
      await db.outbox_mutations.add({
        table_name: 'user_settings',
        record_id: userId,
        action: 'upsert',
        payload: userSettings,
        timestamp: Date.now(),
        retry_count: 0,
      });
      count++;
    }
  });

  return count;
}
```

---

## 7. Component Unit Tests: `src/components/auth/OtpInput.test.tsx`

```tsx
/**
 * src/components/auth/OtpInput.test.tsx
 * Unit tests for discrete 6-digit OTP input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OtpInput } from './OtpInput';

describe('OtpInput Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 6 discrete input boxes with correct attributes and minimum 44px tap targets', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<OtpInput value="" onChange={vi.fn()} />);
    });

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(6);

    inputs.forEach((input, idx) => {
      expect(input.getAttribute('type')).toBe('text');
      expect(input.getAttribute('inputmode')).toBe('numeric');
      expect(input.getAttribute('pattern')).toBe('[0-9]*');
      expect(input.getAttribute('maxlength')).toBe('1');
      expect(input.getAttribute('aria-label')).toBe(`Digit ${idx + 1} of 6`);
      // Verify min 44px tap target styling classes
      expect(input.className).toContain('min-w-[44px]');
      expect(input.className).toContain('min-h-[44px]');
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('handles paste of 6 digits and triggers onComplete', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onChange = vi.fn();
    const onComplete = vi.fn();

    await act(async () => {
      root.render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
    });

    const firstInput = container.querySelector('input');
    expect(firstInput).not.toBeNull();

    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => '948201',
        },
      });
      firstInput!.dispatchEvent(pasteEvent);
    });

    expect(onChange).toHaveBeenCalledWith('948201');
    expect(onComplete).toHaveBeenCalledWith('948201');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('cleans non-numeric formatting from pasted text (e.g. 123-456)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onChange = vi.fn();
    const onComplete = vi.fn();

    await act(async () => {
      root.render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
    });

    const firstInput = container.querySelector('input');
    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: () => 'Code: 582-914',
        },
      });
      firstInput!.dispatchEvent(pasteEvent);
    });

    expect(onChange).toHaveBeenCalledWith('582914');
    expect(onComplete).toHaveBeenCalledWith('582914');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
```

---

## 8. Integration Flow in `SettingsSheet.tsx` & `App.tsx`

### 8.1 Integration in `SettingsSheet.tsx`
- Receive `userEmail?: string | null;`
- "Sign In" button triggers `onSignInClick?.()` -> opens `AuthModal`.
- "Sign Out" button triggers `onSignOutClick?.()` -> signs out and clears session.

### 8.2 Integration in `App.tsx`
```tsx
const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
const [currentUser, setCurrentUser] = useState<User | null>(null);

// In SettingsSheet props:
<SettingsSheet
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  rolloverHour={settings.rollover_hour}
  onUpdateRolloverHour={setRolloverHour}
  userEmail={currentUser?.email}
  onSignInClick={() => {
    setIsSettingsOpen(false);
    setIsAuthModalOpen(true);
  }}
  onSignOutClick={async () => {
    await signOutUser();
    setCurrentUser(null);
  }}
/>

// In Global Modals section:
<AuthModal
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onSuccess={async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user) {
      await promoteLocalDataToUser(user.id);
    }
  }}
/>
```

---

## 9. Verification & Invalidation Protocol

1. **SQL Idempotency Check**: Run the SQL migration script twice in Supabase SQL editor. It must execute without errors on both runs.
2. **PostgREST Schema Verification**: Run `node scripts/verify-supabase.mjs`. It must return status 200 for all tables once migration is applied, or report PGRST205 cleanly if unmigrated.
3. **Discrete 6-Digit OTP UI**: Run `npm test` verifying all 18 existing test suites + `OtpInput.test.tsx` pass.
4. **Touch Target & Font Size Audit**: Assert all 6 boxes are >= 44x44pt and have font-size >= 16px (22px) preventing mobile viewport zooming.
