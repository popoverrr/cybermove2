// Background music: public/audio/ambient.mp3 (docs/10-fixes.md §6).
// 1) keeps an existing file; 2) otherwise tries the Suno CDN; 3) if ffmpeg is available, prepares the loop:
//    MP3 128 kbps, 105 s from 0:20 (past the intro), 1.5 s fade-in/out so the loop seam does not click.
// Usage: node scripts/fetch-audio.mjs [--prepare]   (Node 20+, any OS)
import { existsSync, mkdirSync, statSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ID = '79299bf0-43b4-48f2-bebc-7dad13731fab';
const out = join(process.cwd(), 'public/audio/ambient.mp3');
const prepare = process.argv.includes('--prepare');
mkdirSync(join(process.cwd(), 'public/audio'), { recursive: true });

async function download() {
  for (const host of ['cdn1', 'cdn2']) {
    const url = `https://${host}.suno.ai/${ID}.mp3`;
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://suno.com/' } });
      const type = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok && type.startsWith('audio/') && buf.length > 300 * 1024) {
        writeFileSync(out, buf);
        console.log(`downloaded ${url} (${Math.round(buf.length / 1024)} KB)`);
        return true;
      }
      console.log(`skip ${url}: HTTP ${res.status}, ${type || 'no type'}, ${buf.length} B`);
    } catch (e) { console.log(`skip ${url}: ${e.message}`); }
  }
  return false;
}

let have = existsSync(out);
if (have) console.log(`using existing ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
else have = await download();
if (!have) {
  console.log('\nCould not download the track. Open https://suno.com/s/ISudJuk3fpUFz7Mn → «⋯» → Download → MP3 Audio,');
  console.log('save it as public/audio/ambient.mp3 and run: node scripts/fetch-audio.mjs --prepare && npm run build');
}

if (have && prepare) {
  const ff = spawnSync('ffmpeg', ['-version']);
  if (ff.status !== 0) console.log('ffmpeg not found — the file is used as is');
  else {
  const tmp = out.replace(/\.mp3$/, '.tmp.mp3');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '20', '-t', '105', '-i', out,
    '-af', 'afade=t=in:st=0:d=1.5,afade=t=out:st=103.5:d=1.5', '-codec:a', 'libmp3lame', '-b:a', '128k', tmp], { stdio: 'inherit' });
  if (r.status === 0) {
    unlinkSync(out); renameSync(tmp, out);
    console.log(`prepared: ${Math.round(statSync(out).size / 1024)} KB`);
  }
  }
}
