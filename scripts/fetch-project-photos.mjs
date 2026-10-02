// Downloads the project photos from the old site into src/assets/projects/<id>.<ext>
// and writes "photo": "<id>.<ext>" into content/data/projects.json (null when a download fails,
// so that project keeps its generated cover).
// Usage: node scripts/fetch-project-photos.mjs   (Node 20+, cross-platform)
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const OLD = 'https://cybermove-forward-motion.lovable.app';
const OUT = join(process.cwd(), 'src', 'assets', 'projects');
const DATA = join(process.cwd(), 'content', 'data', 'projects.json');

const PHOTOS = {
  usyk: '/__l5e/assets-v1/739fed82-1930-45e3-b31c-0b1ddbcfbe97/usyk.webp',
  udar: '/__l5e/assets-v1/ba7fd4a8-ca01-473b-a2c8-bb467edac6d4/udar.png',
  ukrradio: '/assets/ukrainske-radio-DM7kXKB8.jpg',
  baryshevsky: '/__l5e/assets-v1/7f579ef0-d8cf-48a0-8be6-be45b12d98c6/oleg-baryshevsky.jpg',
  tsepukh: '/__l5e/assets-v1/84f44555-dd53-4bd1-9973-3411efcc3c3d/tsepukh-p.jpg',
  kehhsha: '/__l5e/assets-v1/eeb3cdf9-a5d0-4b85-a0b7-0597788fedb0/kehhsha.jpg',
  yankovskaya: '/__l5e/assets-v1/ce77666e-9276-4066-b325-147053ecc4d1/yankovskaya-olga.jpg',
  sverona: '/__l5e/assets-v1/356df3c0-d591-4b0f-ba88-283e600004b3/misssverona.jpg',
  meshtiish: '/__l5e/assets-v1/4bf82fbd-1514-4954-8553-3a8570555e08/meshtiish.jpg',
  edu: '/__l5e/assets-v1/be438761-9f83-4b12-973f-7b45523bb24f/education-production.png',
  sii: '/__l5e/assets-v1/86772b62-e867-4bb9-bfc8-2bf27555b939/sii-concept.jpg',
  intertop: '/__l5e/assets-v1/56858f07-db76-40c8-856c-be46302ab596/intertop-spex.png',
  goodmarket: '/__l5e/assets-v1/30b8044c-31ce-4b03-92a6-90c1bb254ed9/good-market.png',
  ecom: '/assets/ecommerce-B1oL3X7W.jpg',
  maharadj: '/__l5e/assets-v1/e5ee504c-5184-45d9-a962-e6e7b1f8b361/maharadj.png',
  'maharadj-spa': '/__l5e/assets-v1/5ba7a1eb-71ea-4c26-a80d-ea667f1258d9/maharadj-spa.png',
  toscana: '/assets/toscana-9b-Z3xYO.jpg',
  gaia: '/__l5e/assets-v1/c7063509-4208-4d59-9309-c6814d13854e/gaia.jpg',
  barbers: '/__l5e/assets-v1/55812b31-67ca-4b26-bd7f-b197ee7a47fe/barbershops.png',
  'fitness-menden': '/__l5e/assets-v1/7794f923-977d-41af-8d07-2fc4437892ab/fitness-room-menden.jpg',
  ufw: '/__l5e/assets-v1/0d0da331-ae46-4d16-8c91-27e595f3e1b8/ufw.jpg',
  vandog: '/__l5e/assets-v1/c5dd3ca0-3dc7-4498-aeb8-2781d60b9014/vandog.png',
  artmango: '/__l5e/assets-v1/e01938a1-6a39-4837-a2ea-4705e7856334/art-mango.png',
  brsm: '/assets/brsm-nafta-CZWbyzNQ.jpg',
  tpk: '/__l5e/assets-v1/d92d7786-18a1-49e4-ac38-1e4cca834c3e/tpk.jpg',
  mpe: '/__l5e/assets-v1/2a5b759a-a07d-4ffc-be0b-e6a5b268eabf/medical-protective-equipment-photo.png',
  hydrosta: '/assets/hydrosta-AIJ1E8ne.jpg',
  hsta: '/assets/hsta-Ds6EMmvA.jpg',
  'hydrosta-service': '/assets/hydrosta-service-55Z09wem.jpg',
  buildingtime: '/__l5e/assets-v1/e0677361-52b8-4326-9eac-515c132ad271/buildingtime.png',
  morris: '/__l5e/assets-v1/a01ea14f-96ff-4c18-bce0-9b27a7dd57aa/morris-group.png',
  furniture: '/__l5e/assets-v1/94f02ee4-6e62-4a34-90ab-e5c43f3fcccd/furniture-factory.png',
  apicapsules: '/__l5e/assets-v1/f570b32b-8d59-4ee2-aa67-ad787b66a2fd/apicapsules-cover.jpg',
  'cybermove-games': '/assets/cybermove-games-B0QeT7Rn.jpg',
};

/** JSON.stringify with the kit's compact style: string arrays and small { ru, en } objects on one line. */
export function compactJson(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\[\n\s+((?:"(?:[^"\\]|\\.)*",?\n\s+)+)\]/g, (_, inner) => `[${inner.trim().split(/,?\n\s+/).join(', ').replace(/,$/, '')}]`)
    .replace(/\{\n\s+"ru": ((?:"(?:[^"\\]|\\.)*")|\[[^\]\n]*\]),\n\s+"en": ((?:"(?:[^"\\]|\\.)*")|\[[^\]\n]*\])\n\s+\}/g, '{ "ru": $1, "en": $2 }');
}

// Detect the real format from the file header (the URL extension is not always trustworthy).
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.slice(0, 4).toString('hex') === '89504e47') return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.slice(4, 12).toString().includes('ftypavif')) return 'avif';
  return null;
}

async function download(path) {
  const res = await fetch(OLD + path, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error(`not an image (${res.headers.get('content-type')})`);
  if (buf.length < 2048) throw new Error(`too small (${buf.length} B)`);
  return { buf, ext };
}

await mkdir(OUT, { recursive: true });
const data = JSON.parse(await readFile(DATA, 'utf8'));
const lines = [];
let failed = 0;
for (const p of data.items) {
  const path = PHOTOS[p.id];
  if (!path) { p.photo = null; lines.push(`skip ${p.id}: no URL`); failed++; continue; }
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      const { buf, ext } = await download(path);
      const file = `${p.id}.${ext}`;
      await writeFile(join(OUT, file), buf);
      p.photo = file;
      lines.push(`ok   ${file} (${Math.round(buf.length / 1024)} KB)`);
      ok = true;
    } catch (e) {
      if (attempt === 2) { p.photo = null; failed++; lines.push(`FAIL ${p.id}: ${e.message}`); }
    }
  }
}

// Write back, keeping "photo" right after "monogram" for readability.
data.items = data.items.map((p) => {
  const { photo, ...rest } = p;
  const out = {};
  for (const [k, v] of Object.entries(rest)) { out[k] = v; if (k === 'monogram') out.photo = photo; }
  return out;
});
await writeFile(DATA, compactJson(data) + '\n');

console.log(lines.join('\n'));
console.log(`\n${data.items.length - failed} downloaded, ${failed} failed.`);
if (failed) console.log('Projects without a photo keep the generated cover (monogram + lines). List them in REPORT.md.');
