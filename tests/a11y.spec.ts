import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function addItemViaUI(page: Page, sectionTitle: string, itemTitle: string) {
  const addBtn = page.locator(`button[aria-label="Add item to ${sectionTitle}"]`);
  await addBtn.click();
  const input = page.locator('input[placeholder="New item…"]');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(itemTitle);
  await input.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}

async function assertZeroSeriousOrCriticalViolations(page: Page, contextName: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const severeViolations = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );

  if (severeViolations.length > 0) {
    console.error(
      `[A11Y VIOLATION in ${contextName}]:`,
      JSON.stringify(
        severeViolations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({ html: n.html, failureSummary: n.failureSummary })),
        })),
        null,
        2
      )
    );
  }

  expect(
    severeViolations,
    `Expected 0 serious/critical axe-core violations in "${contextName}", found: ${severeViolations
      .map((v) => `${v.id} (${v.impact})`)
      .join(', ')}`
  ).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe-core Accessibility Audit (${colorScheme} mode)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(() => {
        (window as unknown as { __CADENCE_MOCK_SUPABASE__?: unknown }).__CADENCE_MOCK_SUPABASE__ = {
          auth: {
            signInWithOtp: async () => ({ data: { user: null, session: null }, error: null }),
            verifyOtp: async () => ({
              data: {
                user: { id: 'a11y-user', email: 'a11y@cadence.app' },
                session: { user: { id: 'a11y-user', email: 'a11y@cadence.app' } },
              },
              error: null,
            }),
            getUser: async () => ({ data: { user: null }, error: null }),
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: async () => ({ error: null }),
          },
          from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            upsert: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      });
    });

    test(`All screens & sheets pass with 0 serious or critical axe violations (${colorScheme})`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Ensure .dark class matches emulated colorScheme
      await page.evaluate((scheme) => {
        if (scheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, colorScheme);

      // 1. Empty Today View
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Today Empty`);

      // 2. Populated Today View (checked and unchecked items)
      await addItemViaUI(page, 'Morning Routine', 'Hydrate 500ml');
      await addItemViaUI(page, 'Work Day', 'Ship Cadence E2E');
      await addItemViaUI(page, 'Evening Routine', 'Read 20 pages');
      await page.locator('button[role="checkbox"]').first().click();
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Today Populated`);

      // 3. Today Edit Mode
      const editBtn = page.locator('header button:has-text("Edit")');
      await editBtn.click();
      await page.waitForTimeout(200);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Today Edit Mode`);

      // Exit Edit Mode
      await page.locator('header button:has-text("Done")').click();
      await page.waitForTimeout(150);

      // 4. Goal Editor Sheet
      const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
      await goalCard.click();
      await page.waitForSelector('div[role="dialog"]');
      await page.locator('#goal-statement-input').fill('Master Apple Liquid Glass');
      await page.locator('input[type="date"]').fill('2026-12-31');
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Goal Editor Sheet`);
      await page.locator('div[role="dialog"] button:has-text("Save")').click();
      await page.waitForTimeout(200);

      // 5. Work View (Populated + Checked + Clear Completed Sheet)
      const workTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Work"]');
      if (await workTab.isVisible()) {
        await workTab.click();
        await page.waitForTimeout(150);
      }
      await addItemViaUI(page, 'Persistent Tasks', 'Audit contrast ratios');
      await addItemViaUI(page, 'Persistent Tasks', 'Verify WebKit layout');
      const workCheckboxes = page
        .locator('[data-checklist-row="true"]', { hasText: 'Audit contrast ratios' })
        .locator('button[role="checkbox"]');
      await workCheckboxes.click();
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Work View Populated`);

      // 6. Clear Completed Confirmation Sheet
      const clearBtn = page.locator('button[aria-label*="Clear"][aria-label*="completed"]');
      await clearBtn.click();
      await page.waitForSelector('div[role="dialog"]');
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(
        page,
        `${colorScheme} - Clear Completed Confirmation Sheet`
      );
      await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
      await page.waitForTimeout(200);

      // 7. Settings Sheet
      await page.locator('header button[aria-label="Settings"]').click();
      await page.waitForSelector('div[role="dialog"]');
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Settings Sheet`);

      // 8. Auth Modal (Email Step & 6-Digit OTP Step)
      await page.locator('[data-testid="settings-sign-in-btn"]').click();
      await page.waitForSelector('#auth-email-input');
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Auth Modal Email Step`);

      await page.locator('#auth-email-input').fill('alex@cadence.app');
      await page.locator('button:has-text("Send 6-Digit Code")').click();
      await page.waitForSelector('[data-testid="otp-box-0"]');
      await page.waitForTimeout(150);
      await assertZeroSeriousOrCriticalViolations(page, `${colorScheme} - Auth Modal OTP Step`);

      await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
      await page.waitForTimeout(150);
    });
  });
}
