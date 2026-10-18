# Original User Request

## 2026-10-17T19:33:37Z

Build **Cadence**, a single-purpose, installable checklist web app (PWA) for one person. It must feel indistinguishable from a first-party Apple iOS 26 app ("Liquid Glass" design language) on an **iPhone 17 Air**, and also work beautifully on desktop. The product is intentionally tiny. **Almost all of the value is in the slickness, smoothness, prestige and class of the experience**: Apple-level quality in every pixel, animation and interaction. This is production software the user will use every day. The user asked for a team of agents to build it.

Working directory: c:\Users\shqai\Downloads\Repo\Checklist
Integrity mode: development

Environment: Windows, PowerShell, Node 24.13, npm 11.10, git 2.51. The working directory is currently empty.

## Requirements

### R1. Product scope (checklists only, no other features)
- **Today tab (the main daily checklist)** has three sections: **Morning Routine**, **Work Day**, **Evening Routine**. Items in all three sections uncheck automatically each day at a **rollover time (default 4:00 AM local, user-adjustable)**, so late nights still count as the previous day. The items themselves persist; only their checked state resets.
- **Goal**: a hero card pinned at the top of Today. It shows one goal statement plus an optional **target date with a subtle countdown** (e.g. "142 days left"). Tapping it opens an editor.
- **Work tab (side checklist)**: a persistent list. Checked items **stay in place, struck through and dimmed**, until deleted. There is per-item delete (including swipe-to-delete on touch), plus a **"Clear Completed"** action, visible only when >=1 item is checked, which asks for confirmation first.
- **Editing** for every list: add, rename inline, drag to reorder, delete, through a native-feeling Edit mode. Lists start **empty**, with elegant empty states that invite adding the first item.
- **Progress feedback** stays within checklist scope: a refined progress ring per daily section, and a subtle, restrained "done" moment when a section or the whole day is completed (no confetti).
- **Navigation**: on mobile, an iOS 26-style floating glass tab bar with **Today** and **Work**. On desktop (>=1024 px), no tab bar; Goal sits on top with Today and Work side by side.
- A minimal Settings sheet: rollover time, signed-in email, sign out. **Nothing else.** No history, stats, streaks, notifications or other features.

