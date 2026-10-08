// npm run cases:import -- <path to cybermove-cases-edits-*.zip> [--dry-run] [--yes]
// Moves the edits of a case-editor draft into the site's data (docs/17-cases-editor.md §7):
//   content/data/cases.json, case-rank.json, sites.json, content/source/images.json (alt), photos in src/assets.
// Shows a summary and asks for confirmation. A field whose site value changed after the draft was created is a
// conflict: it is NOT overwritten, only listed. Writes qa/cases-import-<date>.md. --dry-run writes nothing.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { unzipSync, strFromU8 } from 'fflate';
import sharp from 'sharp';
import { caseToFields, siteToFields, applyCaseFields, applySiteFields } from './model.mjs';

const args = process.argv.slice(2);
const zipPath = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry-run');
const YES = args.includes('--yes');
if (!zipPath || !existsSync(zipPath)) { console.error('Укажите путь к ZIP: npm run cases:import -- <файл.zip> [--dry-run]'); process.exit(2); }

const root = process.cwd();
const P = { cases: 'content/data/cases.json', sites: 'content/data/sites.json', rank: 'content/data/case-rank.json', images: 'content/source/images.json' };
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
if (!files['changes.json']) { console.error('В архиве нет changes.json'); process.exit(2); }
const ch = JSON.parse(strFromU8(files['changes.json']));
if (!String(ch.format).startsWith('cybermove-cases-edits/')) { console.error(`Неизвестный формат: ${ch.format}`); process.exit(2); }

const cases = read(P.cases); const sitesDoc = read(P.sites); const sites = sitesDoc.items; const rank = read(P.rank); const images = read(P.images);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const plan = []; const conflicts = []; const photoOps = []; const notes = [];
for (const it of ch.items) {
  const isSite = it.kind === 'site';
  const cur = isSite ? sites.find((s) => s.id === it.id) : cases.find((c) => c.id === it.id);
  const curF = cur ? (isSite ? siteToFields(cur, sites.indexOf(cur)) : caseToFields(cur)) : null;
  const apply = {}; const keys = [];
  for (const d of it.fields) {
    if (d.field === 'comment' || d.field === 'kind') continue;
    if (cur && !it.isNew && !same(curF[d.field], d.was)) { conflicts.push({ id: it.id, field: d.label, site: curF[d.field], was: d.was, now: d.now }); continue; }
    apply[d.field] = d.now; keys.push(d.field);
  }
  if (!cur && !it.isNew) { notes.push(`${it.id}: нет на сайте и не отмечен как новый — пропущен`); continue; }
  if (keys.length || it.isNew) plan.push({ id: it.id, isSite, isNew: !cur, keys, apply, cur });
  for (const p of it.photos) photoOps.push({ id: it.id, isSite, ...p });
  if (it.question) notes.push(`${it.id}: вопрос — ${it.question}`);
  if (it.comment) notes.push(`${it.id}: комментарий — ${it.comment}`);
}

const fmt = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? x.title : x)).join('; ') : v === null || v === undefined || v === '' ? '—' : String(v)).slice(0, 120);
console.log(`\nРедакция: ${ch.draft} (выгружена ${ch.exportedAt})`);
console.log(`Кейсов и сайтов с правками: ${plan.length} (новых: ${plan.filter((p) => p.isNew).length}), полей: ${plan.reduce((a, p) => a + p.keys.length, 0)}, фото: ${photoOps.filter((p) => p.action !== 'reset').length}, конфликтов: ${conflicts.length}\n`);
for (const p of plan) console.log(`  ${p.isNew ? '+' : '~'} ${p.id}: ${p.keys.join(', ') || '(новый)'}`);
for (const p of photoOps) console.log(`  ▣ ${p.id} ${p.slot}: ${p.action}`);
if (conflicts.length) { console.log('\nКонфликты (не применяются — на сайте поле уже другое):'); for (const c of conflicts) console.log(`  ! ${c.id} · ${c.field}: на сайте «${fmt(c.site)}», в редакции было «${fmt(c.was)}» → «${fmt(c.now)}»`); }
if (notes.length) { console.log('\nВопросы и комментарии:'); for (const n of notes) console.log(`  · ${n}`); }

