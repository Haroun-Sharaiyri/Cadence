# E2E Test Infra: Cadence

## Test Philosophy
- Opaque-box, requirement-driven testing derived strictly from `ORIGINAL_REQUEST.md` and user-facing specifications. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- Viewports:
  - Mobile (iPhone 17 Air): 420x912 pt, touch enabled, deviceScaleFactor 3.
  - Desktop: 1440x900 pt, mouse/keyboard enabled.
- Browsers: WebKit and Chromium.

## Feature Inventory & Test Coverage Mapping
| # | Feature | Source (Requirement) | Tier 1 (>=5) | Tier 2 (>=5) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|----------------------|:------------:|:------------:|:-----------------:|:-----------------:|
| 1 | Today 3 Sections & Checkboxes | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | 4:00 AM Rollover & Persistence | ORIGINAL_REQUEST §R1, §R2 | 5 | 5 | ✓ | ✓ |
| 3 | User-Adjustable Rollover Hour | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Goal Hero Card & Countdown | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Work Tab Strikethrough & Clear Completed | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Native Edit Mode (Rename, Delete, Reorder) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 7 | Floating Tab Bar vs Desktop Side-by-Side | ORIGINAL_REQUEST §R1, §R2 | 5 | 5 | ✓ | ✓ |
| 8 | In-App 6-Digit Email OTP Auth UI | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 9 | Offline Operation & Persistence | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 10 | Multi-Context Sync Convergence & Deletes | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `@playwright/test`
- Invocation: `npx playwright test`
- Viewports & Projects:
  - `iphone-17-air-webkit`: WebKit, 420x912, hasTouch: true, isMobile: true
  - `iphone-17-air-chromium`: Chromium, 420x912, hasTouch: true, isMobile: true
  - `desktop-chromium`: Chromium, 1440x900
  - `desktop-webkit`: WebKit, 1440x900
- Directory Layout:
  `tests/`
  ├── tier1-features.spec.ts
  ├── tier2-boundaries.spec.ts
  ├── tier3-cross-feature.spec.ts
  ├── tier4-workloads.spec.ts
  └── a11y.spec.ts

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | The Early Bird Daily Routine | Today 3 sections, checking morning items, progress ring update | Medium |
| 2 | Midnight Worker across 4 AM Rollover | Controlled clock shift from 03:59 to 04:00 AM, live reset cascade, item persistence | High |
| 3 | Multi-Device Sync & Delete Propagation | Two independent browser contexts, concurrent edits, tombstone deletion, convergence | High |
| 4 | Offline Commute to Work | Disconnect network, add items, check off work, reconnect network, queue drain | High |
| 5 | Goal Sprint Countdown | Setting target date 30 days ahead, editing goal statement, verifying countdown text | Medium |

## Quality Budgets & Gates
- Playwright E2E: 100% pass across all 4 projects.
- Lighthouse CI (Mobile Prod): Performance >= 90, Accessibility >= 95, Best Practices >= 95, CLS < 0.02.
- axe-core: Zero serious or critical violations in light and dark modes.
- Bundle Budget: Initial JS bundle <= 220 KB gzipped.
