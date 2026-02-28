#!/usr/bin/env node
/**
 * Sitemap Generator
 *
 * Generates sitemap.xml dynamically based on articles and static routes.
 * This ensures the sitemap stays in sync with actual content.
 *
 * Run this script during the build process to generate an updated sitemap.
 *
 * IMPORTANT: When adding new articles to src/content/articles.js,
 * also add them to the ARTICLE_ROUTES array below.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://app.discover.legal';
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');

// Static routes with their SEO properties
const STATIC_ROUTES = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/resources',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/privacy',
    changefreq: 'monthly',
    priority: '0.3',
  },
  {
    path: '/tos',
    changefreq: 'monthly',
    priority: '0.3',
  },
  {
    path: '/brand',
    changefreq: 'monthly',
    priority: '0.5',
  },
];

// Article routes
// IMPORTANT: Keep this in sync with src/content/articles.js
const ARTICLE_ROUTES = [
  {
    path: '/resources/how-to-write-an-affidavit',
    changefreq: 'monthly',
    priority: '0.9', // Featured article
  },
  {
    path: '/resources/persuasive-legal-writing-guide',
    changefreq: 'monthly',
    priority: '0.9', // Featured article
  },
  {
    path: '/resources/texas-family-law-affidavits',
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/resources/notarization-explained',
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/resources/utah-legal-documents-guide',
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/resources/arizona-affidavit-requirements',
    changefreq: 'monthly',
    priority: '0.7',
  },
];

/**
 * Generate URL entry for sitemap
 */
function generateUrlEntry(url) {
  const lastmod = new Date().toISOString().split('T')[0];
  return `  <url>
    <loc>${BASE_URL}${url.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
}

/**
 * Generate sitemap.xml content
 */
function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...');

  const allRoutes = [...STATIC_ROUTES, ...ARTICLE_ROUTES];
  const urls = allRoutes.map(route => generateUrlEntry(route));

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Main Pages -->
${urls.slice(0, 5).join('\n\n')}

  <!-- Resource Articles -->
${urls.slice(5).join('\n\n')}

</urlset>
`;

  return xml;
}

/**
 * Write sitemap to file
 */
function writeSitemap() {
  try {
    const sitemap = generateSitemap();
    fs.writeFileSync(OUTPUT_PATH, sitemap, 'utf8');
    console.log(`✅ Sitemap generated successfully at: ${OUTPUT_PATH}`);
    console.log(`   Total URLs: ${STATIC_ROUTES.length + ARTICLE_ROUTES.length}`);
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  writeSitemap();
}

module.exports = { generateSitemap, writeSitemap };
