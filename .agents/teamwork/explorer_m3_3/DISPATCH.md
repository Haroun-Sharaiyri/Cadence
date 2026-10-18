## 2026-10-18T08:38:37Z
You are explorer_m3_3, an exploration specialist for Milestone 3: Apple-Grade Interactions, Motion & UI Components.
Your working directory is: c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m3_3
Your parent orchestrator is: bead4d79-c7a2-42ab-8259-8e33bcf7fd9e

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the global specifications and existing code:
c:\Users\shqai\Downloads\Repo\Checklist\PROJECT.md
c:\Users\shqai\Downloads\Repo\Checklist\src\domain\types.ts
c:\Users\shqai\Downloads\Repo\Checklist\src\domain\countdown.ts
c:\Users\shqai\Downloads\Repo\Checklist\src\db\repository.ts
c:\Users\shqai\Downloads\Repo\Checklist\src\hooks\useChecklist.ts
c:\Users\shqai\Downloads\Repo\Checklist\src\App.tsx
c:\Users\shqai\Downloads\Repo\Checklist\src\components\desktop\DesktopLayout.tsx

YOUR MISSION:
Formulate the concrete, production-ready implementation plan and complete TypeScript code for Milestone 3 Bottom Sheets, Goal Hero & App Integration:
1. `src/components/sheets/BottomSheet.tsx`:
   - Reusable iOS 26 Liquid Glass bottom sheet modal with drag handle bar (`w-9 h-1 rounded-full`).
   - Drag-to-dismiss gesture with Framer Motion (`drag="y"`, dismiss on drag offset > 100px or downward velocity).
   - Backdrop dim (`bg-black/40 backdrop-blur-md`) with fade transition.
   - Rounded-t-[28px] on mobile, centered modal card on desktop.
   - Accessibility (`role="dialog"`, `aria-modal="true"`, Escape key dismiss), safe area padding.
2. `src/components/goal/GoalHeroCard.tsx` & `src/components/sheets/GoalEditorSheet.tsx`:
   - Glass squircle card displaying primary goal statement and dynamic countdown ("X days left", "Due today", etc.) from `computeGoalCountdown`. Tap opens Goal Editor Sheet.
   - Goal Editor Sheet: goal statement text input, target date picker, Save and Clear Goal buttons.
3. `src/components/sheets/SettingsSheet.tsx`:
   - Rollover hour picker (0-23 hours, default 4:00 AM) connected to `useChecklist` settings (`updateSettings({ rollover_hour: newHour })`), explaining daily habit reset time.
   - Auth status display (Guest / Local offline mode, Sign In button ready for M4).
4. `src/components/sheets/ClearCompletedSheet.tsx`:
   - "Clear Completed" button in Work tab header or footer, visible ONLY when `>= 1` item in `work` list is checked.
   - Opens iOS confirmation sheet ("Clear X Completed Tasks?").
   - On confirm: calls `checklistRepository.clearCompletedWorkItems()`, soft-deleting only completed work items.
5. Complete Wiring in `App.tsx` and `DesktopLayout.tsx`:
   - Connect `useChecklist` to `App.tsx` and `DesktopLayout.tsx`.
   - Wire all sections (`today_morning`, `today_work`, `today_evening`, `work`), progress rings, goal hero, and settings.
   - Wire Add Item, Toggle Item, Rename Item, Reorder Item, Delete Item.
6. Provide complete, production-ready TypeScript code in `analysis.md`.
7. Write handoff report to `c:\Users\shqai\Downloads\Repo\Checklist\.agents\teamwork\explorer_m3_3\handoff.md`.
8. Send completion message to parent orchestrator bead4d79-c7a2-42ab-8259-8e33bcf7fd9e.
