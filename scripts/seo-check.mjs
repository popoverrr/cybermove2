// SEO quality gate for «Разборы» (docs/16-seo.md §C.5). Checks every RU article (the 12 legacy ones lightly,
// the SEO articles fully) and writes qa/seo-report.md. Exit code 1 on any error.
//   npm run seo:check                 all articles
//   npm run seo:check -- --wave=1     only report/require one wave (similarity is still checked against all)
import { readFile, readdir, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const WAVE = process.argv.find((a) => a.startsWith('--wave='))?.slice(7);
const exists = (p) => access(p).then(() => true, () => false);
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) out.push(...(await walk(p))); else if (e.name.endsWith('.md')) out.push(p); }
  return out;
}
const json = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));

/* known routes for internal links */
const [services, directions, cases] = await Promise.all([json('content/data/services.json'), json('content/data/directions.json'), json('content/data/cases.json')]);
const routes = new Set(['/', '/services/', '/cases/', '/insights/', '/about/', '/contact/', '/privacy/']);
for (const d of directions) { routes.add(`/services/${d.id}/`); routes.add(`/insights/${d.id}/`); }
for (const s of services) routes.add(`/services/${s.direction}/${s.id}/`);
for (const c of cases) routes.add(`/cases/${c.id}/`);

const plan = Object.fromEntries((await readFile(join(root, 'content/seo/articles-plan.tsv'), 'utf8')).trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')).map((r) => [r[3], { n: +r[0], wave: r[1], rubric: r[2], keyword: r[5], intent: r[7], service: r[8], motif: r[9] }]));
const waveDates = (await json('content/seo/waves.json')).waves;
// planned articles are valid link targets (until published, the site shows such links as plain text)
for (const [slug, r] of Object.entries(plan)) routes.add(`/insights/${r.rubric}/${slug}/`);

const arts = [];
for (const f of await walk(join(root, 'src/content/insights/ru'))) {
  const src = (await readFile(f, 'utf8')).replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = yaml.load(m[1]); const body = m[2];
  const slug = f.split(/[\\/]/).pop().replace(/\.md$/, '');
  const rubric = fm.rubric ?? fm.direction ?? f.split(/[\\/]/).at(-2);
  routes.add(`/insights/${rubric}/${slug}/`);
  arts.push({ slug, fm, body, rubric, legacy: !!fm.date, plan: plan[slug] });
}

/* text helpers */
const plain = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/^\|.*\|$/gm, (l) => l.replace(/\|/g, ' ').replace(/-{3,}/g, ' ')).replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`]/g, ' ');
const words = (t) => t.toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]+(?:-[a-zа-я0-9]+)*/g) ?? [];
const stem = (w) => (w.length <= 4 ? w : w.slice(0, Math.max(4, Math.ceil(w.length * 0.7))));
// a keyword «occurs» if every content word of it occurs as a stem (Russian inflection)
const STOPW = new Set(['и', 'в', 'на', 'с', 'для', 'по', 'или', 'как', 'что', 'к', 'о', 'от', 'из', 'за', 'не']);
const hasKw = (text, kw) => { const ws = new Set(words(text).map(stem)); return words(kw).filter((w) => !STOPW.has(w)).every((w) => ws.has(stem(w))); };
const firstPara = (body) => body.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('-')) ?? '';
const CLICHES = ['в современном мире', 'не секрет, что', 'не секрет что', 'давайте разберемся', 'давайте разберёмся', 'ни для кого не секрет', 'в наше время', 'в условиях современного', 'играет важную роль', 'является неотъемлемой частью', 'в заключение хочется', 'подводя итог', 'в данной статье', 'в этой статье мы', 'как известно,', 'на сегодняшний день', 'уникальное торговое предложение позволяет', 'лучший на рынке', '№1', 'номер один на рынке'];

const shingles = (t) => { const w = words(t); const s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; };
const rows = []; let errorsTotal = 0;
const paraOwners = new Map();
for (const a of arts) {
  const text = plain(a.body);
  a.sh = shingles(text);
  for (const p of a.body.split(/\n\s*\n/)) { const n = p.trim().toLowerCase().replace(/\s+/g, ' '); if (n.length < 80 || n.startsWith('|') || n.startsWith('```') || n.startsWith('#')) continue; (paraOwners.get(n) ?? paraOwners.set(n, []).get(n)).push(a.slug); }
}
for (const a of arts) {
  const e = []; const w = []; const fm = a.fm;
  const text = plain(a.body); const wc = words(text).length;
  const links = [...a.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
  const internal = links.map((l) => l.replace(/[?#].*$/, ''));
  for (const l of internal) if (!routes.has(l)) e.push(`broken link ${l}`);
  for (const l of a.body.matchAll(/\]\((https?:\/\/(?:www\.)?cybermove\.asia[^)]*)\)/g)) e.push(`absolute own link ${l[1]} — use /path/`);
  const toArticles = new Set(internal.filter((l) => /^\/insights\/[\w-]+\/[\w-]+\/$/.test(l) && !l.endsWith(`/${a.slug}/`)));
  const cover = await exists(join(root, 'public/covers', a.slug, 'og.jpg')) && (await exists(join(root, 'public/covers', a.slug, '16x9.webp')));
  if (!fm.cover) e.push('no cover block'); else { if (!fm.cover.alt) e.push('cover.alt missing'); if (!cover) e.push('cover files not rendered (npm run covers)'); }
  let maxSim = 0, simWith = '';
  for (const b of arts) { if (b === a) continue; let inter = 0; for (const s of a.sh) if (b.sh.has(s)) inter++; const sim = inter / Math.max(1, Math.min(a.sh.size, b.sh.size)); if (sim > maxSim) { maxSim = sim; simWith = b.slug; } }
  if (maxSim > 0.15) e.push(`similar to ${simWith} (${(maxSim * 100).toFixed(1)} %)`);
  for (const [p, owners] of paraOwners) if (owners.includes(a.slug) && new Set(owners).size > 1) e.push(`repeated paragraph with ${[...new Set(owners)].filter((x) => x !== a.slug).join(', ')}: «${p.slice(0, 60)}…»`);
  const low = a.body.toLowerCase().replace(/ё/g, 'е');
  for (const c of CLICHES) if (low.includes(c.replace(/ё/g, 'е'))) e.push(`cliché «${c}»`);
  if (!a.legacy) {
    const kw = fm.primaryKeyword ?? a.plan?.keyword;
    const seoTitle = fm.seoTitle ?? fm.title;
    if (!a.plan) e.push('not in content/seo/articles-plan.tsv');
    if (fm.rubric !== a.rubric) e.push(`rubric ${fm.rubric} ≠ folder ${a.rubric}`);
    if (wc < 1400) e.push(`too short: ${wc} words`); else if (wc > 2600) w.push(`long: ${wc} words`);
    if (!kw) e.push('primaryKeyword missing');
    else {
      if (!hasKw(fm.title, kw)) e.push(`keyword «${kw}» not in H1`);
      if (!hasKw(seoTitle, kw)) e.push(`keyword not in seoTitle`);
      if (!hasKw(fm.description, kw)) e.push(`keyword not in description`);
      if (!hasKw(firstPara(a.body), kw)) e.push(`keyword not in the first paragraph`);
      if (![...a.body.matchAll(/^##\s+(.+)$/gm)].some((h) => hasKw(h[1], kw))) e.push(`keyword not in any H2`);
    }
    if (seoTitle.length > 60) e.push(`seoTitle ${seoTitle.length} > 60`);
    if (/[!]|[А-ЯA-Z]{6,}/.test(seoTitle.replace(/CRM|SEO|SMM|UGC|NDA|KPI|CJM|P&L|TikTok|YouTube|Google|Kaspi|amoCRM|Instagram|Meta|IP|AI|ТОО|ИП|B2B|B2C|PR|2GIS/g, ''))) w.push('seoTitle: caps or «!»');
    const dl = (fm.description ?? '').length; if (dl < 140 || dl > 160) e.push(`description ${dl} chars (140–160)`);
    if (/лучш|№ ?1/i.test(fm.description ?? '')) e.push('description: «лучший/№1»');
    if (!fm.publishDate) e.push('publishDate missing');
    const wv = a.plan ? waveDates[a.plan.wave] : null;
    if (wv && fm.publishDate && String(fm.publishDate instanceof Date ? fm.publishDate.toISOString().slice(0, 10) : fm.publishDate) !== wv) e.push(`publishDate ≠ wave ${a.plan.wave} date ${wv}`);
    const svc = (fm.serviceLink ?? '').replace(/[?#].*$/, '');
    if (!fm.serviceLink) e.push('serviceLink missing');
    else if (!internal.some((l) => l === svc || (svc === '/contact/' && l === '/contact/'))) e.push(`no link to ${fm.serviceLink} in the text`);
    if (toArticles.size < 2) e.push(`${toArticles.size} links to other articles (need ≥ 2)`);
    const sumN = (fm.summary ?? []).length; if (sumN < 3 || sumN > 5) e.push(`summary: ${sumN} points (3–5)`);
    if ((fm.faq ?? []).length > 5) e.push('faq > 5');
    if ((fm.related ?? []).some((r) => !arts.some((x) => x.slug === r) && !plan[r])) e.push('related: unknown slug');
    if (a.rubric === 'tenders-legal' && !(fm.sources ?? []).length) e.push('tenders-legal without sources');
    if (/(\d[\d\s]*)\s?(₸|тенге|%)/.test(text) && !(fm.sources ?? []).length && !/пример|условн/i.test(text)) w.push('numbers without sources');
    const paras = a.body.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
    if (/^(Ниже|В этой статье|Разберём|Разберем|Дальше —|Давайте)/.test(paras[1] ?? '')) e.push(`template opening of the 2nd paragraph: «${paras[1].slice(0, 30)}…»`);
    a.ctaStart = (paras.at(-1) ?? '').split(/\s+/)[0];
    if (!/```figure/.test(a.body)) e.push('no figure (1–2 required)');
    if ((a.body.match(/```figure/g) ?? []).length > 2) w.push('more than 2 figures');
    if (!/^##\s+(Типичные ошибки|Частые ошибки|Ошибки)/m.test(a.body)) w.push('no «Типичные ошибки» section');
    if (!/^##\s+С чего начать/m.test(a.body)) w.push('no «С чего начать» section');
    for (const p of a.body.split(/\n\s*\n/)) { const s = p.trim(); if (s.startsWith('|') || s.startsWith('-') || s.startsWith('#') || s.startsWith('```') || /^\d+\./.test(s)) continue; const n = (s.match(/[.!?…](\s|$)/g) ?? []).length; if (n > 5) w.push(`paragraph of ${n} sentences: «${s.slice(0, 40)}…»`); }
  }
  errorsTotal += e.length;
  rows.push({ a, wc, sim: maxSim, simWith, e, w, toA: toArticles.size, seoTitle: (fm.seoTitle ?? fm.title).length, desc: (fm.description ?? '').length });
}

// one CTA formula repeated across articles reads as mass production
const ctaStarts = {}; for (const r of rows) if (r.a.ctaStart) ctaStarts[r.a.ctaStart] = (ctaStarts[r.a.ctaStart] ?? 0) + 1;
const newCount = rows.filter((r) => !r.a.legacy).length;
for (const [w, n] of Object.entries(ctaStarts)) if (newCount >= 20 && n > newCount * 0.25) { errorsTotal++; console.error(`❌ ${n} of ${newCount} final paragraphs start with «${w}» (max 25 %)`); }
rows.sort((x, y) => (x.a.plan?.n ?? 0) - (y.a.plan?.n ?? 0) || x.a.slug.localeCompare(y.a.slug));
const shown = WAVE ? rows.filter((r) => r.a.plan?.wave === WAVE) : rows;
const md = [`# SEO-проверка разборов`, '', `Дата: ${new Date().toISOString().slice(0, 10)}. Статей: ${rows.length} (12 прежних + ${rows.filter((r) => !r.a.legacy).length} новых). Ошибок: ${errorsTotal}.`, '',
  '| № | Волна | Статья | Слов | title | descr | → статьи | Макс. похожесть | Ошибки / замечания |', '|---|---|---|---|---|---|---|---|---|',
  ...shown.map((r) => `| ${r.a.plan?.n ?? '—'} | ${r.a.plan?.wave ?? '—'} | ${r.a.rubric}/${r.a.slug}${r.a.fm.legalCheck ? ' ⚖' : ''} | ${r.wc} | ${r.seoTitle} | ${r.desc} | ${r.toA} | ${(r.sim * 100).toFixed(1)} % (${r.simWith}) | ${[...r.e.map((x) => '❌ ' + x), ...r.w.map((x) => '⚠ ' + x)].join('<br>') || '✓'} |`),
  '', '⚖ — статья помечена «требует юридической проверки» (legalCheck: true).', ''];
await mkdir(join(root, 'qa'), { recursive: true });
await writeFile(join(root, 'qa/seo-report.md'), md.join('\n'));
for (const r of shown) for (const x of r.e) console.error(`❌ ${r.a.slug}: ${x}`);
if (process.argv.includes('--warn')) for (const r of shown) for (const x of r.w) console.warn(`⚠ ${r.a.slug}: ${x}`);
console.log(`seo:check — ${rows.length} articles, ${errorsTotal} errors, max similarity ${(Math.max(...rows.map((r) => r.sim)) * 100).toFixed(1)} %; qa/seo-report.md`);
if (errorsTotal) process.exitCode = 1;
