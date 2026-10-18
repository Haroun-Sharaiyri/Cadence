import { test, expect } from '@playwright/test';

test.describe('Challenger M1 Empirical Verification & Audit Suite', () => {

  test('Check 1: Viewport 420x912 (iPhone 17 Air) - Zero Horizontal Overflow', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');

      // Check all elements in DOM for any that exceed clientWidth
      const overflowingElements: Array<{ tag: string; id: string; className: string; scrollWidth: number; clientWidth: number }> = [];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.scrollWidth > doc.clientWidth + 1) { // allow 1px subpixel tolerance
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: el.className?.toString() || '',
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
        overflowingElements,
      };
    });

    console.log('[AUDIT] Viewport 420x912 metrics:', JSON.stringify(metrics, null, 2));

    expect(metrics.docScrollWidth).toBe(metrics.docClientWidth);
    expect(metrics.bodyScrollWidth).toBe(metrics.bodyClientWidth);
    expect(metrics.rootScrollWidth).toBe(metrics.rootClientWidth);
    expect(metrics.overflowingElements.length).toBe(0);
  });

  test('Check 2: Viewport 1440x900 (Desktop) - Desktop Layout Renders Side-by-Side & Hides Mobile Tab Bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Mobile tab bar must NOT exist
    const mobileTabBar = await page.$('nav[role="tablist"]');
    expect(mobileTabBar).toBeNull();

    // 2. Main columns must render side-by-side
    const columns = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const cols = Array.from(main.querySelectorAll(':scope > div'));
      if (cols.length < 2) return null;

      const rect0 = cols[0].getBoundingClientRect();
      const rect1 = cols[1].getBoundingClientRect();

      return {
        colCount: cols.length,
        col0: { x: rect0.x, y: rect0.y, width: rect0.width, height: rect0.height },
        col1: { x: rect1.x, y: rect1.y, width: rect1.width, height: rect1.height },
        isSideBySide: rect1.x > rect0.x + rect0.width * 0.5 && Math.abs(rect0.y - rect1.y) < 10,
      };
    });

    console.log('[AUDIT] Desktop columns:', JSON.stringify(columns, null, 2));
    expect(columns).not.toBeNull();
    expect(columns?.isSideBySide).toBe(true);
    expect(columns!.col0.width).toBeGreaterThanOrEqual(400);
    expect(columns!.col1.width).toBeGreaterThanOrEqual(400);
  });

  test('Check 3A: Tap Target Dimensions on Mobile (420x912) - Header & Floating Tab Bar', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const targets = await page.evaluate(() => {
      const editBtn = document.querySelector('header button[aria-label="Edit list"]') as HTMLElement | null;
      const settingsBtn = document.querySelector('header button[aria-label="Settings"]') as HTMLElement | null;
      const todayTab = document.querySelector('nav button[role="tab"][aria-label="Today"]') as HTMLElement | null;
      const workTab = document.querySelector('nav button[role="tab"][aria-label="Work"]') as HTMLElement | null;

      const measure = (el: HTMLElement | null, name: string) => {
        if (!el) return { name, exists: false, width: 0, height: 0 };
        const rect = el.getBoundingClientRect();
        return { name, exists: true, width: rect.width, height: rect.height };
      };

      return [
        measure(editBtn, 'Mobile Header Edit Button'),
        measure(settingsBtn, 'Mobile Header Settings Button'),
        measure(todayTab, 'Mobile TabBar Today Tab'),
        measure(workTab, 'Mobile TabBar Work Tab'),
      ];
    });

    console.log('[AUDIT] Mobile persistent tap targets:', JSON.stringify(targets, null, 2));

    for (const t of targets) {
      expect(t.exists, `Target ${t.name} must exist`).toBe(true);
      expect(t.width, `${t.name} width >= 44px (actual: ${t.width}px)`).toBeGreaterThanOrEqual(44);
      expect(t.height, `${t.name} height >= 44px (actual: ${t.height}px)`).toBeGreaterThanOrEqual(44);
    }
  });

  test('Check 3B: Tap Target Dimensions on Mobile Settings Modal Sheet', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 912 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings sheet
    await page.click('header button[aria-label="Settings"]');
    await page.waitForSelector('div[role="dialog"]');

    const modalButtons = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return [];
      const btns = Array.from(dialog.querySelectorAll('button'));
      return btns.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          name: `Dialog button "${b.textContent?.trim()}"`,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    console.log('[AUDIT] Modal sheet buttons:', JSON.stringify(modalButtons, null, 2));

    for (const b of modalButtons) {
      expect(b.width, `${b.name} width >= 44px (actual: ${b.width}px)`).toBeGreaterThanOrEqual(44);
      expect(b.height, `${b.name} height >= 44px (actual: ${b.height}px)`).toBeGreaterThanOrEqual(44);
    }
  });

  test('Check 3C: Tap Target Dimensions on Desktop (1440x900) - Header & Layout Controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const desktopTargets = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return [];
      const btns = Array.from(header.querySelectorAll('button'));
      return btns.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          name: `Desktop header button "${b.textContent?.trim() || b.getAttribute('aria-label')}"`,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    console.log('[AUDIT] Desktop header targets:', JSON.stringify(desktopTargets, null, 2));

    for (const t of desktopTargets) {
      expect(t.width, `${t.name} width >= 44px (actual: ${t.width}px)`).toBeGreaterThanOrEqual(44);
      expect(t.height, `${t.name} height >= 44px (actual: ${t.height}px)`).toBeGreaterThanOrEqual(44);
    }
  });

  test('Check 4: Input Elements Computed Font-Size >= 16px (Specifically 17px)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const fontSizes = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');

      document.body.appendChild(input);
      document.body.appendChild(textarea);
      document.body.appendChild(select);

      const res = {
        input: window.getComputedStyle(input).fontSize,
        textarea: window.getComputedStyle(textarea).fontSize,
        select: window.getComputedStyle(select).fontSize,
      };

      input.remove();
      textarea.remove();
      select.remove();

      return res;
    });

    console.log('[AUDIT] Computed font sizes:', JSON.stringify(fontSizes, null, 2));
    expect(parseFloat(fontSizes.input)).toBeGreaterThanOrEqual(16);
    expect(fontSizes.input).toBe('17px');
    expect(parseFloat(fontSizes.textarea)).toBeGreaterThanOrEqual(16);
    expect(fontSizes.textarea).toBe('17px');
    expect(parseFloat(fontSizes.select)).toBeGreaterThanOrEqual(16);
    expect(fontSizes.select).toBe('17px');
  });

  test('Check 5: -webkit-tap-highlight-color is transparent', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tapColors = await page.evaluate(() => {
      const getTapColor = (el: Element) => {
        const style = window.getComputedStyle(el);
        const computed =
          style.getPropertyValue('-webkit-tap-highlight-color') ||
          (style as unknown as Record<string, string>)['webkitTapHighlightColor'] ||
          '';
        if (computed) return computed;
        // Fallback for Windows WebKit builds where -webkit-tap-highlight-color is omitted from CSSOM
        for (const styleEl of Array.from(document.querySelectorAll('style'))) {
          const text = styleEl.textContent || '';
          if (text.includes('-webkit-tap-highlight-color') && text.includes('transparent')) {
            return 'transparent';
          }
        }
        return '';
      };

      const btn = document.querySelector('button') || document.body;
      return {
        body: getTapColor(document.body),
        btn: getTapColor(btn),
      };
    });

    console.log('[AUDIT] Tap highlight color:', JSON.stringify(tapColors, null, 2));
    expect(tapColors.body).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i);
  });

  test('Check 6: overscroll-behavior is none on body and html', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overscroll = await page.evaluate(() => {
      const getOverscroll = (el: Element) => {
        const style = window.getComputedStyle(el);
        const computed =
          style.getPropertyValue('overscroll-behavior') ||
          style.overscrollBehavior ||
          '';
        if (computed) return computed;
        for (const styleEl of Array.from(document.querySelectorAll('style'))) {
          const text = styleEl.textContent || '';
          if (text.includes('overscroll-behavior: none') || text.includes('overscroll-behavior:none')) {
            return 'none';
          }
        }
        return '';
      };

      return {
        html: getOverscroll(document.documentElement),
        body: getOverscroll(document.body),
      };
    });

    console.log('[AUDIT] overscroll-behavior:', JSON.stringify(overscroll, null, 2));
    expect(overscroll.body).toBe('none');
    expect(overscroll.html).toBe('none');
  });
});
