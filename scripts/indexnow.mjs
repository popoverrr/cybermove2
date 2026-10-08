// IndexNow (Bing, Yandex, …): after a deploy, sends the addresses whose <lastmod> changed since the last run.
//   npm run indexnow            changed addresses only (state in deploy/.indexnow-state.json)
//   npm run indexnow -- --all   every address of the sitemaps
// Needs content/data/seo.json → indexNowKey (the key file <key>.txt is written into dist/ by the build).
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const seo = JSON.parse(await readFile(join(root, 'content/data/seo.json'), 'utf8'));
const company = JSON.parse(await readFile(join(root, 'content/data/company.json'), 'utf8'));
const key = seo.indexNowKey;
if (!key) { console.log('indexnow: content/data/seo.json → indexNowKey is empty, nothing to do'); process.exit(0); }
const site = company.domain.replace(/\/$/, '');
const host = new URL(site).host;
const statePath = join(root, 'deploy/.indexnow-state.json');
const state = await access(statePath).then(() => readFile(statePath, 'utf8').then(JSON.parse), () => ({}));

const urls = [];
for (const f of ['sitemap-pages.xml', 'sitemap-insights.xml']) {
  const xml = await readFile(join(root, 'dist', f), 'utf8').catch(() => '');
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) urls.push({ loc: m[1], lastmod: m[2] ?? '' });
}
if (!urls.length) { console.error('indexnow: no dist/sitemap-*.xml — run npm run build first'); process.exit(1); }
const changed = process.argv.includes('--all') ? urls : urls.filter((u) => state[u.loc] !== u.lastmod);
if (!changed.length) { console.log('indexnow: nothing changed since the last run'); process.exit(0); }

// the key file must be reachable on the live site
const keyUrl = `${site}/${key}.txt`;
const probe = await fetch(keyUrl).then((r) => r.ok && r.text()).catch(() => null);
if (!probe || probe.trim() !== key) { console.error(`indexnow: ${keyUrl} is not reachable — deploy first`); process.exit(1); }

for (let i = 0; i < changed.length; i += 10000) {
  const batch = changed.slice(i, i + 10000);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: keyUrl, urlList: batch.map((u) => u.loc) }),
  });
  console.log(`indexnow: ${batch.length} addresses → HTTP ${res.status}`);
  if (res.status >= 300 && res.status !== 202) process.exit(1);
}
for (const u of urls) state[u.loc] = u.lastmod;
await writeFile(statePath, JSON.stringify(state, null, 1));
