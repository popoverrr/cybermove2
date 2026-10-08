// QA loop from docs/06-qa.md. Run: npm run build && npm run qa
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const PAGES = [
  { key: 'home', ru: '/', en: '/en/' },
  { key: 'services', ru: '/services/', en: '/en/services/' },
  { key: 'direction', ru: '/services/systems/', en: '/en/services/systems/' },
  { key: 'service', ru: '/services/audit/business-audit/', en: '/en/services/audit/business-audit/' },
  { key: 'cases', ru: '/cases/', en: '/en/cases/' },
  { key: 'case', ru: '/cases/usyk/', en: '/en/cases/usyk/' },
  { key: 'case-ship', ru: '/cases/fort-desaix/', en: '/en/cases/fort-desaix/' },
  { key: 'insights', ru: '/insights/', en: '/en/insights/' },
  { key: 'rubric', ru: '/insights/traffic/', en: '/en/insights/traffic/' },
  { key: 'article', ru: '/insights/audit/business-audit-before-ads/', en: '/en/insights/audit/business-audit-before-ads/' },
  { key: 'about', ru: '/about/', en: '/en/about/' },
  { key: 'contact', ru: '/contact/', en: '/en/contact/' },
  { key: 'privacy', ru: '/privacy/', en: '/en/privacy/' },
  { key: '404', ru: '/404.html', en: null },
] as const;
const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
} as const;
const FORBIDDEN = /lorem|todo|undefined|null|example\.com|\{\{|\}\}/i;

function track(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/404.html')) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  return problems;
}

async function scrollThrough(page: Page) {
  // headless Chromium can delay the very first paint of a fresh browser; reveals need rendered frames
  await page.waitForFunction(() => performance.getEntriesByType('paint').length > 0);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y < h; y += Math.round(vh * 0.6)) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

