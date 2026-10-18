import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ROOT_DIR = process.cwd();
const PUBLIC_ICONS_DIR = path.join(ROOT_DIR, 'public', 'icons');
const PUBLIC_SPLASH_DIR = path.join(ROOT_DIR, 'public', 'splash');

fs.mkdirSync(PUBLIC_ICONS_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_SPLASH_DIR, { recursive: true });

// CRC32 calculation table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngRGB(width, height, getPixel) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // RGB color type
  ihdrData[10] = 0; // Deflate compression
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Non-interlaced
  const ihdr = makeChunk('IHDR', ihdrData);

  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter byte: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(raw, { level: 6 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, ihdr, idat, iend]);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const b = c1 / c2;
  const projX = ax + b * vx;
  const projY = ay + b * vy;
  return Math.hypot(px - projX, py - projY);
}

function sdRoundedBox(px, py, hx, hy, r) {
  const qx = Math.abs(px) - hx + r;
  const qy = Math.abs(py) - hy + r;
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - r;
}

console.log('Generating Cadence PWA assets...');

// 1. Write favicon.svg
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A84FF" />
      <stop offset="50%" stop-color="#0066CC" />
      <stop offset="100%" stop-color="#32ADE6" />
    </linearGradient>
    <linearGradient id="specularRim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.20" />
    </linearGradient>
    <linearGradient id="specularGlow" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#bgGrad)" />
  <rect x="16.5" y="16.5" width="479" height="479" rx="111.5" ry="111.5" fill="none" stroke="url(#specularRim)" stroke-width="2" />
  <path d="M 32 128 C 32 75 75 32 128 32 L 384 32 C 437 32 480 75 480 128 C 360 170 160 210 32 128 Z" fill="url(#specularGlow)" />
  <circle cx="256" cy="256" r="174" fill="none" stroke="#FFFFFF" stroke-opacity="0.26" stroke-width="18" />
  <path d="M 169 266 L 230 327 L 348 195" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'favicon.svg'), faviconSvg, 'utf8');

// Anti-aliased iOS 26 Liquid Glass Icon Shader
function iconShader(x, y, w, h) {
  const u = (x + 0.5) / w;
  const v = (y + 0.5) / h;

  // 1. Rich iOS 26 Liquid Glass diagonal gradient (#0A84FF -> #0062CC -> #28B8EA)
  const diag = (u * 0.45 + v * 0.55);
  let r = mix(10, 24, diag);
  let g = mix(132, 168, diag * 0.8 + u * 0.2);
  let b = mix(255, 238, diag);

  // Deepen mid-lower tone slightly for contrast against white glyph
  const centerDist = Math.hypot(u - 0.5, v - 0.5);
  r = clamp(r - centerDist * 14, 0, 255);
  g = clamp(g - centerDist * 22, 0, 255);

  // 2. Top Liquid Glass specular sheen curve
  const sheenCurve = 0.38 - 0.10 * Math.cos((u - 0.25) * Math.PI);
  if (v < sheenCurve) {
    const sheenFactor = Math.pow(clamp((sheenCurve - v) / sheenCurve, 0, 1), 1.6) * 0.26;
    r = mix(r, 255, sheenFactor);
    g = mix(g, 255, sheenFactor);
    b = mix(b, 255, sheenFactor);
  }

  // 3. Concentric cadence progress ring (radius = 0.345, stroke half-width = 0.017)
  const dRing = Math.abs(centerDist - 0.345) - 0.017;
  const ringCov = clamp(0.5 - dRing * w, 0, 1);
  if (ringCov > 0) {
    const ringAlpha = ringCov * 0.26;
    r = mix(r, 255, ringAlpha);
    g = mix(g, 255, ringAlpha);
    b = mix(b, 255, ringAlpha);
  }

  // 4. Soft elevation shadow beneath checkmark glyph
  const dShadowSeg = Math.min(
    distToSegment(u, v - 0.018, 0.33, 0.52, 0.45, 0.64),
    distToSegment(u, v - 0.018, 0.45, 0.64, 0.68, 0.38)
  ) - 0.043;
  const shadowAlpha = clamp(1 - Math.max(dShadowSeg, 0) / 0.045, 0, 1) * 0.22;
  if (shadowAlpha > 0) {
    r = mix(r, 0, shadowAlpha);
    g = mix(g, 24, shadowAlpha);
    b = mix(b, 68, shadowAlpha);
  }

  // 5. Crisp anti-aliased rounded white checkmark glyph
  const dCheck = Math.min(
    distToSegment(u, v, 0.33, 0.52, 0.45, 0.64),
    distToSegment(u, v, 0.45, 0.64, 0.68, 0.38)
  ) - 0.043;
  const checkCov = clamp(0.5 - dCheck * w, 0, 1);
  if (checkCov > 0) {
    r = mix(r, 255, checkCov);
    g = mix(g, 255, checkCov);
    b = mix(b, 255, checkCov);
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

// 2. Generate PNG Icons
console.log('Generating PNG icons...');
const icon192 = createPngRGB(192, 192, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-192x192.png'), icon192);

const icon512 = createPngRGB(512, 512, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-512x512.png'), icon512);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable-512x512.png'), icon512);

const appleTouchIcon = createPngRGB(180, 180, iconShader);
fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'apple-touch-icon-180x180.png'), appleTouchIcon);

