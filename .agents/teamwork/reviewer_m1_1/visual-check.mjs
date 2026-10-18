import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('.agents/teamwork/reviewer_m1_1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log('Launching browser with Chrome channel...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  // Mobile iPhone 17 Air (420x912)
  console.log('Testing mobile 420x912...');
  const mobileContext = await browser.newContext({
    viewport: { width: 420, height: 912 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  // Start preview server
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    shell: true,
    stdio: 'inherit',
  });

  // Wait 2s for server
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const page = await mobileContext.newPage();
    await page.goto('http://localhost:4173');
    await page.waitForTimeout(1000);

    // Capture initial mobile screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light.png') });
    console.log('Saved mobile-light.png');

    // Check bounding boxes
    const headerBox = await page.locator('header').boundingBox();
    const h1Box = await page.locator('h1').boundingBox();
    const heroCardBox = await page.locator('text=Primary Goal').boundingBox();
    console.log('Header bounding box:', headerBox);
    console.log('H1 bounding box:', h1Box);
    console.log('Hero Card bounding box:', heroCardBox);

    // Switch to dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-dark.png') });
    console.log('Saved mobile-dark.png');

    // Desktop 1440x900
    console.log('Testing desktop 1440x900...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:4173');
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-light.png') });
    console.log('Saved desktop-light.png');

    await desktopPage.emulateMedia({ colorScheme: 'dark' });
    await desktopPage.evaluate(() => document.documentElement.classList.add('dark'));
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-dark.png') });
    console.log('Saved desktop-dark.png');

  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
