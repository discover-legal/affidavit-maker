// services/monitoringService.js
const { Pool } = require('pg');
const logger = require('./logger');

class MonitoringService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: []
    };
  }

  // Track API request
  trackRequest(endpoint, method, statusCode, duration) {
    const key = `${method}:${endpoint}`;
    const current = this.metrics.requests.get(key) || {
      count: 0,
      totalDuration: 0,
      successCount: 0,
      errorCount: 0
    };
    
    current.count++;
    current.totalDuration += duration;
    
    if (statusCode >= 200 && statusCode < 300) {
      current.successCount++;
    } else {
      current.errorCount++;
    }
    
    this.metrics.requests.set(key, current);
  }

  // Track errors
  trackError(error, context = {}) {
    const errorKey = error.name || 'UnknownError';
    const current = this.metrics.errors.get(errorKey) || [];
    
    current.push({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
    
    this.metrics.errors.set(errorKey, current);
    
    // Log to database
    this.logErrorToDatabase(error, context);
  }

  async logErrorToDatabase(error, context) {
    try {
      await this.pool.query(
        `INSERT INTO error_logs (error_type, message, stack_trace, context, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          error.name || 'UnknownError',
          error.message,
          error.stack,
          JSON.stringify(context)
        ]
      );
    } catch (dbError) {
      logger.error('Failed to log error to database', { error: dbError });
    }
  }

  // Get system health
  async getSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };

    // Check database
    try {
      const dbCheck = await this.pool.query('SELECT 1');
      health.checks.database = {
        status: 'healthy',
        responseTime: dbCheck.duration
      };
    } catch (error) {
      health.checks.database = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'unhealthy';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    health.checks.memory = {
      status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Check API performance
    const avgResponseTime = this.calculateAverageResponseTime();
    health.checks.performance = {
      status: avgResponseTime < 1000 ? 'healthy' : 'warning',
      averageResponseTime: avgResponseTime
    };

    return health;
  }

  calculateAverageResponseTime() {
    let totalDuration = 0;
    let totalCount = 0;
    
    for (const [key, data] of this.metrics.requests) {
      totalDuration += data.totalDuration;
      totalCount += data.count;
    }
    
    return totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;
  }

  // Generate analytics report
  async generateAnalyticsReport() {
    const report = {
      timestamp: new Date(),
      period: '24h',
      metrics: {}
    };

    // User metrics
    const userMetrics = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_sessions
      FROM activity_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    report.metrics.users = userMetrics.rows[0];

    // Document metrics
    const documentMetrics = await this.pool.query(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts,
        AVG(CASE 
          WHEN completed_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completed_at - created_at))/60 
        END) as avg_completion_minutes
      FROM documents
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    report.metrics.documents = documentMetrics.rows[0];

    // Template usage
    const templateUsage = await this.pool.query(`
      SELECT 
        template_state,
        COUNT(*) as count
      FROM documents
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY template_state
      ORDER BY count DESC
    `);
    report.metrics.templateUsage = templateUsage.rows;

    // Revenue metrics
    const revenueMetrics = await this.pool.query(`
      SELECT 
        COUNT(*) as transaction_count,
        SUM(amount_cents)/100.0 as total_revenue,
        AVG(amount_cents)/100.0 as average_transaction
      FROM payments
      WHERE status = 'succeeded'
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    report.metrics.revenue = revenueMetrics.rows[0];

    // Error summary
    report.metrics.errors = {
      total: Array.from(this.metrics.errors.values()).flat().length,
      byType: {}
    };
    
    for (const [errorType, errors] of this.metrics.errors) {
      report.metrics.errors.byType[errorType] = errors.length;
    }

    return report;
  }

  // Clean old metrics
  cleanOldMetrics() {
    // Keep only last 24 hours of detailed metrics
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    
    // Clean performance metrics
    this.metrics.performance = this.metrics.performance.filter(
      metric => metric.timestamp > cutoff
    );
    
    // Reset request metrics daily
    if (this.shouldResetDailyMetrics()) {
      this.metrics.requests.clear();
      this.metrics.errors.clear();
      this.lastReset = Date.now();
    }
  }

  shouldResetDailyMetrics() {
    if (!this.lastReset) {
      this.lastReset = Date.now();
      return false;
    }
    
    const hoursSinceReset = (Date.now() - this.lastReset) / (1000 * 60 * 60);
    return hoursSinceReset >= 24;
  }

  // Real-time metrics for dashboard
  getRealTimeMetrics() {
    const metrics = {
      timestamp: new Date(),
      activeRequests: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      averageResponseTime: 0
    };

    // Calculate requests per minute
    const recentRequests = Array.from(this.metrics.requests.values())
      .reduce((sum, data) => sum + data.count, 0);
    
    metrics.requestsPerMinute = Math.round(recentRequests / 60);

    // Calculate error rate
    const totalRequests = recentRequests;
    const totalErrors = Array.from(this.metrics.requests.values())
      .reduce((sum, data) => sum + data.errorCount, 0);
    
    metrics.errorRate = totalRequests > 0 
      ? (totalErrors / totalRequests * 100).toFixed(2)
      : 0;

    // Average response time
    metrics.averageResponseTime = this.calculateAverageResponseTime();

    return metrics;
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

// Clean metrics periodically
setInterval(() => {
  monitoringService.cleanOldMetrics();
}, 60 * 60 * 1000); // Every hour

module.exports = monitoringService;