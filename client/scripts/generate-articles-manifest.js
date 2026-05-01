#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * client/scripts/generate-articles-manifest.js
 *
 * Walks every batch file in client/src/content/articles/, extracts
 * per-article metadata, and writes a flat manifest.json that the
 * content-improvement agent can read without bundling or parsing the
 * full bodies. Runs as part of `prebuild`; safe to re-run any time.
 *
 * Each manifest entry:
 *   {
 *     slug, title, description, category, readTime, publishDate,
 *     featured, image,
 *     sourceFile,           // batch filename for traceability
 *     wordCount,            // computed from content body
 *     headingCount,         // # of "##" lines
 *     excerpt,              // first ~280 chars of prose, no markdown noise
 *     tags                  // optional [] — derived from category if empty
 *   }
 *
 * The manifest is checked in so an agent can reason about the corpus
 * without running a build. After editing an article, run:
 *
 *     node client/scripts/generate-articles-manifest.js
 *
 * to refresh.
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'src', 'content', 'articles');
const OUTPUT = path.join(ARTICLES_DIR, 'manifest.json');

// Auto-generated / non-article files that must not be scanned.
const SKIP = new Set(['manifest.json', 'index.js', 'README.md']);

// Default tag derivation for legacy batches that don't yet supply tags.
// Categories like "Texas Law" → ["us-state", "texas", "divorce"].
const STATE_TAG_MAP = {
  'California Law':     ['us-state', 'california'],
  'Florida Law':        ['us-state', 'florida'],
  'New York Law':       ['us-state', 'new-york'],
  'Illinois Law':       ['us-state', 'illinois'],
  'Pennsylvania Law':   ['us-state', 'pennsylvania'],
  'Ohio Law':           ['us-state', 'ohio'],
  'Georgia Law':        ['us-state', 'georgia'],
  'North Carolina Law': ['us-state', 'north-carolina'],
  'Michigan Law':       ['us-state', 'michigan'],
  'Virginia Law':       ['us-state', 'virginia'],
  'Washington Law':     ['us-state', 'washington'],
  'Massachusetts Law':  ['us-state', 'massachusetts'],
  'Colorado Law':       ['us-state', 'colorado'],
  'Texas Law':          ['us-state', 'texas'],
  'Utah Law':           ['us-state', 'utah'],
  'Arizona Law':        ['us-state', 'arizona'],
  'Canada Law':         ['canada'],
};

const CATEGORY_TAG_MAP = {
  'Affidavits':              ['affidavits'],
  'Divorce Process':         ['divorce', 'process'],
  'Custody & Support':       ['custody', 'child-support'],
  'Civil & Family Matters':  ['civil', 'family'],
  'Self-Representation':     ['self-rep', 'pro-se'],
  'Guides':                  ['guide'],
};

function deriveTags(article) {
  if (Array.isArray(article.tags) && article.tags.length > 0) return article.tags;
  return STATE_TAG_MAP[article.category] || CATEGORY_TAG_MAP[article.category] || [];
}

// Extract objects out of a batch file by walking the source text and
// counting brace depth. We only care about top-level entries inside the
// ARTICLES array, so we look for `^  {` (2-space indent) as the start of
// each article object.
function splitArticleObjects(src) {
  const blocks = [];
  const lines = src.split(/\r?\n/);
  let depth = 0;
  let backtick = false;
  let buf = null;

  for (const line of lines) {
    if (buf === null) {
      // Start a new block on a line that is exactly "  {" — this is the
      // canonical shape every batch file uses. False positives are
      // possible but unlikely given the uniform formatting.
      if (/^\s{2}\{\s*$/.test(line)) {
        buf = [line];
        depth = 1;
        backtick = false;
      }
      continue;
    }

    buf.push(line);
    // Toggle backtick mode for the `content: \`...\`` template literal —
    // braces inside the prose must not affect depth tracking.
    for (const ch of line) {
      if (ch === '`') backtick = !backtick;
      if (backtick) continue;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }

    if (depth === 0) {
      blocks.push(buf.join('\n'));
      buf = null;
    }
  }
  return blocks;
}

function readField(block, field) {
  // Match either a single- or double-quoted simple-string field. Captures
  // up to the closing quote followed by `,` or end-of-line.
  const re = new RegExp(`^\\s+${field}:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1\\s*,?\\s*$`, 'm');
  const m = block.match(re);
  return m ? m[2].replace(/\\(['"])/g, '$1') : null;
}

function readBoolField(block, field) {
  const re = new RegExp(`^\\s+${field}:\\s*(true|false)\\s*,?\\s*$`, 'm');
  const m = block.match(re);
  return m ? m[1] === 'true' : false;
}

function readArrayField(block, field) {
  const re = new RegExp(`^\\s+${field}:\\s*\\[([^\\]]*)\\]`, 'm');
  const m = block.match(re);
  if (!m) return null;
  return m[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function readContent(block) {
  // Match the multi-line `content: \`...\`` template literal.
  const start = block.indexOf('content:');
  if (start === -1) return '';
  const tickStart = block.indexOf('`', start);
  if (tickStart === -1) return '';
  const tickEnd = block.indexOf('`', tickStart + 1);
  if (tickEnd === -1) return '';
  return block.slice(tickStart + 1, tickEnd);
}

function summarise(content) {
  // Strip front-matter disclaimer + headings + markdown list markers to
  // produce a reasonable excerpt.
  const stripped = content
    .replace(/^# .*$/gm, '')
    .replace(/^\*\*Disclaimer:\*\*[\s\S]*?\n---/m, '')
    .replace(/^#+\s.*$/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\\`/g, '`')
    .replace(/`{1,3}/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = (content.match(/\b\w+\b/g) || []).length;
  const headingCount = (content.match(/^##\s/gm) || []).length;
  const excerpt = stripped.slice(0, 280) + (stripped.length > 280 ? '…' : '');
  return { wordCount, headingCount, excerpt };
}

function buildManifest() {
  const entries = [];

  for (const file of fs.readdirSync(ARTICLES_DIR).sort()) {
    if (!file.endsWith('.js')) continue;
    if (SKIP.has(file)) continue;

    const src = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const blocks = splitArticleObjects(src);

    for (const block of blocks) {
      const slug = readField(block, 'slug');
      if (!slug) continue;

      const article = {
        slug,
        title:        readField(block, 'title') || '',
        description:  readField(block, 'description') || '',
        category:     readField(block, 'category') || 'Uncategorized',
        readTime:     readField(block, 'readTime') || '',
        publishDate:  readField(block, 'publishDate') || '',
        image:        readField(block, 'image') || '',
        featured:     readBoolField(block, 'featured'),
        sourceFile:   file,
        tags:         readArrayField(block, 'tags'),
      };

      const content = readContent(block);
      Object.assign(article, summarise(content));
      article.tags = deriveTags(article);

      entries.push(article);
    }
  }

  // Stable sort: featured first, then most recent publishDate, then slug.
  entries.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const dateCmp = new Date(b.publishDate || 0) - new Date(a.publishDate || 0);
    if (dateCmp !== 0) return dateCmp;
    return a.slug.localeCompare(b.slug);
  });

  return {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    categories: [...new Set(entries.map(e => e.category))].sort(),
    articles: entries,
  };
}

function main() {
  console.log('🧾  Generating articles manifest...');
  const manifest = buildManifest();
  fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ Manifest written: ${manifest.count} articles across ${manifest.categories.length} categories`);
  console.log(`   ${OUTPUT}`);
}

main();
