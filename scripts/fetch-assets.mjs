// Downloads the 6 team photos from the old site into src/assets/team/member-N.jpg
// Usage: node scripts/fetch-assets.mjs   (Node 20+, cross-platform)
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OLD = 'https://cybermove-forward-motion.lovable.app';
const OUT = join(process.cwd(), 'src', 'assets', 'team');

// Known hashed file names at the time the kit was written.
const KNOWN = [
  '/assets/member-1-BfuP0Lq9.jpg',
  '/assets/member-2-u7ONgTMf.jpg',
  '/assets/member-3-rJamaXVV.jpg',
  '/assets/member-4-WZZwM0E7.jpg',
  '/assets/member-5-C6qhvpB-.jpg',
  '/assets/member-6-BBbagEoz.jpg',
];

async function discover() {
  // Hash names change on every redeploy of the old site — re-read them from /team if needed.
  try {
    const html = await (await fetch(`${OLD}/team`)).text();
    const found = [...new Set(html.match(/\/assets\/member-\d-[\w-]+\.(?:jpe?g|png|webp)/g) || [])];
    return found.sort();
  } catch {
    return [];
  }
}

async function download(path) {
  const res = await fetch(OLD + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(OUT, { recursive: true });
let list = KNOWN;
const results = [];
for (let pass = 0; pass < 2; pass++) {
  results.length = 0;
  let failed = 0;
  for (const p of list) {
    const n = p.match(/member-(\d)/)[1];
    try {
      const buf = await download(p);
      await writeFile(join(OUT, `member-${n}.jpg`), buf);
      results.push(`ok   member-${n}.jpg (${Math.round(buf.length / 1024)} KB)`);
    } catch (e) {
      failed++;
      results.push(`FAIL member-${n}: ${e.message}`);
    }
  }
  if (!failed) break;
  const found = await discover();
  if (!found.length) break;
  list = found;
}
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) {
  console.log('\nSome photos could not be downloaded. Use the monogram fallback (docs/02-design-system.md) and list it in REPORT.md.');
  process.exitCode = 0; // not fatal
}
