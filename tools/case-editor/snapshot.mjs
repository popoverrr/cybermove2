// npm run editor:snapshot — the case data the site is built from (content/data/*.json + the case photos) →
// dist/kejsy-proverka/seed.json and dist/kejsy-proverka/site-photos/. A new draft on the server starts from this
// seed. Order = the home page order (case-rank). Nothing in the site's data is modified.
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { caseToFields, siteToFields, slotsFor } from './model.mjs';

const root = process.cwd();
const out = join(root, 'dist/kejsy-proverka');
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const cases = json('content/data/cases.json');
const sites = json('content/data/sites.json').items;
const sectors = json('content/data/sectors.json');
const services = json('content/data/services.json');
const liveFiles = new Set(readdirSync(join(root, 'src/assets/live')));

mkdirSync(join(out, 'site-photos/live'), { recursive: true });
mkdirSync(join(out, 'site-photos/sites'), { recursive: true });
mkdirSync(join(out, 'site-photos/thumb'), { recursive: true });
// list thumbnails (160 px) so the list stays light on a phone
const thumbs = [];
const thumb = (file, id) => { const src = join(root, 'src/assets', file); if (!existsSync(src)) return null; thumbs.push(sharp(src).resize(160, 120, { fit: 'cover', position: 'top' }).webp({ quality: 70 }).toFile(join(out, 'site-photos/thumb', `${id}.webp`))); return `site-photos/thumb/${id}.webp`; };
const photo = (file) => {
  const src = join(root, 'src/assets', file);
  if (!existsSync(src)) return null;
  copyFileSync(src, join(out, 'site-photos', file));
  return `site-photos/${file}`;
};

const ranked = [...cases].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
const items = [
  ...ranked.map((c, i) => ({
    id: c.id, kind: 'case', f: caseToFields(c), thumb: thumb(`live/${c.id}-4x3.webp`, c.id),
    slots: slotsFor('case', c.id, liveFiles, i < 14).map((s) => ({ ...s, url: s.exists ? photo(s.file) : null })),
  })),
  ...sites.map((s, i) => ({ id: s.id, kind: 'site', f: siteToFields(s, i), thumb: thumb(`sites/${s.id}-desktop.webp`, s.id), slots: slotsFor('site', s.id, liveFiles).map((x) => ({ ...x, url: photo(x.file) })) })),
];
const seed = {
  format: 1,
  created: new Date().toISOString(),
  categories: [...sectors.map((s) => ({ id: s.id, ru: s.title.ru, en: s.title.en })), { id: 'sites', ru: 'Сайты', en: 'Websites' }],
  services: services.map((s) => ({ id: s.id, path: `/services/${s.direction}/${s.id}/`, name: s.name.ru })),
  items,
};
await Promise.all(thumbs);
writeFileSync(join(out, 'seed.json'), JSON.stringify(seed));
console.log(`editor snapshot: ${items.length} items (${cases.length} cases + ${sites.length} sites) → dist/kejsy-proverka/seed.json`);
