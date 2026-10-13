// The 10 services of the «Услуги» ribbon and their motion loops (tools/motion → public/motion/).
// Order and labels = homeServices.items (docs/14-rework.md §8). 01–07 lead to the existing direction/service
// pages; 08–10 got their own pages at /services/<id>/ (text from the matching RU article, see ExtraServicePage).
import { ta, href, asset, type Lang } from './i18n';

export const MOTION_IDS = ['audit', 'brand-core', 'brand-marketing', 'systems', 'smm', 'promotion', 'tenders', 'sales-department', 'hr-consulting', 'business-events'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export interface MotionService { id: MotionId; index: string; label: string; route: string; link: string; /** contact-form service value (08–10) */ form?: string }


export function motionServices(lang: Lang): MotionService[] {
  const items = ta<{ label: string; to: string }[]>(lang, 'homeServices.items');
  return items.map((s, i) => {
    const extra = s.to.startsWith('#'); // 08–10: «#<form value>» in the source → own page /services/<motion id>/
    const route = extra ? `services/${MOTION_IDS[i]}/` : s.to;
    return { id: MOTION_IDS[i], index: String(i + 1).padStart(2, '0'), label: s.label, route, link: href(lang, route), form: extra ? s.to.slice(1) : undefined };
  });
}

export function motionFor(lang: Lang, route: string): MotionService | undefined {
  return motionServices(lang).find((m) => m.route === route);
}

export const motionSrc = (id: MotionId, variant: 'card' | 'hero') => ({
  mp4: asset(`motion/${variant}-${id}.mp4`),
  poster: asset(`motion/${variant}-${id}.webp`),
});
/** phones: the light 720×900 cut of the card loop (tools/motion/mobile.mjs) */
export const motionPhone = (id: MotionId) => ({ mp4: asset(`motion/card-${id}-m.mp4`), poster: asset(`motion/card-${id}.webp`) });

/** Extra pages (08–10): service id for the contact form and the RU article that holds their text. */
export const EXTRA: Record<'sales-department' | 'hr-consulting' | 'business-events', { article: string }> = {
  'sales-department': { article: 'sales-department-from-scratch' },
  'hr-consulting': { article: 'hr-consulting-growing-team' },
  'business-events': { article: 'business-events' },
};
export type ExtraId = keyof typeof EXTRA;
