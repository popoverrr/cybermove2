// Screenshots of the websites from content/data/sites.json (docs/13-fixes-4.md §4.1) → src/assets/sites/.
// desktop: 1440×900, full page capped at 4500 px; mobile: 390×844 first screen. Language pop-ups are dismissed,
// lazy content is scrolled in, animations are frozen before the shot. Usage: npm run sites   (Node 20+)
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const OUT = path.join(root, 'src/assets/sites');
const { items } = JSON.parse(readFileSync(path.join(root, 'content/data/sites.json'), 'utf8'));
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });

const FREEZE = `*,*::before,*::after{animation-play-state:paused!important;animation-delay:-1s!important;transition:none!important;caret-color:transparent!important}
html{scroll-behavior:auto!important}`;

// sites that remember the language in a cookie and serve the Russian version under /ru/
const LANG = { 'oasis-ikigai.com.ua': { cookie: 'oi_lang', path: 'ru/' } };
async function prepare(page, site) {
  const l = LANG[site.domain];
  if (l) await page.context().addCookies([{ name: l.cookie, value: site.capture?.lang || 'ru', domain: site.domain, path: '/' }]);
  await page.goto(l ? site.url + l.path : site.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  // the language dialogs appear with a delay: wait for them, choose Russian, make sure they are gone
  if ((site.capture?.dismiss ?? []).length) {
    const btn = page.locator(site.capture.dismiss.join(', ')).or(page.getByRole('button', { name: /^Русский$/ })).or(page.getByText('Русский', { exact: true }));
    for (let i = 0; i < 3; i++) {
      const el = btn.first();
      try { await el.waitFor({ state: 'visible', timeout: 6000 }); } catch { break; }
      await el.click({ force: true });
      await page.waitForTimeout(1500);
      if (!(await el.isVisible().catch(() => false))) break;
    }
  }
  await page.waitForTimeout(2000); // intro animations
}
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 6000); y += 500) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(250); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
for (const site of items) {
  if (only && site.id !== only) continue;
  try {
    // desktop: long strip
    const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'ru-RU' });
    const p = await d.newPage();
    await prepare(p, site);
    await scrollThrough(p);
    await p.addStyleTag({ content: FREEZE });
    const full = await p.evaluate(() => document.documentElement.scrollHeight);
    const h = Math.min(full, 4500);
    const png = await p.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: 1440, height: h } });
    await sharp(png).resize({ width: 1440 }).webp({ quality: 80 }).toFile(path.join(OUT, `${site.id}-desktop.webp`));
    await d.close();
    // mobile: first screen
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
    const mp = await m.newPage();
    await prepare(mp, site);
    await mp.addStyleTag({ content: FREEZE });
    const mpng = await mp.screenshot();
    await sharp(mpng).resize({ width: 780 }).webp({ quality: 80 }).toFile(path.join(OUT, `${site.id}-mobile.webp`));
    await m.close();
    console.log(`ok   ${site.id} (desktop ${h}px of ${full}px)`);
  } catch (e) {
    console.log(`FAIL ${site.id}: ${String(e.message).slice(0, 120)}`);
  }
}
await browser.close();