if (DRY) { console.log('\n--dry-run: ничего не записано.'); process.exit(0); }
if (!YES) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question('\nПрименить эти изменения к данным сайта? (да/нет) '); rl.close();
  if (!/^(да|y|yes|д)$/i.test(a.trim())) { console.log('Отменено.'); process.exit(0); }
}

/* apply data */
for (const p of plan) {
  if (p.isSite) {
    const next = applySiteFields(p.cur, { ...(p.cur ? siteToFields(p.cur, 0) : {}), ...p.apply }, p.keys);
    next.id = p.id; if (p.cur) sites[sites.indexOf(p.cur)] = next; else sites.push(next);
  } else {
    const base = p.cur ? caseToFields(p.cur) : {};
    const next = applyCaseFields(p.cur, { ...base, ...p.apply }, p.isNew ? Object.keys(p.apply) : p.keys);
    next.id = p.id;
    if (p.isNew) { next.n ||= String(cases.filter((c) => c.sector === next.sector).length + 1).padStart(2, '0'); next.live = { '4x3': `${p.id}-4x3.webp`, '16x9': `${p.id}-16x9.webp` }; }
    if (p.cur) cases[cases.indexOf(p.cur)] = next; else cases.push(next);
    if ('rank' in p.apply) rank[p.id] = Number(p.apply.rank) || 100;
  }
}
/* photos: crop → site formats (webp), alt → images.json */
const SIZE = { '4x3': 1440, '16x9': 1920, '4x5': 1080, logo: 480, shot: 1440 };
for (const p of photoOps) {
  if (p.action === 'reset' || !p.crop_file || !files[p.crop_file]) continue;
  const file = p.isSite ? `sites/${p.id}-desktop.webp` : p.slot === 'logo' ? `live/${p.id}.webp` : `live/${p.id}-${p.slot}.webp`;
  const dest = join(root, 'src/assets', file);
  await sharp(Buffer.from(files[p.crop_file])).resize({ width: SIZE[p.slot], withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
  if (p.slot === 'logo' && !p.isSite) { const c = cases.find((x) => x.id === p.id); if (c) c.logo = `${p.id}.webp`; }
  if (p.alt_ru || p.alt_en) {
    const name = basename(file); let e = images.find((x) => x.save_as === name);
    if (!e) { e = { save_as: name, alt: { ru: '', en: '' } }; images.push(e); }
    e.alt = { ru: p.alt_ru || e.alt?.ru || '', en: p.alt_en || e.alt?.en || '' };
  }
}
writeFileSync(join(root, P.cases), JSON.stringify(cases, null, 2) + '\n');
writeFileSync(join(root, P.sites), JSON.stringify({ ...sitesDoc, items: sites }, null, 2) + '\n');
writeFileSync(join(root, P.rank), JSON.stringify(rank, null, 2) + '\n');
writeFileSync(join(root, P.images), JSON.stringify(images, null, 2) + '\n');

/* report */
const date = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, 'qa'), { recursive: true });
const md = [`# Перенос правок кейсов — ${date}`, '', `Редакция: ${ch.draft}. Архив: ${basename(zipPath)}.`, '', '## Применено', '',
  ...plan.map((p) => `- ${p.isNew ? 'новый ' : ''}${p.id}: ${p.keys.join(', ') || '—'}`), '', '## Фото', '', ...photoOps.map((p) => `- ${p.id} ${p.slot}: ${p.action}`), '',
  '## Конфликты (не применены)', '', ...(conflicts.length ? conflicts.map((c) => `- ${c.id} · ${c.field}: на сайте «${fmt(c.site)}», в редакции было «${fmt(c.was)}» → «${fmt(c.now)}»`) : ['нет']), '',
  '## Вопросы и комментарии', '', ...(notes.length ? notes.map((n) => `- ${n}`) : ['нет']), '',
  'Дальше: npm run build, проверить страницы кейсов, затем npm run deploy. Счётчики категорий на сайте пересчитываются при сборке.'];
writeFileSync(join(root, `qa/cases-import-${date}.md`), md.join('\n'));
console.log(`\nГотово. Отчёт: qa/cases-import-${date}.md. Соберите сайт: npm run build`);
