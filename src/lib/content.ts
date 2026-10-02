import companyJson from '../../content/data/company.json';
import contactsJson from '../../content/data/contacts.json';
import geographyJson from '../../content/data/geography.json';
import projectsJson from '../../content/data/projects.json';
import sectorsJson from '../../content/data/sectors.json';
import servicesJson from '../../content/data/services.json';
import teamJson from '../../content/data/team.json';
import type { Localized } from './i18n';

export interface Company {
  brand: string;
  legalName: string;
  domain: string | null;
  tagline: Localized;
  descriptor: Localized;
  foundedYear: number | null;
}

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
export interface City {
  id: string; region: string; city: Localized; country: Localized; lat: number; lon: number;
}

export type ProjectType = 'client' | 'experience' | 'own' | 'group';
export interface ProjectResult { value: string; label: Localized }
export interface Project {
  id: string;
  name: Localized;
  monogram: string;
  /** file name in src/assets/projects/ (downloaded by scripts/fetch-project-photos.mjs); null → generated cover */
  photo?: string | null;
  /** optional CSS object-position for the photo crop, e.g. "50% 30%" */
  photoFocus?: string;
  sector: string;
  type: ProjectType;
  url: string | null;
  geo: Localized | null;
  showInMarquee: boolean;
  short: Localized;
  details: Localized;
  tags: Localized<string[]>;
  /** Optional: real case numbers. Rendered only when present. */
  results?: ProjectResult[];
  /** Optional: set true to hide a project everywhere. */
  hidden?: boolean;
}

export interface Sector { id: string; title: Localized; line: Localized }

export interface Service {
  id: string; index: string; title: Localized; lead: Localized;
  includes: Localized<string[]>; outcome: Localized;
}

export interface TeamMember {
  id: string; name: string; photo: string | null; photoFocus: string;
  role: Localized; focus: Localized; bio: Localized; tags: Localized<string[]>;
}

export const company = companyJson as Company;
export const contacts = contactsJson as unknown as Contacts;
export const regions = geographyJson.regions as Region[];
export const cities = geographyJson.cities as City[];
export const sectors = sectorsJson as Sector[];
export const services = servicesJson as Service[];
export const team = (teamJson.members as TeamMember[]);

/** Visible projects (the `hidden: true` flag removes a project from the whole site). */
export const projects = (projectsJson.items as Project[]).filter((p) => !p.hidden);

if (!contacts.whatsapp?.url) throw new Error('[content] contacts.whatsapp is required');

export const projectsBySector = (sectorId: string) => projects.filter((p) => p.sector === sectorId);
export const serviceById = (id: string) => {
  const s = services.find((x) => x.id === id);
  if (!s) throw new Error(`[content] Unknown service "${id}"`);
  return s;
};

/** Stable small hash (FNV-1a) for deterministic generated covers. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Eye-line normalisation for portraits: photoFocus "50% 27%" → zoom so eyes sit at EYE_LINE. */
export const EYE_LINE = 0.35;
export function portraitStyle(m: TeamMember): string {
  const [x = '50%', y = '35%'] = m.photoFocus.split(/\s+/);
  const eye = parseFloat(y) / 100;
  const zoom = Math.max(1, EYE_LINE / eye);
  return `--px:${x};--zoom:${zoom.toFixed(3)}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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
