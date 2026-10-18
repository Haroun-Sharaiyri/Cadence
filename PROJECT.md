# Project: Cadence

## Architecture
Cadence is a single-purpose, installable checklist Progressive Web App (PWA) designed to feel indistinguishable from a first-party Apple iOS 26 app ("Liquid Glass" design language) on iPhone 17 Air (420x912 pt viewport) and desktop (1440x900 viewport).

### High-Level Data Flow & Boundaries
```
┌────────────────────────────────────────────────────────────────────────┐
│ UI Layer (React 19 + TypeScript + Framer Motion)                       │
│  - iOS 26 Liquid Glass Design System (Backdrop blur, specular borders) │
│  - Collapsing Navigation Bar, Inset Grouped Lists                      │
│  - Reminders-style Checkbox, Section Progress Rings, Goal Hero Card    │
│  - Edit Mode (Drag Reorder, Inline Rename, Swipe Delete, Sheets)       │
└────────────────────────────────────────────────────────────────────────┘
                                │
               Direct, instant reactive reads/writes
                     (useLiveQuery < 16ms)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Local Domain & Offline Store (Dexie.js / IndexedDB)                    │
│  - Local tables: checklist_items, goals, user_settings, outbox_mutations│
│  - Pure Domain: logical day calculation: localDate(now - rolloverHour) │
│  - Live 4:00 AM Rollover cascade without page reload                   │
│  - Monotonic Lamport Clock for timestamp generation                    │
└────────────────────────────────────────────────────────────────────────┘
                                │
         Background async queue push & delta pull (online)
             Graceful fallback if unmigrated (PGRST205)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Sync Engine & Supabase Remote Cloud (PostgreSQL + GoTrue + Realtime)   │
│  - In-App 6-Digit Email OTP Authentication                             │
│  - Deterministic Last-Write-Wins (LWW) conflict resolution             │
│  - Soft-Delete Tombstones (deleted_at) for guaranteed delete sync      │
│  - Outbox mutation replay with exponential backoff                     │
│  - Row-Level Security (RLS) isolating user data (auth.uid() = user_id) │
└────────────────────────────────────────────────────────────────────────┘
```

