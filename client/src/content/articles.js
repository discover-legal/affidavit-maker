// Articles index — auto-discovers every `.js` batch file in ./articles/.
//
// Adding a new article: drop a new file in ./articles/ that exports an
// `ARTICLES` array (see ./articles/README.md for the schema). Webpack's
// require.context reflows the bundle automatically — no edits to this
// file. The build step also writes ./articles/manifest.json which the
// content-improvement agent reads to reason about the corpus without
// parsing every body.
//
// Auto-generated bookkeeping files (`manifest.json`, `index.js`,
// `README.md`) are excluded so they never end up in the article list.

const ctx = require.context('./articles', false, /^\.\/(?!index|manifest)[a-z0-9][a-z0-9-]*\.js$/);

const collected = ctx.keys()
  .sort()
  .flatMap(key => {
    const mod = ctx(key);
    return Array.isArray(mod && mod.ARTICLES) ? mod.ARTICLES : [];
  });

export const ARTICLES = collected;

export const getArticleBySlug = (slug) =>
  ARTICLES.find(article => article.slug === slug);

export const getFeaturedArticles = () =>
  ARTICLES.filter(article => article.featured);

export const getArticlesByCategory = (category) =>
  ARTICLES.filter(article => article.category === category);

export const getCategories = () =>
  [...new Set(ARTICLES.map(article => article.category))];

export const getArticlesByTag = (tag) =>
  ARTICLES.filter(article => Array.isArray(article.tags) && article.tags.includes(tag));
