// /insights/rss.xml — the 50 newest published RU articles (docs/16-seo.md §A.7).
import type { APIContext } from 'astro';
import { articles, isoDate } from '../../lib/articles';
import { href } from '../../lib/i18n';
import { directionById } from '../../lib/content';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export async function GET({ site }: APIContext) {
  const origin = site!.origin;
  const list = (await articles('ru')).slice(0, 50);
  const items = list.map((a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${origin}${href('ru', a.route)}</link>
      <guid isPermaLink="true">${origin}${href('ru', a.route)}</guid>
      <description>${esc(a.description)}</description>
      <category>${esc(directionById(a.direction).name.ru)}</category>
      <pubDate>${new Date(isoDate(a.published) + 'T06:00:00+05:00').toUTCString()}</pubDate>
    </item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cyber Move Consulting — Разборы</title>
    <link>${origin}${href('ru', 'insights/')}</link>
    <atom:link href="${origin}${href('ru', 'insights/rss.xml')}" rel="self" type="application/rss+xml"/>
    <description>Разборы о бизнесе, маркетинге, CRM и AI, рекламе, тендерах и праве в Казахстане.</description>
    <language>ru</language>
    ${list[0] ? `<lastBuildDate>${new Date(isoDate(list[0].updated) + 'T06:00:00+05:00').toUTCString()}</lastBuildDate>` : ''}
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