## Code Layout
```
c:\Users\shqai\Downloads\Repo\Checklist\
├── .env.example                               # Environment template
├── .env.local                                 # Local env with Supabase URL & Anon Key
├── index.html                                 # HTML entry point with iOS meta tags & font preloads
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript strict configuration
├── vite.config.ts                             # Vite build configuration + PWA plugins
├── playwright.config.ts                       # Playwright E2E configuration (WebKit & Chromium)
├── vitest.config.ts                           # Vitest unit test configuration
├── lighthouserc.json                          # Lighthouse CI quality budget thresholds
├── public/                                    # Static assets, icons, splash screens, manifest
│   ├── manifest.webmanifest                   # PWA manifest
│   ├── sw.js                                  # Service worker for offline shell caching
│   ├── icons/                                 # App icons (192, 512, apple-touch-icon)
│   └── splash/                                # iPhone 17 Air light & dark splash screens
├── supabase/
│   └── migrations/
│       └── 20261017000000_init_cadence.sql    # Idempotent PostgreSQL schema, RLS, triggers, realtime
├── scripts/
│   └── verify-supabase.mjs                    # Standalone script to verify live Supabase schema & auth
├── src/
│   ├── main.tsx                               # App entry point & service worker registration
│   ├── App.tsx                                # Root container, layout switcher (mobile vs desktop)
│   ├── index.css                              # CSS resets, Liquid Glass tokens, typography scale
│   ├── domain/                                # Pure business logic & algorithms (framework-free)
│   │   ├── types.ts                           # Shared data types (Item, Goal, Settings, Sync)
│   │   ├── rollover.ts                        # Logical day calculation, 4 AM boundary, DST handlers
│   │   ├── rollover.test.ts                   # Unit tests for rollover logic
│   │   ├── countdown.ts                       # Goal target date countdown calculation
│   │   ├── countdown.test.ts                  # Unit tests for countdown
│   │   ├── lww.ts                             # Deterministic LWW conflict resolution
│   │   └── lww.test.ts                        # Unit tests for conflict resolution & convergence
│   ├── db/                                    # Local storage layer
│   │   ├── index.ts                           # Dexie database instance & schema definition
│   │   └── repository.ts                      # Optimistic CRUD operations & outbox enqueue
│   ├── sync/                                  # Offline-first sync engine & Supabase client
│   │   ├── supabaseClient.ts                  # Supabase client initialization & health check
│   │   ├── syncEngine.ts                      # Sync runner, push outbox, pull deltas, LWW reconcile
│   │   ├── syncEngine.test.ts                 # Unit tests for outbox replay & delete propagation
│   │   └── auth.ts                            # In-app 6-digit email OTP auth flow & state
│   ├── components/                            # UI Components
│   │   ├── common/                            # Glass chrome, navigation, buttons
│   │   │   ├── GlassContainer.tsx             # Liquid Glass card / material container
│   │   │   ├── CollapsingHeader.tsx           # Large collapsing iOS title & blurred inline bar
│   │   │   ├── FloatingTabBar.tsx             # Mobile floating glass tab bar
│   │   │   ├── ProgressRing.tsx               # Circular SVG progress ring
│   │   │   ├── BottomSheet.tsx                # iOS-style spring bottom sheet modal
│   │   │   └── ConfirmDialog.tsx              # Confirmation sheet for Clear Completed
│   │   ├── today/                             # Today tab views
│   │   │   ├── TodayView.tsx                  # Main Today container
│   │   │   ├── GoalHeroCard.tsx               # Squircle Goal card, countdown & shimmer
│   │   │   ├── GoalEditorSheet.tsx            # Goal statement & target date editor
│   │   │   ├── RoutineSection.tsx             # Morning, Work Day, Evening routine list
│   │   │   └── CheckboxRow.tsx                # Reminders-style animated checkbox row
│   │   ├── work/                              # Work tab views
│   │   │   ├── WorkView.tsx                   # Persistent list container
│   │   │   ├── SwipeableRow.tsx               # Row with touch swipe-to-delete
│   │   │   └── ClearCompletedBar.tsx          # Clear Completed button & action
│   │   ├── settings/                          # Settings sheet
│   │   │   ├── SettingsSheet.tsx              # Minimal sheet (rollover hour, email, sign in/out)
│   │   │   └── OtpInput.tsx                   # 6 discrete numeric OTP boxes with auto-advance/paste
│   │   └── edit/                              # Native Edit Mode
│   │       ├── EditControls.tsx               # Delete button, drag handle, inline rename
│   │       └── ReorderList.tsx                # Spring-reflowing drag reorder container
│   └── utils/                                 # Helpers
│       ├── haptics.ts                         # Best-effort iOS haptic cues
│       ├── motion.ts                          # Framer Motion spring physics constants
│       └── time.ts                            # Date formatting & monotonic timestamp generator
├── tests/                                     # E2E test suites (Playwright)
│   ├── tier1-features.spec.ts                 # Tier 1: Feature coverage (>=5 per feature)
│   ├── tier2-boundaries.spec.ts               # Tier 2: Boundary & corner cases
│   ├── tier3-cross-feature.spec.ts            # Tier 3: Pairwise combinations & sync convergence
│   ├── tier4-workloads.spec.ts                # Tier 4: Real-world daily usage workflows
│   └── a11y.spec.ts                          # axe-core accessibility scanner
└── README.md                                  # Complete production setup & deployment docs
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | iOS 26 Liquid Glass Design System | Multi-stop backdrop blur, specular borders, light/dark mode parity | M1 | spec_miner_ui |
| 2 | Typography Scale & Anti-Zoom Guard | SF Pro system stack with Inter fallback, input font-size >= 16px | M1 | spec_miner_ui |
| 3 | Safe-Area & Viewport Locks | Dynamic Island & home indicator safe padding, no whole-page bounce | M1 | spec_miner_ui |
| 4 | Collapsing Large Navigation Bar | Smooth transition from prominent screen title to inline blurred header | M1 | spec_miner_ui |
| 5 | Mobile Floating Glass Tab Bar | Floating pill with Today and Work tabs, spring highlight, safe clearance | M1 | spec_miner_ui |
| 6 | Desktop Side-by-Side Layout | >=1024px layout with Goal on top and Today & Work side by side, no tab bar | M1 | spec_miner_ui |
| 7 | Desktop Hover & Keyboard Navigation | Space toggles checkbox, Enter adds item, arrows navigate list | M1 | spec_miner_ui |
| 8 | PWA Manifest & App Shell Caching | Installable PWA manifest (standalone), Service Worker offline cache | M1 | spec_miner_ui |
| 9 | iPhone 17 Air Icons & Splash Screens | Light and dark home screen icons & splash screens (1260x2736px / 420x912pt @3x) | M1 | spec_miner_ui |
| 10 | Anti-Web-Ism Locks | No tap highlights, no text selection, touch-action controls | M1 | spec_miner_ui |
| 11 | Local Dexie.js (IndexedDB) Store | Authoritative instant local storage (<16ms reads/writes, zero spinners) | M2 | spec_miner_sync |
| 12 | Today Tab 3 Daily Sections | Morning Routine, Work Day, Evening Routine persistent lists | M2 | explorer_domain |
| 13 | Logical Day Pure Calculation | localDate(now - rolloverHour) pure function, DST resilience | M2 | explorer_domain |
| 14 | User-Adjustable Rollover Time | Default 4:00 AM local, customizable 0-23 hours in Settings | M2 | explorer_domain |
| 15 | Live 4:00 AM Rollover Cascade | Automatic live uncheck across rollover without page reload (items persist) | M2 | explorer_domain |
| 16 | Goal Hero Card & Dynamic Countdown | Statement display, dynamic countdown calculation ("X days left"), hide when cleared | M2 | explorer_domain |
| 17 | Work Tab Persistent List Model | Items stay in place when checked, struck through and dimmed | M2 | explorer_domain |
| 18 | Pure Domain Unit Test Suite | Vitest tests for rollover (3:59 vs 4:00, DST, custom hour) and countdown | M2 | explorer_domain |
| 19 | Reminders-Style Circular Checkbox | Animated checkmark draw-in, systemBlue fill, struck-through & dimmed text | M3 | spec_miner_ui |
| 20 | Section Progress Rings | Circular progress ring reflecting completed/total items per daily section | M3 | explorer_domain |
| 21 | Restrained Completion Feedback | Subtle glow/pulse on section complete, single shimmer on day complete, no confetti | M3 | explorer_domain |
| 22 | Native-Feeling Edit Mode | Toggle button, leading red minus, trailing drag handles, inline title rename | M3 | explorer_domain |
| 23 | Drag-and-Drop Reordering | Reordering across lists with Framer Motion spring reflow | M3 | spec_miner_ui |
| 24 | Work Tab Swipe-to-Delete | Touch gesture swipe with iOS rubber-banding resistance | M3 | explorer_domain |
| 25 | Clear Completed Action | Visible only when >=1 item checked, confirmation bottom sheet, deletes only checked | M3 | explorer_domain |
| 26 | iOS Bottom Sheet Modals | Drag-to-dismiss, backdrop dim and scale back (Goal editor, Settings, Clear Completed) | M3 | spec_miner_ui |
| 27 | Spring Physics Motion System | Framer Motion physics tuned for 120Hz ProMotion | M3 | spec_miner_ui |
| 28 | Prefers-Reduced-Motion Fallback | Disables springs/slides/scales, substitutes subtle opacity cross-fades | M3 | spec_miner_ui |
| 29 | Best-Effort Haptic Feedback | Safe iOS vibration triggers for completions and toggles | M3 | spec_miner_ui |
| 30 | Supabase Database Schema & Migration | user_settings, goals, checklist_items with RLS and triggers (20261017000000_init_cadence.sql) | M4 | spec_miner_sync |
| 31 | In-App 6-Digit Email OTP Auth | 6 discrete boxes, auto-advance, backspace, paste parsing, session persistence | M4 | spec_miner_sync |
| 32 | Outbox Queue & Offline Replay | FIFO mutation queue in Dexie with exponential backoff on reconnect | M4 | spec_miner_sync |
| 33 | Deterministic LWW Conflict Resolution | Monotonic Lamport clock + UUID tie-breaker for multi-device convergence | M4 | spec_miner_sync |
| 34 | Soft-Delete Tombstone Propagation | deleted_at timestamps prevent resurrection across offline devices | M4 | spec_miner_sync |
| 35 | Graceful Fallback Mode | 100% crash-free local operation when unmigrated (PGRST205) or offline | M4 | spec_miner_sync |
| 36 | Env Config & Live Verification Script | .env.local, .env.example, scripts/verify-supabase.mjs | M4 | spec_miner_sync |
| 37 | Sync Engine Unit Test Suite | Vitest tests for LWW convergence, delete propagation, and queue replay | M4 | spec_miner_sync |
| 38 | Playwright E2E Test Suite (Tiers 1-4) | WebKit & Chromium on iPhone 17 Air (420x912) and Desktop (1440x900) passing 100% | M5 | explorer_domain |
| 39 | Multi-Context Sync Convergence E2E | Playwright multi-page sync convergence test with concurrent edits & deletes | M5 | explorer_domain |
| 40 | Auth OTP Flow E2E | Playwright test verifying 6-digit OTP UI, paste, auto-advance, and state transition | M5 | explorer_domain |
| 41 | Adversarial Coverage Hardening (Tier 5) | White-box edge cases and stress tests | M6 | orchestrator |
| 42 | Automated Lighthouse CI Budgets | Perf >= 90, A11y >= 95, Best Practices >= 95, CLS < 0.02, JS <= 220KB | M6 | explorer_domain |
| 43 | Automated axe-core A11y Audit | Zero serious or critical violations in both light and dark modes | M6 | explorer_domain |
| 44 | Independent Apple HIG 12-Item Review | Automated screenshot capture and 12/12 Pass evaluation | M6 | explorer_domain |
| 45 | Comprehensive Production README | Dev/build commands, Vercel deployment, Supabase setup, iPhone HTTPS testing | M6 | spec_miner_sync |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | App Shell & iOS 26 Liquid Glass Design System | Project scaffolding, PWA manifest, service worker, tokens, typography, safe-area, layout switcher, collapsing title | none | DONE |
| M2 | Checklist Domain, Offline Store & Rollover Engine | Dexie.js schema, domain types, rollover algorithm, 4 AM live cascade, Goal countdown, Work list model, Vitest unit tests | M1 | DONE |
| M3 | Apple-Grade Interactions, Motion & UI Components | Checkbox animation, section progress rings, completion feedback, native Edit mode, drag reorder, swipe delete, bottom sheets | M2 | DONE |
| M4 | Supabase Sync Engine, 6-Digit Email OTP & Migration | SQL migration, .env files, Supabase client with PGRST205 fallback, 6-digit OTP UI, outbox queue replay, LWW sync, sync unit tests | M3 | DONE |
| M5 | E2E Test Suite Pass (Tiers 1-4) & Bug Fixes | Playwright E2E execution across WebKit and Chromium (mobile & desktop), 100% pass on Tiers 1-4, multi-context sync verification | M4 | DONE |
| M6 | Quality Budgets, Apple Design Review & README | Lighthouse CI (>=90/95/95, CLS < 0.02), axe-core 0 violations, 12/12 Apple HIG review, README documentation | M5 | DONE |

## Interface Contracts

### Domain ↔ Local Store (`src/domain` ↔ `src/db`)
- `getLogicalDay(date: Date, rolloverHour: number): string` (`YYYY-MM-DD`)
- `isItemCheckedToday(item: ChecklistItem, logicalDay: string): boolean`
- `computeGoalCountdown(targetDate: string | null, logicalDay: string): CountdownResult | null`
- `db.checklist_items.putItem(item: ChecklistItem): Promise<void>`
- `db.checklist_items.softDeleteItem(id: string): Promise<void>`
- `db.outbox_mutations.enqueue(mutation: OutboxMutation): Promise<void>`

### UI Components ↔ Sync Engine (`src/components` ↔ `src/sync`)
- `useSyncState(): { isOnline: boolean; isSyncing: boolean; lastSyncedAt: Date | null; fallbackMode: boolean }`
- `signInWithEmailOtp(email: string): Promise<{ success: boolean; error?: string }>`
- `verifyEmailOtp(email: string, token: string): Promise<{ success: boolean; error?: string }>`
- `signOut(): Promise<void>`
- `triggerManualSync(): Promise<void>`

### Sync Engine ↔ Supabase (`src/sync` ↔ Supabase Cloud)
- Push: `supabase.from('checklist_items').upsert(items)`
- Pull: `supabase.from('checklist_items').select('*').gt('updated_at', lastPullTime)`
- Error Handler: Catch error code `PGRST205` or network timeout -> activate `fallback_local` mode without UI interruption.
