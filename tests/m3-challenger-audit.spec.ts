import { test, expect, type Page } from '@playwright/test';

interface ElementMeasurement {
  name: string;
  selector?: string;
  width: number;
  height: number;
  meetsHIG: boolean;
  notes?: string;
}

/** Helper to add an item to a section via UI */
async function addItemViaUI(page: Page, sectionTitle: string, itemTitle: string) {
  const addBtn = page.locator(`button[aria-label="Add item to ${sectionTitle}"]`);
  await addBtn.click();
  const input = page.locator('input[placeholder="New item…"]');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(itemTitle);
  await input.press('Enter');
  // Wait briefly for reactive render
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

test.describe('Challenger M3 Empirical Verification & Stress Audit', () => {

  test('Check 1: Viewport 420x912 (iPhone 17 Air) - Zero Horizontal Overflow Across All States', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const checkOverflow = async (stateName: string) => {
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');

        const overflowing: Array<{ tag: string; id: string; className: string; scrollWidth: number; clientWidth: number }> = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          // 1px subpixel tolerance
          if (el.scrollWidth > doc.clientWidth + 1) {
            overflowing.push({
              tag: el.tagName,
              id: el.id,
              className: (el.className?.toString() || '').slice(0, 50),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            });
          }
        }

        return {
          viewportWidth: window.innerWidth,
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth,
          rootScrollWidth: root?.scrollWidth ?? 0,
          rootClientWidth: root?.clientWidth ?? 0,
          overflowing,
        };
      });

      console.log(`[AUDIT] Zero Overflow Check [${stateName}]:`, {
        docScrollWidth: result.docScrollWidth,
        docClientWidth: result.docClientWidth,
        overflowCount: result.overflowing.length,
      });

      expect(result.docScrollWidth, `Doc horizontal overflow in state ${stateName}`).toBeLessThanOrEqual(result.docClientWidth + 1);
      expect(result.bodyScrollWidth, `Body horizontal overflow in state ${stateName}`).toBeLessThanOrEqual(result.bodyClientWidth + 1);
      expect(result.rootScrollWidth, `Root horizontal overflow in state ${stateName}`).toBeLessThanOrEqual(result.rootClientWidth + 1);
      expect(result.overflowing.length, `Elements overflowing docClientWidth in state ${stateName}`).toBe(0);
    };

    // State A: Fresh Empty Today View
    await checkOverflow('Today View Empty');

    // State B: Populated Today View
    await addItemViaUI(page, 'Morning Routine', 'Hydrate 500ml');
    await addItemViaUI(page, 'Work Day', 'Deep Focus Session');
    await addItemViaUI(page, 'Evening Routine', 'Reflect on Day');
    await checkOverflow('Today View Populated');

    // State C: Edit Mode Today View
    const editBtn = page.locator('header button', { hasText: 'Edit' });
    await editBtn.click();
    await page.waitForTimeout(200);
    await checkOverflow('Today View Edit Mode');

    // State D: Slide-out Delete Reveal
    const firstMinus = page.locator('button[aria-label^="Delete "]').first();
    await firstMinus.click();
    await page.waitForTimeout(200);
    await checkOverflow('Today View Delete Button Revealed');

    // Exit edit mode
    const doneBtn = page.locator('header button', { hasText: 'Done' });
    await doneBtn.click();
    await page.waitForTimeout(200);

    // State E: Work View Populated with Checked Items
    const workTab = page.locator('nav[role="tablist"] button[role="tab"]', { hasText: 'Work' });
    await workTab.click();
    await page.waitForTimeout(200);
    await addItemViaUI(page, 'Persistent Tasks', 'Triage inbox');
    await addItemViaUI(page, 'Persistent Tasks', 'File expense report');

    // Check one item to reveal Clear Completed button
    const firstCheckbox = page.locator('button[role="checkbox"]').first();
    await firstCheckbox.click();
    await page.waitForTimeout(200);
    await checkOverflow('Work View With Clear Completed Trigger');

    // State F: Clear Completed Sheet Open
    const clearTrigger = page.locator('button', { hasText: /Clear Completed/i });
    await clearTrigger.click();
    await page.waitForTimeout(200);
    await checkOverflow('Clear Completed Sheet Open');
    // Dismiss sheet
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // State G: Settings Sheet Open
    const settingsBtn = page.locator('header button[aria-label="Settings"]');
    await settingsBtn.click();
    await page.waitForTimeout(200);
    await checkOverflow('Settings Sheet Open');
    // Dismiss sheet
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // State H: Goal Editor Sheet Open
    // Switch back to Today tab
    const todayTab = page.locator('nav[role="tablist"] button[role="tab"]', { hasText: 'Today' });
    await todayTab.click();
    await page.waitForTimeout(200);
    const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
    await goalCard.click();
    await page.waitForTimeout(200);
    await checkOverflow('Goal Editor Sheet Open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  test('Check 2: Mobile (420x912) Tap Targets - Strict Apple HIG 44x44pt Verification', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure items exist in all sections
    await addItemViaUI(page, 'Morning Routine', 'Morning Meditation');
    await addItemViaUI(page, 'Work Day', 'Code Review');
    await addItemViaUI(page, 'Evening Routine', 'Read 20 min');

    const measurements: ElementMeasurement[] = [];

    // Helper to measure element and log
    const measureSelector = async (name: string, selector: string) => {
      const loc = page.locator(selector);
      const count = await loc.count();
      for (let i = 0; i < count; i++) {
        const el = loc.nth(i);
        const box = await el.boundingBox();
        const itemName = count > 1 ? `${name} [${i + 1}/${count}]` : name;
        if (!box) {
          measurements.push({ name: itemName, selector, width: 0, height: 0, meetsHIG: false, notes: 'Bounding box null' });
          continue;
        }
        const meetsHIG = box.width >= 43.5 && box.height >= 43.5; // 0.5px subpixel rounding tolerance
        measurements.push({
          name: itemName,
          selector,
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
          meetsHIG,
        });
      }
    };

    // 1. Checkbox buttons (role="checkbox")
    await measureSelector('Checkbox Button (Today)', 'button[role="checkbox"]');

    // 2. SectionHeader Add buttons
    await measureSelector('SectionHeader Add (Morning)', 'button[aria-label="Add item to Morning Routine"]');
    await measureSelector('SectionHeader Add (Work Day)', 'button[aria-label="Add item to Work Day"]');
    await measureSelector('SectionHeader Add (Evening)', 'button[aria-label="Add item to Evening Routine"]');

    // 3. Edit button in mobile header
    await measureSelector('Mobile Header Edit Button', 'header button[aria-label="Edit list"], header button:has-text("Edit")');

    // 4. Settings button in mobile header
    await measureSelector('Mobile Header Settings Button', 'header button[aria-label="Settings"]');

    // 5. Floating tab bar items
    await measureSelector('Floating Tab Bar Items', 'nav[role="tablist"] button[role="tab"]');

    // Enter Edit mode
    const editBtn = page.locator('header button', { hasText: 'Edit' });
    await editBtn.click();
    await page.waitForTimeout(500);

    // 6. Edit mode red minus buttons
    await measureSelector('Edit Mode Red Minus Button', 'button[aria-label^="Delete "]');

    // 7. Edit mode reorder drag handles
    await measureSelector('Edit Mode Reorder Drag Handle', 'div[aria-label^="Reorder "]');

    // Exit Edit mode
    const doneBtn = page.locator('header button', { hasText: 'Done' });
    await doneBtn.click();
    await page.waitForTimeout(250);

    // Switch to Work tab
    const workTab = page.locator('nav[role="tablist"] button[role="tab"]', { hasText: 'Work' });
    await workTab.click();
    await page.waitForTimeout(200);

    // Add item in Work tab & measure SectionHeader Add for Persistent Tasks
    await measureSelector('SectionHeader Add (Work Tasks)', 'button[aria-label="Add item to Persistent Tasks"]');
    await addItemViaUI(page, 'Persistent Tasks', 'Work Sprint Task');

    // Mark completed to reveal Clear Completed button
    const workCheckbox = page.locator('button[role="checkbox"]').first();
    await workCheckbox.click();
    await page.waitForTimeout(200);

    // 8. Clear Completed trigger button
    await measureSelector('Clear Completed Trigger Button', 'button[aria-label*="Clear"][aria-label*="completed"]');

    console.log('[AUDIT] Mobile Tap Targets Results:');
    console.table(measurements);

    for (const m of measurements) {
      expect(m.meetsHIG, `Tap target ${m.name} (${m.width}x${m.height}px) does not meet Apple HIG 44x44pt requirement`).toBe(true);
    }
  });

  test('Check 3: Desktop (1440x900) Tap Targets & Side-by-Side Verification', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-specific layout test runs on desktop projects to avoid mobile viewport scale emulation');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure items exist
    await addItemViaUI(page, 'Morning Routine', 'Desktop Habit 1');
    await addItemViaUI(page, 'Persistent Tasks', 'Desktop Work Task 1');

    const measurements: ElementMeasurement[] = [];

    const measureSelector = async (name: string, selector: string) => {
      const loc = page.locator(selector);
      const count = await loc.count();
      for (let i = 0; i < count; i++) {
        const el = loc.nth(i);
        const box = await el.boundingBox();
        const itemName = count > 1 ? `${name} [${i + 1}/${count}]` : name;
        if (!box) {
          measurements.push({ name: itemName, selector, width: 0, height: 0, meetsHIG: false, notes: 'Bounding box null' });
          continue;
        }
        const meetsHIG = box.width >= 43.5 && box.height >= 43.5;
        measurements.push({
          name: itemName,
          selector,
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
          meetsHIG,
        });
      }
    };

    // 1. Desktop Header Edit button
    await measureSelector('Desktop Header Edit Button', 'header button:has-text("Edit")');

    // 2. Desktop Header Settings button
    await measureSelector('Desktop Header Settings Button', 'header button[aria-label="Settings"]');

    // 3. Checkbox buttons on Desktop
    await measureSelector('Desktop Checkbox Buttons', 'button[role="checkbox"]');

    // 4. SectionHeader Add buttons on Desktop
    await measureSelector('Desktop SectionHeader Add Buttons', 'button[aria-label^="Add item to"]');

    // 5. Verify floating tab bar is absent on desktop
    const tabBar = await page.$('nav[role="tablist"]');
    expect(tabBar, 'Floating tab bar must not be rendered on desktop layout').toBeNull();

    // 6. Enter desktop Edit mode
    const editBtn = page.locator('header button:has-text("Edit")');
    await editBtn.click();
    // Allow spring physics to settle (150ms exit transition + 250ms spring settling)
    await page.waitForTimeout(500);

    await measureSelector('Desktop Edit Mode Red Minus', 'button[aria-label^="Delete "]');
    await measureSelector('Desktop Edit Mode Reorder Handle', 'div[aria-label^="Reorder "]');

    const doneBtn = page.locator('header button:has-text("Done")');
    await doneBtn.click();
    await page.waitForTimeout(200);

    console.log('[AUDIT] Desktop Tap Targets Results:');
    console.table(measurements);

    for (const m of measurements) {
      expect(m.meetsHIG, `Tap target ${m.name} (${m.width}x${m.height}px) does not meet Apple HIG 44x44pt requirement`).toBe(true);
    }
  });

  test('Check 4: Modal Bottom Sheets Tap Targets (Settings, GoalEditor, ClearCompleted)', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sheetMeasurements: ElementMeasurement[] = [];

    const measureSelector = async (name: string, selector: string) => {
      const loc = page.locator(selector);
      const count = await loc.count();
      for (let i = 0; i < count; i++) {
        const el = loc.nth(i);
        const box = await el.boundingBox();
        const itemName = count > 1 ? `${name} [${i + 1}/${count}]` : name;
        if (!box) {
          sheetMeasurements.push({ name: itemName, selector, width: 0, height: 0, meetsHIG: false, notes: 'Bounding box null' });
          continue;
        }
        const meetsHIG = box.width >= 43.5 && box.height >= 43.5;
        sheetMeasurements.push({
          name: itemName,
          selector,
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
          meetsHIG,
        });
      }
    };

    // ── 1. Settings Sheet ──
    const settingsBtn = page.locator('header button[aria-label="Settings"]');
    await settingsBtn.click();
    await page.waitForTimeout(200);

    await measureSelector('Settings Sheet Done Button', 'div[role="dialog"] button:has-text("Done")');
    await measureSelector('Settings Sheet Sign In Button', 'div[role="dialog"] button:has-text("Sign In")');

    // Dismiss Settings
    await page.locator('div[role="dialog"] button:has-text("Done")').click();
    await page.waitForTimeout(250);

    // ── 2. Goal Editor Sheet ──
    const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
    await goalCard.click();
    await page.waitForTimeout(200);

    await measureSelector('Goal Editor Cancel Button', 'div[role="dialog"] button:has-text("Cancel")');
    await measureSelector('Goal Editor Save Button', 'div[role="dialog"] button:has-text("Save")');

    // Type a statement and target date to inspect Clear Target Date & Clear Goal
    const textarea = page.locator('#goal-statement-input');
    await textarea.fill('Launch Cadence PWA to Production');
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2026-12-31');
    await page.waitForTimeout(100);

    await measureSelector('Goal Editor Clear Date Button', 'button[aria-label="Clear target date"]');

    // Save Goal
    const saveBtn = page.locator('div[role="dialog"] button:has-text("Save")');
    await saveBtn.click();
    await page.waitForTimeout(250);

    // Reopen Goal Editor to measure Clear Goal destructive button
    await goalCard.click();
    await page.waitForTimeout(200);
    await measureSelector('Goal Editor Clear Goal Button', 'div[role="dialog"] button:has-text("Clear Goal")');
    await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
    await page.waitForTimeout(250);

    // ── 3. Clear Completed Sheet ──
    // Go to Work tab and add/check an item
    const workTab = page.locator('nav[role="tablist"] button[role="tab"]', { hasText: 'Work' });
    await workTab.click();
    await page.waitForTimeout(200);
    await addItemViaUI(page, 'Persistent Tasks', 'Task to clear');
    const workCheckbox = page.locator('button[role="checkbox"]').first();
    await workCheckbox.click();
    await page.waitForTimeout(200);

    const clearTrigger = page.locator('button', { hasText: /Clear Completed/i });
    await clearTrigger.click();
    await page.waitForTimeout(200);

    await measureSelector('Clear Completed Confirm Button', 'div[role="dialog"] button:has-text("Clear ")');
    await measureSelector('Clear Completed Cancel Button', 'div[role="dialog"] button:has-text("Cancel")');

    // Dismiss
    await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
    await page.waitForTimeout(250);

    console.log('[AUDIT] Sheet Buttons Results:');
    console.table(sheetMeasurements);

    for (const m of sheetMeasurements) {
      expect(m.meetsHIG, `Sheet button ${m.name} (${m.width}x${m.height}px) does not meet Apple HIG 44x44pt requirement`).toBe(true);
    }
  });

  test('Check 5: iOS Safari Anti-Zoom Font-Size Audit (>= 16px, specifically 17px)', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure item exists
    await addItemViaUI(page, 'Morning Routine', 'Item For Rename');

    // 1. Section quick add input font-size
    const addBtn = page.locator('button[aria-label="Add item to Morning Routine"]');
    await addBtn.click();
    const quickAddInput = page.locator('input[placeholder="New item…"]');
    await quickAddInput.waitFor({ state: 'visible' });

    const quickAddFontSize = await quickAddInput.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('[AUDIT] Section Quick Add Input computed font-size:', quickAddFontSize);
    expect(quickAddFontSize).toBe('17px');
    await page.keyboard.press('Escape');

    // 2. Inline rename input font-size in Edit mode
    const editBtn = page.locator('header button', { hasText: 'Edit' });
    await editBtn.click();
    await page.waitForTimeout(200);

    // Click item title text to activate inline rename input
    const itemTitle = page.locator('div[data-checklist-row="true"] .cursor-text').first();
    await itemTitle.click();
    const renameInput = page.locator('div[data-checklist-row="true"] input[type="text"]');
    await renameInput.waitFor({ state: 'visible' });

    const renameFontSize = await renameInput.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('[AUDIT] Inline Rename Input computed font-size:', renameFontSize);
    expect(renameFontSize).toBe('17px');
    await page.keyboard.press('Escape');
    await page.locator('header button', { hasText: 'Done' }).click();
    await page.waitForTimeout(200);

    // 3. Goal Editor Sheet textarea & date picker font-size
    const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
    await goalCard.click();
    await page.waitForTimeout(200);

    const goalTextarea = page.locator('#goal-statement-input');
    const textareaFontSize = await goalTextarea.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('[AUDIT] Goal Statement Textarea computed font-size:', textareaFontSize);
    expect(textareaFontSize).toBe('17px');

    const datePicker = page.locator('input[type="date"]');
    const datePickerFontSize = await datePicker.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('[AUDIT] Goal Date Picker computed font-size:', datePickerFontSize);
    expect(parseFloat(datePickerFontSize)).toBeGreaterThanOrEqual(16);

    await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
    await page.waitForTimeout(200);

    // 4. Settings Sheet rollover select font-size
    const settingsBtn = page.locator('header button[aria-label="Settings"]');
    await settingsBtn.click();
    await page.waitForTimeout(200);

    const selectEl = page.locator('select[aria-label="Habit Rollover Hour"]');
    const selectFontSize = await selectEl.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('[AUDIT] Settings Rollover Select computed font-size:', selectFontSize);
    expect(parseFloat(selectFontSize)).toBeGreaterThanOrEqual(16);

    await page.locator('div[role="dialog"] button:has-text("Done")').click();
    await page.waitForTimeout(200);
  });

  test('Check 6: prefers-reduced-motion: reduce Safeguards Verification', async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verify media query matches in the page
    const prefersReduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(prefersReduced).toBe(true);

    // 2. Verify Checkbox reduced motion behavior
    await addItemViaUI(page, 'Morning Routine', 'Reduced Motion Habit');
    const checkbox = page.locator('button[role="checkbox"]').first();

    // In reduced motion, Checkbox indicator div scale keyframe animation is disabled (animate = undefined)
    const indicatorMotion = await checkbox.locator('div').first().evaluate((el) => {
      // Check if Framer Motion sets style transforms or transition
      return {
        className: el.className,
        styleTransform: el.style.transform,
      };
    });
    console.log('[AUDIT] Checkbox indicator under reduced motion:', indicatorMotion);

    // Toggle checkbox
    await checkbox.click();
    await page.waitForTimeout(100);

    // 3. Open Settings Sheet under reduced motion and verify lack of translateY(100%) slide
    const settingsBtn = page.locator('header button[aria-label="Settings"]');
    await settingsBtn.click();

    const sheetSurface = page.locator('div[role="dialog"] > div:nth-child(2)');
    await expect(sheetSurface).toBeVisible();
    await expect(sheetSurface).toHaveCSS('opacity', '1');
    const sheetStyles = await sheetSurface.evaluate((el) => {
      return {
        transform: window.getComputedStyle(el).transform,
        opacity: window.getComputedStyle(el).opacity,
      };
    });
    console.log('[AUDIT] BottomSheet surface under reduced motion:', sheetStyles);
    expect(sheetStyles.transform).toBe('none');
    expect(parseFloat(sheetStyles.opacity)).toBeGreaterThanOrEqual(0.95);

    await page.locator('div[role="dialog"] button:has-text("Done")').click();
    await page.waitForTimeout(200);
  });

});
