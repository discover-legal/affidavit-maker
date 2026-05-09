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
  content: string;
};

export const ARTICLES: Article[];
export function getArticleBySlug(slug: string): Article | undefined;
export function getFeaturedArticles(): Article[];
export function getArticlesByCategory(category: string): Article[];
export function getCategories(): string[];
