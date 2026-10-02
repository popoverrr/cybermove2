// Reports gzip sizes of JS and CSS per page (as loaded by each HTML file) and font totals.
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
const dist = join(process.cwd(), 'dist');
async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const gz = async (p) => gzipSync(await readFile(p)).length;
const cache = new Map();
async function deps(file, seen = new Set()) {
  // follow static JS imports of an entry chunk
  if (seen.has(file)) return seen; seen.add(file);
  const src = await readFile(join(dist, file), 'utf8');
  for (const m of src.matchAll(/(?:import|from)\s*["']\.?\/?([^"']+\.js)["']/g)) {
    const f = m[1].startsWith('_astro/') ? '/' + m[1] : '/_astro/' + m[1].replace(/^\.\//, '');
    await deps(f, seen);
  }
  return seen;
}
const rows = [];
for (const file of await walk(dist)) {
  const html = await readFile(file, 'utf8');
  const js = new Set(), css = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) for (const f of await deps(m[1])) js.add(f);
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) css.add(m[1]);
  let jsz = 0, cssz = 0;
  for (const f of js) { if (!cache.has(f)) cache.set(f, await gz(join(dist, f))); jsz += cache.get(f); }
  for (const f of css) { if (!cache.has(f)) cache.set(f, await gz(join(dist, f))); cssz += cache.get(f); }
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('');
  rows.push({ page: file.replace(dist, '').replaceAll('\\', '/'), 'JS gz KB': ((jsz + gzipSync(inline).length) / 1024).toFixed(1), 'CSS gz KB': (cssz / 1024).toFixed(1), 'HTML gz KB': (gzipSync(html).length / 1024).toFixed(1) });
}
console.table(rows);
const fonts = (await readdir(join(dist, '_astro'))).filter((f) => f.endsWith('.woff2'));
let ru = 0, en = 0;
for (const f of fonts) {
  const s = (await readFile(join(dist, '_astro', f))).length;
  if (/latin-ext/.test(f)) continue; // only downloaded when ₸ / rare letters are present
  if (/cyrillic/.test(f)) ru += s; else { ru += s; en += s; }
}
console.log(`Fonts downloaded on a typical RU page: ${(ru / 1024).toFixed(0)} KB, EN page: ${(en / 1024).toFixed(0)} KB`);
