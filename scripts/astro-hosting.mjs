// Astro integration: after the build, writes the hosting files that depend on the built output.
// - dist/.htaccess: fills in the CSP hash(es) of inline scripts (the boot script in Base.astro)
// - dist/robots.txt: with the absolute sitemap URL for the configured `site`
// - deploy/nginx.conf.txt: the nginx equivalent of .htaccess for nginx-only Plesk hosting
import { readFile, writeFile, readdir, mkdir, stat, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export function hostingFiles() {
  let site = '';
  let base = '/';
  return {
    name: 'cybermove-hosting',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = String(config.site || '').replace(/\/$/, '');
        base = String(config.base || '/').replace(/\/?$/, '/');
      },
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const hashes = new Set();
        for (const f of await htmlFiles(dist)) {
          const html = await readFile(f, 'utf8');
          for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
            hashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
          }
        }
        // Drop original images Vite emitted but no page references (only the optimised avif/webp/jpg variants are used).
        const astroDir = join(dist, '_astro');
        const texts = [];
        const collect = async (d) => {
          for (const e of await readdir(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) await collect(p);
            else if (/\.(html|css|js|xml|webmanifest|txt)$/.test(e.name)) texts.push(await readFile(p, 'utf8'));
          }
        };
        await collect(dist);
        const all = texts.join('\n');
        let removed = 0, freed = 0;
        for (const name of await readdir(astroDir)) {
          if (!/\.(png|jpe?g|webp|avif)$/i.test(name) || all.includes(name)) continue;
          const p = join(astroDir, name);
          freed += (await stat(p)).size;
          await unlink(p);
          removed++;
        }
        if (removed) logger.info(`removed ${removed} unreferenced original images (${(freed / 1048576).toFixed(1)} MB)`);

        const csp = [...hashes].join(' ');
        const htPath = join(dist, '.htaccess');
        const ht = (await readFile(htPath, 'utf8')).replace('__CSP_SCRIPT_HASHES__', csp);
        await writeFile(htPath, ht);

        await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}${base}sitemap-index.xml\n`);

        const cspLine = (ht.match(/Content-Security-Policy "([^"]+)"/) || [])[1] || '';
        const nginx = `# CYBERMOVE — nginx directives (use ONLY if the Plesk site runs without Apache, i.e. .htaccess is ignored).
# Plesk → Websites & Domains → Apache & nginx Settings → "Additional nginx directives". Paste everything below.

error_page 404 /404.html;

