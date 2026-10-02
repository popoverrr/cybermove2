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

location ~* ^/(approach)/?$ { return 301 /about/; }
location ~* ^/(partners)/?$ { return 301 /projects/; }
location ~* ^/(marketing|brand-development)/?$ { return 301 /services/; }
location ~* ^/services/.+ { return 301 /services/; }
location ~* ^/en/services/.+ { return 301 /en/services/; }
location ~ ^/(en/)?(services|projects|team|about|contact|privacy)$ { return 301 /$1$2/; }

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
      },
    },
  };
}
