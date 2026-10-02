// QA (docs/10-fixes.md): first screen + header at 375 / 768 / 1280 / 1920, RU and EN; also the scrolled header
// with the floating WhatsApp button. Prints CONSULTING vs CYBERMOVE widths. Needs `npm run preview` on :4321.
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
for (const w of [375, 768, 1280, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 812 : 1000 }, isMobile: w < 800, hasTouch: w < 800 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  for (const lang of ['ru', 'en']) {
    await page.goto(`http://localhost:4321/${lang === 'en' ? 'en/' : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1900);
    await page.screenshot({ path: `qa/screens/hero-${lang}-${w}.png` });
    const m = await page.evaluate(() => {
      const n = document.querySelector('.hdr__wm .wm__name')?.getBoundingClientRect();
      const s = document.querySelector('.hdr__wm .wm__sub')?.getBoundingClientRect();
      const h = document.querySelector('.hdr')?.getBoundingClientRect();
      return { name: n && Math.round(n.width), sub: s && Math.round(s.width), hdr: h && Math.round(h.height), sw: document.documentElement.scrollWidth - innerWidth };
    });
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.6));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `qa/screens/scrolled-${lang}-${w}.png` });
    console.log(w, lang, JSON.stringify(m), errs.join(' | '));
  }
  await ctx.close();
}
await browser.close();
