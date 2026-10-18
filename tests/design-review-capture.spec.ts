import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'artifacts', 'design-review');

fs.mkdirSync(OUT_DIR, { recursive: true });

interface ViewportConfig {
  id: 'mobile' | 'desktop';
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

const VIEWPORTS: ViewportConfig[] = [
  {
    id: 'mobile',
    width: 420,
    height: 912,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    id: 'desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
];

const THEMES: Array<'light' | 'dark'> = ['light', 'dark'];

async function addMockSupabase(page: Page) {
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
}

async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const scrollers = document.querySelectorAll('.overflow-y-auto');
    scrollers.forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  });
  await page.waitForTimeout(150);
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

async function switchToWork(page: Page, isMobile: boolean) {
  if (isMobile) {
    const workTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Work"]');
    await workTab.click();
    await page.waitForTimeout(200);
  }
}

async function switchToToday(page: Page, isMobile: boolean) {
  if (isMobile) {
    const todayTab = page.locator('nav[role="tablist"] button[role="tab"][aria-label="Today"]');
    await todayTab.click();
    await page.waitForTimeout(200);
  }
}

async function snap(page: Page, filename: string) {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
  });
}

async function runCaptureForCombo(
  browser: Browser,
  vp: ViewportConfig,
  theme: 'light' | 'dark'
) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    colorScheme: theme,
  });

  const page = await context.newPage();
  await addMockSupabase(page);
  await page.clock.install({ time: new Date(2026, 9, 18, 9, 30, 0) });

  const prefix = `${vp.id}-${theme}`;

  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  // 1. Empty States (Today & Work)
  await scrollToTop(page);
  await snap(page, `${prefix}-01-empty-today.png`);
  if (vp.isMobile) {
    await switchToWork(page, true);
    await scrollToTop(page);
    await snap(page, `${prefix}-02-empty-work.png`);
    await switchToToday(page, true);
  }

  // 2. Goal Editor Sheet & Setting Goal with Target Date
  const goalCard = page.locator('div[role="button"][aria-label*="goal" i]');
  await goalCard.click();
  await page.waitForTimeout(300);
  await page.locator('#goal-statement-input').fill('Ship Cadence 1.0 with Apple HIG Perfection');
  await page.locator('input[type="date"]').fill('2026-10-30');
  await snap(page, `${prefix}-03-sheet-goal-editor.png`);
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await page.waitForTimeout(300);

  // 3. Populate Morning Routine, Work Day, Evening Routine, and Work Tab
  await addItemViaUI(page, 'Morning Routine', 'Hydrate with 500ml water');
  await addItemViaUI(page, 'Morning Routine', '15m sunlight & mobility');
  await addItemViaUI(page, 'Work Day', 'Deep architecture review');
  await addItemViaUI(page, 'Work Day', 'Audit Liquid Glass materials');
  await addItemViaUI(page, 'Evening Routine', 'Digital sunset at 9:00 PM');

  if (vp.isMobile) {
    await switchToWork(page, true);
  }
  await addItemViaUI(page, 'Persistent Tasks', 'Finalize iPhone 17 Air splash screens');
  await addItemViaUI(page, 'Persistent Tasks', 'Verify 4:00 AM rollover boundary');
  await addItemViaUI(page, 'Persistent Tasks', 'Run full Playwright E2E suite');

  if (vp.isMobile) {
    await scrollToTop(page);
    await snap(page, `${prefix}-04-populated-work.png`);
    await switchToToday(page, true);
  }
  await scrollToTop(page);
  await snap(page, `${prefix}-05-populated-today.png`);

  // 4. Checked states & Section 100% Complete
  const cbMorning1 = page
    .locator('[data-checklist-row="true"]', { hasText: 'Hydrate with 500ml water' })
    .locator('button[role="checkbox"]');
  await cbMorning1.click();
  await scrollToTop(page);
  await snap(page, `${prefix}-06-checked-partial.png`);

  // Complete Morning Routine section (100% progress ring state)
  const cbMorning2 = page
    .locator('[data-checklist-row="true"]', { hasText: '15m sunlight & mobility' })
    .locator('button[role="checkbox"]');
  await cbMorning2.click();
  await scrollToTop(page);
  await snap(page, `${prefix}-07-section-complete.png`);

  // 5. Edit Mode (leading red minus, slide-out Delete confirmation, drag handles, inline rename)
  const editBtn = vp.isMobile
    ? page.locator('header button[aria-label="Edit list"]')
    : page.locator('header button:has-text("Edit")');
  await editBtn.click();
  await page.waitForTimeout(300);

  // Trigger slide-out delete button on first item and inline rename on second item
  await page.locator('button[aria-label="Delete Hydrate with 500ml water"]').click();
  await scrollToTop(page);
  await snap(page, `${prefix}-08-edit-mode-delete-reveal.png`);

  // Click on another item title to show inline rename input
  await page.getByText('Deep architecture review').click();
  await scrollToTop(page);
  await snap(page, `${prefix}-09-edit-mode-inline-rename.png`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Exit Edit mode
  const doneBtn = vp.isMobile
    ? page.locator('header button[aria-label="Done editing"]')
    : page.locator('header button:has-text("Done")');
  await doneBtn.click();
  await page.waitForTimeout(250);

  // 6. Day Complete (all daily items checked -> Goal Hero Card restrained completion state)
  await page
    .locator('[data-checklist-row="true"]', { hasText: 'Deep architecture review' })
    .locator('button[role="checkbox"]')
    .click();
  await page
    .locator('[data-checklist-row="true"]', { hasText: 'Audit Liquid Glass materials' })
    .locator('button[role="checkbox"]')
    .click();
  await page
    .locator('[data-checklist-row="true"]', { hasText: 'Digital sunset at 9:00 PM' })
    .locator('button[role="checkbox"]')
    .click();
  await scrollToTop(page);
  await snap(page, `${prefix}-10-day-complete.png`);

  // Also capture mobile scrolled state showing CollapsingHeader inline title & Liquid Glass blur
  if (vp.isMobile) {
    await page.evaluate(() => {
      const scroller = document.querySelector('.overflow-y-auto') as HTMLElement | null;
      if (scroller) scroller.scrollTop = 96;
    });
    await page.waitForTimeout(250);
    await snap(page, `${prefix}-17-scrolled-collapsing-header.png`);
    await scrollToTop(page);
  }

  // 7. Work Tab: Checked item, Swipe-to-Delete reveal (mobile), and Clear Completed Sheet
  if (vp.isMobile) {
    await switchToWork(page, true);
  }
  const workRow1 = page.locator('[data-checklist-row="true"]', {
    hasText: 'Finalize iPhone 17 Air splash screens',
  });
  await workRow1.locator('button[role="checkbox"]').click();
  await scrollToTop(page);

  if (vp.isMobile) {
    // Swipe left ~95px on second work row to snap open the rubber-banded Delete reveal
    const workRow2 = page.locator('[data-checklist-row="true"]', {
      hasText: 'Verify 4:00 AM rollover boundary',
    });
    const box = await workRow2.boundingBox();
    if (box) {
      const startX = box.x + box.width - 40;
      const startY = box.y + box.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(startX - i * 9, startY, { steps: 2 });
      }
      await page.mouse.up();
      await page.waitForTimeout(300);
      await snap(page, `${prefix}-11-swipe-to-delete-reveal.png`);
      // Tap row to close swipe
      await workRow2.click();
      await page.waitForTimeout(200);
    }
  }

  // Open Clear Completed confirmation sheet
  const clearTrigger = page.locator('button[aria-label*="Clear completed"]');
  await clearTrigger.click();
  await page.waitForTimeout(300);
  await snap(page, `${prefix}-12-sheet-clear-completed.png`);
  await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
  await page.waitForTimeout(250);

  // 8. Settings Sheet & Sign-In (AuthModal email + 6-digit OTP step)
  await page.locator('header button[aria-label="Settings"]').click();
  await page.waitForTimeout(300);
  await snap(page, `${prefix}-13-sheet-settings.png`);

  await page.locator('[data-testid="settings-sign-in-btn"]').click();
  await page.waitForTimeout(300);
  await page.locator('#auth-email-input').fill('designer@apple.com');
  await snap(page, `${prefix}-14-auth-modal-email.png`);

  await page.locator('button:has-text("Send 6-Digit Code")').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="otp-box-0"]').pressSequentially('428');
  await snap(page, `${prefix}-15-auth-modal-otp.png`);

  await page.locator('div[role="dialog"] button:has-text("Cancel")').click();
  await page.waitForTimeout(250);

  // 9. Offline / Local Mode state
  await context.setOffline(true);
  await page.waitForTimeout(250);
  if (vp.isMobile) {
    await page.locator('header button[aria-label="Settings"]').click();
    await page.waitForTimeout(300);
    await snap(page, `${prefix}-16-offline-state.png`);
    await page.locator('div[role="dialog"] button:has-text("Done")').click();
  } else {
    await scrollToTop(page);
    await snap(page, `${prefix}-16-offline-state.png`);
  }
  await context.setOffline(false);

  await context.close();
}

test.describe('Apple Design Review Full Screenshot & HIG Audit', () => {
  test.setTimeout(180000);

  test('Captures Light & Dark screenshots at 420x912 (@3x) and 1440x900 (@2x)', async ({
    browser,
  }) => {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        await runCaptureForCombo(browser, vp, theme);
      }
    }

    // Copy generated icons & splash screens into artifacts/design-review/ for consolidated review
    const publicFiles = [
      ['public/icons/apple-touch-icon-180x180.png', 'asset-apple-touch-icon-180x180.png'],
      ['public/icons/icon-512x512.png', 'asset-icon-512x512.png'],
      ['public/splash/splash-light-1260x2736.png', 'asset-splash-light-1260x2736.png'],
      ['public/splash/splash-dark-1260x2736.png', 'asset-splash-dark-1260x2736.png'],
    ];
    for (const [srcRel, destName] of publicFiles) {
      fs.copyFileSync(path.join(process.cwd(), srcRel), path.join(OUT_DIR, destName));
    }

    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
    expect(files.length).toBeGreaterThanOrEqual(60);
  });
});
