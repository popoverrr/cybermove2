// One list of «Разборы» for every page (docs/16-seo.md): the 12 legacy articles (RU + EN, meta from
// content/data/insights.json) and the SEO articles (RU only, full frontmatter). SEO articles appear only when
// published: `draft: false` and `publishDate` ≤ the build date (BUILD_DATE=YYYY-MM-DD overrides «today» in Almaty).
// Unpublished articles get no page, no list entry, no sitemap line, and links to them are unwrapped (no 404s).
import { getCollection, type CollectionEntry } from 'astro:content';
import { insights as legacyMeta, directionById, serviceById, type InsightMeta } from './content';
import { pick, intlLocale, type Lang } from './i18n';

export interface Article {
  id: string;
  lang: Lang;
  direction: string;
  /** route without the language prefix */
  route: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  published: Date;
  updated: Date;
  minutes: number;
  isNew: boolean;
  /** an EN version exists (legacy articles only) */
  hasEn: boolean;
  keywords: string[];
  primaryKeyword?: string;
  /** site-absolute service page, e.g. /services/systems/crm/ */
  serviceLink?: string;
  related: string[];
  author: string;
  coverAlt: string;
  entry: CollectionEntry<'insights'>;
  legacy?: InsightMeta;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
function today(): string {
  const env = (import.meta.env.BUILD_DATE as string | undefined) || process.env.BUILD_DATE;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const buildDate = today();

const legacyService = (m: InsightMeta, e: CollectionEntry<'insights'>) => {
  const s = e.data.services[0];
  if (!s) return `/services/${m.direction}/`;
  const svc = serviceById(s);
  return `/services/${svc.direction}/${svc.id}/`;
};

let cache: Promise<Record<Lang, Article[]>> | null = null;
async function load(): Promise<Record<Lang, Article[]>> {
  const all = await getCollection('insights');
  const out: Record<Lang, Article[]> = { ru: [], en: [] };
  for (const e of all) {
    const [lang, dir, slug] = e.id.split('/') as [Lang, string, string];
    const d = e.data;
    const legacy = legacyMeta.find((m) => m.id === slug);
    if (legacy && d.date) {
      const seo = pick(lang, legacy.seo);
      const minutes = parseInt(pick(lang, legacy.read), 10) || 6;
      out[lang].push({
        id: slug, lang, direction: legacy.direction, route: `insights/${legacy.direction}/${slug}/`,
        title: pick(lang, legacy.title), seoTitle: seo.title, description: seo.description, excerpt: pick(lang, legacy.excerpt),
        published: d.date, updated: d.updatedDate ?? d.date, minutes, isNew: false, hasEn: true,
        // legacy articles: the key phrase that opens their SEO title
        keywords: d.keywords.length ? d.keywords : [seo.title.split(/[:—–]/)[0].trim()], primaryKeyword: d.primaryKeyword, serviceLink: d.serviceLink ?? legacyService(legacy, e),
        related: [...d.related, ...legacy.more], author: d.author, coverAlt: d.cover?.alt ?? pick(lang, legacy.title), entry: e, legacy,
      });
      continue;
    }
    if (lang !== 'ru' || !d.publishDate || d.draft) continue;
    if (iso(d.publishDate) > buildDate) continue;
    const direction = d.rubric ?? d.direction ?? dir;
    directionById(direction);
    const words = (e.body ?? '').split(/\s+/).filter(Boolean).length;
    out.ru.push({
      id: slug, lang, direction, route: `insights/${direction}/${slug}/`,
      title: d.title, seoTitle: d.seoTitle ?? d.title,
      description: d.description, excerpt: d.description,
      published: d.publishDate, updated: d.updatedDate && d.updatedDate > d.publishDate ? d.updatedDate : d.publishDate,
      minutes: d.readingMinutes ?? Math.max(3, Math.round(words / 180)), isNew: true, hasEn: false,
      keywords: d.keywords, primaryKeyword: d.primaryKeyword, serviceLink: d.serviceLink, related: d.related, author: d.author,
      coverAlt: d.cover?.alt ?? d.title, entry: e,
    });
  }
  for (const l of Object.keys(out) as Lang[]) out[l].sort((a, b) => +b.published - +a.published || a.title.localeCompare(b.title));
  return out;
}

/** Published articles of a language, newest first. */
export async function articles(lang: Lang): Promise<Article[]> {
  cache ??= load();
  return (await cache)[lang];
}
export async function articleById(lang: Lang, id: string) {
  return (await articles(lang)).find((a) => a.id === id);
}
/** ids of every article in the collection, published or not (to tell «unpublished» from «broken» links) */
export async function allSlugs(): Promise<Set<string>> {
  return new Set((await getCollection('insights')).map((e) => e.id.split('/').pop()!));
}

export const fmtDate = (lang: Lang, d: Date) => new Intl.DateTimeFormat(intlLocale[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
export const isoDate = iso;
export const readLabel = (lang: Lang, n: number) => (lang === 'ru' ? `${n} мин чтения` : `${n} min read`);

/** Articles about a service page (its serviceLink), then the rest of its rubric — for «Разборы по теме». */
export async function articlesFor(lang: Lang, opts: { service?: string; direction: string; limit?: number }) {
  const list = await articles(lang);
  const svcPath = opts.service ? `/services/${opts.direction}/${opts.service}/` : null;
  const exact = svcPath ? list.filter((a) => a.serviceLink === svcPath) : [];
  const rest = list.filter((a) => a.direction === opts.direction && !exact.includes(a));
  return [...exact, ...rest].slice(0, opts.limit ?? 6);
}

/** «Читайте также»: manual `related` first, then by rubric and shared keywords. */
export async function relatedTo(a: Article, n = 3) {
  const list = (await articles(a.lang)).filter((x) => x.id !== a.id);
  const picked: Article[] = [];
  for (const id of a.related) { const x = list.find((y) => y.id === id); if (x && !picked.includes(x)) picked.push(x); }
  const kw = new Set(a.keywords.map((k) => k.toLowerCase()));
  const score = (x: Article) => (x.direction === a.direction ? 2 : 0) + (x.serviceLink && x.serviceLink === a.serviceLink ? 2 : 0) + x.keywords.filter((k) => kw.has(k.toLowerCase())).length;
  for (const x of [...list].sort((p, q) => score(q) - score(p))) { if (picked.length >= n) break; if (!picked.includes(x)) picked.push(x); }
  return picked.slice(0, n);
}

/** Real authors (src/content/authors/<slug>.md frontmatter: name, role, photo, sameAs) — none until the owner adds them. */
export interface Author { id: string; name: string; role: string; photo?: string; sameAs: string[] }
const authorFiles = import.meta.glob<{ frontmatter: Omit<Author, 'id'> }>('/src/content/authors/*.md', { eager: true });
export const authors: Author[] = Object.entries(authorFiles).map(([p, m]) => ({ id: p.split('/').pop()!.replace(/\.md$/, ''), sameAs: [], ...m.frontmatter }));

export const rubricName = (lang: Lang, id: string) => pick(lang, directionById(id).name);