for (const p of PAGES) {
  for (const lang of ['ru', 'en'] as const) {
    const path = p[lang];
    if (!path) continue;
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      test(`${lang} ${p.key} @${vpName}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
        const page = await ctx.newPage();
        const problems = track(page);
        await page.goto(path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll').toBe(true);
        await expect(page.locator('h1')).toHaveCount(1);
        expect(await page.getAttribute('html', 'lang')).toBe(lang);
        // 404 is noindex and has no language alternates (docs/16-seo.md §A.13)
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(p.key === '404' ? 0 : 3);
        await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

        await scrollThrough(page);
        const text = await page.evaluate(() => document.body.innerText);
        expect(text.match(FORBIDDEN)?.[0] ?? null, 'placeholder text on page').toBeNull();

        await page.screenshot({ path: `qa/screens/${lang}-${p.key}-${vpName}.png`, fullPage: true });
        expect(problems, problems.join('\n')).toEqual([]);
        await ctx.close();
      });
    }
  }
}

test('no horizontal scroll at 320 px, all pages', async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const p of PAGES) for (const lang of ['ru', 'en'] as const) {
    const path = p[lang];
    if (!path) continue;
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await scrollThrough(page);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, `${path} scrollWidth at 320`).toBeLessThanOrEqual(iw);
    // no heading word may be wider than its heading (it would be broken mid-word or clipped)
    const tooWide = await page.evaluate(() => [...document.querySelectorAll('h1, h2')].filter((h) => h.clientWidth > 0).flatMap((h) => {
      const cs = getComputedStyle(h);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ls = parseFloat(cs.letterSpacing) || 0;
      const words = (h.textContent || '').split(/\s+/).filter(Boolean);
      return words.filter((w) => ctx.measureText(w).width + ls * w.length > h.clientWidth + 1).map((w) => `${w} (${Math.round(ctx.measureText(w).width)} > ${h.clientWidth})`);
    }));
    expect(tooWide, `${path}: heading words wider than the heading at 320 px`).toEqual([]);
  }
  await ctx.close();
});

test('reduced motion: every .reveal is visible after load', async ({ browser }) => {
  test.setTimeout(400_000);
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const p of PAGES) for (const lang of ['ru', 'en'] as const) {
    const path = p[lang];
    if (!path) continue;
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.reveal')].filter((el) => {
      const s = getComputedStyle(el);
      return +s.opacity < 0.99 || s.visibility === 'hidden';
    }).length);
    expect(hidden, `${path}: hidden .reveal elements`).toBe(0);
  }
  await ctx.close();
});

test.describe('interactions (desktop)', () => {
  let ctx: BrowserContext;
  let page: Page;
  test.beforeEach(async ({ browser }) => {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
  });
  test.afterEach(async () => ctx.close());

  test('nav capsule + menu panel', async () => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#hdr')).toHaveAttribute('data-state', 'top');
    await page.mouse.move(700, 600);
    await page.mouse.wheel(0, 600);
    await expect(page.locator('#hdr')).toHaveAttribute('data-state', /capsule|expanded/);
    const btn = page.locator('.hdr__menu');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#menu-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#menu-panel')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.classList.contains('hdr__menu'))).toBe(true);
  });

  test('contact: ?service preselects, validation, WhatsApp', async () => {
    await page.goto('/contact/?service=crm');
    await expect(page.locator('.contact__form select[name="service"]')).toHaveValue('crm');
    await page.evaluate(() => { (window as unknown as { __opened: string[] }).__opened = []; window.open = (u?: string | URL) => { (window as unknown as { __opened: string[] }).__opened.push(String(u)); return null; }; });
    await page.locator('.contact__form .cform__submit').click();
    await expect(page.locator('.contact__form #cf-name-err')).not.toBeEmpty();
    await expect(page.locator('.contact__form #cf-contact-err')).not.toBeEmpty();
    await page.fill('#cf-name', 'Test');
    await page.fill('#cf-contact', '+7 701 000 00 00');
    await page.locator('.contact__form .chip--check').first().click();
    await page.locator('.contact__form .cform__submit').click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened.length).toBe(1);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(opened[0])).toContain('CRM');
  });

  test('language switch leads to the alternate page (HTTP 200)', async () => {
    for (const p of PAGES) for (const lang of ['ru', 'en'] as const) {
      const path = p[lang];
      if (!path || p.key === '404') continue;
      await page.goto(path);
      const href = await page.locator('.hdr__lang').getAttribute('href');
      expect(href).toBe(p[lang === 'ru' ? 'en' : 'ru']);
      const res = await page.request.get(href!);
      expect(res.status()).toBe(200);
    }
  });
});

test('performance: no long tasks > 50 ms while scrolling home (4× CPU throttle)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    (window as unknown as { __lt: number[] }).__lt = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __lt: number[] }).__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
  });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 300) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  const long = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
  console.log(`long tasks during scroll (4× throttle): ${JSON.stringify(long)}`);
  expect(long.filter((d) => d > 50)).toEqual([]);
  await ctx.close();
});

test.describe('rework (docs/14-rework.md)', () => {
  test('home: block order, one button, three-line title at 320–430 px (stabilize §1)', async ({ browser }) => {
    for (const w of [320, 360, 375, 414, 430]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto('/');
      const t = page.locator('h1');
      await expect(t).toHaveText('Убираем хаос. Структурируем. Развиваем бизнес.');
      const r = await t.evaluate((e) => ({ fit: e.scrollWidth <= e.clientWidth + 1, fs: parseFloat(getComputedStyle(e).fontSize), lines: [...e.querySelectorAll('.rhero__line')].map((l) => l.getClientRects().length) }));
      expect(r.fit && r.lines.length === 3 && r.lines.every((n) => n === 1), `title at ${w}`).toBe(true);
      if (w >= 375) expect(r.fs, `title size at ${w}`).toBeGreaterThanOrEqual(36);
      await ctx.close();
    }
    const page = await browser.newPage();
    await page.goto('/');
    const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.className.split(' ').find((c) => /^(rhero|rcases|rbrands|rsvc|rmethod|rins|cta)$/.test(c)) || s.className));
    expect(order).toEqual(['rhero', 'rcases', 'rbrands', 'rsvc', 'home-method', 'rins', 'cta'].map((x) => (x === 'home-method' ? 'rmethod' : x)));
    await expect(page.locator('.rhero .btn')).toHaveCount(1);
    await expect(page.locator('.rsvc__row')).toHaveCount(10);
    await expect(page.locator('.cta a[href*="wa.me"]')).toHaveCount(0);
  });
  test('home cases: all chips visible, ranked ribbon, filter', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/');
    const chips = page.locator('.rcases .gchip');
    await expect(chips).toHaveCount(10);
    const vw = 375;
    for (const b of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) expect(b).toBeLessThanOrEqual(vw);
    const ids = await page.locator('#home-cases .pcard:not([aria-hidden])').evaluateAll((els) => els.slice(0, 2).map((e) => (e as HTMLElement).dataset.id));
    expect(ids).toEqual(['usyk', 'udar']);
    await page.locator('.gchip[data-sector="maritime"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#home-cases .pcard:not(.is-off)')).toHaveCount(6); // 3 cases × 2 copies
    await expect(page.locator('.rcases a[href="/cases/"]')).toHaveCount(1);
    await ctx.close();
  });
  test('/cases/: 9 sections, websites last, /sites/ is gone', async ({ page }) => {
    await page.goto('/cases/');
    await expect(page.locator('.csec2')).toHaveCount(9);
    await expect(page.locator('.csec2').last()).toHaveAttribute('id', 'sites');
    await expect(page.locator('.pgrid')).toHaveCount(0);
    // the preview server has no redirects (404); on the host .htaccess sends /sites/ → /cases/#sites (301)
    const r = await page.request.get('/sites/', { maxRedirects: 0 });
    expect([301, 404]).toContain(r.status());
  });
  test('contact panel: fab + every CTA, four ways to close', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.locator('.rsvc__link[data-service="hr-consulting"]').click();
    await expect(page.locator('#cpanel')).toBeVisible();
    await expect(page.locator('#cpanel select[name="service"]')).toHaveValue('hr-consulting');
    await page.keyboard.press('Escape');
    await expect(page.locator('#cpanel')).toBeHidden();
    await page.locator('[data-panel-open]').click();
    await expect(page.locator('#cpanel')).toBeVisible();
    await page.locator('.cpanel__close').click();
    await expect(page.locator('#cpanel')).toBeHidden();
    await page.locator('.rhero .btn').click();
    await expect(page.locator('#cpanel select[name="service"]')).toHaveValue('business-audit');
    await ctx.close();
  });
  test('name: CYBER MOVE CONSULTING, green bar, no sound in header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hdr__wm .wm__type')).toHaveText(/CYBER MOVE\s+CONSULTING/);
    await expect(page.locator('.hdr [data-music]')).toHaveCount(0);
    await expect(page).toHaveTitle('Бизнес-консалтинг в Казахстане — Cyber Move Consulting');
  });
});
