// Content collection «Разборы»: src/content/insights/<lang>/<rubric>/<slug>.md.
// - the 12 articles of the live site (RU + EN, verbatim): `date`, `direction`; lists and excerpts come from
//   content/data/insights.json;
// - the SEO articles (docs/16-seo.md, RU only): `publishDate`, `rubric` and the full SEO frontmatter. They are built
//   only once `publishDate` ≤ the build date (waves) and `draft` is false — see src/lib/articles.ts.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const rubric = z.enum(['audit', 'systems', 'brand-content', 'traffic', 'tenders-legal']);

const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    // legacy articles
    date: z.coerce.date().optional(),
    direction: rubric.optional(),
    services: z.array(z.string()).default([]),
    cases: z.array(z.string()).default([]),
    // SEO articles
    rubric: rubric.optional(),
    publishDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('editorial'),
    primaryKeyword: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    serviceLink: z.string().optional(),
    related: z.array(z.string()).default([]),
    summary: z.array(z.string()).default([]),
    cover: z.object({ motif: z.string(), variant: z.string().optional(), title: z.string().optional(), alt: z.string().optional(), data: z.any() }).optional(),
    readingMinutes: z.number().optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
    legalCheck: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { insights };
