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
// brand mark from the live site's logo (src/assets/brand/logo-source.svg): «CM» glyphs + name outlines
const src = await readFile(join(root, 'src/assets/brand/logo-source.svg'), 'utf8');
const groups = src.replace(/\r?\n/g, '').match(/<g transform="translate\(17\.303[\s\S]*?<\/g><\/g>|<g fill="currentColor" >[\s\S]*?<\/g>/g);
const CM = groups[0];        // the monogram inside the circle (viewBox 0 0 100 100)
const NAME = groups[1];      // CYBERMOVE outlines (y ≈ 25…61)
const SUB = groups[2];       // CONSULTING outlines (y ≈ 75…95)
const mark = (color, sw) => `<circle cx="50" cy="50" r="47" fill="none" stroke="${color}" stroke-width="${sw}"/>${CM.replaceAll('currentColor', color)}`;

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
    <text x="60" y="58">CHAOS → CORE → SYSTEM → GROWTH</text>
    <text x="1140" y="58" text-anchor="end">RU · EN</text>
    <text x="60" y="578">${company.legalName}</text>
  </g>
  <g transform="translate(60 222) scale(1.3)">${mark(C.chalk, 1.4)}</g>
  <g font-family="IT" font-weight="650" fill="${C.chalk}">
    <text x="220" y="312" font-size="86" letter-spacing="-1.5">CYBER MOVE</text>
  </g>
  <rect x="220" y="338" width="40" height="4" fill="${C.accent}"/>
  <text id="sub" x="880" y="318" font-family="JB" font-weight="300" font-size="40" letter-spacing="7" fill="${C.steel}">CONSULTING</text>
  <g font-family="IT" font-weight="500" fill="${C.chalk}" font-size="36" letter-spacing="-0.6">
    <text x="60" y="432">${company.tagline.ru}</text>
  </g>
  <g font-family="IT" font-weight="500" fill="${C.steel}" font-size="28" letter-spacing="-0.4">
    <text x="60" y="478">${company.tagline.en}</text>
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
  // CONSULTING follows the name on the same line; the accent bar spans the whole logo line
  const word = document.querySelector('text[font-size="86"]');
  const box = word.getBBox();
  const sub = document.querySelector('#sub');
  sub.setAttribute('x', String(box.x + box.width + 22));
  const sb = sub.getBBox();
  document.querySelector('rect[width="40"]').setAttribute('width', String(sb.x + sb.width - box.x));
});
const raw = await page.screenshot({ type: 'png' });
await browser.close();
await sharp(raw).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(join(pub, 'og.png'));

/* ── Favicon: the CM mark in a circle (pure paths, no font dependency) + the accent pixel ── */
const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${C.space}"/>
  <g transform="translate(8 8) scale(0.84)">${mark(C.chalk, 5)}</g>
  <rect x="80" y="80" width="12" height="12" fill="${C.accent}"/>
</svg>`;
await writeFile(join(pub, 'favicon.svg'), favSvg);
const png = (size, pad = 0) => sharp(Buffer.from(favSvg), { density: 72 * (size / 100) * 1.01 })
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

/* ── Logo: mark + name + CONSULTING (outlines from the live logo), accent square ── */
// one line: mark · CYBER MOVE · CONSULTING (rework §12); CONSULTING moved up to the name's baseline
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 100" width="840" height="100" role="img" aria-label="CYBER MOVE CONSULTING">
  ${mark(C.space, 2.2)}${NAME.replaceAll('currentColor', C.space)}<g transform="translate(352 -34)" opacity="0.72">${SUB.replaceAll('currentColor', C.space)}</g>
  <rect x="124" y="74" width="710" height="3" fill="${C.accent}"/>
</svg>`;
await writeFile(join(pub, 'logo.svg'), logo);
console.log('brand assets written to public/');
