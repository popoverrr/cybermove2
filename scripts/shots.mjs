// QA helper: screenshots of the key pages (RU + EN, mobile + desktop) into qa/screens/.
// Usage: node scripts/shots.mjs [filter] [--top]   (needs `npm run preview` on :4321)
//   --top  first screen only (faster), otherwise full page after scrolling through the reveals
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const top = args.includes('--top');
const filter = args.find((a) => !a.startsWith('--'));
const PAGES = [
  ['home', ''], ['services', 'services/'], ['direction', 'services/systems/'], ['service', 'services/audit/business-audit/'],
  ['cases', 'cases/'], ['case', 'cases/usyk/'], ['case-ship', 'cases/fort-desaix/'], ['insights', 'insights/'],
  ['article', 'insights/audit/business-audit-before-ads/'], ['about', 'about/'], ['contact', 'contact/'], ['privacy', 'privacy/'],
];
const VPS = { m: { width: 375, height: 812 }, d: { width: 1280, height: 900 } };
mkdirSync('qa/screens', { recursive: true });
const browser = await chromium.launch();
for (const [vp, size] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: vp === 'm', isMobile: vp === 'm' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  for (const lang of ['ru', 'en']) {
    for (const [name, route] of PAGES) {
      if (filter && !name.includes(filter)) continue;
      const url = `http://localhost:4321/${lang === 'en' ? 'en/' : ''}${route}`;
      errors.length = 0;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(top ? 1800 : 600);
      const out = `qa/screens/${lang}-${name}-${vp}.png`;
      if (!top) {
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += 600) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: out, fullPage: !top });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(out, sw > 0 ? `HSCROLL +${sw}px` : '', errors.length ? `ERRORS ${errors.join(' | ')}` : '');
    }
  }
  await ctx.close();
}
await browser.close();
