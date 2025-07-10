// scripts/analyze.js
const { Pool } = require('pg');
require('dotenv').config();

async function analyzeUsage() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Document statistics
    const docStats = await pool.query(`
      SELECT 
        template_state,
        document_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_completion_time_minutes
      FROM documents
      GROUP BY template_state, document_type
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Document Statistics:');
    console.table(docStats.rows);
    
    // User activity
    const userActivity = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_actions
      FROM activity_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date DESC
      LIMIT 7
    `);
    
    console.log('\n👥 User Activity (Last 7 Days):');
    console.table(userActivity.rows);
    
    // Revenue analytics
    const revenue = await pool.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        payment_type,
        COUNT(*) as transactions,
        SUM(amount_cents)/100.0 as revenue_usd
      FROM payments
      WHERE status = 'succeeded'
      GROUP BY month, payment_type
      ORDER BY month DESC
      LIMIT 3
    `);
    
    console.log('\n💰 Revenue (Last 3 Months):');
    console.table(revenue.rows);
    
  } catch (error) {
    console.error('Analysis error:', error);
  } finally {
    await pool.end();
  }
}

analyzeUsage();