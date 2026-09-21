import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/content/articles';

const BASE_URL = 'https://discover.legal';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/services`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/tools/affidavits`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/tools/biglaw`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/research`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/resources`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/tos`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/brand`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = ARTICLES.map((article) => {
    // Use the article's own publish date so crawlers don't see every URL
    // "modified" on each deploy; fall back to build time if it won't parse.
    const published = new Date(article.publishDate);
    return {
      url: `${BASE_URL}/resources/${article.slug}`,
      lastModified: Number.isNaN(published.getTime()) ? lastModified : published,
      changeFrequency: 'monthly',
      priority: article.featured ? 0.9 : 0.7,
    };
  });

  return [...staticRoutes, ...articleRoutes];
}
