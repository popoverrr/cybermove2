// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { hostingFiles } from './scripts/astro-hosting.mjs';
import { execSync } from 'node:child_process';

// date of the last content change (git), not of the build — for <lastmod> of non-article pages
let CONTENT_DATE = new Date().toISOString().slice(0, 10);
try { CONTENT_DATE = execSync('git log -1 --format=%cs -- content src/components src/content', { encoding: 'utf8' }).trim() || CONTENT_DATE; } catch { /* no git */ }

const company = JSON.parse(readFileSync(new URL('./content/data/company.json', import.meta.url), 'utf8'));

// Deployment address comes from the environment: set these in the shell or in `.env` (see `.env.example`).
// SITE_URL  — origin only, e.g. https://cybermove.kz or https://<user>.github.io.
//             Falls back to `company.json → domain`, then to a placeholder.
// BASE_PATH — sub-path the site is served from, e.g. /cybermove-site/ for GitHub Pages. Default: /
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const SITE = (env.SITE_URL || company.domain || 'https://cybermove.example').replace(/\/+$/, '');
const BASE = `/${(env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never', assets: '_astro' },
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  prefetch: false,
  integrations: [
    hostingFiles(),
  ],
  vite: {
    define: { 'import.meta.env.CONTENT_DATE': JSON.stringify(CONTENT_DATE) },
    build: { assetsInlineLimit: 0 },
  },
});
