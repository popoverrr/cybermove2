// Builds content/i18n/{ru,en}.json: texts of the showcase pages (home, services, cases, about, contact,
// privacy, insights) and the shared labels of the templates — all taken verbatim from content/source/.
// Interface strings that the live site does not show as text (menu/close labels, 404, WhatsApp template)
// are kept from content/i18n/_ui.<lang>.json (the skeleton's interface texts).
// Usage: node scripts/import-pages.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'content/source');

function load(lang, rel) {
  const raw = readFileSync(join(SRC, lang, rel), 'utf8').replace(/\r/g, '');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = {};
  if (m) for (const l of m[1].split('\n')) { const i = l.indexOf(':'); fm[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return { fm, lines: (m ? m[2] : raw).split('\n').filter((l) => l.trim() !== '') };
}
const LINK = /\s*\{→([^}]*)\}/g;
const strip = (l) => l.replace(LINK, '').trim();
const cells = (l) => strip(l).split('|').map((x) => x.trim()).filter((x) => x && x !== '·');
const meta = (fm) => ({ title: fm.title, description: fm.description });
const after = (ls, pred, n = 1) => ls[ls.findIndex(pred) + n];
const idx = (ls, pred, from = 0) => { const i = ls.findIndex((l, k) => k >= from && pred(l)); if (i < 0) throw new Error('not found: ' + pred); return i; };
const h2 = (ls, i) => strip(ls[i].slice(3));
const nth = (ls, re, n) => ls.filter((l) => re.test(l))[n];

function build(lang) {
  const ui = JSON.parse(readFileSync(join(root, `content/i18n/_ui.${lang}.json`), 'utf8'));
  const home = load(lang, 'index.md'), H = home.lines;
  const svc = load(lang, 'services.md'), S = svc.lines;
  const cases = load(lang, 'cases.md'), C = cases.lines;
  const about = load(lang, 'about.md'), A = about.lines;
  const contact = load(lang, 'contact.md'), K = contact.lines;
  const privacy = load(lang, 'privacy.md'), P = privacy.lines;
  const ins = load(lang, 'insights.md'), I = ins.lines;
  const art = load(lang, 'insights/audit/business-audit-before-ads.md'), R = art.lines;
  const dir = load(lang, 'services/audit.md'), D = dir.lines;
  const sv = load(lang, 'services/audit/business-audit.md'), V = sv.lines;
  const cs = load(lang, 'cases/usyk.md'), U = cs.lines;
  const ship = load(lang, 'cases/fort-desaix.md');

  /* home */
  const h1 = idx(H, (l) => l.startsWith('# '));
  const heroBtns = cells(H[h1 + 2]);
  const clientsAt = idx(H, (l) => /^02 \| .* \| \+ \|/.test(l));
  const names = []; for (let i = clientsAt + 2; H[i].startsWith('- '); i++) names.push(H[i].slice(2));
  const resAt = idx(H, (l) => /^06 · GROWTH$/.test(l));
  const statsAt = idx(H, (l) => /^03 \| \/ 05 \|$/.test(l));
  const stats = [];
  for (let i = statsAt + 1; stats.length < 4; i += 2) { const c = cells(H[i]); stats.push({ value: c[0], suffix: c[1] ?? '', label: H[i + 1] }); }
  const allCases = cells(H[statsAt + 9])[0];
  const apAt = idx(H, (l) => /^## .*\|/.test(l));
  const approach = [1, 2, 3].map((k) => { const c = cells(H[apAt + k].slice(2)); return { title: c[1], text: c[2] }; });
  const ctaAt = idx(H, (l) => /^07 · CONTACT$/.test(l));
  const waBtn = cells(S[S.length - 1]);

  /* form (contact page) */
  const fAt = idx(K, (l) => l.startsWith('# '));
  const opt = K.filter((l) => /^\s+option: /.test(l)).map((l) => l.replace(/^\s+option: /, ''));
  const radios = K.map((l, i) => (/\[field format \(radio=/.test(l) ? { id: l.match(/radio=(\w+)/)[1], label: cells(K[i + 1])[0] } : null)).filter(Boolean);
  const nameLbl = cells(K[fAt + 2])[0];
  const req = cells(K[fAt + 4]);
  const cont = cells(K[fAt + 6]);
  const svcLbl = cells(K[fAt + 8])[0];
  const formatLbl = K[idx(K, (l) => /\[field format \(radio=audit/.test(l)) - 1];
  const msgLbl = cells(K[idx(K, (l) => /\[field message/.test(l)) - 1])[0];
  const sendAt = idx(K, (l) => /\[field website\]/.test(l)) + 1;
  const consent = K[sendAt + 2];
  const chanAt = idx(K, (l) => /^WhatsApp$/.test(l));

  /* about */
  const aH1 = cells(A[idx(A, (l) => l.startsWith('# '))].slice(2));
  const aText = after(A, (l) => l.startsWith('# '));
  const numAt = idx(A, (l) => l.startsWith('## '), idx(A, (l) => l.startsWith('# ')) + 1);
  const numbers = []; for (let i = numAt + 1; numbers.length < 4; i += 2) numbers.push({ value: A[i], label: A[i + 1] });
  const whatAt = idx(A, (l) => l.startsWith('## '), numAt + 1);
  const what = []; for (let i = whatAt + 1; !A[i].startsWith('## '); i += 3) what.push({ label: A[i], title: strip(A[i + 1].slice(4)), text: A[i + 2] });
  const apprAt = idx(A, (l) => l.startsWith('## '), whatAt + 1);
  const steps = []; for (let i = apprAt + 1; !A[i].startsWith('## '); i += 3) steps.push({ stage: cells(A[i])[1].replace(/^·\s*/, ''), title: strip(A[i + 1].slice(4)), text: A[i + 2] });
  const whyAt = idx(A, (l) => l.startsWith('## '), apprAt + 1);
  const why = []; for (let i = whyAt + 1; !A[i].startsWith('## '); i += 2) why.push({ title: strip(A[i].slice(4)), text: A[i + 1] });
  const fmtAt = idx(A, (l) => l.startsWith('## '), whyAt + 1);
  const formats = []; for (let i = fmtAt + 1; !A[i].startsWith('## '); i += 2) formats.push({ title: strip(A[i].slice(4)), text: A[i + 1] });
  const metAt = idx(A, (l) => l.startsWith('## '), fmtAt + 1);
  const metrics = []; let i = metAt + 2;
  for (; A[i + 1] && !A[i].startsWith('- ') && / \|$/.test(A[i]); i += 2) { const c = cells(A[i]); metrics.push({ code: c[0], name: c[1], text: A[i + 1] }); }
  const alsoTitle = A[i]; const also = []; for (i++; A[i].startsWith('- '); i++) also.push(A[i].slice(2));
  const geoAt = idx(A, (l) => l.startsWith('## '), i);
  const cities = []; for (i = geoAt + 2; A[i].startsWith('- '); i++) cities.push(cells(A[i].slice(2))[1]);
  const regionsTitle = A[i];
  const regions = [];
  for (i++; i < A.length && A[i].startsWith('### '); ) {
    const r = { name: strip(A[i].slice(4)), cities: A[i + 1], text: null, cases: [] };
    i += 2;
    if (A[i] && !A[i].startsWith('### ') && !A[i].startsWith('- ') && !/^CHAOS/.test(A[i])) r.text = A[i++];
    for (; A[i] && A[i].startsWith('- '); i++) r.cases.push({ text: strip(A[i].slice(2)).replace(/\s*→$/, ''), slug: A[i].match(/\/cases\/([\w-]+)\//)[1] });
    regions.push(r);
    if (/^CHAOS/.test(A[i] || '')) break;
  }

  /* services page */
  const sH1 = idx(S, (l) => l.startsWith('# '));
  const sAbout = S.find((l) => /\{→(\/en)?\/about\/\}$/.test(l));

  /* cases page */
  const cH1 = idx(C, (l) => l.startsWith('# '));

  /* direction page labels */
  const dirH2 = D.filter((l) => l.startsWith('## ')).map((l) => strip(l.slice(3)));
  const svcMore = strip(nth(D, /^\S.* → \{→.*\/services\/audit\/business-audit\/\}$/, 0)).replace(/\s*→$/, '');
  const allIns = strip(D.find((l) => /\{→.*\/insights\/audit\/\}$/.test(l))).replace(/\s*→$/, '');
  const more = strip(D.find((l) => /\{→.*\/insights\/audit\/[\w-]+\/\}$/.test(l) && !l.startsWith('### '))).replace(/\s*→$/, '');

  /* service page labels */
  const svH2 = V.filter((l) => l.startsWith('## ')).map((l) => strip(l.slice(3)));
  const discussBtn = cells(V.find((l) => /\?service=business-audit\} \|/.test(l)))[0];

  /* case page labels */
  const uH2 = U.filter((l) => l.startsWith('## ')).map((l) => strip(l.slice(3)));
  const crumbCases = cells(U.find((l) => /\{→(\/en)?\/cases\/\} \|/.test(l)))[0];
  const nextLine = strip(U.find((l) => /\{→(\/en)?\/contact\/\}\S/.test(l)) || U.find((l) => /Следующий|Next/.test(l)));
  const [discussSimilar, nextRaw] = nextLine.split('|').map((x) => x.trim()).filter(Boolean);
  const nextCase = nextRaw.split(':')[0];
  const shipH2 = ship.lines.filter((l) => l.startsWith('## ')).map((l) => strip(l.slice(3)));

  /* insights */
  const chips = I.filter((l) => /^- .*\{→(\/en)?\/insights\//.test(l)).map((l) => strip(l.slice(2)));
  const rH2 = R.filter((l) => l.startsWith('## ')).map((l) => strip(l.slice(3)));
  const crumbsHome = strip(I.find((l) => l.startsWith('- ')).slice(2));
  const tocTitle = after(R, (l) => l.startsWith('# '), 2);

  /* footer + chrome */
  const ftAt = idx(H, (l) => /^[^|]+: \| Bielefeld/.test(l));
  const footer = {
    tagline: H[ftAt + 1],
    sectionsTitle: H[ftAt + 3],
    langTitle: H[idx(H, (l) => /^- RU \{→/.test(l)) - 1],
    geoTitle: H[idx(H, (l) => /^Bielefeld ·/.test(l)) - 1],
    cities: H[idx(H, (l) => /^Bielefeld ·/.test(l))],
    copyright: H.find((l) => /^© \d{4}/.test(l)).replace(/^© \d{4} /, ''),
    privacy: strip(H.find((l) => /^- .*\{→(\/en)?\/privacy\/\}/.test(l)).slice(2)),
    insights: strip(H.find((l) => /^- .*\{→(\/en)?\/insights\/\}/.test(l)).slice(2)),
  };
  const chrome = load(lang, '_chrome.md').lines;
  const navItem = (re) => strip(chrome.find((l) => /^- [^0-9]/.test(l) && re.test(l)).slice(2));
  const nav = {
    ...ui.nav,
    services: navItem(/services\/\}/), cases: navItem(/cases\/\}/), about: navItem(/about\/\}/), contact: navItem(/contact\/\}/),
    insights: footer.insights,
    cta: cells(chrome.find((l) => /^\| .* \| \{→(\/en)?\/contact\/\}$/.test(l)))[0],
    ctaLong: heroBtns[0],
    home: crumbsHome,
  };

  return {
    meta: {
      siteName: 'CYBERMOVE',
      home: meta(home.fm), services: meta(svc.fm), cases: meta(cases.fm), insights: meta(ins.fm),
      about: meta(about.fm), contact: meta(contact.fm), privacy: meta(privacy.fm), notFound: ui.meta.notFound,
    },
    nav,
    common: { ...ui.common, whatsapp: waBtn[1], codes: S[sH1 + 2] },
    footer: { ...footer, bend: ui.footer.bend },
    home: {
      // hero texts: from the skeleton by the owner's decision (docs/10-fixes.md §1)
      hero: ui.home.hero,
      windows: ui.home.windows,
      orbit: ui.home.orbit,
      clients: { label: cells(H[clientsAt])[1], names },
      directions: { label: cells(S[sH1 - 1])[0], title: strip(S[sH1].slice(2)), resultLabel: cells(S.find((l) => /^\S+:\s*\|/.test(l)))[0].replace(/:$/, ''), link: strip(nth(S, /→ \{→(\/en)?\/services\/audit\/\}$/, 0)).replace(/\s*→$/, '') },
      results: { label: H[resAt], title: h2(H, resAt + 1), stats, link: allCases, featured: ['usyk', 'ukrainian-fashion-week', 'intertop', 'brsm-nafta', 'hydrosta-kazakhstan'] },
      approach: { label: H[apAt - 1], title: cells(H[apAt].slice(3)).join(' '), items: approach, link: strip(H[apAt + 4]).replace(/\s*→$/, '') },
      cta: { label: H[ctaAt], title: h2(H, ctaAt + 1), lead: H[ctaAt + 2], primary: heroBtns[0], secondary: waBtn[1] },
    },
    method: { label: A[apprAt - 1] && /^CHAOS/.test(A[apprAt - 1]) ? A[apprAt - 1] : S[sH1 + 2], title: h2(A, apprAt), steps },
    services: {
      hero: { label: cells(S[sH1 - 1])[0], title: strip(S[sH1].slice(2)), lead: S[sH1 + 1], codes: S[sH1 + 2] },
      resultLabel: cells(S.find((l) => /^\S+:\s*\|/.test(l)))[0].replace(/:$/, ''),
      directionLink: strip(nth(S, /→ \{→(\/en)?\/services\/audit\/\}$/, 0)).replace(/\s*→$/, ''),
      aboutLink: strip(sAbout).replace(/\s*→$/, ''),
      formats: { title: h2(A, fmtAt), items: formats },
    },
    cases: { hero: { label: C[cH1 - 1], title: strip(C[cH1].slice(2)), lead: C[cH1 + 1] }, filterAll: chips[0], forms: ui.cases.forms },
    about: {
      hero: { kicker: aH1[0], title: aH1[1], text: aText, codes: after(A, (l) => l === aText) },
      numbers: { title: h2(A, numAt), items: numbers },
      what: { title: h2(A, whatAt), items: what },
      approach: { title: h2(A, apprAt), steps },
      why: { title: h2(A, whyAt), items: why },
      formats: { title: h2(A, fmtAt), items: formats },
      metrics: { title: h2(A, metAt), lead: A[metAt + 1], items: metrics, alsoTitle, also },
      geo: { title: h2(A, geoAt), lead: A[geoAt + 1], cities, regionsTitle, regions },
    },
    contact: {
      hero: { title: strip(K[fAt].slice(2)), lead: K[fAt + 1] },
      form: {
        name: nameLbl, required: req[0], contact: req[1], invalidContact: cont[0], company: cont[1],
        service: svcLbl, serviceNone: opt[0], format: formatLbl, formats: radios, message: msgLbl,
        submit: cells(K[sendAt])[0], whatsapp: cells(K[sendAt + 1])[0],
        consent: strip(consent).replace(/\.$/, ''), sending: K[sendAt + 3], success: cells(K[sendAt + 4])[0], error: K[sendAt + 5],
        waTemplate: ui.contact.form.waTemplate,
      },
      channels: { whatsapp: K[chanAt], companyLabel: K[chanAt + 2], company: K[chanAt + 3], phoneLabel: cells(K[chanAt + 4])[0].replace(/:$/, '') },
      geo: { label: K[K.length - 2], cities: K[K.length - 1] },
    },
    privacy: {
      label: P[0], title: strip(P[1].slice(2)),
      sections: P.slice(2).reduce((acc, l) => { if (l.startsWith('## ')) { if (/<header>/.test(l)) acc.stop = true; else if (!acc.stop) acc.list.push({ h: strip(l.slice(3)), p: '' }); } else if (!acc.stop) acc.list[acc.list.length - 1].p += strip(l); return acc; }, { list: [], stop: false }).list,
    },
    insights: {
      hero: { title: strip(I[idx(I, (l) => l.startsWith('# '))].slice(2)), lead: after(I, (l) => l.startsWith('# ')) },
      all: chips[0], more, allInsights: allIns, toc: tocTitle,
      what: rH2[rH2.length - 5], relatedCases: rH2[rH2.length - 4], faq: rH2[rH2.length - 3], moreTopic: rH2[rH2.length - 2],
    },
    direction: { services: dirH2[0], cases: dirH2[1], insights: dirH2[2], directions: dirH2[3], serviceMore: svcMore, resultLabel: cells(S.find((l) => /^\S+:\s*\|/.test(l)))[0].replace(/:$/, '') },
    service: {
      includes: svH2[0], how: svH2[1], result: svH2[2], forWhom: svH2[3], cases: svH2[4], faq: svH2[5], insights: svH2[6], others: svH2[7],
      discuss: discussBtn,
    },
    case: {
      crumb: crumbCases, disciplines: uH2.find((x, k) => k === uH2.length - 4), services: uH2[uH2.length - 3], similar: uH2[uH2.length - 2],
      discuss: discussSimilar, next: nextCase, vessel: shipH2[0],
    },
    notFound: ui.notFound,
  };
}

for (const lang of ['ru', 'en']) {
  // phone format of the owner's fixes (docs/10-fixes.md §4) everywhere, incl. the contact page description
  const data = JSON.parse(JSON.stringify(build(lang)).replaceAll('+7 701 825 10 28', '+7 701 825 1028'));
  const check = (o, p = '') => { for (const [k, v] of Object.entries(o)) { if (v === undefined) throw new Error(`[${lang}] undefined ${p}${k}`); if (v && typeof v === 'object') check(v, `${p}${k}.`); } };
  check(data);
  writeFileSync(join(root, `content/i18n/${lang}.json`), JSON.stringify(data, null, 2) + '\n');
}
console.log('i18n written');