// 3. Generate iPhone 17 Air Splash Screens (1260x2736) with aspect-ratio-true squircle icon
console.log('Generating iPhone 17 Air splash screens (1260x2736)...');

function makeSplashShader(bgR, bgG, bgB, isDark) {
  const badgeSize = 240; // 80pt @3x
  const half = badgeSize / 2; // 120px
  const cornerRadius = 54; // continuous squircle corner radius

  return function splashShader(x, y, w, h) {
    const cx = w * 0.5;
    const cy = Math.round(h * 0.45);
    const dx = x - cx;
    const dy = y - cy;

    // Fast bounding-box reject outside icon + shadow region
    if (Math.abs(dx) > half + 36 || Math.abs(dy) > half + 48) {
      return [bgR, bgG, bgB];
    }

    let r = bgR;
    let g = bgG;
    let b = bgB;

    // Soft ambient shadow below squircle badge
    const dShadow = sdRoundedBox(dx, dy - 10, half, half, cornerRadius);
    if (dShadow > -2 && dShadow < 28) {
      const sFactor = Math.pow(clamp(1 - Math.max(dShadow, 0) / 28, 0, 1), 1.8) * (isDark ? 0.45 : 0.14);
      r = mix(r, isDark ? 10 : 0, sFactor);
      g = mix(g, isDark ? 132 : 40, sFactor);
      b = mix(b, isDark ? 255 : 100, sFactor);
    }

    // Squircle icon badge SDF
    const dBox = sdRoundedBox(dx, dy, half, half, cornerRadius);
    const badgeCov = clamp(0.5 - dBox, 0, 1);
    if (badgeCov > 0) {
      const localX = clamp(dx + half, 0, badgeSize - 1);
      const localY = clamp(dy + half, 0, badgeSize - 1);
      let [ir, ig, ib] = iconShader(localX, localY, badgeSize, badgeSize);

      // Subtle 1.5px specular border along squircle rim
      const rimDist = Math.abs(dBox + 1.0);
      if (rimDist < 1.2) {
        const rimAlpha = clamp(1 - rimDist / 1.2, 0, 1) * (dy < 0 ? 0.55 : 0.2);
        ir = Math.round(mix(ir, 255, rimAlpha));
        ig = Math.round(mix(ig, 255, rimAlpha));
        ib = Math.round(mix(ib, 255, rimAlpha));
      }

      r = mix(r, ir, badgeCov);
      g = mix(g, ig, badgeCov);
      b = mix(b, ib, badgeCov);
    }

    return [Math.round(r), Math.round(g), Math.round(b)];
  };
}

const splashLight = createPngRGB(1260, 2736, makeSplashShader(242, 242, 247, false));
fs.writeFileSync(path.join(PUBLIC_SPLASH_DIR, 'splash-light-1260x2736.png'), splashLight);

const splashDark = createPngRGB(1260, 2736, makeSplashShader(0, 0, 0, true));
fs.writeFileSync(path.join(PUBLIC_SPLASH_DIR, 'splash-dark-1260x2736.png'), splashDark);

console.log('All PWA icons and splash screens generated successfully.');
