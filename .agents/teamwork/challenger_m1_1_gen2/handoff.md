# Milestone 1 Empirical Verification Report: App Shell & iOS 26 Liquid Glass

**Agent**: `challenger_m1_1_gen2`  
**Parent Orchestrator**: `bead4d79-c7a2-42ab-8259-8e33bcf7fd9e`  
**Date**: 2026-10-18T07:33:30Z  
**Verdict**: **`REQUEST_CHANGES`**  

---

## 1. Observation

### 1.1 Test Infrastructure Setup
Playwright WebKit browser was initially missing on Windows (`Executable doesn't exist at C:\Users\shqai\AppData\Local\ms-playwright\webkit-2370\Playwright.exe`).  
Command executed:
```powershell
npx playwright install webkit
```
Output:
```
WebKit 27.2 (playwright webkit v2370) downloaded to C:\Users\shqai\AppData\Local\ms-playwright\webkit-2370
Exit code: 0
```

### 1.2 Empirical Execution Logs

#### Suite 1: `tests/m1-stress.spec.ts` (Cross-Browser WebKit & Chromium)
Command executed:
```powershell
npx playwright test tests/m1-stress.spec.ts
```
Summary Output:
- 34 passed, 14 failed (WebKit & Chromium)
- Verbatim Failure Logs:
  ```
  [iphone-17-air-chromium] › tests\m1-stress.spec.ts:128:5 › Mobile Settings modal sheet: check tap targets when opened
  Settings dialog buttons: [
    {
      "text": "Done",
      "width": 42.5,
      "height": 25.5
    }
  ]
  Error: Dialog button "Done" width must be >= 44px (was 42.5px)
  ```
  ```
  [iphone-17-air-chromium] › tests\m1-stress.spec.ts:158:5 › Desktop 1440x900: All interactive elements in header and layout have boundingClientRect >= 44x44
  Desktop interactive elements: [
    {
      "tagName": "BUTTON",
      "text": "Edit",
      "width": 60.34375,
      "height": 34.5
    },
    {
      "tagName": "BUTTON",
      "text": "Settings",
      "width": 40,
      "height": 40
    }
  ]
  Error: Desktop element "Edit" height must be >= 44px (was 34.5px)
  ```

#### Suite 2: `tests/m1-challenger-audit.spec.ts` (Independent Audit Harness)
Command executed:
```powershell
npx playwright test tests/m1-challenger-audit.spec.ts --project=iphone-17-air-chromium --project=desktop-chromium
```
Summary Output: 12 passed, 4 failed.  
Command executed:
```powershell
npx playwright test tests/m1-challenger-audit.spec.ts --project=iphone-17-air-webkit
```
Summary Output: 4 passed, 4 failed.

### 1.3 Detailed Metric Measurements

| Criterion | Target / Requirement | Measured Value | Pass / Fail | Source Location |
|-----------|----------------------|----------------|:-----------:|-----------------|
| **Viewport 420x912 (iPhone 17 Air) Overflow** | `scrollWidth === clientWidth` | `docScrollWidth: 420px, docClientWidth: 420px, overflowingElements: 0` | **PASS** | `src/App.tsx`, `index.html` |
| **Viewport 375x667 (iPhone SE) Overflow** | `scrollWidth === clientWidth` | `scrollWidth: 375px, clientWidth: 375px` | **PASS** | `src/App.tsx` |
| **Desktop 1440x900 Layout** | Side-by-side columns, mobile tab bar hidden | `col0: 572px, col1: 572px, isSideBySide: true, tabList: null` | **PASS** | `src/components/desktop/DesktopLayout.tsx` |
| **Breakpoint 1023px vs 1024px** | 1023px shows tab bar; 1024px hides tab bar | 1023px: `nav[role="tablist"]` present; 1024px: `null` | **PASS** | `src/hooks/useMediaQuery.ts` |
| **Mobile Header Edit Button** | `width >= 44px, height >= 44px` | `44px x 44px` | **PASS** | `src/components/common/CollapsingHeader.tsx:90-97` |
| **Mobile Header Settings Button** | `width >= 44px, height >= 44px` | `44px x 44px` | **PASS** | `src/components/common/CollapsingHeader.tsx:99-106` |
| **Mobile TabBar "Today" Tab** | `width >= 44px, height >= 44px` | `125px x 46px` | **PASS** | `src/components/common/FloatingTabBar.tsx:60-100` |
| **Mobile TabBar "Work" Tab** | `width >= 44px, height >= 44px` | `125px x 46px` | **PASS** | `src/components/common/FloatingTabBar.tsx:60-100` |
| **Mobile Settings Sheet "Done" Button** | `width >= 44px, height >= 44px` | `width: 42.5px, height: 25.5px` | **FAIL** | `src/App.tsx:144-150` |
| **Desktop Header "Edit" Button** | `width >= 44px, height >= 44px` | `width: 60.34px, height: 34.5px` | **FAIL** | `src/components/desktop/DesktopLayout.tsx:122-132` |
| **Desktop Header "Settings" Button** | `width >= 44px, height >= 44px` | `width: 40.0px, height: 40.0px` | **FAIL** | `src/components/desktop/DesktopLayout.tsx:134-145` |
| **Input Font Size Lock** | `font-size >= 16px` (specifically 17px) | `input: 17px, textarea: 17px, select: 17px` | **PASS** | `src/index.css:221-224` |
| **-webkit-tap-highlight-color** | `transparent` | Chromium: `rgba(0, 0, 0, 0)`; CSS rule declared in `*` | **PASS** | `src/index.css:188-192` |
| **overscroll-behavior** | `none` on body/html | Chromium: `none`; CSS rule declared in `html, body, #root` | **PASS** | `src/index.css:194-206` |

