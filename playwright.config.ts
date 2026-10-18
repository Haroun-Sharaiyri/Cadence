import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // iPhone 17 Air - WebKit (Primary mobile fidelity target)
    {
      name: 'iphone-17-air-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 420, height: 912 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        defaultBrowserType: 'webkit',
      },
    },
    // iPhone 17 Air - Chromium
    {
      name: 'iphone-17-air-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 420, height: 912 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
    // Desktop - Chromium (>=1024px side-by-side)
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Desktop - WebKit
    {
      name: 'desktop-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
