import { test, expect } from '@playwright/test';

test.describe('Milestone 1 Empirical Adversarial Stress Suite', () => {

  test.describe('Viewport Limits & Horizontal Overflow', () => {
    test('iPhone 17 Air (420x912): assert zero horizontal overflow', async ({ page }) => {
      await page.setViewportSize({ width: 420, height: 912 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const dimensions = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: docEl.scrollWidth,
          docClientWidth: docEl.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth,
          rootScrollWidth: root?.scrollWidth ?? 0,
          rootClientWidth: root?.clientWidth ?? 0,
        };
      });

      console.log('Mobile 420x912 dimensions:', JSON.stringify(dimensions));
      expect(dimensions.docScrollWidth).toBe(dimensions.docClientWidth);
      expect(dimensions.bodyScrollWidth).toBe(dimensions.bodyClientWidth);
      expect(dimensions.rootScrollWidth).toBe(dimensions.rootClientWidth);
      expect(dimensions.docScrollWidth).toBeLessThanOrEqual(420);
    });

    test('Smaller mobile viewport (375x667 - iPhone SE): assert zero horizontal overflow', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });
      console.log('SE 375x667 dimensions:', JSON.stringify(overflow));
      expect(overflow.scrollWidth).toBe(overflow.clientWidth);
    });

    test('Boundary breakpoint 1023px (Mobile) vs 1024px (Desktop)', async ({ page }) => {
      // 1023px: should show floating tab bar and hide desktop layout
      await page.setViewportSize({ width: 1023, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const mobileTabBar1023 = await page.$('nav[role="tablist"]');
      expect(mobileTabBar1023).not.toBeNull();

      // 1024px: should hide mobile tab bar and render desktop side-by-side layout
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.waitForTimeout(300); // allow resize observer / state update
      const mobileTabBar1024 = await page.$('nav[role="tablist"]');
      expect(mobileTabBar1024).toBeNull();
    });
  });

  test.describe('Desktop Layout Rendering (1440x900)', () => {
    test('Desktop: renders side-by-side columns and hides mobile tab bar', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // 1. Mobile tab bar must NOT be present
      const tabBar = await page.$('nav[role="tablist"]');
      expect(tabBar).toBeNull();

      // 2. Main layout must render side-by-side columns
      const columns = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return null;
        const cols = main.querySelectorAll(':scope > div');
        if (cols.length < 2) return null;
        const rect1 = cols[0].getBoundingClientRect();
        const rect2 = cols[1].getBoundingClientRect();
        return {
          col1: { x: rect1.x, y: rect1.y, width: rect1.width, height: rect1.height },
          col2: { x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height },
          isSideBySide: rect2.x > rect1.x + rect1.width * 0.5 && Math.abs(rect1.y - rect2.y) < 50,
        };
      });

      console.log('Desktop side-by-side columns:', JSON.stringify(columns));
      expect(columns).not.toBeNull();
      expect(columns?.isSideBySide).toBe(true);
      expect(columns!.col1.width).toBeGreaterThan(400);
      expect(columns!.col2.width).toBeGreaterThan(400);
    });
  });

  test.describe('Tap Target Dimensions (>= 44x44px minimum)', () => {
    test('Mobile 420x912: All interactive elements in header, tab bar, and layout have boundingClientRect >= 44x44', async ({ page }) => {
      await page.setViewportSize({ width: 420, height: 912 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const elements = await page.evaluate(() => {
        const interactiveSelectors = 'button, [role="button"], [role="tab"], a, input, select';
        const els = Array.from(document.querySelectorAll(interactiveSelectors));
        return els.map((el) => {
          const rect = el.getBoundingClientRect();
          const text = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim();
          return {
            tagName: el.tagName,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            text,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden',
          };
        }).filter((item) => item.visible);
      });

      console.log('Mobile interactive elements:', JSON.stringify(elements, null, 2));
      for (const el of elements) {
        expect(el.width, `Element "${el.text}" width must be >= 44px (was ${el.width}px)`).toBeGreaterThanOrEqual(44);
        expect(el.height, `Element "${el.text}" height must be >= 44px (was ${el.height}px)`).toBeGreaterThanOrEqual(44);
      }
    });

    test('Mobile Settings modal sheet: check tap targets when opened', async ({ page }) => {
      await page.setViewportSize({ width: 420, height: 912 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Click settings button to open modal sheet
      await page.click('button[aria-label="Settings"]');
      await page.waitForSelector('div[role="dialog"]');

      const dialogButtons = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return [];
        const buttons = Array.from(dialog.querySelectorAll('button'));
        return buttons.map((b) => {
          const rect = b.getBoundingClientRect();
          return {
            text: b.textContent?.trim(),
            width: rect.width,
            height: rect.height,
          };
        });
      });

      console.log('Settings dialog buttons:', JSON.stringify(dialogButtons, null, 2));
      for (const btn of dialogButtons) {
        expect(btn.width, `Dialog button "${btn.text}" width must be >= 44px (was ${btn.width}px)`).toBeGreaterThanOrEqual(44);
        expect(btn.height, `Dialog button "${btn.text}" height must be >= 44px (was ${btn.height}px)`).toBeGreaterThanOrEqual(44);
      }
    });

    test('Desktop 1440x900: All interactive elements in header and layout have boundingClientRect >= 44x44', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const elements = await page.evaluate(() => {
        const interactiveSelectors = 'button, [role="button"], [role="tab"], a, input, select';
        const els = Array.from(document.querySelectorAll(interactiveSelectors));
        return els.map((el) => {
          const rect = el.getBoundingClientRect();
          const text = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim();
          return {
            tagName: el.tagName,
            ariaLabel: el.getAttribute('aria-label'),
            text,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          };
        }).filter((item) => item.visible);
      });

      console.log('Desktop interactive elements:', JSON.stringify(elements, null, 2));
      for (const el of elements) {
        expect(el.width, `Desktop element "${el.text}" width must be >= 44px (was ${el.width}px)`).toBeGreaterThanOrEqual(44);
        expect(el.height, `Desktop element "${el.text}" height must be >= 44px (was ${el.height}px)`).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Anti-Web-Isms & Typography & Touch Locks', () => {
    test('Input elements have computed font-size >= 16px (specifically 17px)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const computedFontSizes = await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Test input';
        const textarea = document.createElement('textarea');
        const select = document.createElement('select');
        document.body.appendChild(input);
        document.body.appendChild(textarea);
        document.body.appendChild(select);

        const inputStyle = window.getComputedStyle(input).fontSize;
        const textareaStyle = window.getComputedStyle(textarea).fontSize;
        const selectStyle = window.getComputedStyle(select).fontSize;

        input.remove();
        textarea.remove();
        select.remove();

        return {
          inputFontSize: inputStyle,
          textareaFontSize: textareaStyle,
          selectFontSize: selectStyle,
        };
      });

      console.log('Input font sizes:', JSON.stringify(computedFontSizes));
      expect(parseFloat(computedFontSizes.inputFontSize)).toBeGreaterThanOrEqual(16);
      expect(computedFontSizes.inputFontSize).toBe('17px');
      expect(parseFloat(computedFontSizes.textareaFontSize)).toBeGreaterThanOrEqual(16);
      expect(computedFontSizes.textareaFontSize).toBe('17px');
      expect(parseFloat(computedFontSizes.selectFontSize)).toBeGreaterThanOrEqual(16);
      expect(computedFontSizes.selectFontSize).toBe('17px');
    });

    test('-webkit-tap-highlight-color is transparent', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const tapHighlight = await page.evaluate(() => {
        const resolveTap = (el: Element | null) => {
          if (!el) return null;
          const style = window.getComputedStyle(el);
          const val =
            style.getPropertyValue('-webkit-tap-highlight-color') ||
            (style as unknown as { webkitTapHighlightColor?: string }).webkitTapHighlightColor ||
            '';
          if (val) return val;
          for (const styleEl of Array.from(document.querySelectorAll('style'))) {
            const text = styleEl.textContent || '';
            if (text.includes('-webkit-tap-highlight-color') && text.includes('transparent')) {
              return 'transparent';
            }
          }
          return '';
        };
        const btn = document.querySelector('button');
        return {
          bodyTapHighlight: resolveTap(document.body),
          btnTapHighlight: resolveTap(btn),
        };
      });

      console.log('Tap highlight color:', JSON.stringify(tapHighlight));
      expect(tapHighlight.bodyTapHighlight).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i);
      if (tapHighlight.btnTapHighlight) {
        expect(tapHighlight.btnTapHighlight).toMatch(/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i);
      }
    });

    test('overscroll-behavior is none on body and html', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const overscroll = await page.evaluate(() => {
        const resolveOverscroll = (el: Element | null) => {
          if (!el) return null;
          const style = window.getComputedStyle(el);
          const val = style.getPropertyValue('overscroll-behavior') || style.overscrollBehavior || '';
          if (val) return val;
          for (const styleEl of Array.from(document.querySelectorAll('style'))) {
            const text = styleEl.textContent || '';
            if (text.includes('overscroll-behavior: none') || text.includes('overscroll-behavior:none')) {
              return 'none';
            }
          }
          return '';
        };
        return {
          htmlOverscroll: resolveOverscroll(document.documentElement),
          bodyOverscroll: resolveOverscroll(document.body),
          rootOverscroll: resolveOverscroll(document.getElementById('root')),
        };
      });

      console.log('Overscroll behaviors:', JSON.stringify(overscroll));
      expect(overscroll.bodyOverscroll).toBe('none');
      expect(overscroll.htmlOverscroll).toBe('none');
      expect(overscroll.rootOverscroll).toBe('none');
    });

    test('user-select is none on body and UI chrome, but text on inputs', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const userSelects = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const btn = document.querySelector('button');
        const btnStyle = btn ? window.getComputedStyle(btn) : null;

        const input = document.createElement('input');
        document.body.appendChild(input);
        const inputStyle = window.getComputedStyle(input);
        const inputSelect = inputStyle.userSelect;
        input.remove();

        return {
          bodyUserSelect: bodyStyle.userSelect,
          btnUserSelect: btnStyle?.userSelect,
          inputSelect,
        };
      });

      console.log('User select styles:', JSON.stringify(userSelects));
      expect(userSelects.bodyUserSelect).toBe('none');
      expect(userSelects.btnUserSelect).toBe('none');
      expect(userSelects.inputSelect).toBe('text');
    });

    test('touch-action is manipulation on buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const touchAction = await page.evaluate(() => {
        const btn = document.querySelector('button');
        return btn ? window.getComputedStyle(btn).touchAction : null;
      });

      console.log('Button touch-action:', touchAction);
      expect(touchAction).toBe('manipulation');
    });
  });
});
