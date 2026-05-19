import type { Locale } from '@/lib/locale';

/**
 * Locale tag on each article.
 *   'us'   — show only on US-default site (default if field is missing)
 *   'ca'   — show only when locale = 'ca'
 *   'both' — generic; show on either locale
 */
export type ArticleLocale = 'us' | 'ca' | 'both';

export type Article = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  publishDate: string;
  image: string;
  featured?: boolean;
  locale?: ArticleLocale;
  content: string;
};

export const ARTICLES: Article[];

export function getArticleBySlug(slug: string): Article | undefined;
export function getFeaturedArticles(): Article[];
export function getArticlesByCategory(category: string): Article[];
export function getCategories(): string[];

/**
 * Locale-aware versions used by the resources page (server-rendered with
 * the active locale). An article matches a locale when its `locale` field
 * is 'both' OR matches; missing locale defaults to 'us'.
 */
export function getArticlesForLocale(locale: Locale): Article[];
export function getFeaturedArticlesForLocale(locale: Locale): Article[];
export function getCategoriesForLocale(locale: Locale): string[];
