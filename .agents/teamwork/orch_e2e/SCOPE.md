# Scope: E2E Testing Track Orchestrator

## Reference Documents
- Authoritative User Request: `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Master Plan: `c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md`
- Test Infrastructure Specification: `c:\Users\shqai\Downloads\Repo\Checklist\TEST_INFRA.md`
- Domain & Test Analysis: `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_domain\analysis.md`

## Mission
Design and implement the complete, opaque-box, requirement-driven E2E test suite covering Tiers 1-4, accessibility scans, and multi-browser/viewport configurations. Publish `TEST_READY.md` upon completion.

## Scope of Deliverables
1. **Playwright Configuration (`playwright.config.ts`)**:
   - iPhone 17 Air viewport (420x912 pt, touch enabled, deviceScaleFactor 3) on WebKit and Chromium.
   - Desktop viewport (1440x900 pt) on Chromium and WebKit.
   - Web server integration (`npm run preview` or dev server).
2. **Tier 1 - Feature Coverage Tests (`tests/tier1-features.spec.ts`)**:
   - >=5 test cases per core feature in isolation (Today 3 sections, 4 AM rollover, Goal countdown, Work strikethrough, Edit mode, Floating tab bar, Desktop layout, In-App OTP UI, Offline operations).
3. **Tier 2 - Boundary & Corner Cases (`tests/tier2-boundaries.spec.ts`)**:
   - Empty state rendering, long text titles, special characters, midnight/rollover boundary clock shifts, offline toggle during edit, zero checked items "Clear Completed" visibility guard.
4. **Tier 3 - Cross-Feature & Pairwise Tests (`tests/tier3-cross-feature.spec.ts`)**:
   - Multi-context sync convergence (two independent browser contexts editing concurrently, verifying deterministic convergence).
   - Delete propagation (soft tombstones syncing and removing items on peer context).
   - Reordering during background sync.
5. **Tier 4 - Real-World Application Workloads (`tests/tier4-workloads.spec.ts`)**:
   - Full morning-to-evening daily checklist lifecycle.
   - Multi-device workflow simulation.
6. **Accessibility Scanner (`tests/a11y.spec.ts`)**:
   - Automated axe-core scan on every view in light and dark mode, asserting zero serious/critical violations.
7. **`TEST_READY.md`** published at project root when complete.

## File Ownership
- `playwright.config.ts`
- `tests/*`
- `TEST_READY.md`
