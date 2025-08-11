// services/DatabaseService.js
/**
 * Optimized Database Service with Advanced Connection Pooling
 * Provides connection management, query optimization, and monitoring
 * 
 * @version 2.0.0
 */

const { Pool } = require('pg');
const winston = require('winston');
const EventEmitter = require('events');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

class ConnectionMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      queryTimes: []
    };
    
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');
    this.maxQueryTimes = 100; // Keep last 100 query times for average
  }
  
  recordQuery(duration, success = true) {
    this.metrics.totalQueries++;
    
    if (!success) {
      this.metrics.failedQueries++;
    }
    
    if (duration > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      this.emit('slowQuery', { duration });
    }
    
    // Update average query time
    this.metrics.queryTimes.push(duration);
    if (this.metrics.queryTimes.length > this.maxQueryTimes) {
      this.metrics.queryTimes.shift();
    }
    
    this.metrics.averageQueryTime = 
      this.metrics.queryTimes.reduce((a, b) => a + b, 0) / this.metrics.queryTimes.length;
  }
  
  updateConnectionMetrics(pool) {
    this.metrics.totalConnections = pool.totalCount;
    this.metrics.idleConnections = pool.idleCount;
    this.metrics.activeConnections = pool.totalCount - pool.idleCount;
    this.metrics.waitingRequests = pool.waitingCount;
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
}

