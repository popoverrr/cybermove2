// Downloads the images of the current live site (cybermove.asia) listed in
// content/source/images.json into src/assets/live/<save_as>.
// Run BEFORE the new site replaces the old one on the domain.
// Usage: node scripts/fetch-live-images.mjs   (Node 20+, cross-platform)
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ORIGIN = 'https://cybermove.asia';
const OUT = join(process.cwd(), 'src', 'assets', 'live');
const list = JSON.parse(await readFile(join(process.cwd(), 'content', 'source', 'images.json'), 'utf8'));

await mkdir(OUT, { recursive: true });
const failed = [];
for (const img of list) {
  if (img.save_as.startsWith("dir-")) continue; // old-site backgrounds of the service areas are not used (docs/11-fixes-2.md §C)
  try {
    const res = await fetch(ORIGIN + img.path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error('not an image: ' + type);
    await writeFile(join(OUT, img.save_as), Buffer.from(await res.arrayBuffer()));
    console.log('ok  ', img.save_as);
  } catch (e) {
    failed.push(img.path);
    console.log('FAIL', img.path, String(e.message || e));
  }
}
console.log(`\n${list.length - failed.length}/${list.length} downloaded to src/assets/live/`);
if (failed.length) {
  console.log('Failed (hashed file names change when the old site is rebuilt — open the page on the live site, take the new <img src> and retry):');
  for (const f of failed) console.log('  ' + f);
  process.exitCode = 1;
}
