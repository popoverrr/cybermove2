// Generates brand assets into public/: og.png (1200×630), favicon.svg/.ico, apple-touch-icon.png, icon-192/512.png, logo.svg.
// Usage: npm run og   (needs the Playwright Chromium from the QA setup: npx playwright install chromium)
// The OG image is laid out as SVG and rendered in Chromium so it uses the real self-hosted Inter Tight; sharp finalises the PNG.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

const root = process.cwd();
const pub = join(root, 'public');
await mkdir(pub, { recursive: true });
const company = JSON.parse(await readFile(join(root, 'content/data/company.json'), 'utf8'));

const C = { space: '#08090B', graphite: '#111316', chalk: '#F2F2EF', steel: '#8C9199', accent: '#C8FF2E', line: 'rgba(242,242,239,0.12)' };
const font = (f) => readFile(join(root, 'node_modules/@fontsource-variable', f)).then((b) => b.toString('base64'));
const [itLat, itCyr, jbLat, jbCyr] = await Promise.all([
  font('inter-tight/files/inter-tight-latin-wght-normal.woff2'),
  font('inter-tight/files/inter-tight-cyrillic-wght-normal.woff2'),
  font('jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'),
  font('jetbrains-mono/files/jetbrains-mono-cyrillic-wght-normal.woff2'),
]);

/* ── OG image ── */
const grid = Array.from({ length: 13 }, (_, i) => `<line x1="${60 + i * 90}" y1="0" x2="${60 + i * 90}" y2="630" stroke="${C.line}"/>`).join('');
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.space}"/>
  ${grid}
  <line x1="0" y1="96" x2="1200" y2="96" stroke="${C.line}"/>
  <line x1="0" y1="534" x2="1200" y2="534" stroke="${C.line}"/>
  <g font-family="JB" font-size="18" letter-spacing="1.2" fill="${C.steel}">
    <text x="60" y="58">${company.descriptor.ru.toUpperCase()}</text>
    <text x="1140" y="58" text-anchor="end">RU · EN</text>
    <text x="60" y="578">${company.legalName}</text>
  </g>
  <g font-family="IT" font-weight="600" fill="${C.chalk}">
    <text x="52" y="370" font-size="178" letter-spacing="-5">${company.brand}</text>
  </g>
  <rect x="1108" y="232" width="26" height="26" fill="${C.accent}"/>
  <g font-family="IT" font-weight="500" fill="${C.chalk}" font-size="40" letter-spacing="-0.8">
    <text x="60" y="466">${company.tagline.ru}</text>
  </g>
  <g font-family="IT" font-weight="500" fill="${C.steel}" font-size="28" letter-spacing="-0.4">
    <text x="1140" y="466" text-anchor="end">${company.tagline.en}</text>
  </g>
</svg>`;

const html = `<!doctype html><html><head><style>
@font-face{font-family:IT;font-weight:100 900;src:url(data:font/woff2;base64,${itLat}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:IT;font-weight:100 900;src:url(data:font/woff2;base64,${itCyr}) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:JB;src:url(data:font/woff2;base64,${jbLat}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:JB;src:url(data:font/woff2;base64,${jbCyr}) format('woff2');unicode-range:U+0400-045F}
html,body{margin:0;background:${C.space}} svg{display:block}
</style></head><body>${ogSvg}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
// fit the wordmark: place the accent pixel right after the rendered wordmark
await page.evaluate(() => {
  const word = document.querySelector('text[font-size="178"]');
  const box = word.getBBox();
  document.querySelector('rect[width="26"]').setAttribute('x', String(box.x + box.width + 14));
});
const raw = await page.screenshot({ type: 'png' });
await browser.close();
await sharp(raw).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(join(pub, 'og.png'));

/* ── Favicon: "C" arc + the accent pixel, as pure paths (no font dependency) ── */
const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${C.space}"/>
  <path d="M21.5 10.2A8 8 0 1 0 21.5 21.8" fill="none" stroke="${C.chalk}" stroke-width="3.6" stroke-linecap="butt"/>
  <rect x="22.5" y="19.5" width="5" height="5" fill="${C.accent}"/>
</svg>`;
await writeFile(join(pub, 'favicon.svg'), favSvg);
const png = (size, pad = 0) => sharp(Buffer.from(favSvg), { density: 72 * (size / 32) * 1.01 })
  .resize(size - pad * 2, size - pad * 2).extend({ top: pad, bottom: pad, left: pad, right: pad, background: C.space }).png().toBuffer();
await writeFile(join(pub, 'apple-touch-icon.png'), await png(180, 0));
await writeFile(join(pub, 'icon-192.png'), await png(192));
await writeFile(join(pub, 'icon-512.png'), await png(512));

// ICO container with a single embedded 32×32 PNG (valid for all modern browsers)
const p32 = await png(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(p32.length, 14); header.writeUInt32LE(22, 18);
await writeFile(join(pub, 'favicon.ico'), Buffer.concat([header, p32]));

/* ── Logo (text wordmark with a system-safe font stack, per design system) ── */
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="64" viewBox="0 0 360 64" role="img" aria-label="${company.brand}">
  <text x="0" y="48" font-family="'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif" font-weight="600" font-size="52" letter-spacing="-1" fill="${C.space}">${company.brand}</text>
  <rect x="338" y="10" width="14" height="14" fill="${C.accent}"/>
</svg>`;
await writeFile(join(pub, 'logo.svg'), logo);
console.log('brand assets written to public/');
