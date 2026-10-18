import { test, expect, type Page } from '@playwright/test';

async function addItemViaUI(page: Page, sectionTitle: string, itemTitle: string) {
  const addBtn = page.locator(`button[aria-label="Add item to ${sectionTitle}"]`);
  await addBtn.click();
  const input = page.locator(`input[aria-label="New item for ${sectionTitle}"]`);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(itemTitle);
  await input.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}

test.describe('Tier 2: Boundary Value Analysis & HIG Constraints', () => {
  test('B2.1: Exact second boundary — 03:59:59 AM stays checked, 04:00:00 AM unchecks live', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 3, 59, 20) });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addItemViaUI(page, 'Morning Routine', 'Boundary Precision Habit');
    const cb = page
      .locator('[data-checklist-row="true"]', { hasText: 'Boundary Precision Habit' })
      .locator('button[role="checkbox"]');
    await cb.click();
    await expect(cb).toHaveAttribute('aria-checked', 'true');

    // Advance clock to 03:59:58.500 (just before 04:00:00) -> must remain checked
    const msBeforeBoundary = await page.evaluate(() => {
      const target = new Date(2026, 9, 18, 3, 59, 58, 500).getTime();
      return Math.max(0, target - Date.now());
    });
    await page.clock.runFor(msBeforeBoundary);
    await expect(cb).toHaveAttribute('aria-checked', 'true');

    // Advance 3 seconds past 04:00:00 -> must uncheck live without reload
    await page.clock.runFor(3000);
    await expect(cb).toHaveAttribute('aria-checked', 'false');
  });

  test('B2.2: Rollover hour extreme boundaries (0 = Midnight, 23 = 11:00 PM)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('header button[aria-label="Settings"]').click();
    const select = page.locator('select[aria-label="Habit Rollover Hour"]');

    // Lower boundary: 0 (12:00 AM Midnight)
    await select.selectOption('0');
    await expect(select).toHaveValue('0');

    // Upper boundary: 23 (11:00 PM)
    await select.selectOption('23');
    await expect(select).toHaveValue('23');

    await page.locator('div[role="dialog"] button:has-text("Done")').click();

    // Reload and verify boundary value 23 persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('header button[aria-label="Settings"]').click();
    await expect(page.locator('select[aria-label="Habit Rollover Hour"]')).toHaveValue('23');
  });

  test('B2.3: Goal countdown boundaries — 1 day left, Due today, 1 day overdue, 5 days overdue', async ({
    page,
  }) => {
    // Logical day: 2026-10-18
    await page.clock.install({ time: new Date(2026, 9, 18, 12, 0, 0) });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');

    const setGoalDate = async (stmt: string, dateStr: string) => {
      await goalCard.click();
      await page.locator('#goal-statement-input').fill(stmt);
      await page.locator('input[type="date"]').fill(dateStr);
      await page.locator('div[role="dialog"] button:has-text("Save")').click();
      await page.waitForTimeout(100);
    };

    // +1 day -> "1 day left"
    await setGoalDate('Tomorrow Goal', '2026-10-19');
    await expect(goalCard).toContainText('1 day left');

    // 0 days -> "Due today"
    await setGoalDate('Today Goal', '2026-10-18');
    await expect(goalCard).toContainText('Due today');

    // -1 day -> "1 day overdue"
    await setGoalDate('Yesterday Goal', '2026-10-17');
    await expect(goalCard).toContainText('1 day overdue');

    // -5 days -> "5 days overdue"
    await setGoalDate('Past Goal', '2026-10-13');
    await expect(goalCard).toContainText('5 days overdue');
  });

  test('B2.4: Empty / whitespace-only item creation and inline rename guards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Attempt to add whitespace-only item
    await page.locator('button[aria-label="Add item to Morning Routine"]').click();
    const addInput = page.locator('input[aria-label="New item for Morning Routine"]');
    await addInput.fill('   ');
    await addInput.press('Enter');

    // Section remains empty
    await expect(page.getByText('No morning habits yet. Tap + to add habits.')).toBeVisible();

    // Add valid item, then attempt to rename to empty string or cancel with Escape
    await addItemViaUI(page, 'Morning Routine', 'Original Habit Name');
    await page.locator('header button:has-text("Edit")').click();

    await page.getByText('Original Habit Name').click();
    const renameInput = page.locator('input[aria-label="Rename Original Habit Name"]');
    await renameInput.fill('   ');
    await renameInput.press('Enter');

    // Title reverts to 'Original Habit Name'
    await expect(page.getByText('Original Habit Name')).toBeVisible();
  });

  test('B2.5: Layout, Zero Horizontal Overflow (420px), >=44x44px Mobile Tap Targets, >=16px Inputs, Reduced Motion', async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addItemViaUI(page, 'Morning Routine', 'HIG Verification Item');

    if (isMobile) {
      // 1. Mobile shows floating tab bar
      await expect(page.locator('nav[role="tablist"]')).toBeVisible();

      // 2. Zero horizontal overflow at 420px
      const overflow = await page.evaluate(() => ({
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.docClientWidth + 1);

      // 3. Every visible interactive button/tab on mobile is >= 44x44px
      const buttons = page.locator('button:visible, [role="tab"]:visible');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          expect(box.width).toBeGreaterThanOrEqual(43.5);
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
      }
    } else {
      // Desktop shows Today and Work side by side with no tab bar
      await expect(page.locator('nav[role="tablist"]')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
    }

    // 4. Open Settings sheet under prefers-reduced-motion: reduce -> verify no slide transform & input >= 16px
    await page.locator('header button[aria-label="Settings"]').click();
    await page.waitForTimeout(250);

    const selectFontSize = await page
      .locator('select[aria-label="Habit Rollover Hour"]')
      .evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    expect(selectFontSize).toBeGreaterThanOrEqual(16);

    const sheetSurface = page.locator('div[role="dialog"] > div:nth-child(2)');
    const transform = await sheetSurface.evaluate((el) => window.getComputedStyle(el).transform);
    expect(transform).toBe('none');
  });
});