class QueryBuilder {
  static select(table, conditions = {}, options = {}) {
    let query = `SELECT ${options.columns || '*'} FROM ${table}`;
    const params = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => {
          params.push(conditions[key]);
          return `${key} = $${index + 1}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    
    return { query, params };
  }
  
  static insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    return { query, params: values };
  }
  
  static update(table, data, conditions) {
    const updateColumns = Object.keys(data);
    const updateValues = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    const setClause = updateColumns
      .map((col, index) => `${col} = $${index + 1}`)
      .join(', ');
    
    const whereClause = conditionKeys
      .map((key, index) => `${key} = $${updateValues.length + index + 1}`)
      .join(' AND ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;
    
    return { query, params: [...updateValues, ...conditionValues] };
  }
  
  static delete(table, conditions) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    
    const whereClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');
    
    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
    
    return { query, params: values };
  }
}

class DatabaseService {
  constructor(config = {}) {
    this.config = {
      connectionString: config.connectionString || process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? 
        { rejectUnauthorized: false } : false,
      
      // Optimized pool configuration
      max: parseInt(config.max || process.env.DATABASE_POOL_MAX || '20'),
      min: parseInt(config.min || process.env.DATABASE_POOL_MIN || '2'),
      idleTimeoutMillis: parseInt(config.idleTimeout || '30000'),
      connectionTimeoutMillis: parseInt(config.connectionTimeout || '5000'),
      
      // Advanced options
      statement_timeout: parseInt(config.statementTimeout || '30000'),
      query_timeout: parseInt(config.queryTimeout || '30000'),
      application_name: config.appName || 'affidavit-maker',
      
      // Connection retry
      retryAttempts: parseInt(config.retryAttempts || '3'),
      retryDelay: parseInt(config.retryDelay || '1000')
    };
    
    this.pool = null;
    this.monitor = new ConnectionMonitor();
    this.queryCache = new Map();
    this.cacheMaxSize = config.cacheMaxSize || 100;
    this.cacheTTL = config.cacheTTL || 60000; // 1 minute
    this.prepared = new Map(); // Prepared statements
    
    this.initialize();
  }
  
  async initialize() {
    try {
      await this.createPool();
      await this.testConnection();
      this.setupEventHandlers();
      this.startHealthCheck();
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }
  
  async createPool() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.pool = new Pool(this.config);
        
        // Test the pool immediately
        const client = await this.pool.connect();
        client.release();
        
        logger.info(`Database pool created successfully on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`Database connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay * attempt)
          );
        }
      }
    }
    
    throw new Error(`Failed to create database pool after ${this.config.retryAttempts} attempts: ${lastError.message}`);
  }
  
  setupEventHandlers() {
    this.pool.on('error', (err, client) => {
      logger.error('Unexpected database error on idle client:', err);
    });
    
    this.pool.on('connect', (client) => {
      logger.debug('New client connected to database');
      this.monitor.updateConnectionMetrics(this.pool);
    });
    
    this.pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool');
      this.monitor.updateConnectionMetrics(this.pool);
    });
    
    this.pool.on('remove', (client) => {
      logger.debug('Client removed from pool');
      this.monitor.updateConnectionMetrics(this.pool);
    });
    
    // Monitor slow queries
    this.monitor.on('slowQuery', ({ duration }) => {
      logger.warn(`Slow query detected: ${duration}ms`);
    });
  }
  
  startHealthCheck() {
    // Periodic health check every minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.query('SELECT 1');
        logger.debug('Database health check passed');
      } catch (error) {
        logger.error('Database health check failed:', error);
        // Try to recover
        await this.reconnect();
      }
    }, 60000);
  }
  
  async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as db_version');
      logger.info('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }
  
  async reconnect() {
    logger.info('Attempting to reconnect to database...');
    
    try {
      // Close existing pool
      if (this.pool) {
        await this.pool.end();
      }
      
      // Create new pool
      await this.createPool();
      await this.testConnection();
      
      logger.info('Successfully reconnected to database');
    } catch (error) {
      logger.error('Failed to reconnect to database:', error);
      throw error;
    }
  }
  
  getCacheKey(query, params) {
    return `${query}_${JSON.stringify(params || [])}`;
  }
  
  getFromCache(key) {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.queryCache.delete(key);
    return null;
  }
  
  setCache(key, data) {
    if (this.queryCache.size >= this.cacheMaxSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  async query(text, params, options = {}) {
    const startTime = process.hrtime.bigint();
    let client;
    
    try {
      // Check cache for SELECT queries
      if (options.cache && text.trim().toUpperCase().startsWith('SELECT')) {
        const cacheKey = this.getCacheKey(text, params);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          logger.debug('Returning cached query result');
          return cached;
        }
      }
      
      // Get client from pool
      client = await this.pool.connect();
      
      // Execute query
      const result = await client.query(text, params);
      
      // Calculate duration
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      
      // Record metrics
      this.monitor.recordQuery(duration, true);
      
      // Log slow queries
      if (duration > this.config.slowQueryThreshold) {
        logger.warn('Slow query detected:', {
          query: text,
          params,
          duration: `${duration}ms`,
          rows: result.rowCount
        });
      }
      
      // Cache if requested
      if (options.cache && text.trim().toUpperCase().startsWith('SELECT')) {
        const cacheKey = this.getCacheKey(text, params);
        this.setCache(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.monitor.recordQuery(duration, false);
      
      logger.error('Query failed:', {
        query: text,
        params,
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    } finally {
      if (client) {
        client.release();
      }
      this.monitor.updateConnectionMetrics(this.pool);
    }
  }
  
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Convenience methods using QueryBuilder
  async select(table, conditions = {}, options = {}) {
    const { query, params } = QueryBuilder.select(table, conditions, options);
    const result = await this.query(query, params, { cache: options.cache });
    return result.rows;
  }
  
  async insert(table, data) {
    const { query, params } = QueryBuilder.insert(table, data);
    const result = await this.query(query, params);
    return result.rows[0];
  }
  
  async update(table, data, conditions) {
    const { query, params } = QueryBuilder.update(table, data, conditions);
    const result = await this.query(query, params);
    return result.rows;
  }
  
  async delete(table, conditions) {
    const { query, params } = QueryBuilder.delete(table, conditions);
    const result = await this.query(query, params);
    return result.rows;
  }
  
  // Batch operations for performance
  async batchInsert(table, records) {
    if (!records || records.length === 0) return [];
    
    const columns = Object.keys(records[0]);
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    records.forEach(record => {
      const rowPlaceholders = columns.map(() => `$${paramIndex++}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...columns.map(col => record[col]));
    });
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result.rows;
  }
  
  // Prepared statements for frequently used queries
  async prepare(name, text) {
    if (!this.prepared.has(name)) {
      this.prepared.set(name, { text, name });
    }
    return this.prepared.get(name);
  }
  
  async execute(name, params) {
    const prepared = this.prepared.get(name);
    if (!prepared) {
      throw new Error(`Prepared statement '${name}' not found`);
    }
    
    return await this.query(prepared.text, params);
  }
  
  // Get pool statistics
  getStats() {
    return {
      pool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      },
      metrics: this.monitor.getMetrics(),
      cache: {
        size: this.queryCache.size,
        maxSize: this.cacheMaxSize
      }
    };
  }
  
  // Clean up
  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.pool) {
      await this.pool.end();
      logger.info('Database pool closed');
    }
    
    this.queryCache.clear();
    this.prepared.clear();
  }
}

// Singleton instance
let instance = null;

module.exports = {
  DatabaseService,
  QueryBuilder,
  ConnectionMonitor,
  
  // Get singleton instance
  getInstance: (config) => {
    if (!instance) {
      instance = new DatabaseService(config);
    }
    return instance;
  }
};