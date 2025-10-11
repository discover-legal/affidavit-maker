// scripts/cleanDatabase.js - Automated database cleanup for activity logs and sessions
const { Pool } = require('pg');
require('dotenv').config();

async function cleanDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { 
      rejectUnauthorized: false 
    } : false
  });

  let client;
  
  try {
    client = await pool.connect();
    console.log('Connected to database');
    
    // Clean up old activity logs (keeps last 90 days)
    console.log('Cleaning up old activity logs...');
    const activityResult = await client.query('SELECT cleanup_old_activity_logs()');
    const activityDeleted = activityResult.rows[0].cleanup_old_activity_logs;
    console.log(`✓ Deleted ${activityDeleted} old activity log entries`);
    
    // Clean up expired sessions
    console.log('Cleaning up expired sessions...');
    const sessionResult = await client.query('SELECT cleanup_expired_sessions()');
    const sessionsDeleted = sessionResult.rows[0].cleanup_expired_sessions;
    console.log(`✓ Deleted ${sessionsDeleted} expired sessions`);
    
    console.log('\n✅ Database cleanup completed successfully');
    console.log(`   Total records deleted: ${activityDeleted + sessionsDeleted}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

cleanDatabase();
