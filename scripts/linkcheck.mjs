// Crawls every internal <a href>/<link href>/src in dist/*.html and checks that the target file exists.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
const dist = join(process.cwd(), 'dist');
async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const exists = async (p) => { try { const s = await stat(p); return s.isDirectory() ? exists(join(p, 'index.html')) : true; } catch { return false; } };
let checked = 0; const broken = [];
for (const file of await walk(dist)) {
  const html = await readFile(file, 'utf8');
  const refs = [...html.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));
  for (let ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|#|javascript:)/.test(ref)) continue;
    ref = ref.split('#')[0].split('?')[0];
    if (!ref) continue;
    const target = ref.startsWith('/') ? join(dist, decodeURIComponent(ref)) : join(dirname(file), decodeURIComponent(ref));
    checked++;
    if (!(await exists(target))) broken.push(`${file.replace(dist, '')} → ${ref}`);
  }
}
console.log(`linkcheck: ${checked} internal references checked, ${broken.length} broken`);
if (broken.length) { console.log(broken.join('\n')); process.exit(1); }