---

## 2. Logic Chain

1. **Tap Target Specifications**:
   - `ORIGINAL_REQUEST.md` (§R2 line 24 & Acceptance Criteria line 80) states:
     > "44 pt minimum tap targets"  
     > "Every interactive element is >=44x44 px on mobile."
   - The mission dispatch mandates:
     > "All interactive elements in header, tab bar, and layout have boundingClientRect width >= 44px and height >= 44px."

2. **Analysis of Failing Elements**:
   - **Element 1: Mobile Settings Sheet "Done" Button (`src/App.tsx:144-150`)**:
     ```tsx
     <button
       type="button"
       onClick={() => setIsSettingsOpen(false)}
       className="text-[17px] font-semibold text-[var(--system-blue)]"
     >
       Done
     </button>
     ```
     The button lacks padding or minimum dimensions. Its bounding rectangle measures **42.5px wide by 25.5px high**, which is a direct violation of the 44x44pt Apple HIG touch target rule.
   - **Element 2: Desktop Header "Edit" Button (`src/components/desktop/DesktopLayout.tsx:122-132`)**:
     ```tsx
     className="px-4 py-1.5 rounded-full text-[15px] font-semibold text-[var(--system-blue)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none"
     ```
     With `py-1.5` (6px top/bottom padding) and 15px line height, the total computed height is **34.5px** (< 44px).
   - **Element 3: Desktop Header "Settings" Button (`src/components/desktop/DesktopLayout.tsx:134-145`)**:
     ```tsx
     className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[var(--label)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none"
     ```
     The button explicitly specifies `min-h-[40px] min-w-[40px]`, producing a **40px by 40px** box (< 44px).

3. **Responsive & Viewport Compliance**:
   - Both iPhone 17 Air (420x912) and iPhone SE (375x667) viewports produce zero horizontal overflow (`scrollWidth === clientWidth === 420` and `375`).
   - Desktop viewports (1440x900) correctly hide the mobile floating tab bar and render side-by-side columns of width 572px each.
   - All input controls have font-size strictly locked to 17px (`!important` in `src/index.css`), preventing Safari viewport zoom.
   - Anti-web-ism resets (`-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, `user-select: none`, `touch-action: manipulation`) are properly declared in `src/index.css`.

4. **Inference**:
   - The core responsive architecture and styling are high-grade and functional.
   - However, because 3 interactive buttons fail the boundingClientRect >= 44x44px minimum tap target constraint, Milestone 1 cannot be approved without remediation.

---

## 3. Caveats

- **WebKit-Cairo on Windows**: In Playwright's Windows build of WebKit (WinCairo/WPE), `-webkit-tap-highlight-color` and `overscroll-behavior` do not reflect their values in `window.getComputedStyle(element)`. However, inspection of `src/index.css` confirms they are applied correctly via CSS rules (`* { -webkit-tap-highlight-color: transparent !important; }` and `html, body, #root { overscroll-behavior: none; }`), and Chromium verifies these computed styles as `rgba(0, 0, 0, 0)` and `none`.
- **Review-Only Constraint**: In accordance with the challenger role, no source code in `src/` was modified. The remediation must be applied by the implementing worker.

---

## 4. Conclusion & Required Actions

**Verdict**: **`REQUEST_CHANGES`**

The worker must apply the following 3 fixes to resolve the tap target violations:

1. **Fix Mobile Settings Modal "Done" Button (`src/App.tsx:144-150`)**:
   Add `min-h-[44px] min-w-[44px] px-2 flex items-center justify-center`:
   ```tsx
   <button
     type="button"
     onClick={() => setIsSettingsOpen(false)}
     className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center text-[17px] font-semibold text-[var(--system-blue)]"
   >
     Done
   </button>
   ```

2. **Fix Desktop Header "Edit" Button (`src/components/desktop/DesktopLayout.tsx:128`)**:
   Ensure minimum height of 44px:
   ```tsx
   className="min-h-[44px] px-4 py-2 rounded-full text-[15px] font-semibold text-[var(--system-blue)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none flex items-center justify-center"
   ```

3. **Fix Desktop Header "Settings" Button (`src/components/desktop/DesktopLayout.tsx:141`)**:
   Change `min-h-[40px] min-w-[40px]` to `min-h-[44px] min-w-[44px]`:
   ```tsx
   className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[var(--label)] bg-[var(--secondary-system-fill)] hover:bg-[var(--tertiary-system-fill)] active:scale-95 transition-all select-none"
   ```

---

## 5. Verification Method

To verify the fixes independently:

1. Run the audit test suite:
   ```powershell
   npx playwright test tests/m1-challenger-audit.spec.ts --project=iphone-17-air-chromium --project=desktop-chromium
   ```
2. Verify that Check 3B (Mobile Settings Modal Sheet) and Check 3C (Desktop Header) pass:
   - Check 3B: `Dialog button "Done"` width >= 44px and height >= 44px
   - Check 3C: `Desktop header button "Edit"` height >= 44px
   - Check 3C: `Desktop header button "Settings"` width >= 44px and height >= 44px
3. Invalidation condition: Any interactive button measuring `< 44px` in width or height invalidates Milestone 1 acceptance.
