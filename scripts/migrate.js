#! scripts/migrate.js
const { Pool } = require('pg');
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

    // Define migrations
    const migrations = [
      {
        name: 'add_performance_indexes',
        query: `
          CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action 
          ON activity_logs(user_id, action);
          
          CREATE INDEX IF NOT EXISTS idx_payments_date_type 
          ON payments(created_at, payment_type);
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

    // Run migrations
    for (const migration of migrations) {
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