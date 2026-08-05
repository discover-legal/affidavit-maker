#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
// Migrate-time TLS policy matches lib/db.ts: production fails closed unless
// DATABASE_CA_CERT or a DATABASE_CERT_SHA256 leaf fingerprint is configured.
const { resolveMigrationSsl } = require('./databaseSsl');
try { require('dotenv').config(); } catch (_) { /* dotenv is dev-only; Render injects env directly */ }

// Stable, application-specific two-int advisory lock. It is session scoped, so
// it remains held even while a migration opens/closes its own transaction.
const MIGRATION_LOCK = [0x41464649, 0x44415649]; // "AFFI", "DAVI"

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

/**
 * Existing migrations may contain a single outer BEGIN/COMMIT pair. Remove
 * only standalone transaction-control lines (PL/pgSQL BEGIN has no semicolon)
 * and put every migration plus its ledger insert in our own transaction.
 */
function normalizeMigration(sql, name) {
  const begin = [...sql.matchAll(/^\s*BEGIN\s*;\s*(?:--.*)?$/gim)];
  const commit = [...sql.matchAll(/^\s*COMMIT\s*;\s*(?:--.*)?$/gim)];
  const rollback = [...sql.matchAll(/^\s*ROLLBACK\s*;\s*(?:--.*)?$/gim)];
  if (rollback.length || begin.length !== commit.length || begin.length > 1) {
    throw new Error(`${name}: unsupported transaction control; expected zero or one BEGIN/COMMIT pair`);
  }
  if (!begin.length) return sql;
  if (begin[0].index > commit[0].index) {
    throw new Error(`${name}: COMMIT appears before BEGIN`);
  }
  return sql
    .replace(/^\s*BEGIN\s*;\s*(?:--.*)?$/gim, '')
    .replace(/^\s*COMMIT\s*;\s*(?:--.*)?$/gim, '');
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const ssl = await resolveMigrationSsl();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });
  let client;
  let locked = false;
  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock($1, $2)', MIGRATION_LOCK);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('ALTER TABLE migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)');

    const dir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(dir).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const name = file.slice(0, -4);
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const digest = checksum(sql);
      const recorded = await client.query('SELECT checksum FROM migrations WHERE name = $1', [name]);
      if (recorded.rowCount) {
        if (recorded.rows[0].checksum && recorded.rows[0].checksum !== digest) {
          throw new Error(`${name}: applied migration was modified (checksum mismatch)`);
        }
        if (!recorded.rows[0].checksum) {
          await client.query('UPDATE migrations SET checksum = $2 WHERE name = $1', [name, digest]);
        }
        console.log(`Skipping applied migration: ${name}`);
        continue;
      }

      console.log(`Running migration: ${name}`);
      await client.query('BEGIN');
      try {
        await client.query(normalizeMigration(sql, name));
        await client.query('INSERT INTO migrations (name, checksum) VALUES ($1, $2)', [name, digest]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(`Migration completed: ${name}`);
    }
    console.log('All migrations completed successfully');
  } finally {
    if (locked && client) {
      await client.query('SELECT pg_advisory_unlock($1, $2)', MIGRATION_LOCK).catch(() => {});
    }
    client?.release();
    await pool.end();
  }
}

module.exports = { checksum, normalizeMigration, runMigrations };

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}
