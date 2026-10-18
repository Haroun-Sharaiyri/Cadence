# Project Orchestration Plan: Cadence

## Objective
Build Cadence, an Apple iOS 26 Liquid Glass PWA checklist app with offline-first Supabase sync, achieving 100% test pass, Playwright E2E across WebKit & Chromium, Lighthouse >=90/95/95, axe-core 0 violations, and 12/12 Apple HIG Design Review passes.

## Phases

### Phase 0: Survey & Specification (Parallel Explorers)
- **Explorer 1 (Spec Miner)**: iOS 26 Liquid Glass Design System, SF Pro / Inter typography, Spring physics, Haptics, PWA manifest, service worker, icons, splash screens, mobile/desktop responsiveness.
- **Explorer 2 (Spec Miner)**: Offline-first architecture, IndexedDB schema, Supabase schema & SQL migration, RLS policies, 6-digit email OTP auth flow, deterministic sync conflict resolution, delete propagation, offline queue replay.
- **Explorer 3 (Explorer)**: Checklist domain logic (Today tab 3 sections, 4:00 AM user-adjustable rollover without server cron, Goal hero countdown, Work tab persistent list with strikethrough & Clear Completed, Edit mode, progress ring), E2E test scenarios, and quality budget setup.

### Phase 1: Synthesize & Global Project Specification
- Merge explorer findings into `PROJECT.md` at root.
- Define Architecture, Feature Inventory (all features mapped to milestones), Code Layout, Interface Contracts, Milestones.
- Create `TEST_INFRA.md` for E2E Testing Track.

### Phase 2: Dual Track Execution
- **Track A: E2E Testing Track**
  - Harness setup (Playwright WebKit + Chromium, mobile 420x912 + desktop 1440x900).
  - Tiers 1-4 tests (Feature, Boundary, Combinatorial, Real-world).
  - Produces `TEST_READY.md`.
- **Track B: Implementation Track (Iterative Milestones)**
  - Milestone 1: Core Scaffolding, PWA, Layout Shell, iOS 26 Liquid Glass design system.
  - Milestone 2: Local Domain State & Offline Store (IndexedDB, Today 3 sections, Rollover logic, Work list, Goal hero card).
  - Milestone 3: Interactions, Gestures & Motion (Inline rename, drag reorder, swipe-to-delete, progress rings, completion feedback, Settings sheet).
  - Milestone 4: Supabase Sync Engine, Auth OTP, SQL Migration, Offline Queue Replay.
  - Milestone 5: E2E Test Pass (100% Tiers 1-4 pass) & Hardening.
  - Milestone 6: Quality Budgets & Independent Apple Design Review (Lighthouse, axe-core, 12 HIG items).

### Phase 3: Acceptance & Completion Handoff
- Verify all acceptance criteria.
- README and SQL migration validation.
- Final report to Sentinel.
