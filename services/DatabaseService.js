// services/DatabaseService.js - Resilient database operations
const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseService {
  constructor(config) {
    this.pool = new Pool(config);
    this.retryLimit = 3;
    this.errorCounts = new Map();
    
    // Monitor connection errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
    
    // Periodic cleanup of error counts
    setInterval(() => this.cleanupErrorCounts(), 5 * 60 * 1000);
  }
  
  cleanupErrorCounts() {
    const now = Date.now();
    for (const [key, entry] of this.errorCounts.entries()) {
      if (now - entry.timestamp > 60 * 60 * 1000) { // 1 hour
        this.errorCounts.delete(key);
      }
    }
  }
  
  async query(text, params, options = {}) {
    const queryKey = text.slice(0, 50);
    const maxRetries = options.retries || this.retryLimit;
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        const start = Date.now();
        const res = await this.pool.query(text, params);
        const duration = Date.now() - start;
        
        // Log slow queries
        if (duration > 200) {
          logger.warn('Slow database query', {
            queryKey,
            duration,
            rows: res.rowCount
          });
        }
        
        return res;
      } catch (err) {
        retries++;
        
        // Track error counts
        const entry = this.errorCounts.get(queryKey) || { count: 0, timestamp: Date.now() };
        entry.count++;
        entry.timestamp = Date.now();
        this.errorCounts.set(queryKey, entry);
        
        // Handle specific errors
        if (err.code === '40P01') { // Deadlock detected
          logger.warn('Database deadlock detected, retrying', { retries, queryKey });
          await new Promise(r => setTimeout(r, 100 * retries));
          continue;
        }
        
        if (err.code === '23505') { // Unique violation
          throw {
            code: 'DUPLICATE_KEY',
            message: 'A record with this key already exists',
            originalError: err
          };
        }
        
        if (retries <= maxRetries) {
          logger.warn('Database query error, retrying', {
            error: err.message,
            retries,
            queryKey
          });
          await new Promise(r => setTimeout(r, 100 * retries));
        } else {
          logger.error('Database query failed after retries', {
            error: err.message,
            retries,
            queryKey
          });
          throw err;
        }
      }
    }
  }
  
  async getClient() {
    const client = await this.pool.connect();
    
    // Wrap client to add monitoring
    const originalQuery = client.query.bind(client);
    client.query = async (...args) => {
      const [text, params] = args;
      try {
        return await originalQuery(...args);
      } catch (err) {
        logger.error('Client query error', {
          text: text.slice(0, 50),
          error: err.message
        });
        throw err;
      }
    };
    
    return client;
  }
  
  // Transaction helper
  async transaction(callback) {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // Graceful shutdown - close all connections
  async end() {
    logger.info('Closing database connection pool...');
    await this.pool.end();
  }
}

// Export singleton instance
// SECURITY (HIGH-05): Added query timeout to prevent slow query DoS
const dbService = new DatabaseService({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  statement_timeout: 30000, // 30 second query timeout
  query_timeout: 30000      // 30 second overall query timeout
});

module.exports = { dbService, DatabaseService };