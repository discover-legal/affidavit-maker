// config/database.js - Database Configuration
const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * Database configuration with proper error handling and security
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  /**
   * Initialize database connection with retry logic
   */
  async initialize() {
    const config = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { 
        rejectUnauthorized: false 
      } : false,
      max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 60000,
      // Additional security and performance settings
      statement_timeout: 30000, // 30 seconds
      query_timeout: 25000, // 25 seconds
    };

    this.pool = new Pool(config);

    // Set up event handlers
    this.setupEventHandlers();

    // Test initial connection with retry logic
    await this.connectWithRetry();

    // Set up health monitoring
    this.startHealthMonitoring();

    return this.pool;
  }

  /**
   * Set up database event handlers
   */
  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      logger.info('New database client connected', {
        processId: client.processID,
        database: client.database
      });
    });

    this.pool.on('error', (err, client) => {
      logger.logError(err, {
        type: 'database_pool_error',
        processId: client?.processID
      });
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool', {
        processId: client.processID,
        poolSize: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });

    this.pool.on('remove', (client) => {
      logger.debug('Client removed from pool', {
        processId: client.processID
      });
    });
  }

  /**
   * Connect with retry logic
   */
  async connectWithRetry() {
    while (this.connectionAttempts < this.maxRetries) {
      try {
        const client = await this.pool.connect();
        
        // Test connection with a simple query
        const result = await client.query('SELECT NOW() as current_time, version()');
        client.release();
        
        this.isConnected = true;
        this.connectionAttempts = 0;
        
        logger.info('✅ Database connected successfully', {
          serverVersion: result.rows[0].version.split(' ')[1],
          currentTime: result.rows[0].current_time,
          poolConfig: {
            max: this.pool.options.max,
            idleTimeout: this.pool.options.idleTimeoutMillis,
            connectionTimeout: this.pool.options.connectionTimeoutMillis
          }
        });
        
        return;
        
      } catch (error) {
        this.connectionAttempts++;
        this.isConnected = false;
        
        logger.logError(error, {
          type: 'database_connection_failed',
          attempt: this.connectionAttempts,
          maxRetries: this.maxRetries
        });
        
        if (this.connectionAttempts >= this.maxRetries) {
          throw new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000);
        logger.info(`Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Check connection health every 30 seconds
    setInterval(async () => {
      try {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        if (!this.isConnected) {
          this.isConnected = true;
          logger.info('Database connection restored');
        }
        
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          logger.logError(error, {
            type: 'database_health_check_failed'
          });
        }
      }
    }, 30000);

    // Log pool statistics every 5 minutes
    setInterval(() => {
      if (this.pool) {
        logger.logPerformance('database_pool_stats', {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Execute a query with logging and error handling
   */
  async query(text, params = [], context = {}) {
    const start = Date.now();
    let client;

    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        logger.logDatabase('slow_query', 'unknown', duration, {
          query: text.substring(0, 100),
          paramCount: params.length,
          rowCount: result.rowCount,
          ...context
        });
      } else {
        logger.logDatabase('query', 'unknown', duration, {
          rowCount: result.rowCount,
          ...context
        });
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.logError(error, {
        type: 'database_query_error',
        query: text.substring(0, 100),
        paramCount: params.length,
        duration,
        ...context
      });
      
      // Re-throw with additional context
      const enhancedError = new Error(`Database query failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.query = text.substring(0, 100);
      enhancedError.code = error.code;
      throw enhancedError;
      
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute a transaction with proper error handling
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      logger.logDatabase('transaction', 'multiple', 0, {
        status: 'committed'
      });
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.logError(error, {
        type: 'database_transaction_error',
        status: 'rolled_back'
      });
      
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    if (!this.pool) return null;
    
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isConnected: this.isConnected
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.pool) {
      logger.info('Closing database connection pool...');
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Helper function for SQL injection prevention
const escapeIdentifier = (identifier) => {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

// Helper function for safe LIKE queries
const escapeLike = (str) => {
  return str.replace(/[%_\\]/g, '\\$&');
};

module.exports = {
  databaseManager,
  escapeIdentifier,
  escapeLike
};