if ($host ~* ^www\.(.+)$) { return 301 https://$1$request_uri; }

location ~* ^/(approach)/?$ { return 301 /about/; }
location ~* ^/(partners)/?$ { return 301 /cases/; }
location ~* ^/(marketing|brand-development)/?$ { return 301 /services/; }
location ~* ^/(en/)?projects/?$ { return 301 /$1cases/; }
location ~* ^/(en/)?team/?$ { return 301 /$1about/; }
location ~* ^/(en/)?sites/?$ { return 301 /$1cases/#sites; }
location ~ ^/(en/)?((services|cases|insights)(/[\\w-]+){0,2}|about|contact|privacy)$ { return 301 /$1$2/; }

location ^~ /_astro/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}
location ~* \\.(woff2|avif|webp|jpg|jpeg|png|svg|ico)$ {
  add_header Cache-Control "public, max-age=604800";
  try_files $uri =404;
}

add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "${cspLine}" always;

gzip on;
gzip_types text/css application/javascript text/javascript application/json image/svg+xml application/manifest+json;
`;
        const deployDir = fileURLToPath(new URL('../deploy/', import.meta.url));
        await mkdir(deployDir, { recursive: true });
        await writeFile(join(deployDir, 'nginx.conf.txt'), nginx);
        logger.info(`CSP hashes: ${csp || '(none)'}; robots.txt and deploy/nginx.conf.txt written`);
        await writeSitemaps(dist, site, logger);
        await writeVerificationFiles(dist, logger);
      },
    },
  };
}

/* ── Sitemaps (docs/16-seo.md §A.6): built from the pages themselves — only indexable pages whose canonical is
   their own address; <lastmod> = content date (article:modified_time or cm:lastmod), hreflang alternates from <head>,
   articles in a separate sitemap-insights.xml with their cover (image:image). ── */
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function writeSitemaps(dist, site, logger) {
  const pages = [];
  for (const f of await htmlFiles(dist)) {
    const html = await readFile(f, 'utf8');
    if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (!canonical || canonical.endsWith('.html')) continue;
    const rel = f.slice(dist.length).replace(/\\/g, '/').replace(/^\/?/, '/').replace(/index\.html$/, '');
    if (new URL(canonical).pathname !== rel) continue; // a redirect stub or a page canonicalised elsewhere
    const lastmod = ((html.match(/<meta property="article:modified_time" content="([^"]+)"/) || html.match(/<meta name="cm:lastmod" content="([^"]+)"/)) || [])[1];
    const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    const isArticle = /<meta property="og:type" content="article"/.test(html);
    const image = isArticle ? (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] : null;
    const cover = isArticle ? (html.match(/<meta name="cm:cover" content="([^"]+)"/) || [])[1] : null;
    const title = isArticle ? (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] : null;
    pages.push({ loc: canonical, lastmod, alts, isArticle, images: [cover, image].filter(Boolean), title, insights: /\/insights\//.test(rel) });
  }
  pages.sort((a, b) => a.loc.localeCompare(b.loc));
  const urlXml = (p) => `  <url>
    <loc>${xmlEsc(p.loc)}</loc>${p.lastmod ? `
    <lastmod>${p.lastmod.slice(0, 10)}</lastmod>` : ''}${p.alts.map(([l, h]) => `
    <xhtml:link rel="alternate" hreflang="${l}" href="${xmlEsc(h)}"/>`).join('')}${p.images.map((i) => `
    <image:image><image:loc>${xmlEsc(i)}</image:loc></image:image>`).join('')}
  </url>`;
  const set = (list) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${list.map(urlXml).join('\n')}
</urlset>
`;
  const ins = pages.filter((p) => p.insights), rest = pages.filter((p) => !p.insights);
  const newest = (list) => list.map((p) => p.lastmod || '').sort().at(-1)?.slice(0, 10);
  await writeFile(join(dist, 'sitemap-pages.xml'), set(rest));
  await writeFile(join(dist, 'sitemap-insights.xml'), set(ins));
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[['sitemap-pages.xml', newest(rest)], ['sitemap-insights.xml', newest(ins)]].map(([n, d]) => `  <sitemap><loc>${site}/${n}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</sitemap>`).join('\n')}
</sitemapindex>
`;
  await writeFile(join(dist, 'sitemap-index.xml'), index);
  for (const old of ['sitemap-0.xml']) await unlink(join(dist, old)).catch(() => {});
  logger.info(`sitemaps: ${rest.length} pages + ${ins.length} insights pages`);
}

/* ── Search engine verification (docs/16-seo.md §B): content/data/seo.json; empty values → nothing written ── */
async function writeVerificationFiles(dist, logger) {
  const seo = JSON.parse(await readFile(new URL('../content/data/seo.json', import.meta.url), 'utf8'));
  const g = seo.googleHtmlFile || {};
  if (g.name && /^google[\w-]+\.html$/.test(g.name)) await writeFile(join(dist, g.name), g.content || `google-site-verification: ${g.name}`);
  if (seo.indexNowKey && /^[a-zA-Z0-9-]{8,128}$/.test(seo.indexNowKey)) await writeFile(join(dist, `${seo.indexNowKey}.txt`), seo.indexNowKey);
  logger.info(`verification: google meta ${seo.googleSiteVerification ? 'on' : 'off'}, google file ${g.name ? 'on' : 'off'}, yandex ${seo.yandexVerification ? 'on' : 'off'}, bing ${seo.bingVerification ? 'on' : 'off'}, IndexNow ${seo.indexNowKey ? 'on' : 'off'}`);
}
