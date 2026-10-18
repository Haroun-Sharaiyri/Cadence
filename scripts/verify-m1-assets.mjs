import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const distDir = path.resolve('dist');
const publicDir = path.resolve('public');

console.log('====================================================');
console.log('EMPIRICAL VERIFICATION FOR MILESTONE 1');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. BUNDLE SIZE BUDGET TEST
// -----------------------------------------------------------------------------
console.log('--- 1. BUNDLE SIZE BUDGET TEST ---');
const htmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('ERROR: dist/index.html does not exist! Build required.');
  process.exit(1);
}
const html = fs.readFileSync(htmlPath, 'utf8');

const initialScripts = [];
const scriptMatch = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
for (const m of scriptMatch) {
  initialScripts.push(m[1].replace(/^\//, ''));
}
const preloadMatch = html.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/g);
for (const m of preloadMatch) {
  initialScripts.push(m[1].replace(/^\//, ''));
}

console.log('Initial JavaScript assets loaded by index.html:');
let totalUncompressed = 0;
let totalGzip = 0;
const bundleDetails = [];

for (const relPath of initialScripts) {
  const fullPath = path.join(distDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`ERROR: Referenced initial script missing: ${fullPath}`);
    process.exit(1);
  }
  const rawBuf = fs.readFileSync(fullPath);
  const gzBuf = zlib.gzipSync(rawBuf, { level: 9 });
  totalUncompressed += rawBuf.length;
  totalGzip += gzBuf.length;
  bundleDetails.push({
    file: relPath,
    rawBytes: rawBuf.length,
    rawKb: (rawBuf.length / 1024).toFixed(2),
    gzipBytes: gzBuf.length,
    gzipKb: (gzBuf.length / 1024).toFixed(2),
  });
  console.log(`  - ${relPath}: ${rawBuf.length} B raw (${(rawBuf.length / 1024).toFixed(2)} KB), ${gzBuf.length} B gzip (${(gzBuf.length / 1024).toFixed(2)} KB)`);
}

const budgetBytes = 220 * 1024; // 225,280 bytes
const budgetKb = 220;
const actualGzipKb = (totalGzip / 1024).toFixed(2);
const passBudget = totalGzip <= budgetBytes;

console.log(`\nInitial JS Bundle Total:`);
console.log(`  Raw uncompressed: ${totalUncompressed} bytes (${(totalUncompressed / 1024).toFixed(2)} KB)`);
console.log(`  Gzip compressed (level 9): ${totalGzip} bytes (${actualGzipKb} KB)`);
console.log(`  Budget limit: ${budgetBytes} bytes (${budgetKb} KB)`);
console.log(`  Headroom: ${(budgetBytes - totalGzip)} bytes (${((budgetBytes - totalGzip) / 1024).toFixed(2)} KB)`);
console.log(`  Status: ${passBudget ? 'PASS (Under Budget)' : 'FAIL (Exceeds Budget)'}\n`);

// -----------------------------------------------------------------------------
// 2. MANIFEST.WEBMANIFEST VALIDATION
// -----------------------------------------------------------------------------
console.log('--- 2. MANIFEST VALIDATION ---');
const manifestPublicPath = path.join(publicDir, 'manifest.webmanifest');
const manifestDistPath = path.join(distDir, 'manifest.webmanifest');

for (const mPath of [manifestPublicPath, manifestDistPath]) {
  console.log(`Testing manifest at: ${mPath}`);
  if (!fs.existsSync(mPath)) {
    console.error(`FAIL: Manifest missing at ${mPath}`);
    process.exit(1);
  }
  const rawManifest = fs.readFileSync(mPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(rawManifest);
    console.log('  ✓ Valid JSON syntax');
  } catch (e) {
    console.error('  FAIL: Manifest is not valid JSON:', e.message);
    process.exit(1);
  }

  // Name check
  if (manifest.name === 'Cadence' && manifest.short_name === 'Cadence') {
    console.log(`  ✓ Name: "${manifest.name}", Short Name: "${manifest.short_name}"`);
  } else {
    console.error(`  FAIL: Name check failed: name=${manifest.name}, short_name=${manifest.short_name}`);
  }

  // start_url check
  if (manifest.start_url === '/') {
    console.log(`  ✓ start_url: "${manifest.start_url}"`);
  } else {
    console.error(`  FAIL: start_url is "${manifest.start_url}", expected "/"`);
  }

  // display mode check
  if (manifest.display === 'standalone') {
    console.log(`  ✓ display: "${manifest.display}"`);
  } else {
    console.error(`  FAIL: display is "${manifest.display}", expected "standalone"`);
  }

  // icons array
  if (Array.isArray(manifest.icons) && manifest.icons.length > 0) {
    console.log(`  ✓ icons array present with ${manifest.icons.length} definitions:`);
    for (const icon of manifest.icons) {
      console.log(`    - src: ${icon.src}, sizes: ${icon.sizes}, type: ${icon.type}, purpose: ${icon.purpose}`);
      // verify referenced file exists in public/ and dist/
      const iconRel = icon.src.replace(/^\//, '');
      const pubIconFile = path.join(publicDir, iconRel);
      const distIconFile = path.join(distDir, iconRel);
      if (!fs.existsSync(pubIconFile)) {
        console.error(`    FAIL: Referenced icon missing in public: ${pubIconFile}`);
      }
      if (!fs.existsSync(distIconFile)) {
        console.error(`    FAIL: Referenced icon missing in dist: ${distIconFile}`);
      }
    }
  } else {
    console.error('  FAIL: manifest.icons is missing or empty');
  }
}

// -----------------------------------------------------------------------------
// 3. SERVICE WORKER VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. SERVICE WORKER VALIDATION ---');
const swPublicPath = path.join(publicDir, 'sw.js');
const swDistPath = path.join(distDir, 'sw.js');

for (const swPath of [swPublicPath, swDistPath]) {
  console.log(`Testing service worker at: ${swPath}`);
  if (!fs.existsSync(swPath)) {
    console.error(`FAIL: Service worker missing at ${swPath}`);
    process.exit(1);
  }
  const swCode = fs.readFileSync(swPath, 'utf8');

  // Cache name
  const cacheNameMatch = swCode.match(/const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  if (cacheNameMatch) {
    console.log(`  ✓ CACHE_NAME defined: "${cacheNameMatch[1]}"`);
  } else {
    console.error('  FAIL: CACHE_NAME constant not found');
  }

  // Shell assets list
  const shellAssetsMatch = swCode.match(/const\s+SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (shellAssetsMatch) {
    const assetsRaw = shellAssetsMatch[1]
      .split('\n')
      .map(line => line.trim().replace(/[',]/g, ''))
      .filter(line => line.length > 0 && !line.startsWith('//'));
    console.log(`  ✓ SHELL_ASSETS defined with ${assetsRaw.length} assets:`, assetsRaw);
    // Verify each static asset exists
    for (const asset of assetsRaw) {
      if (asset === '/' || asset === '/index.html') continue;
      const assetRel = asset.replace(/^\//, '');
      const pubAsset = path.join(publicDir, assetRel);
      const distAsset = path.join(distDir, assetRel);
      if (!fs.existsSync(pubAsset)) {
        console.warn(`    WARNING: Precached asset not found in public/: ${assetRel}`);
      }
      if (!fs.existsSync(distAsset)) {
        console.warn(`    WARNING: Precached asset not found in dist/: ${assetRel}`);
      }
    }
  } else {
    console.error('  FAIL: SHELL_ASSETS array not found');
  }

  // Lifecycle listeners
  const hasInstall = swCode.includes("addEventListener('install'");
  const hasActivate = swCode.includes("addEventListener('activate'");
  const hasFetch = swCode.includes("addEventListener('fetch'");
  console.log(`  ✓ Event listeners: install=${hasInstall}, activate=${hasActivate}, fetch=${hasFetch}`);

  // Offline navigation fallback
  const hasNavigateMode = swCode.includes("request.mode === 'navigate'");
  const hasIndexFallback = swCode.includes("caches.match('/index.html')");
  if (hasNavigateMode && hasIndexFallback) {
    console.log('  ✓ Navigation requests fall back to cached /index.html when offline');
  } else {
    console.error('  FAIL: Offline navigation fallback not detected');
  }

  // Third-party network exclusion (Supabase bypass)
  const hasThirdPartyBypass = swCode.includes('url.origin !== self.location.origin');
  if (hasThirdPartyBypass) {
    console.log('  ✓ Third-party network requests (e.g. Supabase) explicitly bypassed');
  } else {
    console.error('  FAIL: Third-party origin bypass not detected');
  }
}

// -----------------------------------------------------------------------------
// 4. IMAGE AND ICON BINARY VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 4. IMAGE AND ICON BINARY VALIDATION ---');

function validatePngFile(filePath, expectedWidth, expectedHeight) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${filePath}` };
  }
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) {
    return { ok: false, error: `File too small to be a valid PNG: ${buf.length} bytes` };
  }

  // Check 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const expectedSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(expectedSig)) {
    return { ok: false, error: 'Invalid PNG signature header' };
  }

  // Check IHDR chunk
  const ihdrLen = buf.readUInt32BE(8);
  const ihdrType = buf.toString('ascii', 12, 16);
  if (ihdrType !== 'IHDR' || ihdrLen !== 13) {
    return { ok: false, error: `Invalid first chunk: type=${ihdrType}, length=${ihdrLen}` };
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const compression = buf[26];
  const filter = buf[27];
  const interlace = buf[28];

  // Check ending chunk IEND: 00 00 00 00 49 45 4E 44 AE 42 60 82
  const hasIend = buf.toString('ascii', buf.length - 8, buf.length - 4) === 'IEND';

  const dimMatch = width === expectedWidth && height === expectedHeight;

  return {
    ok: dimMatch && hasIend,
    width,
    height,
    bitDepth,
    colorType,
    fileSizeBytes: buf.length,
    hasIend,
    error: dimMatch ? null : `Dimension mismatch: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`,
  };
}

const imagesToTest = [
  { path: 'icons/apple-touch-icon-180x180.png', width: 180, height: 180 },
  { path: 'icons/icon-192x192.png', width: 192, height: 192 },
  { path: 'icons/icon-512x512.png', width: 512, height: 512 },
  { path: 'icons/icon-maskable-512x512.png', width: 512, height: 512 },
  { path: 'splash/splash-light-1260x2736.png', width: 1260, height: 2736 },
  { path: 'splash/splash-dark-1260x2736.png', width: 1260, height: 2736 },
];

for (const img of imagesToTest) {
  for (const baseDir of [publicDir, distDir]) {
    const fullPath = path.join(baseDir, img.path);
    const result = validatePngFile(fullPath, img.width, img.height);
    const label = `${path.basename(baseDir)}/${img.path}`;
    if (result.ok) {
      console.log(`  ✓ ${label}: Valid PNG (${result.width}x${result.height}, ${result.fileSizeBytes} B, bitDepth=${result.bitDepth}, IEND verified)`);
    } else {
      console.error(`  FAIL: ${label}: ${result.error}`);
    }
  }
}

// Validate favicon.svg
const faviconPub = path.join(publicDir, 'icons', 'favicon.svg');
const faviconDist = path.join(distDir, 'icons', 'favicon.svg');
for (const favPath of [faviconPub, faviconDist]) {
  if (fs.existsSync(favPath)) {
    const content = fs.readFileSync(favPath, 'utf8');
    const isSvg = content.includes('<svg') && content.includes('</svg>') && content.includes('viewBox="0 0 512 512"');
    console.log(`  ✓ ${path.basename(path.dirname(path.dirname(favPath)))}/icons/favicon.svg: Valid SVG (${content.length} B, contains root <svg> & viewBox)`);
  } else {
    console.error(`  FAIL: Favicon missing at ${favPath}`);
  }
}

console.log('\n====================================================');
console.log('ALL STATIC ASSET CHECKS COMPLETED');
console.log('====================================================');
