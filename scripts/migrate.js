#! scripts/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Define hardcoded migrations (legacy)
    const hardcodedMigrations = [
      {
        name: 'add_performance_indexes',
        query: `
          CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action
          ON activity_logs(user_id, action);

          CREATE INDEX IF NOT EXISTS idx_payments_date_method_type
          ON payments(created_at, payment_method_type);
        `
      },
      {
        name: 'add_template_analytics',
        query: `
          CREATE TABLE IF NOT EXISTS template_analytics (
            id SERIAL PRIMARY KEY,
            template_state VARCHAR(5),
            template_type VARCHAR(50),
            success_rate DECIMAL(5,2),
            avg_completion_time INTEGER,
            total_uses INTEGER,
            calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      }
    ];

    // Load file-based migrations from migrations/ folder
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file.match(/^\d+_/)) // Only numbered migrations like 001_*.sql
      .sort(); // Sort by filename to ensure order

    const fileMigrations = migrationFiles.map(file => ({
      name: file.replace('.sql', ''),
      query: fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    }));

    // Combine all migrations: hardcoded first (for backwards compatibility), then file-based
    const allMigrations = [...hardcodedMigrations, ...fileMigrations];

    // Run migrations
    for (const migration of allMigrations) {
      const result = await pool.query(
        'SELECT * FROM migrations WHERE name = $1',
        [migration.name]
      );

      if (result.rows.length === 0) {
        console.log(`Running migration: ${migration.name}`);
        await pool.query(migration.query);
        await pool.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        console.log(`✅ Migration ${migration.name} completed`);
      } else {
        console.log(`⏭️  Migration ${migration.name} already executed`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();