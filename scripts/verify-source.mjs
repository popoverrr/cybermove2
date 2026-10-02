// Checks the build against the live-site export (docs/00-migration.md, «Проверка готовности» 2–3):
// every URL of content/source/pages.json exists in dist/ with the same <title>, description and H1 text;
// every paragraph > 80 chars of service, case and article pages is present in the HTML.
// Usage: node scripts/verify-source.mjs   (after npm run build with BASE_PATH unset)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
// display titles of services replaced by the owner (docs/11-fixes-2.md §D): old names in list cells → new ones
const svc = JSON.parse(readFileSync(join(root, 'content/data/services.json'), 'utf8'));
const renames = svc.flatMap((x) => ['ru', 'en'].map((l) => [x.seoTitle[l], x.title[l]])).filter(([a, b]) => a !== b).sort((a, b) => b[0].length - a[0].length);
const pages = JSON.parse(readFileSync(join(root, 'content/source/pages.json'), 'utf8'));
const norm = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<\/?(a|strong|em|b|i|span|code|tspan)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().replace('+7 701 825 10 28', '+7 701 825 1028'); // phone format: docs/10-fixes.md §4
let fails = 0, checked = 0;
const missing = [];
for (const p of pages) {
  const file = join(root, 'dist', p.url, 'index.html');
  if (!existsSync(file)) { console.log('MISSING', p.url); fails++; continue; }
  const html = readFileSync(file, 'utf8');
  const text = norm(html);
  const src = readFileSync(join(root, 'content/source', p.file), 'utf8').replace(/\r/g, '');
  const fm = Object.fromEntries(src.split('---')[1].trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  const title = norm(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
  const desc = norm(html.match(/<meta name="description" content="([^"]*)"/)[1]);
  const h1 = norm(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
  if (title !== norm(fm.title)) { console.log('TITLE', p.url, '|', title, '≠', fm.title); fails++; }
  if (desc !== norm(fm.description)) { console.log('DESC', p.url); fails++; }
  // home H1 comes from the skeleton by the owner's decision (docs/10-fixes.md §1)
  // service H1 = the new display title (docs/11-fixes-2.md §D)
  // service area H1 = the area name, the thesis is a subtitle (docs/13-fixes-4.md §2)
  if (!/^\/(en\/)?$/.test(p.url) && !/\/services\/[\w-]+\/([\w-]+\/)?$/.test(p.url) && h1.replace(/\s/g, '') !== norm(fm.h1).replace(/\s/g, '')) { console.log('H1', p.url, '|', h1, '≠', fm.h1); fails++; }
  if (!/\/(services\/[\w-]+\/[\w-]+|cases\/[\w-]+|insights\/[\w-]+\/[\w-]+)\/$/.test(p.url)) continue;
  const body = src.split('---').slice(2).join('---').split('\n');
  const stop = body.findIndex((l) => /^## (Похожие кейсы|Similar cases|Связанные кейсы|Related cases)/.test(l) && /cases\/[\w-]+\/$/.test(p.url))
  for (const raw of body) {
    if (raw.length <= 80 || raw.startsWith('[img')) continue;
    // each span of the export line is checked on its own (index numbers and separators are layout, not text)
    for (const cell of raw.replace(/\s*\{→[^}]*\}/g, '').replace(/^[-#]+\s*/, '').split(' | ')) {
      let l = norm(cell.replace(/\|/g, ''));
      for (const [a, b] of renames) if (l === a) l = b;
      if (l.length < 30 || /^\d\d$/.test(l) || /→$/.test(l)) continue;
      checked++;
      if (!text.includes(l)) missing.push(`${p.url}: ${l.slice(0, 90)}…`);
    }
  }
  void stop;
}
console.log(`pages ${pages.length}, meta fails ${fails}; paragraphs checked ${checked}, missing ${missing.length}`);
missing.slice(0, 60).forEach((m) => console.log('  TEXT', m));
process.exit(fails || missing.length ? 1 : 0);
