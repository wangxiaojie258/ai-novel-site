/**
 * Search API: /api/search?q=keyword
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 1) {
    return json({ results: [] });
  }

  const keyword = q.toLowerCase();

  const novels = await getCollection('novels');
  const classics = await getCollection('classics');

  const allBooks = [...novels, ...classics];

  const results = allBooks
    .filter((entry) => {
      const d = entry.data;
      const title = (d.title ?? '').toLowerCase();
      const author = (d.author ?? '').toLowerCase();
      const tags = Array.isArray(d.tags) ? d.tags.join(' ').toLowerCase() : '';
      const excerpt = (d.excerpt ?? '').toLowerCase();
      const collection = entry.collection;

      return (
        title.includes(keyword) ||
        author.includes(keyword) ||
        tags.includes(keyword) ||
        excerpt.includes(keyword) ||
        collection.includes(keyword)
      );
    })
    .slice(0, 20)
    .map((entry) => ({
      id: entry.id,
      title: entry.data.title,
      author: entry.data.author,
      cover: entry.data.cover ?? '',
      excerpt: entry.data.excerpt ?? '',
      category: entry.data.category ?? '通用',
      chapterCount: entry.data.chapterCount ?? 0,
      wordCount: entry.data.wordCount ?? 0,
      href: entry.collection === 'novels'
        ? `/novels/${entry.id}`
        : `/classics/${entry.id}`,
    }));

  return json({ results, keyword: q });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
