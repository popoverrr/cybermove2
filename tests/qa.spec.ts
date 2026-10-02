// QA loop from docs/06-qa.md. Run: npm run build && npm run qa
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const PAGES = [
  { key: 'home', ru: '/', en: '/en/' },
  { key: 'services', ru: '/services/', en: '/en/services/' },
  { key: 'projects', ru: '/projects/', en: '/en/projects/' },
  { key: 'team', ru: '/team/', en: '/en/team/' },
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
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
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

  test('home window click navigates', async () => {
    await page.goto('/');
    await page.locator('[data-win="projects"]').click();
    await expect(page).toHaveURL(/\/projects\/$/);
  });

  test('projects: filter, overlay, deep link', async () => {
    await page.goto('/projects/');
    const cards = page.locator('.pcard:not(.is-off)');
    await expect(cards).toHaveCount(34);
    const b2bCount = await page.locator('.pcard[data-sector="b2b"]').count();
    await page.locator('.chip[data-sector="b2b"]').click();
    await expect(cards).toHaveCount(b2bCount);
    await page.locator('.pcard:not(.is-off) .pcard__link').first().click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page).toHaveURL(/[?&]p=[\w-]+/); // ?sector= is kept alongside
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.goto('/projects/?p=usyk');
    await expect(page.locator('dialog[open] #pd-title-usyk')).toBeVisible();
  });

  test('estimator reacts to sliders', async () => {
    await page.goto('/services/');
    const hours = page.locator('[data-res="hours"]');
    await hours.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const before = await hours.textContent();
    await page.locator('#est-people').fill('50');
    await page.waitForTimeout(1200);
    expect(await hours.textContent()).not.toBe(before);
    await expect(page.locator('[data-est-cta]')).toHaveAttribute('href', /est=\d+h/);
  });

  test('contact: prefill, validation, WhatsApp', async () => {
    await page.goto('/contact/?need=ai&est=120h');
    await expect(page.locator('input[name="needs"][value="ai"]')).toBeChecked();
    await expect(page.locator('textarea[name="message"]')).toHaveValue(/120/);
    await page.evaluate(() => { (window as unknown as { __opened: string[] }).__opened = []; window.open = (u?: string | URL) => { (window as unknown as { __opened: string[] }).__opened.push(String(u)); return null; }; });
    await page.locator('.cform__submit').click();
    await expect(page.locator('#cf-name-err')).not.toBeEmpty();
    await expect(page.locator('#cf-contact-err')).not.toBeEmpty();
    await page.fill('#cf-name', 'Test');
    await page.fill('#cf-contact', '+7 701 000 00 00');
    await page.locator('.cform__submit').click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened.length).toBe(1);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
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

test.describe('content features', () => {
  for (const [name, opts] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ] as const) {
    test(`project window photo is in full colour (${name})`, async ({ browser }) => {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      for (const id of ['usyk', 'ufw', 'hydrosta']) {
        await page.goto(`/projects/?p=${id}`);
        const img = page.locator('dialog[open] .pd__cover img');
        await expect(img).toBeVisible();
        expect(await img.evaluate((el) => getComputedStyle(el).filter), `${id} overlay photo filter`).toBe('none');
      }
      // grid cards stay grayscale previews
      await page.keyboard.press('Escape');
      expect(await page.locator('.pcard .pphoto').first().evaluate((el) => getComputedStyle(el).filter)).toContain('grayscale');
      await ctx.close();
    });
  }

  test('projects ?sector= preselects the filter and the URL follows the chips', async ({ page }) => {
    await page.goto('/en/projects/?sector=horeca');
    const n = await page.locator('.pcard[data-sector="horeca"]').count();
    await expect(page.locator('.chip.is-on')).toHaveAttribute('data-sector', 'horeca');
    await expect(page.locator('.pcard:not(.is-off)')).toHaveCount(n);
    await page.locator('.chip[data-sector="b2b"]').click();
    await expect(page).toHaveURL(/\?sector=b2b$/);
    await page.locator('.chip[data-sector="all"]').click();
    await expect(page).toHaveURL(/\/en\/projects\/$/);
  });

  test('home sectors link to filtered projects and project windows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('.sm__tab[data-sector="horeca"]')).toHaveAttribute('href', '/projects/?sector=horeca');
    await expect(page.locator('.sm__name-link').first()).toHaveAttribute('href', /\/projects\/\?p=[\w-]+$/);
    await page.locator('.home-sectors').scrollIntoViewIfNeeded();
    await page.locator('.sm__tab[data-sector="media"]').hover();
    await expect(page.locator('[data-sector-all]')).toHaveAttribute('href', '/projects/?sector=media');
    await page.locator('.sm__tab[data-sector="media"]').click();
    await expect(page).toHaveURL(/\/projects\/\?sector=media$/);
    await expect(page.locator('.chip.is-on')).toHaveAttribute('data-sector', 'media');
  });

  test('estimator has no share slider; formula states the fixed 25 %', async ({ page }) => {
    for (const path of ['/services/', '/en/services/']) {
      await page.goto(path);
      await expect(page.locator('input[name="share"]')).toHaveCount(0);
      await expect(page.locator('.est__formula')).toContainText('25%');
    }
  });

  test('home contact window lists every non-empty channel, one link, no nested anchors', async ({ page }) => {
    await page.goto('/');
    const win = page.locator('[data-win="contact"]');
    await expect(win.locator('.hwin__channel')).toHaveCount(3);
    await expect(win.locator('a')).toHaveCount(0);
    await expect(win.locator('.hwin__caret')).toHaveCount(1);
    await expect(win.locator('.hwin__channel').last().locator('.hwin__caret')).toHaveCount(1);
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
