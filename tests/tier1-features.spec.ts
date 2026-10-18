import { test, expect, type Page } from '@playwright/test';

async function switchToWorkView(page: Page) {
  const workTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Work"]');
  if (await workTab.isVisible()) {
    await workTab.click();
    await page.waitForTimeout(120);
  }
}

async function switchToTodayView(page: Page) {
  const todayTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Today"]');
  if (await todayTab.isVisible()) {
    await todayTab.click();
    await page.waitForTimeout(120);
  }
}

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

test.describe('Tier 1: Comprehensive Feature Suite (Cadence E2E)', () => {
  test.describe('Feature 1: Today 3 Daily Sections & Checkboxes', () => {
    test('F1.1: Renders Morning Routine, Work Day, and Evening Routine with intentional empty states', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h2', { hasText: 'Morning Routine' })).toBeVisible();
      await expect(page.locator('h2', { hasText: 'Work Day' })).toBeVisible();
      await expect(page.locator('h2', { hasText: 'Evening Routine' })).toBeVisible();

      await expect(page.getByText('No morning habits yet. Tap + to add habits.')).toBeVisible();
      await expect(page.getByText('No work habits yet. Tap + to add habits.')).toBeVisible();
      await expect(page.getByText('No evening habits yet. Tap + to add habits.')).toBeVisible();
    });

    test('F1.2: Adds items to each of the three daily sections', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Morning Routine', 'Drink 500ml water');
      await addItemViaUI(page, 'Work Day', 'Deep work sprint');
      await addItemViaUI(page, 'Evening Routine', 'Digital sunset at 9 PM');

      await expect(page.getByText('Drink 500ml water')).toBeVisible();
      await expect(page.getByText('Deep work sprint')).toBeVisible();
      await expect(page.getByText('Digital sunset at 9 PM')).toBeVisible();
    });

    test('F1.3: Checking and unchecking items updates section progress ring and tabular counter', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Morning Routine', 'Morning stretch');
      await addItemViaUI(page, 'Morning Routine', 'Espresso');

      const ring = page.locator('[role="progressbar"]').first();
      await expect(ring).toHaveAttribute('aria-valuenow', '0');
      await expect(ring).toHaveAttribute('aria-valuemax', '2');
      await expect(page.getByText('0 of 2')).toBeVisible();

      const firstCb = page
        .locator('[data-checklist-row="true"]', { hasText: 'Morning stretch' })
        .locator('button[role="checkbox"]');
      await firstCb.click();

      await expect(firstCb).toHaveAttribute('aria-checked', 'true');
      await expect(ring).toHaveAttribute('aria-valuenow', '1');
      await expect(page.getByText('1 of 2')).toBeVisible();

      const secondCb = page
        .locator('[data-checklist-row="true"]', { hasText: 'Espresso' })
        .locator('button[role="checkbox"]');
      await secondCb.click();

      await expect(secondCb).toHaveAttribute('aria-checked', 'true');
      await expect(ring).toHaveAttribute('aria-valuenow', '2');
      await expect(page.getByText('2 of 2')).toBeVisible();

      // Uncheck first item
      await firstCb.click();
      await expect(firstCb).toHaveAttribute('aria-checked', 'false');
      await expect(ring).toHaveAttribute('aria-valuenow', '1');
    });

    test('F1.4: Completing all daily items triggers restrained Day Complete indicator on Goal Hero Card', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Morning Routine', 'Sun salutation');
      const cb = page
        .locator('[data-checklist-row="true"]', { hasText: 'Sun salutation' })
        .locator('button[role="checkbox"]');
      await cb.click();

      await expect(page.getByText('Day Complete')).toBeVisible();
    });

    test('F1.5: Checked daily item applies strikethrough styling to title', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Work Day', 'Review architecture doc');
      const row = page.locator('[data-checklist-row="true"]', {
        hasText: 'Review architecture doc',
      });
      const cb = row.locator('button[role="checkbox"]');
      await cb.click();

      const titleEl = row.locator('.line-through');
      await expect(titleEl).toBeVisible();
      await expect(titleEl).toHaveText('Review architecture doc');
    });
  });

  test.describe('Feature 2: 4:00 AM Rollover & Item Persistence', () => {
    test('F2.1: Checks made at 3:59 AM remain until 4:00 AM, then live-reset without reload while items persist', async ({
      page,
    }) => {
      await page.clock.install({ time: new Date(2026, 9, 18, 3, 58, 30) });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Morning Routine', 'Late night journal');
      await addItemViaUI(page, 'Work Day', 'Deploy hotfix');
      await addItemViaUI(page, 'Evening Routine', 'Herbal tea');

      const cb1 = page
        .locator('[data-checklist-row="true"]', { hasText: 'Late night journal' })
        .locator('button[role="checkbox"]');
      const cb2 = page
        .locator('[data-checklist-row="true"]', { hasText: 'Deploy hotfix' })
        .locator('button[role="checkbox"]');
      const cb3 = page
        .locator('[data-checklist-row="true"]', { hasText: 'Herbal tea' })
        .locator('button[role="checkbox"]');

      await cb1.click();
      await cb2.click();
      await cb3.click();

      // Advance to ~3:59:25 AM — still checked
      await page.clock.runFor(50 * 1000);
      await expect(cb1).toHaveAttribute('aria-checked', 'true');
      await expect(cb2).toHaveAttribute('aria-checked', 'true');
      await expect(cb3).toHaveAttribute('aria-checked', 'true');

      // Advance past 4:00:00 AM (45 seconds -> ~4:00:10 AM)
      await page.clock.runFor(45 * 1000);

      // All daily items appear unchecked WITHOUT reload
      await expect(cb1).toHaveAttribute('aria-checked', 'false');
      await expect(cb2).toHaveAttribute('aria-checked', 'false');
      await expect(cb3).toHaveAttribute('aria-checked', 'false');

      // Items themselves persist
      await expect(page.getByText('Late night journal')).toBeVisible();
      await expect(page.getByText('Deploy hotfix')).toBeVisible();
      await expect(page.getByText('Herbal tea')).toBeVisible();
    });

    test('F2.2: Work tab items remain checked across the 4:00 AM daily rollover boundary', async ({
      page,
    }) => {
      await page.clock.install({ time: new Date(2026, 9, 18, 3, 59, 0) });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await switchToWorkView(page);
      await addItemViaUI(page, 'Persistent Tasks', 'Prepare Q4 board deck');

      const workCb = page
        .locator('[data-checklist-row="true"]', { hasText: 'Prepare Q4 board deck' })
        .locator('button[role="checkbox"]');
      await workCb.click();
      await expect(workCb).toHaveAttribute('aria-checked', 'true');

      // Cross 4:00 AM boundary
      await page.clock.runFor(65 * 1000);

      // Work item stays checked
      await expect(workCb).toHaveAttribute('aria-checked', 'true');
    });
  });

  test.describe('Feature 3: User-Adjustable Rollover Hour in Settings', () => {
    test('F3.1: Changing the rollover hour in Settings changes the live rollover boundary', async ({
      page,
    }) => {
      // Start at 3:59 AM
      await page.clock.install({ time: new Date(2026, 9, 18, 3, 59, 0) });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Change rollover hour in Settings from 4:00 AM to 5:00 AM
      await page.locator('header button[aria-label="Settings"]').click();
      const select = page.locator('select[aria-label="Habit Rollover Hour"]');
      await expect(select).toHaveValue('4');
      await select.selectOption('5');
      await expect(select).toHaveValue('5');
      await page.locator('div[role="dialog"] button:has-text("Done")').click();

      await addItemViaUI(page, 'Morning Routine', 'Custom 5 AM boundary item');
      const cb = page
        .locator('[data-checklist-row="true"]', { hasText: 'Custom 5 AM boundary item' })
        .locator('button[role="checkbox"]');
      await cb.click();
      await expect(cb).toHaveAttribute('aria-checked', 'true');

      // Advance past 4:00 AM (to 4:05 AM) -> should NOT uncheck because rollover hour is now 5 AM!
      await page.clock.runFor(6 * 60 * 1000);
      await expect(cb).toHaveAttribute('aria-checked', 'true');

      // Advance past 5:00 AM (another 56 minutes -> 5:01 AM) -> now it MUST uncheck live!
      await page.clock.runFor(56 * 60 * 1000);
      await expect(cb).toHaveAttribute('aria-checked', 'false');
    });
  });

  test.describe('Feature 4: Goal Hero Card & Dynamic Countdown', () => {
    test('F4.1: Setting a goal statement and target date displays exact day countdown; clearing date hides countdown', async ({
      page,
    }) => {
      await page.clock.install({ time: new Date(2026, 9, 18, 10, 0, 0) }); // Logical day: 2026-10-18
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
      await expect(goalCard).toContainText('Tap to set your primary goal…');

      await goalCard.click();
      await page.locator('#goal-statement-input').fill('Ship Cadence 1.0 with zero defects');
      // 10 days after 2026-10-18 -> 2026-10-28
      await page.locator('input[type="date"]').fill('2026-10-28');
      await page.locator('div[role="dialog"] button:has-text("Save")').click();

      await expect(goalCard).toContainText('Ship Cadence 1.0 with zero defects');
      await expect(goalCard).toContainText('10 days left');

      // Reopen Goal Editor and clear target date
      await goalCard.click();
      await page.locator('button[aria-label="Clear target date"]').click();
      await page.locator('div[role="dialog"] button:has-text("Save")').click();

      await expect(goalCard).toContainText('Ship Cadence 1.0 with zero defects');
      await expect(goalCard).not.toContainText('days left');
    });
  });

  test.describe('Feature 5: Work Tab Strikethrough, Swipe-to-Delete & Clear Completed', () => {
    test('F5.1: Checked Work items stay in place struck through; Clear Completed requires confirmation and removes only checked items', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await switchToWorkView(page);
      await addItemViaUI(page, 'Persistent Tasks', 'Keep this active task');
      await addItemViaUI(page, 'Persistent Tasks', 'Complete and clear this task');

      // Clear Completed trigger is hidden when 0 items are checked
      const clearTrigger = page.locator('button[aria-label*="Clear"][aria-label*="completed"]');
      await expect(clearTrigger).toHaveCount(0);

      // Check the second item
      const secondRow = page.locator('[data-checklist-row="true"]', {
        hasText: 'Complete and clear this task',
      });
      await secondRow.locator('button[role="checkbox"]').click();

      // Stays in place and struck through
      await expect(secondRow.locator('.line-through')).toHaveText('Complete and clear this task');

      // Clear Completed trigger is now visible
      await expect(clearTrigger).toBeVisible();
      await expect(clearTrigger).toContainText('Clear Completed (1)');

      // Click Clear Completed -> opens confirmation sheet; Cancel keeps item
      await clearTrigger.click();
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toContainText('Clear 1 Completed Task?');
      await dialog.locator('button:has-text("Cancel")').click();
      await expect(page.getByText('Complete and clear this task')).toBeVisible();

      // Reopen and confirm deletion
      await clearTrigger.click();
      await page
        .locator('div[role="dialog"] button:has-text("Clear 1 Completed Task")')
        .click();

      // Checked item is removed; unchecked item remains
      await expect(page.getByText('Complete and clear this task')).toHaveCount(0);
      await expect(page.getByText('Keep this active task')).toBeVisible();
      await expect(clearTrigger).toHaveCount(0);
    });

    test('F5.2: Swipe-to-delete removes Work item on mobile viewport', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await switchToWorkView(page);
      await addItemViaUI(page, 'Persistent Tasks', 'Swipeable task item');

      const row = page.locator('[data-checklist-row="true"]', {
        hasText: 'Swipeable task item',
      });
      await expect(row).toBeVisible();

      const box = await row.boundingBox();
      expect(box).not.toBeNull();

      // Perform left drag gesture across row (> 160px left to trigger full swipe or reveal delete button)
      const startX = box!.x + box!.width - 30;
      const startY = box!.y + box!.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(startX - i * 20, startY, { steps: 2 });
      }
      await page.mouse.up();
      await page.waitForTimeout(400);

      // If snap-open delete button is visible, click it; if full-swiped, it is already deleting/deleted
      const count = await page.getByText('Swipeable task item').count();
      if (count > 0) {
        const swipeDeleteBtn = row.locator('button[aria-label="Swipe delete Swipeable task item"]');
        await swipeDeleteBtn.click({ force: true, timeout: 1500 }).catch(() => {});
      }

      await expect(page.getByText('Swipeable task item')).toHaveCount(0);
    });
  });

  test.describe('Feature 6: Native Edit Mode (Inline Rename, Delete, Reorder)', () => {
    test('F6.1: Inline rename, reorder, and delete items across daily sections', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await addItemViaUI(page, 'Morning Routine', 'Habit Alpha');
      await addItemViaUI(page, 'Morning Routine', 'Habit Beta');

      // Enter Edit Mode
      await page.locator('header button:has-text("Edit")').click();

      // 1. Inline Rename "Habit Alpha" -> "Habit Alpha Renamed"
      await page.getByText('Habit Alpha').click();
      const renameInput = page.locator('input[aria-label="Rename Habit Alpha"]');
      await renameInput.fill('Habit Alpha Renamed');
      await renameInput.press('Enter');

      await expect(page.getByText('Habit Alpha Renamed')).toBeVisible();

      // 2. Reorder "Habit Beta" above "Habit Alpha Renamed"
      const betaHandle = page.locator('div[aria-label="Reorder Habit Beta"]');
      const alphaHandle = page.locator('div[aria-label="Reorder Habit Alpha Renamed"]');
      const betaBox = await betaHandle.boundingBox();
      const alphaBox = await alphaHandle.boundingBox();
      expect(betaBox).not.toBeNull();
      expect(alphaBox).not.toBeNull();

      await page.mouse.move(betaBox!.x + betaBox!.width / 2, betaBox!.y + betaBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        alphaBox!.x + alphaBox!.width / 2,
        alphaBox!.y - 12,
        { steps: 15 }
      );
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(200);

      // 3. Delete "Habit Alpha Renamed" via leading red minus + slide-out Delete button
      await page.locator('button[aria-label="Delete Habit Alpha Renamed"]').click();
      const slideDeleteBtn = page
        .locator('[data-checklist-row="true"]', { hasText: 'Habit Alpha Renamed' })
        .locator('button:has-text("Delete")');
      await slideDeleteBtn.click();

      await expect(page.getByText('Habit Alpha Renamed')).toHaveCount(0);
      await expect(page.getByText('Habit Beta')).toBeVisible();

      // Exit Edit Mode
      await page.locator('header button:has-text("Done")').click();
    });
  });

  test.describe('Feature 8: In-App 6-Digit Email OTP Sign-In Flow', () => {
    test('F8.1: Email -> 6-digit code UI flow supports auto-advance and paste against mocked auth service', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        let currentUser: { id: string; email: string } | null = null;
        const listeners: Array<(event: string, session: unknown) => void> = [];

        (window as unknown as { __CADENCE_MOCK_SUPABASE__?: unknown }).__CADENCE_MOCK_SUPABASE__ = {
          auth: {
            signInWithOtp: async ({ email }: { email: string }) => {
              return { data: { user: null, session: null }, error: null, email };
            },
            verifyOtp: async ({ email, token }: { email: string; token: string }) => {
              if (token === '123456') {
                currentUser = { id: 'user-otp-1', email };
                const session = { user: currentUser };
                listeners.forEach((cb) => cb('SIGNED_IN', session));
                return { data: { user: currentUser, session }, error: null };
              }
              return {
                data: { user: null, session: null },
                error: new Error('Invalid 6-digit verification code'),
              };
            },
            getUser: async () => ({ data: { user: currentUser }, error: null }),
            getSession: async () => ({
              data: { session: currentUser ? { user: currentUser } : null },
              error: null,
            }),
            onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
              listeners.push(cb);
              return {
                data: {
                  subscription: {
                    unsubscribe: () => {
                      const idx = listeners.indexOf(cb);
                      if (idx >= 0) listeners.splice(idx, 1);
                    },
                  },
                },
              };
            },
            signOut: async () => {
              currentUser = null;
              listeners.forEach((cb) => cb('SIGNED_OUT', null));
              return { error: null };
            },
          },
          from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            upsert: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Open Settings -> Sign In
      await page.locator('header button[aria-label="Settings"]').click();
      await page.locator('[data-testid="settings-sign-in-btn"]').click();

      // Enter email
      const emailInput = page.locator('#auth-email-input');
      await expect(emailInput).toBeVisible();
      await emailInput.fill('founder@cadence.app');
      await page.locator('button:has-text("Send 6-Digit Code")').click();

      // Verify transition to 6-digit OTP step
      const box0 = page.locator('[data-testid="otp-box-0"]');
      await expect(box0).toBeVisible();

      // Test auto-advance for first 3 digits
      await box0.pressSequentially('987');
      await expect(page.locator('[data-testid="otp-box-0"]')).toHaveValue('9');
      await expect(page.locator('[data-testid="otp-box-1"]')).toHaveValue('8');
      await expect(page.locator('[data-testid="otp-box-2"]')).toHaveValue('7');
      await expect(page.locator('[data-testid="otp-box-3"]')).toBeFocused();

      // Test paste of full 6-digit valid code ("123-456")
      await box0.evaluate((el) => {
        const dt = new DataTransfer();
        dt.setData('text', '123-456');
        const evt = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(evt);
      });

      // Modal closes automatically on verification success; verify signed-in state in Settings
      await page.waitForTimeout(200);
      await page.locator('header button[aria-label="Settings"]').click();
      await expect(page.locator('[data-testid="settings-auth-status"]')).toHaveText('Signed In');
      await expect(page.locator('[data-testid="settings-user-email"]')).toHaveText(
        'founder@cadence.app'
      );
    });
  });

  test.describe('Feature 9: Offline Persistence & Network Disabled Operation', () => {
    test('F9.1: All checklist and goal actions work offline and survive full page reload', async ({
      page,
      context,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Disable network
      await context.setOffline(true);

      await addItemViaUI(page, 'Morning Routine', 'Offline Morning Habit');
      await page
        .locator('[data-checklist-row="true"]', { hasText: 'Offline Morning Habit' })
        .locator('button[role="checkbox"]')
        .click();

      await switchToWorkView(page);
      await addItemViaUI(page, 'Persistent Tasks', 'Offline Work Task');

      await switchToTodayView(page);
      await page.locator('div[role="button"][aria-label*="goal" i]').click();
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.locator('#goal-statement-input').fill('Offline Goal Resilience');
      await dialog.locator('button:has-text("Save")').click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('div[role="button"][aria-label*="goal" i]')).toContainText(
        'Offline Goal Resilience'
      );

      // Restore network to allow reload in Playwright dev server, and verify IndexedDB persistence across reload
      await context.setOffline(false);
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Offline Morning Habit')).toBeVisible();
      await expect(
        page
          .locator('[data-checklist-row="true"]', { hasText: 'Offline Morning Habit' })
          .locator('button[role="checkbox"]')
      ).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('div[role="button"][aria-label*="goal" i]')).toContainText(
        'Offline Goal Resilience'
      );

      await switchToWorkView(page);
      await expect(page.getByText('Offline Work Task')).toBeVisible();
    });
  });
});
