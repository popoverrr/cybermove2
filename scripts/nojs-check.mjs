// Checks that pages are fully readable with JavaScript disabled: node scripts/nojs-check.mjs (preview must be running)
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
for (const p of ['/', '/services/', '/projects/', '/team/', '/about/', '/contact/', '/en/']) {
  await page.goto('http://localhost:4321' + p);
  const r = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll('main *')].filter((el) => el.children.length === 0 && el.textContent.trim() && +getComputedStyle(el).opacity < 0.5 && !el.closest('.pd,.page-bar,[aria-hidden="true"],.sr-only')).length,
    formAction: document.querySelector('form.cform')?.getAttribute('action') ?? '-',
    filterShown: getComputedStyle(document.querySelector('.pfilter') || document.body).display,
  }));
  console.log(p, r);
}
await page.goto('http://localhost:4321/projects/#p-usyk');
console.log('no-JS project window via :target visible:', await page.locator('#p-usyk .pd__win').isVisible());
await browser.close();
