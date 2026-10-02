// Converts the live-site export (content/source/{ru,en}/**.md) into the data files the site reads:
// content/data/{directions,services,cases,sectors,insights}.json and content/data/pages.json
// (texts of the showcase pages). Text is taken verbatim; only structure is inferred.
// Usage: node scripts/import-source.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'content/source');
const OUT = join(root, 'content/data');
const LANGS = ['ru', 'en'];

/* ── parsing helpers ── */
function load(lang, rel) {
  const raw = readFileSync(join(SRC, lang, rel), 'utf8').replace(/\r/g, '');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = {};
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); fm[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  let lines = m[2].split('\n').filter((l) => l.trim() !== '');
  // drop the shared CTA tail ("CHAOS → CORE → SYSTEM → GROWTH" + "## Начнём…")
  const cta = lines.findIndex((l, i) => /^## /.test(l) && i > 0 && /^CHAOS → CORE → SYSTEM → GROWTH$/.test(lines[i - 1]) && /\{→https:\/\/wa\.me/.test(lines[i + 2] || ''));
  if (cta > 0) lines = lines.slice(0, cta - 1);
  return { fm, lines };
}
const LINK = /\s*\{→([^}]*)\}/g;
const hrefOf = (l) => { const m = [...l.matchAll(LINK)]; return m.length ? m[m.length - 1][1] : null; };
const strip = (l) => l.replace(LINK, '').trim();
/** split by the export's span separator " | " */
const cells = (l) => strip(l).split('|').map((x) => x.trim()).filter((x) => x && x !== '·');
const noLang = (h) => h && h.replace(/^\/en\//, '/');
const slugFrom = (h, re) => { const m = noLang(h || '')?.match(re); return m ? m[1] : null; };
const isLabel = (l) => /^\d\d(\s*[·\/—]\s*.*)?$/.test(l);

/** sections by "## " heading; the label line right before a heading is attached to it */
function sections(lines) {
  const out = [{ title: null, label: null, href: null, lines: [] }];
  for (const l of lines) {
    if (l.startsWith('## ')) {
      const prev = out[out.length - 1].lines;
      const label = prev.length && isLabel(prev[prev.length - 1]) ? prev.pop() : null;
      out.push({ title: strip(l.slice(3)), href: hrefOf(l), label, lines: [] });
    } else out[out.length - 1].lines.push(l);
  }
  return out;
}
const caseSlugs = (ls) => ls.map((l) => (l.includes(' | ') || /^\S/.test(l)) && slugFrom(hrefOf(l), /^\/cases\/([\w-]+)\/$/)).filter(Boolean);
const articleSlugs = (ls) => ls.filter((l) => l.startsWith('### ')).map((l) => slugFrom(hrefOf(l), /^\/insights\/[\w-]+\/([\w-]+)\/$/)).filter(Boolean);
/** "### title" + following paragraph(s) */
function titled(ls) {
  const out = [];
  for (const l of ls) {
    if (l.startsWith('### ')) out.push({ t: strip(l.slice(4)), d: '' });
    else if (out.length) out[out.length - 1].d += (out[out.length - 1].d ? '\n' : '') + strip(l);
  }
  return out;
}
const bullets = (ls) => ls.filter((l) => l.startsWith('- ')).map((l) => cells(l.slice(2)));
const seo = (fm) => ({ title: fm.title, description: fm.description, h1: fm.h1 });
const L = (f) => Object.fromEntries(LANGS.map((lang) => [lang, f(lang)]));
const both = (f) => { const r = L(f); return r; };

/* ── directions & services ── */
const DIRS = ['audit', 'systems', 'brand-content', 'traffic', 'tenders-legal'];
const svcIndex = load('ru', 'services.md');
const directions = [];
const services = [];
const dirPage = Object.fromEntries(DIRS.map((d) => [d, L((lang) => load(lang, `services/${d}.md`))]));
const svcList = (lang) => sections(load(lang, 'services.md').lines).filter((s) => s.href && /\/services\/[\w-]+\/$/.test(noLang(s.href)));
const aboutDirs = (lang) => {
  const s = sections(load(lang, 'about.md').lines).find((x) => x.lines.some((l) => /^### .*\{→(\/en)?\/services\/audit\/\}/.test(l)));
  return Object.fromEntries(s.lines.filter((l) => l.startsWith('### ')).map((l) => [slugFrom(hrefOf(l), /^\/services\/([\w-]+)\/$/), strip(l.slice(4))]));
};
const about = L(aboutDirs);
const svcIdx = L(svcList);
const homeLines = L((lang) => load(lang, 'index.md').lines);

DIRS.forEach((d, di) => {
  const P = dirPage[d];
  const pick = (f) => L((lang) => f(P[lang], lang));
  const secs = L((lang) => sections(P[lang].lines));
  const h1Cells = L((lang) => cells(P[lang].lines.find((l) => l.startsWith('# ')).slice(2)));
  const head = L((lang) => {
    const ls = secs[lang][0].lines;
    const h = ls.findIndex((l) => l.startsWith('# '));
    const rest = ls.slice(h + 1);
    const metricsAt = rest.findIndex((l) => / · /.test(l) && l === l.toUpperCase());
    const aboutAt = rest.findIndex((l) => /\{→(\/en)?\/about\//.test(l));
    return {
      lead: rest[0],
      metrics: rest[metricsAt],
      intro: rest.slice(metricsAt + 1, aboutAt).map(strip),
      aboutLink: { text: strip(rest[aboutAt]).replace(/\s*→$/, ''), href: noLang(hrefOf(rest[aboutAt])) },
    };
  });
  const svcSec = L((lang) => secs[lang][1]);
  const svcItems = L((lang) => {
    const out = [];
    for (const l of svcSec[lang].lines) {
      if (l.startsWith('### ')) out.push({ id: slugFrom(hrefOf(l), /^\/services\/[\w-]+\/([\w-]+)\/$/), name: strip(l.slice(4)), line: '', points: [] });
      else if (!out.length) continue;
      else if (l.startsWith('- ')) out[out.length - 1].points.push(strip(l.slice(2)));
      else if (!/\{→/.test(l) && !/^\d\d \/ \d\d$/.test(l)) out[out.length - 1].line = strip(l);
    }
    return out;
  });
  const idxSec = L((lang) => svcIdx[lang][di]);
  const result = L((lang) => { const r = idxSec[lang].lines.find((l) => /^(Результат|Result):?\s*\|/.test(l) || /^\S+:\s*\|/.test(l)); return cells(r)[1]; });
  // thesis shown on home ("## Сначала диагноз…" after "01 — Аудит")
  const home = L((lang) => {
    const ls = homeLines[lang];
    const i = ls.findIndex((l) => new RegExp(`^0${di + 1} — `).test(l));
    return { codes: ls[i - 1], thesis: strip(ls[i + 1].slice(3)) };
  });
  const id = d;
  const label = idxSec.ru.label; // "01 · CORE"
  directions.push({
    id,
    index: label.slice(0, 2),
    stage: label.split('·')[1].trim(),
    name: L((lang) => idxSec[lang].title),
    nameFull: L((lang) => about[lang][d]),
    kicker: L((lang) => h1Cells[lang][0]),
    thesis: L((lang) => h1Cells[lang][1] ?? home[lang].thesis),
    lead: L((lang) => head[lang].lead),
    metrics: head.ru.metrics,
    codes: home.ru.codes,
    intro: L((lang) => head[lang].intro.filter((p) => !/→/.test(p))),
    result: result,
    services: svcItems.ru.map((s) => s.id),
    cases: caseSlugs(secs.ru[2].lines),
    insights: articleSlugs(secs.ru[3].lines),
    image: `dir-${d}.webp`,
    seo: L((lang) => seo(P[lang].fm)),
  });
  svcItems.ru.forEach((s, si) => {
    const SP = L((lang) => load(lang, `services/${d}/${s.id}.md`));
    const ss = L((lang) => sections(SP[lang].lines));
    const head = L((lang) => {
      const ls = ss[lang][0].lines;
      const h = ls.findIndex((l) => l.startsWith('# '));
      const rest = ls.slice(h + 1);
      const mAt = rest.findIndex((l) => / · /.test(l) && l === l.toUpperCase());
      return { lead: rest[0], metrics: rest[mAt], intro: rest.slice(mAt + 1).map(strip) };
    });
    const sec = (lang, i) => ss[lang][i];
    const steps = L((lang) => {
      const out = []; let note = null;
      for (const l of sec(lang, 2).lines) {
        if (/^\d\d · [A-Z]+$/.test(l)) out.push({ stage: l.split('·')[1].trim(), t: '', d: '', time: null });
        else if (l.startsWith('### ')) out[out.length - 1].t = strip(l.slice(4));
        else if (/^[^|]+:\s*\|/.test(l) && out.length && out[out.length - 1].d) out[out.length - 1].time = cells(l)[1];
        else if (out.length && !out[out.length - 1].d) out[out.length - 1].d = strip(l);
        else note = strip(l);
      }
      return { items: out, note, timeLabel: (sec(lang, 2).lines.find((l) => /^[^|]+:\s*\|/.test(l)) || '').split(':')[0] || null };
    });
    const faq = L((lang) => {
      const out = [];
      for (const l of sec(lang, 6).lines) {
        if (/ \|$/.test(l)) out.push({ q: l.replace(/\s*\|$/, ''), a: '' });
        else out[out.length - 1].a += (out[out.length - 1].a ? '\n' : '') + strip(l);
      }
      return out;
    });
    services.push({
      id: s.id,
      direction: d,
      index: String(si + 1).padStart(2, '0'),
      name: L((lang) => svcItems[lang][si].name),
      line: L((lang) => svcItems[lang][si].line),
      points: L((lang) => svcItems[lang][si].points),
      lead: L((lang) => head[lang].lead),
      intro: L((lang) => head[lang].intro),
      includes: L((lang) => titled(sec(lang, 1).lines)),
      steps: L((lang) => steps[lang].items),
      stepsNote: L((lang) => steps[lang].note),
      timeLabel: L((lang) => steps[lang].timeLabel),
      result: L((lang) => bullets(sec(lang, 3).lines).map((c) => c.join(' '))),
      forWhom: L((lang) => titled(sec(lang, 4).lines)),
      cases: caseSlugs(sec('ru', 5).lines),
      faq,
      insights: articleSlugs(sec('ru', 7).lines),
      seo: L((lang) => seo(SP[lang].fm)),
    });
  });
});

/* ── sectors & cases ── */
const casesPage = L((lang) => load(lang, 'cases.md'));
const SECTOR_IDS = ['experts', 'politics', 'retail', 'horeca', 'b2b', 'maritime', 'pro', 'tech'];
const cs = L((lang) => sections(casesPage[lang].lines).slice(1));
const sectors = SECTOR_IDS.map((id, i) => ({ id, title: L((lang) => cs[lang][i].title), line: L((lang) => cs[lang][i].lines[0]) }));
const images = JSON.parse(readFileSync(join(SRC, 'images.json'), 'utf8'));
const altOf = (file) => images.find((x) => x.save_as === file)?.alt ?? null;
const cardInfo = L((lang) => {
  const out = {};
  cs[lang].forEach((s, si) => {
    for (let i = 0; i < s.lines.length; i++) {
      const slug = slugFrom(hrefOf(s.lines[i]), /^\/cases\/([\w-]+)\/$/);
      if (slug && s.lines[i].includes(' | ')) out[slug] = { sector: SECTOR_IDS[si], name: s.lines[i - 1], tags: cells(s.lines[i])[0] };
    }
  });
  return out;
});
const order = Object.keys(cardInfo.ru);
const KNOWN = {
  project: ['Проект', 'Project'], task: ['Задача', 'Task'], role: ['Роль CYBERMOVE', 'CYBERMOVE role'],
  done: ['Что было сделано', 'What we did'], result: ['Результат', 'Result'], vessel: ['Судно', 'Vessel'],
  disciplines: ['Дисциплины', 'Disciplines'], services: ['Услуги в проекте', 'Services in this project'], similar: ['Похожие кейсы', 'Similar cases'],
};
const kindOf = (title) => Object.keys(KNOWN).find((k) => KNOWN[k].includes(title)) ?? 'extra';
const cases = order.map((slug) => {
  const P = L((lang) => load(lang, `cases/${slug}.md`));
  const parsed = L((lang) => {
    const ss = sections(P[lang].lines);
    const head = ss[0].lines;
    const h = head.findIndex((l) => l.startsWith('# '));
    const crumb = cells(head.find((l) => /^\S.*\{→(\/en)?\/cases\/\}/.test(l)));
    const rest = head.slice(h + 1);
    const ext = rest.find((l) => /↗ \{→https?:/.test(l));
    const r = { n: crumb[1], name: strip(head[h].slice(2)), summary: rest[0], disciplinesLine: rest[1], link: ext ? { text: strip(ext).replace(/\s*↗$/, ''), href: hrefOf(ext) } : null, blocks: [] };
    for (const s of ss.slice(1)) {
      const kind = kindOf(s.title);
      if (kind === 'similar' || kind === 'services') { r[kind] = s.lines; continue; }
      if (kind === 'disciplines') { r.disciplines = s.lines[0]; continue; }
      if (kind === 'vessel') {
        const rows = []; let i = 0; const ls = s.lines;
        while (i < ls.length && !/\{→|:/.test(ls[i]) && !/^\S+ \S+: /.test(ls[i])) {
          const v = ls[i + 1]; const c = cells(v);
          rows.push({ k: ls[i], v: c[0], note: c[1] ?? null }); i += 2;
          if (/^\$/.test(c[0])) break;
        }
        const tail = ls.slice(i);
        const former = tail.find((l) => !/\{→/.test(l));
        const src = tail.find((l) => /\{→/.test(l));
        r.blocks.push({ kind, title: s.title, rows, former: former ? former : null, source: src ? { text: strip(src).replace(/\s*↗$/, ''), href: hrefOf(src) } : null });
        continue;
      }
      const items = bullets(s.lines).map((c) => c.filter((x) => !/^\d\d$/.test(x)).join(' '));
      const paras = s.lines.filter((l) => !l.startsWith('- ')).map(strip);
      r.blocks.push({ kind, title: s.title, paras, items, numbered: kind === 'done' });
    }
    return r;
  });
  const svc = parsed.ru.services.map((l) => slugFrom(hrefOf(l), /^\/services\/[\w-]+\/([\w-]+)\/$/));
  const similar = caseSlugs(parsed.ru.similar);
  const photo = ['jpg', 'png', 'webp'].map((e) => `${slug}.${e}`).find((f) => existsSync(join(root, 'src/assets/projects', f)));
  const logo = existsSync(join(root, 'src/assets/live', `${slug}.webp`)) ? `${slug}.webp` : null;
  const alt = altOf(`${slug}-4x3.webp`);
  return {
    id: slug,
    n: parsed.ru.n,
    sector: cardInfo.ru[slug].sector,
    name: L((lang) => parsed[lang].name),
    cardName: L((lang) => cardInfo[lang][slug].name),
    tags: L((lang) => cardInfo[lang][slug].tags),
    summary: L((lang) => parsed[lang].summary),
    disciplinesLine: L((lang) => parsed[lang].disciplinesLine),
    disciplines: L((lang) => parsed[lang].disciplines),
    link: parsed.ru.link ? L((lang) => parsed[lang].link) : null,
    blocks: L((lang) => parsed[lang].blocks),
    services: svc,
    similar,
    photo: photo ?? null,
    live: { '4x3': `${slug}-4x3.webp`, '16x9': `${slug}-16x9.webp` },
    logo,
    alt: alt ?? L((lang) => parsed[lang].name),
    seo: L((lang) => seo(P[lang].fm)),
  };
});

/* ── insights (meta for lists; bodies live in src/content/insights) ── */
const ins = L((lang) => load(lang, 'insights.md'));
const insights = [];
{
  const ls = L((lang) => ins[lang].lines);
  ls.ru.forEach((l, i) => {
    if (!l.startsWith('## ')) return;
    const href = noLang(hrefOf(l));
    const [, direction, slug] = href.match(/^\/insights\/([\w-]+)\/([\w-]+)\/$/);
    const j = ls.en.findIndex((x) => x.startsWith('## ') && noLang(hrefOf(x)) === href);
    const meta = L((lang) => cells((lang === 'ru' ? ls.ru : ls.en)[(lang === 'ru' ? i : j) - 1]));
    const art = L((lang) => load(lang, `insights/${direction}/${slug}.md`));
    insights.push({
      id: slug, direction,
      date: L((lang) => meta[lang][0]),
      read: L((lang) => meta[lang][2]),
      title: L((lang) => strip((lang === 'ru' ? ls.ru[i] : ls.en[j]).slice(3))),
      excerpt: L((lang) => (lang === 'ru' ? ls.ru[i + 1] : ls.en[j + 1])),
      seo: L((lang) => seo(art[lang].fm)),
      more: articleSlugs(sections(art.ru.lines).slice(-1)[0].lines),
    });
  });
}
const rubrics = DIRS.map((d) => {
  const P = L((lang) => load(lang, `insights/${d}.md`));
  return { id: d, h1: L((lang) => strip(P[lang].lines.find((l) => l.startsWith('# ')).slice(2))), lead: L((lang) => P[lang].lines[P[lang].lines.findIndex((l) => l.startsWith('# ')) + 1]), seo: L((lang) => seo(P[lang].fm)) };
});

const w = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n');
w('directions.json', directions);
w('services.json', services);
w('sectors.json', sectors);
w('cases.json', cases);
w('insights.json', { rubrics, items: insights });
console.log(`directions ${directions.length}, services ${services.length}, sectors ${sectors.length}, cases ${cases.length}, insights ${insights.length}`);
