// scripts/fixDatabase.js - Fix database connection issues
const { Pool } = require('pg');
require('dotenv').config();

async function testAndFixDatabase() {
  console.log('🔍 Testing database connection...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database query successful:', result.rows[0].now);
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log('\n📊 Existing tables:');
    tables.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
    // Check for required tables
    const requiredTables = ['users', 'documents', 'payments', 'activity_logs'];
    const existingTables = tables.rows.map(r => r.tablename);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables:', missingTables.join(', '));
      console.log('Run the database schema script to create missing tables.');
    } else {
      console.log('\n✅ All required tables exist');
    }
    
    // Check connection pool
    console.log('\n🔌 Connection pool status:');
    console.log(`  - Total connections: ${pool.totalCount}`);
    console.log(`  - Idle connections: ${pool.idleCount}`);
    console.log(`  - Waiting requests: ${pool.waitingCount}`);
    
    client.release();
    
    // Test multiple concurrent connections
    console.log('\n🔄 Testing concurrent connections...');
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        pool.query('SELECT pg_sleep(0.1), $1 as connection_number', [i + 1])
      );
    }
    
    await Promise.all(promises);
    console.log('✅ Concurrent connections successful');
    
    // Add missing indexes
    console.log('\n🔧 Checking indexes...');
    const indexes = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);
    
    console.log(`Found ${indexes.rows.length} custom indexes`);
    
    // Add any missing critical indexes
    const criticalIndexes = [
      {
        name: 'idx_documents_user_id_status',
        table: 'documents',
        columns: 'user_id, status',
        query: 'CREATE INDEX IF NOT EXISTS idx_documents_user_id_status ON documents(user_id, status)'
      },
      {
        name: 'idx_activity_logs_user_id_created',
        table: 'activity_logs',
        columns: 'user_id, created_at',
        query: 'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id_created ON activity_logs(user_id, created_at DESC)'
      }
    ];
    
    for (const index of criticalIndexes) {
      const exists = indexes.rows.find(i => i.indexname === index.name);
      if (!exists) {
        console.log(`  - Creating index ${index.name} on ${index.table}(${index.columns})...`);
        try {
          await pool.query(index.query);
          console.log(`    ✅ Created successfully`);
        } catch (error) {
          console.log(`    ❌ Failed: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.error('\nTroubleshooting steps:');
    console.error('1. Check DATABASE_URL in .env file');
    console.error('2. Ensure PostgreSQL is running');
    console.error('3. Verify database exists');
    console.error('4. Check username/password');
    console.error('\nConnection string format:');
    console.error('postgresql://username:password@localhost:5432/database_name');
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
testAndFixDatabase().catch(console.error);