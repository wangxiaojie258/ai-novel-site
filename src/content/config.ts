import { defineCollection, z } from 'astro:content';

const novelsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    category: z.enum(['male', 'female', 'general']),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).default([]),
    status: z.enum(['ongoing', 'completed']).default('ongoing'),
    wordCount: z.number(),
    chapterCount: z.number(),
    cover: z.string().optional(),
    excerpt: z.string().optional(),
    aiModel: z.string().optional(),
    genre: z.enum(['cyber-cultivation', 'rule-horror', 'ai-awakening', 'code-cultivation', 'doujin']).default('doujin'),
    promptPreview: z.string().optional(),
    publishDate: z.string().optional(),
    updateDate: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const classicsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    dynasty: z.string().optional(),
    wordCount: z.number(),
    chapterCount: z.number(),
    cover: z.string().optional(),
    excerpt: z.string().optional(),
    publishDate: z.string().optional(),
    updateDate: z.string().optional(),
    featured: z.boolean().default(false),
    isPublicDomain: z.boolean().default(true),
  }),
});

const chaptersCollection = defineCollection({
  type: 'content',
  schema: z.object({
    novelId: z.string(),
    volume: z.string().optional(),
    chapterNumber: z.number(),
    title: z.string(),
    wordCount: z.number().optional(),
    publishDate: z.string().optional(),
  }),
});

export const collections = {
  novels: novelsCollection,
  classics: classicsCollection,
  chapters: chaptersCollection,
};
