import ru from '../../content/i18n/ru.json';
import en from '../../content/i18n/en.json';

// Adding a locale (e.g. `kk`) = one JSON file here + one entry in astro.config.mjs → i18n.locales.
export const dictionaries = { ru, en } as const;
export type Lang = keyof typeof dictionaries;
export const langs = Object.keys(dictionaries) as Lang[];
export const defaultLang: Lang = 'ru';

export const intlLocale: Record<Lang, string> = { ru: 'ru-RU', en: 'en-GB' };
export const ogLocale: Record<Lang, string> = { ru: 'ru_RU', en: 'en_US' };

/** Reads any value by dot path. A missing key fails the build. */
export function tv(lang: Lang, key: string): unknown {
  let node: unknown = dictionaries[lang];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in (node as object))) {
      throw new Error(`[i18n] Missing key "${key}" for lang "${lang}"`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (node === undefined || node === null || node === '') {
    throw new Error(`[i18n] Empty key "${key}" for lang "${lang}"`);
  }
  return node;
}

/**
 * Typography only (the words never change): in Russian, one- and two-letter words
 * («в», «с», «и», «на»…) are glued to the next word with a non-breaking space,
 * so they never hang at the end of a line.
 */
const SHORT_WORD = /(^|[\s«("—])([а-яёА-ЯЁ]{1,2}) (?=\S)/g;
const EN_ARTICLE = /(^|\s)(a|an|the|A|An|The) (?=\S)/g;
export function typo(lang: Lang, s: string): string {
  if (lang === 'en') return s.replace(EN_ARTICLE, '$1$2 ');
  if (lang !== 'ru') return s;
  // twice, so chains like «и в» are both glued
  return s.replace(SHORT_WORD, '$1$2 ').replace(SHORT_WORD, '$1$2 ');
}

const typoDeep = (lang: Lang, v: unknown): unknown =>
  typeof v === 'string' ? typo(lang, v)
    : Array.isArray(v) ? v.map((x) => typoDeep(lang, x))
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typoDeep(lang, x)]))
        : v;

/** String by dot path, with optional {placeholder} substitution. */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const v = tv(lang, key);
  if (typeof v !== 'string') throw new Error(`[i18n] Key "${key}" is not a string`);
  return typo(lang, vars ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : v);
}

/** Array/object by dot path. */
export function ta<T = unknown>(lang: Lang, key: string): T {
  return typoDeep(lang, tv(lang, key)) as T;
}

export type Localized<T = string> = { [K in Lang]: T };

/** Resolves a bilingual `{ ru, en }` data field. */
export function pick<T>(lang: Lang, field: Localized<T>): T {
  const v = field[lang];
  if (v === undefined || v === null) throw new Error(`[i18n] Missing "${lang}" value in data field`);
  return typoDeep(lang, v) as T;
}

export type PageKey = 'home' | 'services' | 'projects' | 'team' | 'about' | 'contact' | 'privacy';
export const pageSlugs: Record<PageKey, string> = {
  home: '',
  services: 'services/',
  projects: 'projects/',
  team: 'team/',
  about: 'about/',
  contact: 'contact/',
  privacy: 'privacy/',
};

/** Site base path from `BASE_PATH` (astro.config.mjs), always with a trailing slash: '/' or '/cybermove-site/'. */
export const base: string = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Root-relative URL of a file in `public/`: asset('og.png') → '/og.png' (or '/cybermove-site/og.png'). */
export function asset(path: string): string {
  return base + path.replace(/^\//, '');
}

/** Root-relative URL of a page in a language: url('en','services') → '/en/services/' (base path included). */
export function url(lang: Lang, page: PageKey, suffix = ''): string {
  const prefix = lang === defaultLang ? base : `${base}${lang}/`;
  return prefix + pageSlugs[page] + suffix;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'ru' ? 'en' : 'ru';
}
