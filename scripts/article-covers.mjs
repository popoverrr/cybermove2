// Article covers (docs/16-seo.md §D): for every RU article in src/content/insights/ru/** with a `cover` block,
// renders the motif from its frontmatter into public/covers/<slug>/:
//   16x9.{avif,webp} 1600×900 (+ -800), 4x3.{avif,webp} 1200×900 (+ -600), 1x1.{avif,webp} 800×800 (+ -400),
//   og.jpg 1200×630 with the title, rubric and logo (legacy articles also og-en.jpg).
// Rendering goes through Chromium (Playwright) so the real Inter Tight / JetBrains Mono are used; sharp encodes.
// Unchanged covers are skipped (content hash in public/covers/manifest.json).
//   npm run covers            build what changed, then check uniqueness (dHash, Hamming ≥ 10 of 64)
//   npm run covers -- --force rebuild everything
//   npm run covers:sheet      qa/covers-sheet.png — all covers 10 per row
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import yaml from 'js-yaml';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { cover, hash } from './lib/figures.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SHEET = args.includes('--sheet');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7);
const VERSION = 'v1';
const outRoot = join(root, 'public/covers');

const RUBRIC = { audit: 'Аудит и финансы', systems: 'Сайты, CRM и AI', 'brand-content': 'Бренд и контент', traffic: 'Реклама и продвижение', 'tenders-legal': 'Тендеры и право' };
const RUBRIC_EN = { audit: 'Audit & finance', systems: 'Websites, CRM & AI', 'brand-content': 'Brand & content', traffic: 'Advertising & promotion', 'tenders-legal': 'Tenders & legal' };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const front = (src) => { const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/); return m ? yaml.load(m[1]) : {}; };
const exists = (p) => access(p).then(() => true, () => false);

/* articles + FIG numbers: legacy 01–12 by date, plan rows 13–100 */
const plan = (await readFile(join(root, 'content/seo/articles-plan.tsv'), 'utf8')).trim().split(/\r?\n/).slice(1).map((l) => l.split('\t'));
const planN = Object.fromEntries(plan.map((r) => [r[3], Number(r[0])]));
const files = await walk(join(root, 'src/content/insights/ru'));
const enTitles = {};
for (const f of await walk(join(root, 'src/content/insights/en'))) enTitles[f.split(/[\\/]/).pop().replace(/\.md$/, '')] = front(await readFile(f, 'utf8')).title;
const arts = [];
for (const f of files) {
  const fm = front(await readFile(f, 'utf8'));
  const slug = f.split(/[\\/]/).pop().replace(/\.md$/, '');
  const rubric = fm.rubric ?? fm.direction ?? f.split(/[\\/]/).at(-2);
  arts.push({ slug, fm, rubric, legacy: !!fm.date, date: String(fm.date ?? fm.publishDate ?? '') });
}
const legacy = arts.filter((a) => a.legacy).sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
legacy.forEach((a, i) => (a.n = i + 1));
for (const a of arts) if (!a.legacy) a.n = 12 + (planN[a.slug] ?? 0);
arts.sort((a, b) => a.n - b.n);

