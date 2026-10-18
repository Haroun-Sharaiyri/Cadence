/**
 * scripts/verify-budgets.mjs
 * Empirical verification of Cadence production bundle size budgets,
 * Cumulative Layout Shift (CLS), PWA Service Worker offline reload, and Lighthouse mobile metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function verifyBundleBudgets() {
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error('dist/index.html not found. Run `npm run build` first.');
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Extract initial synchronous <script type="module" src="..."> and <link rel="modulepreload" href="...">
  const scriptSrcMatches = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const preloadHrefMatches = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map(
    (m) => m[1]
  );

  const initialJsPaths = [...new Set([...scriptSrcMatches, ...preloadHrefMatches])];

  console.log('=== 1. INITIAL SYNCHRONOUS JS CHUNKS (in dist/index.html) ===');
  let initialRawBytes = 0;
  let initialGzipBytes = 0;
  const initialChunks = [];

  for (const relPath of initialJsPaths) {
    const fullPath = path.join(DIST_DIR, relPath.replace(/^\//, ''));
    const buf = fs.readFileSync(fullPath);
    const gz = zlib.gzipSync(buf, { level: 9 });
    initialRawBytes += buf.length;
    initialGzipBytes += gz.length;
    initialChunks.push({
      file: relPath,
      rawBytes: buf.length,
      gzipBytes: gz.length,
      rawKB: formatKB(buf.length),
      gzipKB: formatKB(gz.length),
    });
    console.log(
      `  ${relPath.padEnd(42)} Raw: ${formatKB(buf.length).padStart(10)} | Gzip: ${formatKB(gz.length).padStart(9)}`
    );
  }

  console.log('-------------------------------------------------------------');
  console.log(
    `  TOTAL INITIAL JS:                          Raw: ${formatKB(initialRawBytes).padStart(10)} | Gzip: ${formatKB(initialGzipBytes).padStart(9)} (${initialGzipBytes} bytes)`
  );

  // Inspect all JS and CSS files in dist/assets
  const assetsDir = path.join(DIST_DIR, 'assets');
  const allAssetFiles = fs.readdirSync(assetsDir);
  const initialBasenames = new Set(initialJsPaths.map((p) => path.basename(p)));

  let deferredRawBytes = 0;
  let deferredGzipBytes = 0;
  const deferredChunks = [];
  const cssAssets = [];

  console.log('\n=== 2. DEFERRED LAZY-LOADED JS CHUNKS ===');
  for (const file of allAssetFiles) {
    if (file.endsWith('.map')) continue;
    const fullPath = path.join(assetsDir, file);
    const buf = fs.readFileSync(fullPath);
    const gz = zlib.gzipSync(buf, { level: 9 });

    if (file.endsWith('.js') && !initialBasenames.has(file)) {
      deferredRawBytes += buf.length;
      deferredGzipBytes += gz.length;
      deferredChunks.push({
        file: `/assets/${file}`,
        rawBytes: buf.length,
        gzipBytes: gz.length,
        rawKB: formatKB(buf.length),
        gzipKB: formatKB(gz.length),
      });
      console.log(
        `  /assets/${file.padEnd(34)} Raw: ${formatKB(buf.length).padStart(10)} | Gzip: ${formatKB(gz.length).padStart(9)}`
      );
    } else if (file.endsWith('.css')) {
      cssAssets.push({
        file: `/assets/${file}`,
        rawBytes: buf.length,
        gzipBytes: gz.length,
        rawKB: formatKB(buf.length),
        gzipKB: formatKB(gz.length),
      });
    }
  }

  console.log('-------------------------------------------------------------');
  console.log(
    `  TOTAL DEFERRED JS:                         Raw: ${formatKB(deferredRawBytes).padStart(10)} | Gzip: ${formatKB(deferredGzipBytes).padStart(9)} (${deferredGzipBytes} bytes)`
  );
  console.log(
    `  TOTAL ALL JS (INITIAL + DEFERRED):         Raw: ${formatKB(initialRawBytes + deferredRawBytes).padStart(10)} | Gzip: ${formatKB(initialGzipBytes + deferredGzipBytes).padStart(9)}`
  );

  console.log('\n=== 3. CSS ASSETS ===');
  for (const css of cssAssets) {
    console.log(`  ${css.file.padEnd(42)} Raw: ${css.rawKB.padStart(10)} | Gzip: ${css.gzipKB.padStart(9)}`);
  }

  const maxInitialGzipBytes = 180 * 1024; // 180 KB strict target (budget <= 220 KB)
  if (initialGzipBytes > maxInitialGzipBytes) {
    throw new Error(`Initial JS gzipped size (${formatKB(initialGzipBytes)}) exceeds strict 180 KB target!`);
  }
  console.log(`\n✅ Initial JS Budget PASS: ${formatKB(initialGzipBytes)} <= 180.00 KB (Hard limit: 220.00 KB)`);

  return {
    initialChunks,
    deferredChunks,
    cssAssets,
    initialRawBytes,
    initialGzipBytes,
    deferredRawBytes,
    deferredGzipBytes,
  };
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Wait and retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function runPlaywrightClsAndPwaAudit() {
  console.log('\n=== 4. PLAYWRIGHT MOBILE CLS, TIMING & OFFLINE PWA AUDIT ===');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 420, height: 912 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();

    // Inject PerformanceObserver for layout-shift before navigation
    await page.addInitScript(() => {
      window.__CLS_SCORE__ = 0;
      window.__CLS_ENTRIES__ = [];
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__CLS_SCORE__ += entry.value;
              window.__CLS_ENTRIES__.push({ value: entry.value, startTime: entry.startTime });
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // Ignore if unsupported
      }
    });

    const response = await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    const initialStatus = response?.status() ?? 0;

    // Wait for UI to settle
    await page.waitForSelector('text=Morning Routine', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Measure paint & CLS metrics and wait for Service Worker activation + controller claim
    const perfMetrics = await page.evaluate(async () => {
      const paints = performance.getEntriesByType('paint');
      const fcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0;
      const cls = window.__CLS_SCORE__ ?? 0;

      // Wait for Service Worker registration and activation
      let swActive = false;
      let swScope = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        swActive = Boolean(reg.active);
        swScope = reg.scope;
        if (!navigator.serviceWorker.controller) {
          await new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
            setTimeout(resolve, 1500);
          });
        }
      }

      return { fcp, cls, swActive, swScope };
    });

    // Check manifest.webmanifest
    const manifestRes = await page.request.get(`${PREVIEW_URL}/manifest.webmanifest`);
    const manifestStatus = manifestRes.status();
    const manifestJson = await manifestRes.json();

    // Test offline launch via Service Worker
    await context.setOffline(true);
    const offlineReloadRes = await page.reload({ waitUntil: 'load' });
    const offlineStatus = offlineReloadRes?.status() ?? 0;
    await page.waitForSelector('text=Morning Routine', { timeout: 10000 });
    const offlineHeadingVisible = await page.locator('text=Morning Routine').isVisible();
    await context.setOffline(false);

    console.log(`  Initial HTTP Status:       ${initialStatus}`);
    console.log(`  First Contentful Paint:    ${perfMetrics.fcp.toFixed(1)} ms`);
    console.log(`  Cumulative Layout Shift:   ${perfMetrics.cls.toFixed(5)} (Budget: < 0.02)`);
    console.log(`  Manifest Status & Display: HTTP ${manifestStatus}, display="${manifestJson.display}", icons=${manifestJson.icons?.length}`);
    console.log(`  Service Worker Active:     ${perfMetrics.swActive} (scope: ${perfMetrics.swScope})`);
    console.log(`  Offline Reload Status:     HTTP ${offlineStatus}, UI Rendered Offline: ${offlineHeadingVisible}`);

    if (perfMetrics.cls >= 0.02) {
      throw new Error(`CLS (${perfMetrics.cls}) exceeded 0.02 budget!`);
    }
    if (!perfMetrics.swActive || offlineStatus !== 200 || !offlineHeadingVisible) {
      throw new Error('PWA offline launch verification failed!');
    }

    return {
      initialStatus,
      fcpMs: perfMetrics.fcp,
      cls: perfMetrics.cls,
      manifestStatus,
      manifestDisplay: manifestJson.display,
      manifestIconsCount: manifestJson.icons?.length ?? 0,
      swActive: perfMetrics.swActive,
      offlineStatus,
      offlineHeadingVisible,
    };
  } finally {
    await browser.close();
  }
}

function runLighthouseAudit() {
  console.log('\n=== 5. LIGHTHOUSE MOBILE PRODUCTION AUDIT ===');
  const chromePath = chromium.executablePath();
  const reportPath = path.join(ROOT_DIR, 'lighthouse-report.json');

  const cmd = `npx --yes lighthouse ${PREVIEW_URL} --output=json --output-path="${reportPath}" --only-categories=performance,accessibility,best-practices --form-factor=mobile --screenEmulation.mobile --screenEmulation.width=420 --screenEmulation.height=912 --screenEmulation.deviceScaleFactor=3 --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet`;

  execSync(cmd, {
    cwd: ROOT_DIR,
    env: { ...process.env, CHROME_PATH: chromePath },
    stdio: 'inherit',
  });

  const lhr = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const perfScore = Math.round((lhr.categories.performance?.score ?? 0) * 100);
  const a11yScore = Math.round((lhr.categories.accessibility?.score ?? 0) * 100);
  const bpScore = Math.round((lhr.categories['best-practices']?.score ?? 0) * 100);

  const clsValue = lhr.audits['cumulative-layout-shift']?.numericValue ?? 0;
  const fcpValue = lhr.audits['first-contentful-paint']?.displayValue ?? 'N/A';
  const lcpValue = lhr.audits['largest-contentful-paint']?.displayValue ?? 'N/A';
  const tbtValue = lhr.audits['total-blocking-time']?.displayValue ?? 'N/A';
  const siValue = lhr.audits['speed-index']?.displayValue ?? 'N/A';

  console.log(`  Performance Score:         ${perfScore} / 100 (Target: >= 90)`);
  console.log(`  Accessibility Score:       ${a11yScore} / 100 (Target: >= 95)`);
  console.log(`  Best Practices Score:      ${bpScore} / 100 (Target: >= 95)`);
  console.log(`  Lighthouse CLS:            ${clsValue.toFixed(5)} (Target: < 0.02)`);
  console.log(`  First Contentful Paint:    ${fcpValue}`);
  console.log(`  Largest Contentful Paint:  ${lcpValue}`);
  console.log(`  Total Blocking Time:       ${tbtValue}`);
  console.log(`  Speed Index:               ${siValue}`);

  // Clean up temporary lighthouse-report.json after reading
  try {
    fs.unlinkSync(reportPath);
  } catch {
    // ignore
  }

  return {
    perfScore,
    a11yScore,
    bpScore,
    clsValue,
    fcpValue,
    lcpValue,
    tbtValue,
    siValue,
  };
}

async function main() {
  const bundleMetrics = verifyBundleBudgets();

  // Start vite preview server
  const previewProc = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--host'],
    {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    }
  );

  try {
    await waitForServer(PREVIEW_URL);
    const pwaMetrics = await runPlaywrightClsAndPwaAudit();
    const lhMetrics = runLighthouseAudit();

    console.log('\n=== SUMMARY JSON ===');
    console.log(JSON.stringify({ bundleMetrics, pwaMetrics, lhMetrics }, null, 2));
  } finally {
    previewProc.kill();
  }
}

main().catch((err) => {
  console.error('\n❌ Quality Budget Verification Failed:', err);
  process.exit(1);
});
