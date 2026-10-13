// Phone cut of every card loop: 720×900, CRF 23 (~1 MB) from the 1080×1350 master, via Remotion's bundled ffmpeg.
// Phones (< 600 px) play card-<id>-m.mp4 both in the ribbon and in the hero of service pages.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'out/video';
const dest = path.resolve('../../public/motion');
for (const f of fs.readdirSync(dir).filter((x) => /^card-.+(?<!-m)\.mp4$/.test(x))) {
  const out = path.join(dir, f.replace(/\.mp4$/, '-m.mp4'));
  execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, f), '-vf', 'scale=720:900:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], { stdio: 'inherit', shell: true });
  fs.copyFileSync(out, path.join(dest, path.basename(out)));
  console.log(`mobile ${path.basename(out)} ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}