/* brand mark for OG (outlines of the live logo, same as scripts/og-image.mjs) */
const src = await readFile(join(root, 'src/assets/brand/logo-source.svg'), 'utf8');
const groups = src.replace(/\r?\n/g, '').match(/<g transform="translate\(17\.303[\s\S]*?<\/g><\/g>|<g fill="currentColor" >[\s\S]*?<\/g>/g);
const brandMark = `<g transform="scale(0.44)"><circle cx="50" cy="50" r="47" fill="none" stroke="#F2F2EF" stroke-width="2.2"/>${groups[0].replaceAll('currentColor', '#F2F2EF')}</g>
  <text x="58" y="29" style="font-family:'Inter Tight Variable';font-weight:650;font-size:24px;fill:#F2F2EF;letter-spacing:-0.3px">CYBER MOVE</text>
  <text x="222" y="29" style="font-family:'JetBrains Mono Variable';font-weight:300;font-size:15px;fill:#8C9199;letter-spacing:3px">CONSULTING</text>`;

const font = (f) => readFile(join(root, 'node_modules/@fontsource-variable', f)).then((b) => b.toString('base64'));
const [itLat, itCyr, jbLat, jbCyr] = await Promise.all([
  font('inter-tight/files/inter-tight-latin-wght-normal.woff2'), font('inter-tight/files/inter-tight-cyrillic-wght-normal.woff2'),
  font('jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'), font('jetbrains-mono/files/jetbrains-mono-cyrillic-wght-normal.woff2'),
]);
const css = `@font-face{font-family:'Inter Tight Variable';font-weight:100 900;src:url(data:font/woff2;base64,${itLat}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}
@font-face{font-family:'Inter Tight Variable';font-weight:100 900;src:url(data:font/woff2;base64,${itCyr}) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:'JetBrains Mono Variable';font-weight:100 800;src:url(data:font/woff2;base64,${jbLat}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF,U+2212}
@font-face{font-family:'JetBrains Mono Variable';font-weight:100 800;src:url(data:font/woff2;base64,${jbCyr}) format('woff2');unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
html,body{margin:0;background:#08090B}svg{display:block}`;

// cache keys + dHash bits live outside public/ (not deployed)
const manifestPath = join(root, 'content/seo/covers-manifest.json');
const manifest = (await exists(manifestPath)) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
manifest.dhash ??= {};
manifest.auto ??= {}; // automatic layout variant for covers that came out too similar to another
await mkdir(outRoot, { recursive: true });

async function sheet() {
  const list = arts.filter((a) => a.fm.cover);
  const cols = 10, w = 320, h = 180, gap = 8;
  const rows = Math.ceil(list.length / cols);
  const tiles = [];
  for (const [i, a] of list.entries()) {
    const p = join(outRoot, a.slug, '16x9.webp');
    if (!(await exists(p))) continue;
    tiles.push({ input: await sharp(p).resize(w, h).toBuffer(), left: gap + (i % cols) * (w + gap), top: gap + Math.floor(i / cols) * (h + gap) });
  }
  await mkdir(join(root, 'qa'), { recursive: true });
  await sharp({ create: { width: gap + cols * (w + gap), height: gap + rows * (h + gap), channels: 3, background: '#1A1D21' } }).composite(tiles).png().toFile(join(root, 'qa/covers-sheet.png'));
  console.log(`qa/covers-sheet.png — ${tiles.length} covers`);
}
if (SHEET) { await sheet(); process.exit(0); }

const todo = [];
for (const a of arts) {
  if (!a.fm.cover) { console.warn(`no cover block: ${a.slug}`); continue; }
  if (ONLY && a.slug !== ONLY) continue;
  const key = String(hash(VERSION + (manifest.auto[a.slug] ?? '') + JSON.stringify(a.fm.cover) + a.fm.title + (enTitles[a.slug] ?? '') + a.n + a.rubric));
  const dir = join(outRoot, a.slug);
  if (!FORCE && manifest[a.slug] === key && (await exists(join(dir, 'og.jpg')))) continue;
  todo.push({ ...a, key, dir });
}

if (todo.length) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const shot = async (svg, w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    return page.screenshot({ type: 'png' });
  };
  for (const a of todo) {
    await mkdir(a.dir, { recursive: true });
    const fig = `FIG. ${String(a.n).padStart(2, '0')}`;
    const common = { motif: a.fm.cover.motif, data: a.fm.cover.data, fig, rubric: RUBRIC[a.rubric], path: `cyber move / разборы / ${a.slug}`, seed: hash(a.slug + (a.fm.cover.variant ?? '') + (manifest.auto[a.slug] ?? '')) };
    const big = await shot(cover({ ...common, format: '16x9' }), 1600, 900);
    await sharp(big).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '16x9.avif'));
    await sharp(big).webp({ quality: 80 }).toFile(join(a.dir, '16x9.webp'));
    await sharp(big).resize(800).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '16x9-800.avif'));
    await sharp(big).resize(800).webp({ quality: 80 }).toFile(join(a.dir, '16x9-800.webp'));
    // dHash of the motif area (the window frame is the same on every cover by design)
    { const px = await sharp(big).extract({ left: 140, top: 186, width: 1320, height: 560 }).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
      let bits = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] < px[y * 9 + x + 1] ? '1' : '0';
      manifest.dhash[a.slug] = bits; }
    const f43 = await shot(cover({ ...common, format: '4x3' }), 1200, 900);
    await sharp(f43).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '4x3.avif'));
    await sharp(f43).webp({ quality: 80 }).toFile(join(a.dir, '4x3.webp'));
    await sharp(f43).resize(600).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '4x3-600.avif'));
    await sharp(f43).resize(600).webp({ quality: 80 }).toFile(join(a.dir, '4x3-600.webp'));
    const sq = await shot(cover({ ...common, format: '1x1' }), 800, 800);
    await sharp(sq).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '1x1.avif'));
    await sharp(sq).webp({ quality: 80 }).toFile(join(a.dir, '1x1.webp'));
    await sharp(sq).resize(400).avif({ quality: 55, effort: 4 }).toFile(join(a.dir, '1x1-400.avif'));
    await sharp(sq).resize(400).webp({ quality: 80 }).toFile(join(a.dir, '1x1-400.webp'));
    const og = await shot(cover({ ...common, format: 'og', title: a.fm.title, brandMark }), 1200, 630);
    await sharp(og).jpeg({ quality: 84, mozjpeg: true }).toFile(join(a.dir, 'og.jpg'));
    if (enTitles[a.slug]) {
      const ogEn = await shot(cover({ ...common, format: 'og', rubric: RUBRIC_EN[a.rubric], path: `cyber move / insights / ${a.slug}`, title: enTitles[a.slug], brandMark }), 1200, 630);
      await sharp(ogEn).jpeg({ quality: 84, mozjpeg: true }).toFile(join(a.dir, 'og-en.jpg'));
    }
    manifest[a.slug] = a.key;
    process.stdout.write(`${fig} ${a.slug}\n`);
  }
  await browser.close();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
}
console.log(`covers: ${todo.length} rendered, ${arts.filter((a) => a.fm.cover).length - todo.length} unchanged`);

