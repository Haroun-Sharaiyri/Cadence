import { test, expect, type Page, type BrowserContext } from '@playwright/test';

async function switchToWorkView(page: Page) {
  const workTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Work"]');
  if (await workTab.isVisible()) {
    await workTab.click();
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

interface CloudStore {
  checklist_items: Map<string, Record<string, unknown>>;
  goals: Map<string, Record<string, unknown>>;
  user_settings: Map<string, Record<string, unknown>>;
}

async function attachSharedCloudBackend(
  context: BrowserContext,
  store: CloudStore,
  userId: string = 'sync-user-uuid',
  email: string = 'sync@cadence.app'
) {
  await context.exposeFunction(
    '__cadenceCloudUpsert',
    (table: keyof CloudStore, record: Record<string, unknown>) => {
      const map = store[table];
      const key = table === 'user_settings' ? String(record.user_id) : String(record.id);
      const existing = map.get(key);
      if (!existing || String(record.updated_at) >= String(existing.updated_at)) {
        map.set(key, { ...record });
      }
      return { data: [record], error: null };
    }
  );

  await context.exposeFunction('__cadenceCloudSelect', (table: keyof CloudStore) => {
    const map = store[table];
    return { data: Array.from(map.values()), error: null };
  });

  await context.addInitScript(
    ({ uid, userEmail }) => {
      const userObj = { id: uid, email: userEmail };
      const win = window as unknown as {
        __cadenceCloudUpsert: (
          table: string,
          record: Record<string, unknown>
        ) => Promise<{ data: unknown; error: null }>;
        __cadenceCloudSelect: (
          table: string
        ) => Promise<{ data: Record<string, unknown>[]; error: null }>;
        __CADENCE_MOCK_SUPABASE__: unknown;
      };

      win.__CADENCE_MOCK_SUPABASE__ = {
        auth: {
          getUser: async () => ({ data: { user: userObj }, error: null }),
          getSession: async () => ({ data: { session: { user: userObj } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOtp: async () => ({ data: { user: null, session: null }, error: null }),
          verifyOtp: async () => ({
            data: { user: userObj, session: { user: userObj } },
            error: null,
          }),
          signOut: async () => ({ error: null }),
        },
        from: (table: string) => ({
          upsert: async (payload: Record<string, unknown>) => {
            return await win.__cadenceCloudUpsert(table, payload);
          },
          select: () => {
            const chain = {
              eq: () => chain,
              gt: () => chain,
              then: (
                onfulfilled?: (val: unknown) => unknown,
                onrejected?: (reason: unknown) => unknown
              ) => {
                return win.__cadenceCloudSelect(table).then(onfulfilled, onrejected);
              },
            };
            return chain;
          },
        }),
      };
    },
    { uid: userId, userEmail: email }
  );
}

test.describe('Tier 3: Pairwise Cross-Feature & Multi-Context Sync Convergence', () => {
  test('CF3.1: Multi-Context Sync Convergence — two independent browser contexts converge after concurrent edits and deletions', async ({
    browser,
    viewport,
  }) => {
    const sharedStore: CloudStore = {
      checklist_items: new Map(),
      goals: new Map(),
      user_settings: new Map(),
    };

    const contextA = await browser.newContext({ viewport: viewport ?? { width: 420, height: 912 } });
    const contextB = await browser.newContext({ viewport: viewport ?? { width: 420, height: 912 } });

    await attachSharedCloudBackend(contextA, sharedStore);
    await attachSharedCloudBackend(contextB, sharedStore);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('http://localhost:5173/');
    await pageB.goto('http://localhost:5173/');
    await pageA.waitForLoadState('networkidle');
    await pageB.waitForLoadState('networkidle');

    // Step 1: Context A creates 3 items across Today Morning Routine and push-syncs to shared cloud
    await addItemViaUI(pageA, 'Morning Routine', 'Shared Habit 1');
    await addItemViaUI(pageA, 'Morning Routine', 'Concurrent Rename Target');
    await addItemViaUI(pageA, 'Morning Routine', 'Item To Be Deleted By B');

    await pageA.evaluate(async () => {
      const engine = (window as unknown as { __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> } }).__CADENCE_SYNC_ENGINE__;
      await engine.triggerSync();
    });

    // Step 2: Context B pulls initial items and renders all 3
    await pageB.evaluate(async () => {
      const engine = (window as unknown as { __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> } }).__CADENCE_SYNC_ENGINE__;
      await engine.triggerSync();
    });

    await expect(pageB.getByText('Shared Habit 1')).toBeVisible();
    await expect(pageB.getByText('Concurrent Rename Target')).toBeVisible();
    await expect(pageB.getByText('Item To Be Deleted By B')).toBeVisible();

    // Step 3: Concurrent divergent edits while offline/unsynced:
    // Context A checks "Shared Habit 1" and renames "Concurrent Rename Target" -> "Context A Title"
    await pageA
      .locator('[data-checklist-row="true"]', { hasText: 'Shared Habit 1' })
      .locator('button[role="checkbox"]')
      .click();

    await pageA.locator('header button:has-text("Edit")').click();
    await pageA.getByText('Concurrent Rename Target').click();
    const renameInputA = pageA.locator('input[aria-label="Rename Concurrent Rename Target"]');
    await renameInputA.fill('Context A Title');
    await renameInputA.press('Enter');
    await pageA.locator('header button:has-text("Done")').click();

    // Wait 50ms so Context B's edit on "Concurrent Rename Target" has a strictly newer timestamp (LWW winner)
    await pageB.waitForTimeout(50);

    // Context B renames "Concurrent Rename Target" -> "Context B Winner Title" AND deletes "Item To Be Deleted By B"
    await pageB.locator('header button:has-text("Edit")').click();
    await pageB.getByText('Concurrent Rename Target').click();
    const renameInputB = pageB.locator('input[aria-label="Rename Concurrent Rename Target"]');
    await renameInputB.fill('Context B Winner Title');
    await renameInputB.press('Enter');

    await pageB.locator('button[aria-label="Delete Item To Be Deleted By B"]').click();
    await pageB
      .locator('[data-checklist-row="true"]', { hasText: 'Item To Be Deleted By B' })
      .locator('button:has-text("Delete")')
      .click();
    await pageB.locator('header button:has-text("Done")').click();

    // Step 4: Both contexts sync with shared backend and converge
    await pageA.evaluate(async () => {
      const engine = (window as unknown as { __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> } }).__CADENCE_SYNC_ENGINE__;
      await engine.triggerSync();
    });
    await pageB.evaluate(async () => {
      const engine = (window as unknown as { __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> } }).__CADENCE_SYNC_ENGINE__;
      await engine.triggerSync();
    });
    await pageA.evaluate(async () => {
      const engine = (window as unknown as { __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> } }).__CADENCE_SYNC_ENGINE__;
      await engine.triggerSync();
    });

    // Verify deterministic convergence across both contexts:
    // 1. "Shared Habit 1" is checked on BOTH contexts
    await expect(
      pageA
        .locator('[data-checklist-row="true"]', { hasText: 'Shared Habit 1' })
        .locator('button[role="checkbox"]')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      pageB
        .locator('[data-checklist-row="true"]', { hasText: 'Shared Habit 1' })
        .locator('button[role="checkbox"]')
    ).toHaveAttribute('aria-checked', 'true');

    // 2. "Context B Winner Title" won LWW conflict on BOTH contexts
    await expect(pageA.getByText('Context B Winner Title')).toBeVisible();
    await expect(pageB.getByText('Context B Winner Title')).toBeVisible();

    // 3. Tombstone deletion propagated — "Item To Be Deleted By B" is absent on BOTH contexts
    await expect(pageA.getByText('Item To Be Deleted By B')).toHaveCount(0);
    await expect(pageB.getByText('Item To Be Deleted By B')).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test('CF3.2: Rollover + Custom Rollover Hour + Goal Countdown — crossing custom boundary resets habits and updates countdown live', async ({
    page,
  }) => {
    // Start at 5:59 AM on Oct 18, 2026
    await page.clock.install({ time: new Date(2026, 9, 18, 5, 59, 0) });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set rollover hour to 6:00 AM (so at 5:59 AM, logical day is still 2026-10-17!)
    await page.locator('header button[aria-label="Settings"]').click();
    await page.locator('select[aria-label="Habit Rollover Hour"]').selectOption('6');
    await page.locator('div[role="dialog"] button:has-text("Done")').click();

    // Set Goal with target date 2026-10-22 (5 days from 2026-10-17)
    const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
    await goalCard.click();
    await page.locator('#goal-statement-input').fill('Cross-feature rollover goal');
    await page.locator('input[type="date"]').fill('2026-10-22');
    await page.locator('div[role="dialog"] button:has-text("Save")').click();

    await expect(goalCard).toContainText('5 days left');

    // Add and check a Morning Routine item
    await addItemViaUI(page, 'Morning Routine', 'Pre-6AM Habit');
    const cb = page
      .locator('[data-checklist-row="true"]', { hasText: 'Pre-6AM Habit' })
      .locator('button[role="checkbox"]');
    await cb.click();
    await expect(cb).toHaveAttribute('aria-checked', 'true');

    // Advance clock past 6:00 AM -> logical day shifts from 2026-10-17 to 2026-10-18!
    await page.clock.runFor(65 * 1000);

    // Habit unchecks live AND Goal countdown updates from "5 days left" to "4 days left"!
    await expect(cb).toHaveAttribute('aria-checked', 'false');
    await expect(goalCard).toContainText('4 days left');
  });

  test('CF3.3: Edit Mode + Checked Items + Work Clear Completed — inline rename preserves completion state and Clear Completed selectively purges', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await switchToWorkView(page);
    await addItemViaUI(page, 'Persistent Tasks', 'Draft Task 1');
    await addItemViaUI(page, 'Persistent Tasks', 'Draft Task 2');

    // Check Draft Task 1
    await page
      .locator('[data-checklist-row="true"]', { hasText: 'Draft Task 1' })
      .locator('button[role="checkbox"]')
      .click();

    // Enter Edit mode and rename Draft Task 1 -> "Completed Task 1 Renamed"
    await page.locator('header button:has-text("Edit")').click();
    await page.getByText('Draft Task 1').click();
    const renameInput = page.locator('input[aria-label="Rename Draft Task 1"]');
    await renameInput.fill('Completed Task 1 Renamed');
    await renameInput.press('Enter');
    await page.locator('header button:has-text("Done")').click();

    // Verify it is still checked and struck through
    const renamedRow = page.locator('[data-checklist-row="true"]', {
      hasText: 'Completed Task 1 Renamed',
    });
    await expect(renamedRow.locator('button[role="checkbox"]')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    // Clear Completed removes "Completed Task 1 Renamed" and leaves "Draft Task 2"
    await page.locator('button[aria-label*="Clear"][aria-label*="completed"]').click();
    await page
      .locator('div[role="dialog"] button:has-text("Clear 1 Completed Task")')
      .click();

    await expect(page.getByText('Completed Task 1 Renamed')).toHaveCount(0);
    await expect(page.getByText('Draft Task 2')).toBeVisible();
  });
});
