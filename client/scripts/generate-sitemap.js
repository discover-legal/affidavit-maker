#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * client/scripts/generate-sitemap.js
 *
 * Builds client/public/sitemap.xml at build time. Auto-discovers article
 * URLs by scanning the per-bucket files in client/src/content/articles/ —
 * no manual list to keep in sync with articles.js.
 *
 * Runs as the `prebuild` npm hook.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://discover.legal';
const ARTICLES_DIR = path.join(__dirname, '..', 'src', 'content', 'articles');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');

const STATIC_ROUTES = [
  { path: '/',          changefreq: 'weekly',  priority: '1.0' },
  { path: '/resources', changefreq: 'weekly',  priority: '0.9' },
  { path: '/privacy',   changefreq: 'yearly',  priority: '0.5' },
  { path: '/tos',       changefreq: 'yearly',  priority: '0.5' },
  { path: '/brand',     changefreq: 'monthly', priority: '0.4' },
];

function collectSlugs() {
  const slugs = [];
  for (const file of fs.readdirSync(ARTICLES_DIR).sort()) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const re = /^\s+slug:\s*['"]([a-z0-9-]+)['"]/gm;
    let m;
    while ((m = re.exec(src)) !== null) {
      slugs.push(m[1]);
    }
  }
  return [...new Set(slugs)];
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function urlEntry(loc, changefreq, priority, lastmod) {
  return `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildXml(slugs) {
  const today = isoDate();
  const urls = [
    ...STATIC_ROUTES.map(r => urlEntry(r.path, r.changefreq, r.priority, today)),
    ...slugs.map(s => urlEntry(`/resources/${s}`, 'monthly', '0.7', today)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

function main() {
  console.log('🗺️  Generating sitemap.xml...');
  const slugs = collectSlugs();
  fs.writeFileSync(OUTPUT_PATH, buildXml(slugs));
  console.log(`✅ Sitemap written: ${STATIC_ROUTES.length} static + ${slugs.length} article URLs`);
  console.log(`   ${OUTPUT_PATH}`);
}

main();
