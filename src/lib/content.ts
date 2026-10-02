// Typed loaders for content/data/*.json. The data files are generated from the live-site export
// (content/source/) by scripts/import-source.mjs — edit the source, not the JSON, when texts change.
import companyJson from '../../content/data/company.json';
import contactsJson from '../../content/data/contacts.json';
import geographyJson from '../../content/data/geography.json';
import directionsJson from '../../content/data/directions.json';
import servicesJson from '../../content/data/services.json';
import casesJson from '../../content/data/cases.json';
import sectorsJson from '../../content/data/sectors.json';
import insightsJson from '../../content/data/insights.json';
import orbitJson from '../../content/data/core-orbit.json';
import sitesJson from '../../content/data/sites.json';
import type { Localized } from './i18n';

export interface Company { brand: string; legalName: string; domain: string | null; tagline: Localized; foundedYear: number | null }

interface Channel { number?: string; display?: string; url?: string; handle?: string }
export interface Contacts {
  whatsapp: { number: string; display: string; url: string };
  phone: { number: string; display: string } | null;
  email: string | null;
  formEmail: string | null;
  telegram: string | Channel | null;
  instagram: string | Channel | null;
  linkedin: string | Channel | null;
  address: Localized | string | null;
}

export interface Region { id: string; label: Localized }
export interface City { id: string; region: string; name: string; lat: number; lon: number }

interface Seo { title: string; description: string; h1: string }
export interface Direction {
  id: string; index: string; stage: string;
  name: Localized; nameFull: Localized; kicker: Localized; thesis: Localized; lead: Localized;
  metrics: string; codes: string; intro: Localized<string[]>; result: Localized;
  services: string[]; cases: string[]; insights: string[]; seo: Localized<Seo>;
}
export interface Titled { t: string; d: string }
export interface Service {
  id: string; direction: string; index: string;
  /** display title (= title); seoTitle — the live-site name, kept for JSON-LD alternateName */
  name: Localized; title: Localized; seoTitle: Localized; line: Localized; points: Localized<string[]>; lead: Localized; intro: Localized<string[]>;
  includes: Localized<Titled[]>;
  steps: Localized<{ stage: string; t: string; d: string; time: string | null }[]>;
  stepsNote: Localized<string | null>; timeLabel: Localized<string | null>;
  result: Localized<string[]>; forWhom: Localized<Titled[]>;
  cases: string[]; faq: Localized<{ q: string; a: string }[]>; insights: string[]; seo: Localized<Seo>;
}
export type CaseBlock =
  | { kind: 'vessel'; title: string; rows: { k: string; v: string; note: string | null }[]; former: string | null; source: { text: string; href: string } | null }
  | { kind: string; title: string; paras: string[]; items: string[]; numbered: boolean };
export interface Case {
  id: string; n: string; rank: number; sector: string;
  name: Localized; cardName: Localized; tags: Localized; summary: Localized; disciplinesLine: Localized; disciplines: Localized;
  link: Localized<{ text: string; href: string }> | null;
  blocks: Localized<CaseBlock[]>;
  services: string[]; similar: string[];
  live: { '4x3': string; '16x9': string }; logo: string | null;
  alt: Localized; seo: Localized<Seo>;
}
export interface Sector { id: string; title: Localized; line: Localized }
export interface InsightMeta {
  id: string; direction: string; date: Localized; read: Localized; title: Localized; excerpt: Localized; seo: Localized<Seo>; more: string[];
}
export interface Rubric { id: string; h1: Localized; lead: Localized; seo: Localized<Seo> }
export interface OrbitNode { id: string; label: string; ring: 'core' | 'system'; angle: number; direction?: string }

export interface Site {
  id: string; name: string; domain: string; url: string;
  type: Localized; summary: Localized; description: Localized; languages: string[]; tags: Localized<string[]>; direction: string;
}
export const sites = sitesJson.items as unknown as Site[];
export const company = companyJson as Company;
export const contacts = contactsJson as unknown as Contacts;
export const regions = geographyJson.regions as Region[];
export const cities = geographyJson.cities as City[];
export const directions = directionsJson as Direction[];
export const services = servicesJson as Service[];
export const cases = casesJson as Case[];
export const sectors = sectorsJson as Sector[];
export const insights = insightsJson.items as InsightMeta[];
export const rubrics = insightsJson.rubrics as Rubric[];
export const orbit = orbitJson as OrbitNode[];

if (!contacts.whatsapp?.url) throw new Error('[content] contacts.whatsapp is required');

const find = <T extends { id: string }>(list: T[], kind: string) => (id: string): T => {
  const x = list.find((v) => v.id === id);
  if (!x) throw new Error(`[content] Unknown ${kind} "${id}"`);
  return x;
};
export const directionById = find(directions, 'direction');
export const serviceById = find(services, 'service');
export const caseById = find(cases, 'case');
export const insightById = find(insights, 'insight');
export const casesBySector = (sectorId: string) => cases.filter((c) => c.sector === sectorId);
/** «from the largest» (content/data/case-rank.json) — the order of every case ribbon */
export const byRank = <T extends { rank: number }>(list: T[]) => [...list].sort((a, b) => a.rank - b.rank);
export const casesRanked = () => byRank(cases);
export const servicesOf = (d: Direction) => d.services.map(serviceById);

/** Data integrity: every reference must resolve (fails the build otherwise). */
for (const d of directions) { d.services.forEach(serviceById); d.cases.forEach(caseById); d.insights.forEach(insightById); }
for (const s of services) { directionById(s.direction); s.cases.forEach(caseById); s.insights.forEach(insightById); }
for (const c of cases) { c.services.forEach(serviceById); c.similar.forEach(caseById); if (!sectors.some((s) => s.id === c.sector)) throw new Error(`[content] sector ${c.sector}`); }
for (const n of orbit) if (n.direction) directionById(n.direction);

/** Stable small hash (FNV-1a) for deterministic generated covers. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Short monogram for the corner chip when a case has no logo file. */
export function monogram(name: string): string {
  const w = name.replace(/[«»"()]/g, '').split(/[\s/]+/).filter(Boolean);
  return (w.length === 1 ? w[0].slice(0, 4) : w.slice(0, 2).map((x) => x[0]).join('')).toUpperCase();
}

/** Resolves a social channel value (string URL/handle or object) to { href, label } or null. */
export function channelLink(value: Contacts['telegram'], base: string): { href: string; label: string } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//.test(value);
    const handle = value.replace(/^https?:\/\/[^/]+\//, '').replace(/^@/, '');
    return { href: isUrl ? value : base + handle, label: '@' + handle };
  }
  if (value.url) return { href: value.url, label: value.display || value.url.replace(/^https?:\/\//, '') };
  return null;
}
