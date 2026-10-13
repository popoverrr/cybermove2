// Render the service loops. Bundles once, then for each composition renders frames 1…LOOP
// (frame LOOP ≡ frame 0 of the loop; the very first WebGL frame of a session comes out before post-processing
// is ready, so it is skipped). Usage:
//   node render.mjs                    → all cards + heroes as MP4 (H.264) + WebM? (see FORMAT) into out/video
//   node render.mjs --sheet audit      → contact sheet of 8 frames per variant into out/sheet-<id>.png
//   node render.mjs --only audit,core  → limit to ids
import { bundle } from '@remotion/bundler';
import { renderMedia, renderFrames, selectComposition, getCompositions } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('../../node_modules/sharp');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? true) : null; };
const sheet = flag('--sheet');
const posters = flag('--posters');
const POSTER = 150; // a frame where every scene is fully built
const only = flag('--only');
const variants = (flag('--variants') || 'card,hero').split(',');
const LOOP = 240;
const chromiumOptions = { gl: 'angle' };

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), onProgress: () => {} });
const comps = await getCompositions(serveUrl, { chromiumOptions });
const ids = [...new Set(comps.map((c) => c.id.replace(/^(card|hero)-/, '')))].filter((id) => (sheet && sheet !== true ? id === sheet : !only || only.split(',').includes(id)));

for (const id of ids) {
  for (const v of variants) {
    const composition = await selectComposition({ serveUrl, id: `${v}-${id}`, chromiumOptions });
    const t0 = Date.now();
    if (sheet) {
      const dir = path.resolve(`out/sheet/${v}-${id}`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      await renderFrames({ composition, serveUrl, chromiumOptions, imageFormat: 'png', outputDir: dir, frameRange: [0, 225], everyNthFrame: 15, concurrency: 1,
        onStart: () => {}, onFrameUpdate: () => {} });
      // files are numbered 00…15 for frames 0, 15, 30…225; take 15, 45 … 225 (skip the warm-up frame 0)
      const files = fs.readdirSync(dir).filter((f) => /.(jpeg|png)$/.test(f)).sort();
      const pick = files.filter((_, i) => i % 2 === 1);
      const tw = v === 'card' ? 320 : 480, th = v === 'card' ? 400 : 270;
      const imgs = await Promise.all(pick.map((f) => sharp(path.join(dir, f)).resize(tw, th).toBuffer()));
      const cols = 4;
      await sharp({ create: { width: cols * (tw + 6), height: Math.ceil(imgs.length / cols) * (th + 6), channels: 3, background: '#ffffff' } })
        .composite(imgs.map((b, i) => ({ input: b, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) })))
        .jpeg({ quality: 85 }).toFile(`out/sheet-${v}-${id}.jpg`);
      console.log(`sheet ${v}-${id} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      continue;
    }
    fs.mkdirSync('out/video', { recursive: true });
    if (posters) {
      const dir = path.resolve(`out/poster-tmp/${v}-${id}`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      await renderFrames({ composition, serveUrl, chromiumOptions, imageFormat: 'png', outputDir: dir, frameRange: [0, POSTER], everyNthFrame: POSTER, concurrency: 1, onStart: () => {}, onFrameUpdate: () => {} });
      const last = fs.readdirSync(dir).filter((f) => /.(jpeg|png)$/.test(f)).sort().pop();
      await sharp(path.join(dir, last)).resize(v === 'card' ? 720 : 1280).webp({ quality: 82 }).toFile(`out/video/${v}-${id}.webp`);
      console.log(`poster ${v}-${id}`);
      continue;
    }
    await renderMedia({ composition, serveUrl, chromiumOptions, codec: 'h264', crf: 20, pixelFormat: 'yuv420p', x264Preset: 'slow', imageFormat: 'png',
      outputLocation: `out/video/${v}-${id}.mp4`, frameRange: [1, LOOP], concurrency: 1, muted: true, enforceAudioTrack: false });
    console.log(`video ${v}-${id} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}

// publish rendered loops into the site (public/motion/), unless this was a contact-sheet run
if (!sheet) {
  const dest = path.resolve('../../public/motion');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync('out/video')) if (/\.(mp4|webp)$/.test(f)) fs.copyFileSync(path.join('out/video', f), path.join(dest, f));
  console.log(`published → ${dest}`);
}
