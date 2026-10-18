/**
 * tests/tier4-workloads.spec.ts
 * Tier 4 — Real-World Application Workload Scenarios (TEST_INFRA.md §Real-World Application Scenarios)
 *
 * Scenarios:
 *   1. The Early Bird Daily Routine (Today 3 sections, checking morning items, progress ring update)
 *   2. Midnight Worker across 4 AM Rollover (Controlled clock shift from 03:59 to 04:00 AM, live reset cascade, item persistence)
 *   3. Multi-Device Sync & Delete Propagation (Two independent browser contexts, concurrent edits, tombstone deletion, convergence)
 *   4. Offline Commute to Work (Disconnect network, add items, check off work, reconnect network, queue drain)
 *   5. Goal Sprint Countdown (Setting target date 30 days ahead, editing goal statement, verifying countdown text)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

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

interface CloudStore {
  checklist_items: Map<string, Record<string, unknown>>;
  goals: Map<string, Record<string, unknown>>;
  user_settings: Map<string, Record<string, unknown>>;
}

async function attachSharedCloudBackend(
  context: BrowserContext,
  store: CloudStore,
  options: { userId?: string; email?: string; isOfflineRef?: { current: boolean } } = {}
) {
  const userId = options.userId ?? 'workload-user-uuid';
  const email = options.email ?? 'workload@cadence.app';
  const isOfflineRef = options.isOfflineRef ?? { current: false };

  await context.exposeFunction(
    '__cadenceCloudUpsert',
    (table: keyof CloudStore, record: Record<string, unknown>) => {
      if (isOfflineRef.current) {
        return { data: null, error: { message: 'Failed to fetch (Simulated Offline)' } };
      }
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
    if (isOfflineRef.current) {
      return { data: null, error: { message: 'Failed to fetch (Simulated Offline)' } };
    }
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
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
        __cadenceCloudSelect: (
          table: string
        ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
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
        channel: () => ({
          on: function () {
            return this;
          },
          subscribe: function () {
            return this;
          },
          unsubscribe: () => {},
        }),
        removeChannel: () => {},
      };
    },
    { uid: userId, userEmail: email }
  );
}

test.describe('Tier 4 — Real-World Application Workload Scenarios', () => {
  test('Scenario 1: The Early Bird Daily Routine — Today 3 sections, checking morning items, progress ring update', async ({
    page,
  }) => {
    await page.goto('/');

    // Populate all 3 daily routine sections
    await addItemViaUI(page, 'Morning Routine', 'Drink 500ml water');
    await addItemViaUI(page, 'Morning Routine', '10 min mobility stretch');
    await addItemViaUI(page, 'Morning Routine', 'Review daily priorities');

    await addItemViaUI(page, 'Work Day', 'Deep work block 1');
    await addItemViaUI(page, 'Work Day', 'Inbox zero');

    await addItemViaUI(page, 'Evening Routine', 'Digital sunset at 9 PM');

    const morningCard = page.locator('section[aria-label="Morning Routine"]');
    const workDayCard = page.locator('section[aria-label="Work Day"]');
    const eveningCard = page.locator('section[aria-label="Evening Routine"]');

    // Initial state: Morning Routine is 0 of 3 (0%)
    await expect(morningCard.locator('[role="progressbar"][aria-label*="(0%)"]')).toBeVisible();
    await expect(morningCard.getByText('0 of 3')).toBeVisible();

    // Check 1st Morning Routine item -> 33% (1 of 3)
    await page.locator('button[role="checkbox"][aria-label*="Drink 500ml water"]').click();
    await expect(morningCard.locator('[role="progressbar"][aria-label*="(33%)"]')).toBeVisible();
    await expect(morningCard.getByText('1 of 3')).toBeVisible();

    // Check 2nd Morning Routine item -> 67% (2 of 3)
    await page.locator('button[role="checkbox"][aria-label*="10 min mobility stretch"]').click();
    await expect(morningCard.locator('[role="progressbar"][aria-label*="(67%)"]')).toBeVisible();
    await expect(morningCard.getByText('2 of 3')).toBeVisible();

    // Check 3rd Morning Routine item -> 100% (3 of 3)
    await page.locator('button[role="checkbox"][aria-label*="Review daily priorities"]').click();
    await expect(morningCard.locator('[role="progressbar"][aria-label*="(100%)"]')).toBeVisible();
    await expect(morningCard.getByText('3 of 3')).toBeVisible();

    // Other sections remain at 0%
    await expect(workDayCard.locator('[role="progressbar"][aria-label*="(0%)"]')).toBeVisible();
    await expect(eveningCard.locator('[role="progressbar"][aria-label*="(0%)"]')).toBeVisible();
  });

  test('Scenario 2: Midnight Worker across 4 AM Rollover — Controlled clock shift from 03:59 to 04:00 AM, live reset cascade, item persistence', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 4, 15, 3, 58, 30, 0) });
    await page.goto('/');

    // Add items across all 3 daily routine sections + persistent Work section
    await addItemViaUI(page, 'Morning Routine', 'Morning Espresso');
    await addItemViaUI(page, 'Work Day', 'Late Night Code Review');
    await addItemViaUI(page, 'Evening Routine', 'Wind Down');

    await switchToWorkView(page);
    await addItemViaUI(page, 'Persistent Tasks', 'Deploy midnight hotfix');

    // Check off the persistent Work item at 03:58:30 AM
    const workCheckbox = page.locator('button[role="checkbox"][aria-label*="Deploy midnight hotfix"]');
    await workCheckbox.click();
    await expect(workCheckbox).toHaveAttribute('aria-checked', 'true');

    // Switch back to Today view and check all 3 daily routine items
    await switchToTodayView(page);
    const morningCb = page.locator('button[role="checkbox"][aria-label*="Morning Espresso"]');
    const workDayCb = page.locator('button[role="checkbox"][aria-label*="Late Night Code Review"]');
    const eveningCb = page.locator('button[role="checkbox"][aria-label*="Wind Down"]');

    await morningCb.click();
    await workDayCb.click();
    await eveningCb.click();

    await expect(morningCb).toHaveAttribute('aria-checked', 'true');
    await expect(workDayCb).toHaveAttribute('aria-checked', 'true');
    await expect(eveningCb).toHaveAttribute('aria-checked', 'true');

    // Advance clock to ~03:59:20 AM (still well before 4:00 AM rollover boundary)
    await page.clock.runFor(50 * 1000);
    await expect(morningCb).toHaveAttribute('aria-checked', 'true');
    await expect(workDayCb).toHaveAttribute('aria-checked', 'true');
    await expect(eveningCb).toHaveAttribute('aria-checked', 'true');

    // Advance clock across 04:00:00 AM boundary (to ~04:00:05 AM) without reloading page
    await page.clock.runFor(45 * 1000);

    // Verify live reset cascade: all 3 daily sections uncheck automatically while items persist
    await expect(morningCb).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });
    await expect(workDayCb).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });
    await expect(eveningCb).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });

    await expect(page.getByText('Morning Espresso')).toBeVisible();
    await expect(page.getByText('Late Night Code Review')).toBeVisible();
    await expect(page.getByText('Wind Down')).toBeVisible();

    // Verify persistent Work item was NOT reset by the 4:00 AM rollover
    await switchToWorkView(page);
    await expect(workCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  test('Scenario 3: Multi-Device Sync & Delete Propagation — Two independent browser contexts, concurrent edits, tombstone deletion, convergence', async ({
    browser,
    viewport,
  }) => {
    const cloudStore: CloudStore = {
      checklist_items: new Map(),
      goals: new Map(),
      user_settings: new Map(),
    };

    const contextA = await browser.newContext({ viewport: viewport ?? { width: 420, height: 912 } });
    const contextB = await browser.newContext({ viewport: viewport ?? { width: 420, height: 912 } });

    await attachSharedCloudBackend(contextA, cloudStore);
    await attachSharedCloudBackend(contextB, cloudStore);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // 1. Device A creates 3 items in Morning Routine and syncs to cloud
    await pageA.goto('http://localhost:5173/');
    await addItemViaUI(pageA, 'Morning Routine', 'Keep & Check Task');
    await addItemViaUI(pageA, 'Morning Routine', 'Shared Rename Target');
    await addItemViaUI(pageA, 'Morning Routine', 'Obsolete Task To Delete');

    await pageA.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
      };
      await win.__CADENCE_SYNC_ENGINE__.triggerSync();
    });

    // 2. Device B opens and pulls the 3 items from cloud
    await pageB.goto('http://localhost:5173/');
    await pageB.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
      };
      await win.__CADENCE_SYNC_ENGINE__.triggerSync();
    });

    await expect(pageB.getByText('Keep & Check Task')).toBeVisible();
    await expect(pageB.getByText('Shared Rename Target')).toBeVisible();
    await expect(pageB.getByText('Obsolete Task To Delete')).toBeVisible();

    // 3. Concurrent edits on Device A and Device B:
    // Device A checks "Keep & Check Task" and renames "Shared Rename Target" -> "Renamed On Device A"
    await pageA.locator('button[role="checkbox"][aria-label*="Keep & Check Task"]').click();
    await pageA.locator('header button:has-text("Edit")').click();
    await pageA.getByText('Shared Rename Target').click();
    const renameInputA = pageA.locator('input[aria-label="Rename Shared Rename Target"]');
    await renameInputA.fill('Renamed On Device A');
    await renameInputA.press('Enter');
    await pageA.locator('header button:has-text("Done")').click();

    // Device B deletes "Obsolete Task To Delete" (tombstone soft-delete) and adds "Added On Device B"
    await pageB.locator('header button:has-text("Edit")').click();
    await pageB.locator('button[aria-label="Delete Obsolete Task To Delete"]').click();
    await pageB.locator('button[aria-label="Confirm delete Obsolete Task To Delete"]').click();
    await pageB.locator('header button:has-text("Done")').click();
    await addItemViaUI(pageB, 'Morning Routine', 'Added On Device B');

    // 4. Synchronize both devices with cloud
    await pageA.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
      };
      await win.__CADENCE_SYNC_ENGINE__.triggerSync();
    });
    await pageB.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
      };
      await win.__CADENCE_SYNC_ENGINE__.triggerSync();
    });
    await pageA.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
      };
      await win.__CADENCE_SYNC_ENGINE__.triggerSync();
    });

    // 5. Verify convergence across both contexts
    for (const p of [pageA, pageB]) {
      await expect(p.getByText('Renamed On Device A')).toBeVisible();
      await expect(p.getByText('Added On Device B')).toBeVisible();
      await expect(p.getByText('Obsolete Task To Delete')).toHaveCount(0);
      await expect(
        p.locator('button[role="checkbox"][aria-label*="Keep & Check Task"]')
      ).toHaveAttribute('aria-checked', 'true');
    }

    await contextA.close();
    await contextB.close();
  });

  test('Scenario 4: Offline Commute to Work — Disconnect network, add items, check off work, reconnect network, queue drain', async ({
    browser,
    viewport,
  }) => {
    const cloudStore: CloudStore = {
      checklist_items: new Map(),
      goals: new Map(),
      user_settings: new Map(),
    };
    const isOfflineRef = { current: false };

    const context = await browser.newContext({ viewport: viewport ?? { width: 420, height: 912 } });
    await attachSharedCloudBackend(context, cloudStore, { isOfflineRef });
    const page = await context.newPage();

    await page.goto('http://localhost:5173/');

    // Enter subway tunnel: disconnect network
    isOfflineRef.current = true;
    await context.setOffline(true);

    // Add Morning Routine and Work items while offline
    await addItemViaUI(page, 'Morning Routine', 'Listen to architecture podcast');
    await page.locator('button[role="checkbox"][aria-label*="Listen to architecture podcast"]').click();

    await switchToWorkView(page);
    await addItemViaUI(page, 'Persistent Tasks', 'Draft Q3 roadmap RFC');
    await addItemViaUI(page, 'Persistent Tasks', 'Review security audit PR');
    await page.locator('button[role="checkbox"][aria-label*="Draft Q3 roadmap RFC"]').click();

    // Verify items are queued in local outbox_mutations while offline
    const pendingCountOffline = await page.evaluate(async () => {
      const win = window as unknown as {
        __CADENCE_DB__: { outbox_mutations: { count: () => Promise<number> } };
      };
      return await win.__CADENCE_DB__.outbox_mutations.count();
    });
    expect(pendingCountOffline).toBeGreaterThan(0);
    expect(cloudStore.checklist_items.size).toBe(0);

    // Arrive at office: reconnect network and drain sync queue
    isOfflineRef.current = false;
    await context.setOffline(false);

    // Verify outbox_mutations drained to 0 and all 3 items are replicated to cloudStore
    await expect
      .poll(
        async () => {
          return await page.evaluate(async () => {
            const win = window as unknown as {
              __CADENCE_SYNC_ENGINE__: { triggerSync: () => Promise<void> };
              __CADENCE_DB__: { outbox_mutations: { count: () => Promise<number> } };
            };
            await win.__CADENCE_SYNC_ENGINE__.triggerSync();
            return await win.__CADENCE_DB__.outbox_mutations.count();
          });
        },
        { timeout: 5000 }
      )
      .toBe(0);
    expect(cloudStore.checklist_items.size).toBe(3);

    await context.close();
  });

  test('Scenario 5: Goal Sprint Countdown — Setting target date 30 days ahead, editing goal statement, verifying countdown text', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(2026, 5, 1, 9, 0, 0) }); // June 1, 2026
    await page.goto('/');

    // 1. Open Goal Editor Sheet and set target date 30 days ahead (July 1, 2026)
    await page.locator('[role="button"][aria-label^="Primary Goal"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('textarea').fill('Ship Cadence 1.0 to Production');
    await dialog.locator('input[type="date"]').fill('2026-07-01');
    await dialog.locator('button:has-text("Save")').click();
    await expect(dialog).toBeHidden();

    // Verify goal statement and "30 days left" badge
    await expect(page.getByText('Ship Cadence 1.0 to Production')).toBeVisible();
    await expect(page.getByText('30 days left')).toBeVisible();

    // 2. Edit goal statement and pull target date closer to 14 days ahead (June 15, 2026)
    await page.locator('[role="button"][aria-label^="Primary Goal"]').click();
    await expect(dialog).toBeVisible();
    await dialog.locator('textarea').fill('Ship Cadence 1.0 Release Candidate');
    await dialog.locator('input[type="date"]').fill('2026-06-15');
    await dialog.locator('button:has-text("Save")').click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Ship Cadence 1.0 Release Candidate')).toBeVisible();
    await expect(page.getByText('14 days left')).toBeVisible();

    // 3. Clear target date and verify countdown badge is hidden while statement remains
    await page.locator('[role="button"][aria-label^="Primary Goal"]').click();
    await expect(dialog).toBeVisible();
    await dialog.locator('button[aria-label="Clear target date"]').click();
    await dialog.locator('button:has-text("Save")').click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Ship Cadence 1.0 Release Candidate')).toBeVisible();
    await expect(page.getByText(/days left|Due today|overdue/i)).toHaveCount(0);
  });
});
