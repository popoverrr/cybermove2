// npm run editor:build — builds the case editor into dist/kejsy-proverka/ AFTER the site build (the site's pages
// are not touched; robots.txt gets «Disallow: /kejsy-proverka/»). Bundle: vanilla JS + fflate (esbuild, no CDN).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const here = join(root, 'tools/case-editor');
const out = join(root, 'dist/kejsy-proverka');
if (!existsSync(join(root, 'dist/index.html'))) { console.error('dist/ is empty — run npm run build first'); process.exit(2); }
const keep = new Set(['seed.json', 'site-photos']);
if (existsSync(out)) for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(join(out, f), { recursive: true, force: true });
mkdirSync(join(out, 'lib'), { recursive: true }); mkdirSync(join(out, 'fonts'), { recursive: true });

const V = Date.now().toString(36);
await build({ entryPoints: [join(here, 'src/app.js')], bundle: true, splitting: true, format: 'esm', outdir: out, minify: true, target: ['es2020', 'safari15', 'chrome90'], legalComments: 'none', chunkNames: 'chunk-[hash]', logLevel: 'warning' });

// colour tokens from the site's design system
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const vars = [...new Set(tokens.match(/--(c-[a-z-]+|accent|accent-ink):\s*#[0-9A-Fa-f]{3,8};/g) ?? [])].join(' ');
writeFileSync(join(out, 'app.css'), `:root { ${vars} }\n` + readFileSync(join(here, 'src/app.css'), 'utf8'));
writeFileSync(join(out, 'app.html'), readFileSync(join(here, 'src/app.html'), 'utf8').replaceAll('__V__', V));
const fonts = { 'inter-cyr.woff2': 'inter/files/inter-cyrillic-wght-normal.woff2', 'inter-lat.woff2': 'inter/files/inter-latin-wght-normal.woff2',
  'jb-lat.woff2': 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'jb-cyr.woff2': 'jetbrains-mono/files/jetbrains-mono-cyrillic-wght-normal.woff2' };
for (const [to, from] of Object.entries(fonts)) copyFileSync(join(root, 'node_modules/@fontsource-variable', from), join(out, 'fonts', to));

// server
for (const f of ['api.php', 'index.php', 'store.php', 'config.example.php']) copyFileSync(join(here, 'server', f), join(out, f));
copyFileSync(join(here, 'server/lib/boot.php'), join(out, 'lib/boot.php'));
writeFileSync(join(out, 'lib/.htaccess'), 'Require all denied\n');
copyFileSync(join(here, 'server/htaccess.txt'), join(out, '.htaccess'));
if (existsSync(join(here, 'config.php'))) copyFileSync(join(here, 'config.php'), join(out, 'config.php'));
else console.warn('⚠ tools/case-editor/config.php is missing — the owner password is not set (npm run editor:password)');

// seed + photos of the site
execFileSync(process.execPath, [join(here, 'snapshot.mjs')], { stdio: 'inherit' });

// robots: keep the editor out of search
const robots = join(root, 'dist/robots.txt');
let r = existsSync(robots) ? readFileSync(robots, 'utf8') : 'User-agent: *\nAllow: /\n';
if (!r.includes('/kejsy-proverka/')) { r = r.replace(/(User-agent: \*\n)/, '$1Disallow: /kejsy-proverka/\n'); writeFileSync(robots, r); }

const js = readdirSync(out).filter((f) => f.endsWith('.js'));
const gz = js.map((f) => gzipSync(readFileSync(join(out, f))).length).reduce((a, b) => a + b, 0);
console.log(`case editor → dist/kejsy-proverka/ (JS ${js.length} files, ${(gz / 1024).toFixed(1)} KB gzip)`);
