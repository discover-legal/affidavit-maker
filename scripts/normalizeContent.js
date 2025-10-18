#!/usr/bin/env node
/*
 * scripts/normalizeContent.js
 * Idempotent migration to normalize legacy documents.content into canonical JSON
 * Usage:
 *   node scripts/normalizeContent.js --dry-run --limit=100
 */

const { databaseManager } = require('../config/database');
const { prepareFactsForStorage } = require('../utils/factNormalizer');
const util = require('util');

const argv = require('minimist')(process.argv.slice(2));
const DRY_RUN = argv['dry-run'] || argv.dryRun || false;
const LIMIT = parseInt(argv.limit || '0', 10) || 0;

async function normalizeRowContent(row) {
  let raw = row.content;
  if (raw === null || raw === undefined) raw = '';

  let parsed;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Raw string - convert into canonical facts by splitting paragraphs
      const parts = String(raw).split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      parsed = { facts: parts.length > 0 ? parts.map(p => ({ content: p })) : [] };
    }
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    parsed = { facts: [] };
  }

  // Ensure facts array exists
  const facts = Array.isArray(parsed.facts) ? parsed.facts : (parsed.sections && parsed.sections.facts && Array.isArray(parsed.sections.facts.items) ? parsed.sections.facts.items.map(i => ({ content: i.displayContent || i.content || '' })) : []);

  const normalizedFacts = prepareFactsForStorage(facts || []);

  const canonical = {
    ...parsed,
    facts: normalizedFacts
  };

  // Avoid changing other fields; stringify
  const newContent = JSON.stringify(canonical);
  const oldContentStr = typeof raw === 'string' ? raw : JSON.stringify(raw);

  const changed = oldContentStr !== newContent;
  return { changed, newContent, canonical };
}

async function main() {
  console.log('Normalize documents.content -> canonical facts');
  await databaseManager.initialize();
  const pool = databaseManager.pool;

  const selectSql = LIMIT > 0 ? `SELECT id, content FROM documents LIMIT ${LIMIT}` : 'SELECT id, content FROM documents';
  const res = await pool.query(selectSql);
  console.log(`Found ${res.rows.length} documents to inspect`);

  let changedCount = 0;
  for (const row of res.rows) {
    const { changed, newContent } = await normalizeRowContent(row);
    if (changed) {
      changedCount++;
      if (DRY_RUN) {
        console.log(`[DRY] Would normalize document id=${row.id}`);
      } else {
        try {
          await pool.query('UPDATE documents SET content = $1 WHERE id = $2', [newContent, row.id]);
          console.log(`Normalized document id=${row.id}`);
        } catch (err) {
          console.error(`Failed to update document id=${row.id}:`, err.message);
        }
      }
    }
  }

  console.log(`Processed ${res.rows.length} rows. Changed: ${changedCount}`);
  await databaseManager.shutdown();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
