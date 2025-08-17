import { defineCollection, z } from 'astro:content';

// Define schema for site sections
const sections = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    order: z.number(),
    enabled: z.boolean().default(true),
    // Hero specific fields
    badge: z.string().optional(),
    headline: z.object({
      line1: z.string(),
      line2: z.string(),
      highlight: z.string(),
    }).optional(),
    subheading: z.object({
      words: z.array(z.string()),
      accent: z.string(),
      suffix: z.string(),
    }).optional(),
    badges: z.array(z.object({
      icon: z.string(),
      text: z.string(),
    })).optional(),
    cta: z.object({
      title: z.string(),
      subtitle: z.string(),
      privacy: z.string(),
    }).optional(),
    // How it works specific fields
    steps: z.array(z.object({
      number: z.string(),
      title: z.string(),
      description: z.string(),
      features: z.array(z.string()),
    })).optional(),
    // Footer specific fields
    copyright: z.string().optional(),
    links: z.array(z.object({
      text: z.string(),
      href: z.string(),
    })).optional(),
  }),
});

// Define schema for feature cards
const features = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    icon: z.string(),
    order: z.number(),
  }),
});

// Define schema for comparison data
const comparisons = defineCollection({
  type: 'data',
  schema: z.object({
    features: z.array(z.object({
      feature: z.string(),
      elevra: z.object({
        status: z.enum(['check', 'cross']),
        text: z.string(),
      }),
      competitors: z.record(z.string(), z.object({
        status: z.enum(['check', 'cross']),
        text: z.string(),
      })),
    })),
  }),
});

export const collections = {
  sections,
  features,
  comparisons,
};