/* uniqueness: dHash (9×8 grey, horizontal gradient bits), every pair Hamming ≥ 10 */
const hashes = [];
for (const a of arts) {
  const b = manifest.dhash[a.slug];
  if (b) hashes.push({ slug: a.slug, bits: [...b] });
}
let bad = 0; let minD = 64;
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) {
  let d = 0; for (let k = 0; k < 64; k++) d += hashes[i].bits[k] !== hashes[j].bits[k];
  minD = Math.min(minD, d);
  if (d < 10) { bad++; console.error(`too similar (dHash ${d}): ${hashes[i].slug} ↔ ${hashes[j].slug}`); }
}
console.log(`dHash: ${hashes.length} covers, min distance ${hashes.length > 1 ? minD : '—'}, ${bad} pairs below 10`);
if (bad && !args.includes('--no-retry')) {
  // give the later article of each colliding pair another layout variant and render again
  const later = new Set();
  for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) {
    let d = 0; for (let k = 0; k < 64; k++) d += hashes[i].bits[k] !== hashes[j].bits[k];
    if (d < 10) later.add(hashes[j].slug);
  }
  for (const s of later) manifest.auto[s] = String((Number(manifest.auto[s] ?? 0) || 0) + 1);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
  const tries = Number(process.env.COVER_TRY ?? 0);
  if (tries < 6) {
    console.log(`re-rendering ${later.size} covers with another layout (try ${tries + 1})`);
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [process.argv[1], ...args.filter((x) => x !== '--force')], { stdio: 'inherit', env: { ...process.env, COVER_TRY: String(tries + 1) } });
  } else process.exitCode = 1;
}
