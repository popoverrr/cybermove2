// Dev helper: node scripts/shot.mjs <path> [mobile|desktop] [out.png] [scrollY]
import { chromium } from '@playwright/test';
const [path = '/', vp = 'desktop', out = 'qa/shot.png', full = 'full'] = process.argv.slice(2);
const size = vp === 'mobile' ? { width: 390, height: 844 } : vp === 'narrow' ? { width: 320, height: 700 } : { width: 1440, height: 900 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: vp !== 'desktop', isMobile: vp !== 'desktop' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4321' + path, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
if (full === 'full') {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(250); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: out, fullPage: true });
} else {
  await page.evaluate((y) => window.scrollTo(0, y), +full);
  await page.waitForTimeout(900);
  await page.screenshot({ path: out });
}
const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
console.log('scrollWidth/innerWidth', sw, 'errors', errors);
await browser.close();
