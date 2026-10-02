// Content collection «Разборы»: src/content/insights/<lang>/<direction>/<slug>.md — the 12 articles of the
// live site, verbatim. Lists and meta (date, reading time, excerpt) come from content/data/insights.json.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    direction: z.enum(['audit', 'systems', 'brand-content', 'traffic', 'tenders-legal']),
    services: z.array(z.string()).default([]),
    cases: z.array(z.string()).default([]),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { insights };
