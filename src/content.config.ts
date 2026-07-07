import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const CategoryEnum = z.enum(['male', 'female', 'general']).describe('男频 / 女频 / 通用');
const StatusEnum = z.enum(['ongoing', 'completed']).describe('连载中 / 已完结');

const novels = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx,json}', base: './src/content/novels' }),
  schema: z.object({
    title: z.string(),
    author: z.string().describe('AI 模型名'),
    category: CategoryEnum,
    subcategory: z.string(),
    tags: z.array(z.string()).default([]),
    status: StatusEnum,
    wordCount: z.number().int().nonnegative().default(0),
    chapterCount: z.number().int().nonnegative().default(0),
    cover: z.string().optional(),
    excerpt: z.string().default(''),
    aiModel: z.string().describe('具体模型版本，如 gpt-4o / claude-3.5 / deepseek-v3'),
    promptPreview: z.string().default('').describe('提示词预览'),
    publishDate: z.coerce.date(),
    updateDate: z.coerce.date(),
    featured: z.boolean().default(false),
  }),
});

const classics = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx,json}', base: './src/content/classics' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    dynasty: z.string().describe('朝代 / 时代'),
    category: z.string().describe('题材分类'),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    excerpt: z.string().default(''),
    wordCount: z.number().int().nonnegative().default(0),
    chapterCount: z.number().int().nonnegative().default(0),
    publishDate: z.coerce.date(),
  }),
});

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx,json}', base: './src/content/chapters' }),
  schema: z.object({
    novelId: z.string().optional().describe('关联 AI 小说 id；与 classicId 二选一'),
    classicId: z.string().optional().describe('关联经典名著 id；与 novelId 二选一'),
    volume: z.string().default('正文'),
    chapterNumber: z.number().int().positive(),
    title: z.string(),
    content: z.string().describe('Markdown / 纯文本正文'),
    wordCount: z.number().int().nonnegative().default(0),
    publishDate: z.coerce.date(),
  }),
});

export const collections = { novels, classics, chapters };