### R2. Apple-grade design & motion (the core of the project)
- Faithful to the iOS 26 Human Interface Guidelines and Liquid Glass: translucent glass materials for bars and controls, large collapsing titles, inset grouped lists, iOS semantic colors, system typography (SF Pro via the system font stack on Apple devices, Inter as the fallback elsewhere), 44 pt minimum tap targets, and correct safe-area handling around the Dynamic Island and home indicator.
- **Accent:** iOS **systemBlue** (#007AFF light / #0A84FF dark) as the primary accent, with **systemCyan** (#32ADE6 / #64D2FF) used sparingly for highlights.
- **Appearance:** automatically follows the system Light/Dark setting, and both modes are equally polished.
- **Motion:** physically based spring animations everywhere (never linear or janky), smooth at 120 Hz ProMotion, a fully respected prefers-reduced-motion path, and best-effort haptics on iOS.
- **Feel:** no web-isms. No tap highlights, accidental text selection, input zoom, rubber-banding of the whole page, layout shift, flashes of unstyled or white content, or loading spinners for local data.
- **App icon and splash screens** for "Cadence" (light and dark), designed to look at home on an iOS 26 Home Screen.

### R3. Offline-first sync & sign-in (user-chosen backend: Supabase)
- The app works fully offline and responds instantly (UI never waits on the network), then syncs in the background between the user's iPhone and desktop when online. Edits made offline on two devices must reconcile deterministically, and deletions must propagate.
- **Sign-in:** email **one-time 6-digit code** entered inside the app (not magic links, which open in Safari instead of the installed PWA on iOS). Once per device. All data is private per user, enforced server-side with Row Level Security.
- **Supabase project** (provided by the user; the anon key is public by design):
  - VITE_SUPABASE_URL=https://hkncvdgrvsopjtqlsiyt.supabase.co
  - VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbmN2ZGdydnNvcGp0cWxzaXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTg0MDIsImV4cCI6MjEwNzgzNDQwMn0.JpNcBD_wBgZuwMuUiXt8j63dD-FUVuGjNTIP7jcv5xs
  - Store them in a git-ignored .env.local, and provide a .env.example.
- The team has **no** database admin credentials. Deliver the complete SQL migration (schema + RLS + realtime setup) as a file for the user to run in the Supabase SQL editor. Until it is run, the app must still work fully locally and must not crash or show raw errors.

### R4. Platform & delivery
- **User-chosen stack:** React + TypeScript + Vite, with Motion (Framer Motion) for animation. Other libraries are at the team's discretion.
- Installable from Safari to the iPhone Home Screen, launching full-screen (standalone) with a proper manifest, icons, iOS meta tags and a service worker for offline launch.
- **Do NOT** create remote GitHub repos, push code or deploy anywhere. The user will handle GitHub + Vercel. A local git repo with sensible commits is fine.
- A **README** covering:
  - local dev, test and build commands
  - Vercel deployment steps, including env vars
  - Supabase setup: run the migration, set the email template to show {{ .Token }}, set the email OTP length to 6, and set site/redirect URLs
  - how to test on a real iPhone from a Windows PC over HTTPS (e.g. a tunnel or local trusted cert)

## Reference: approved design direction (guidance, not mandatory implementation)
The user approved the following direction. Treat it as the quality target. The team may choose different implementations if they meet or exceed it.
- Reminders-style rows: a circular checkbox fills with the accent color, the checkmark draws in, and the title fades to secondary color.
- The collapsing large title ("Today" with a date subtitle, "Work") turns into an inline title over a translucent blurred bar on scroll.
- The Goal card is the visual hero (display type, continuous-curve corners, a quiet blue-to-cyan glow), with a single restrained shimmer when the whole day is complete.
- Bottom sheets (Goal editor, Settings, confirmations) behave like iOS: drag to dismiss, background scales back.
- Swipe-to-delete has iOS rubber-banding. Edit mode shows leading delete controls and trailing drag handles, with springy reflow.
- On desktop: hover states and keyboard support (Space toggles the focused row, Enter adds an item, arrow keys move focus).
- The daily reset can be derived from a "logical day" (localDate(now - rolloverHour)), so no server cron is needed. The list resets live at rollover with a gentle cascade.

## Acceptance Criteria

### Build & code health
- [ ] npm install, then npm run build, npm run lint, a TypeScript strict typecheck and npm test all succeed with zero errors on Windows.
- [ ] Unit tests cover:
  - day-rollover logic (3:59 vs 4:00 AM, DST transitions, a custom rollover hour)
  - sync conflict resolution (concurrent edits on two devices resolve deterministically)
  - delete propagation
  - offline queue replay after reconnect

### End-to-end behavior (Playwright, WebKit **and** Chromium, at 420x912 iPhone 17 Air viewport **and** 1440x900 desktop)
- [ ] Daily sections: add, rename, reorder (drag) and delete items in each of the three sections. Check/uncheck updates the section progress ring.
- [ ] Rollover: with a controlled clock, checks made at 3:59 AM remain until 4:00 AM, then all daily items appear unchecked without a reload. Items persist.
- [ ] Changing the rollover hour in Settings changes the boundary.
- [ ] Work: checked items stay in place, visibly struck through. Swipe-to-delete works on the mobile viewport. "Clear Completed" appears only when >=1 item is checked, requires confirmation, and removes only checked items.
- [ ] Goal: setting a statement and target date shows the correct day countdown. Clearing the date hides the countdown.
- [ ] Persistence & offline: data survives reload. With the network disabled, all actions work and survive reload.
- [ ] Sync: two independent browser contexts converge after concurrent edits, including deletions. Use a test backend or fake, since the live DB schema may not be migrated yet. A separate opt-in script verifies against the live Supabase project once the migration is applied.
- [ ] Sign-in: the email -> 6-digit code UI flow works against a mocked auth service. Code entry supports paste and auto-advance.
- [ ] Layout: mobile shows the floating tab bar. Desktop shows Today and Work side by side with no tab bar.
- [ ] No horizontal overflow at 420 px. Every interactive element is >=44x44 px on mobile. Every text input is >=16 px font size.

### Quality budgets (measured, not self-assessed)
- [ ] Lighthouse (mobile, production build): Performance >= 90, Accessibility >= 95, Best Practices >= 95. The PWA is installable (valid manifest, service worker, offline launch works).
- [ ] Cumulative Layout Shift < 0.02. Initial JS <= 220 KB gzipped.
- [ ] axe-core: zero serious or critical violations on every screen, in both light and dark mode.
- [ ] With prefers-reduced-motion: reduce, there are no spring, slide or scale animations (cross-fades only).

### Apple design review (independent agent-as-judge; must not be an implementing agent)
- [ ] A reviewer captures screenshots (and short recordings or frame sequences for key interactions) of **every** screen and state in light and dark, at both viewports: empty states, populated, checked, edit mode, swiping, sheets, section complete, day complete, sign-in, offline.
- [ ] The reviewer scores each item **Pass/Fail** with written justification:
  1. Matches iOS 26 Liquid Glass look (materials, floating tab bar, translucency)
  2. Typography matches the iOS type scale and hierarchy
  3. Spacing and alignment are on-grid and consistent
  4. Semantic color correctness and parity in light and dark
  5. Safe areas are correct (Dynamic Island, home indicator)
  6. Motion is springy, interruptible and never janky or linear
  7. No web-isms (tap highlight, text selection, zoom, page bounce, flashes)
  8. Empty states feel intentional and elegant
  9. Completion moments are tasteful and restrained
  10. The desktop layout feels premium, not like a stretched phone UI
  11. The app icon and splash screens look at home on an iOS 26 Home Screen
  12. Overall: "Would this pass as an Apple first-party app?"
- [ ] **Ship gate:** all 12 items Pass. Any Fail goes back to the implementers and is re-reviewed.

### Handoff
- [ ] The README covers every item listed in R4, and the SQL migration file applies cleanly to an empty Supabase Postgres database.
- [ ] Final report includes the verification results (test output, Lighthouse scores, bundle size, axe results, design review table) and exact next steps for the user.
