// scripts/cleanDatabase.js - Automated database cleanup for activity logs and sessions
const { Pool } = require('pg');
const { databasePoolConfig } = require('./databaseConfig');
try { require('dotenv').config(); } catch (_) { /* production injects env */ }

async function heartbeat(suffix = '') {
  const url = process.env.CLEANUP_HEARTBEAT_URL;
  if (!url) return;
  const target = `${url}${suffix}`;
  const response = await fetch(target, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`cleanup heartbeat returned ${response.status}`);
}

async function cleanDatabase() {
  const pool = new Pool(databasePoolConfig());

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

    // Shared limiter counters have no value after their window has been
    // expired for a day. The table is FORCE-RLS/system-only, so scope the
    // maintenance bypass to this short transaction.
    console.log('Cleaning up expired API rate-limit counters...');
    await client.query('BEGIN');
    let rateLimitsDeleted = 0;
    try {
      await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'true']);
      const rateLimitResult = await client.query(
        `DELETE FROM api_rate_limits
          WHERE reset_at < CURRENT_TIMESTAMP - INTERVAL '1 day'`,
      );
      rateLimitsDeleted = rateLimitResult.rowCount || 0;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
    console.log(`✓ Deleted ${rateLimitsDeleted} expired API rate-limit counters`);
    
    console.log('\n✅ Database cleanup completed successfully');
    console.log(`   Total records deleted: ${activityDeleted + sessionsDeleted + rateLimitsDeleted}`);
    await heartbeat();
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    await heartbeat('/fail').catch((heartbeatError) => {
      console.error('Cleanup failure heartbeat also failed:', heartbeatError.message);
    });
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

cleanDatabase();
