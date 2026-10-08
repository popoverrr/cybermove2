// /llms.txt — a plain description of the company and its key pages for AI search (docs/16-seo.md §A.14).
import type { APIContext } from 'astro';
import { directions, services, company } from '../lib/content';
import { articles } from '../lib/articles';
import { href } from '../lib/i18n';

export async function GET({ site }: APIContext) {
  const o = site!.origin;
  const list = await articles('ru');
  const lines = [
    `# ${company.brand}`,
    '',
    `> ${company.tagline.ru} Консалтинговая компания: аудит бизнеса и финансов, маркетинг и реклама, бренд и контент, сайты, CRM и AI-автоматизация, тендеры и право. Работаем в Казахстане (Алматы, Астана, Шымкент) и с международными проектами. Языки сайта: русский, английский.`,
    '',
    '## Основные страницы',
    `- [Главная](${o}${href('ru')})`,
    `- [Услуги](${o}${href('ru', 'services/')})`,
    `- [Кейсы](${o}${href('ru', 'cases/')})`,
    `- [Разборы](${o}${href('ru', 'insights/')})`,
    `- [О компании](${o}${href('ru', 'about/')})`,
    `- [Контакты](${o}${href('ru', 'contact/')})`,
    `- [English version](${o}${href('en')})`,
    '',
    '## Направления и услуги',
    ...directions.flatMap((d) => [
      `- [${d.nameFull.ru}](${o}${href('ru', `services/${d.id}/`)})`,
      ...services.filter((s) => s.direction === d.id).map((s) => `  - [${s.name.ru}](${o}${href('ru', `services/${d.id}/${s.id}/`)})`),
    ]),
    '',
    '## Разборы (новые)',
    ...list.slice(0, 30).map((a) => `- [${a.title}](${o}${href('ru', a.route)})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
