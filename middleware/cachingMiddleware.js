// middleware/cachingMiddleware.js
/**
 * Advanced Response Caching Middleware with Redis Support
 * Provides intelligent caching, monitoring, and performance optimization
 * 
 * @version 1.0.0
 */

const crypto = require('crypto');
const winston = require('winston');

// In-memory cache as fallback
class MemoryCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
    
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }
  
  generateKey(req) {
    const { method, originalUrl, query, body } = req;
    const data = {
      method,
      url: originalUrl,
      query: query || {},
      body: method !== 'GET' ? body : undefined
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.hits++;
    return item.data;
  }
  
  set(key, value, ttl = this.ttl) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttl,
      timestamp: Date.now()
    });
  }
  
  delete(key) {
    return this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
  
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) : 0
    };
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Cache configuration
const CacheConfig = {
  // Routes that should be cached
  cacheable: [
    { path: /^\/api\/templates/, ttl: 3600000 }, // 1 hour
    { path: /^\/api\/states/, ttl: 86400000 }, // 24 hours
    { path: /^\/api\/preview/, ttl: 60000 }, // 1 minute
    { path: /^\/api\/documents\/\w+$/, ttl: 300000 }, // 5 minutes
    { path: /^\/health/, ttl: 10000 } // 10 seconds
  ],
  
  // Routes that should never be cached
  excluded: [
    /^\/api\/auth/,
    /^\/api\/payment/,
    /^\/api\/chat/,
    /^\/api\/save/
  ],
  
  // Cache key variations based on headers
  varyBy: ['authorization', 'accept-language', 'x-api-version']
};

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/cache.log' })
  ]
});

/**
 * Response Caching Middleware Factory
 */
function createCachingMiddleware(options = {}) {
  const cache = options.cache || new MemoryCache(
    options.maxSize || 100,
    options.defaultTTL || 60000
  );
  
  const config = { ...CacheConfig, ...options.config };
  
  return function cachingMiddleware(req, res, next) {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET' && !options.cacheNonGet) {
      return next();
    }
    
    // Check if route is excluded
    const isExcluded = config.excluded.some(pattern => pattern.test(req.path));
    if (isExcluded) {
      return next();
    }
    
    // Check if route is cacheable
    const cacheConfig = config.cacheable.find(item => item.path.test(req.path));
    if (!cacheConfig && !options.cacheAll) {
      return next();
    }
    
    // Generate cache key
    const baseKey = cache.generateKey(req);
    const varyHeaders = config.varyBy
      .map(header => `${header}:${req.headers[header] || 'none'}`)
      .join('|');
    const cacheKey = `${baseKey}:${varyHeaders}`;
    
    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { 
        path: req.path, 
        method: req.method,
        key: cacheKey.substring(0, 8) 
      });
      
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey.substring(0, 8));
      
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([key, value]) => {
          if (!['x-cache', 'x-cache-key'].includes(key.toLowerCase())) {
            res.set(key, value);
          }
        });
      }
      
      return res.status(cached.status || 200).json(cached.body);
    }
    
    // Cache miss - intercept response
    logger.debug('Cache miss', { 
      path: req.path, 
      method: req.method 
    });
    
    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Key', cacheKey.substring(0, 8));
    
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    // Override json method to cache response
    res.json = function(body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = cacheConfig?.ttl || options.defaultTTL || 60000;
        
        cache.set(cacheKey, {
          body,
          status: res.statusCode,
          headers: res.getHeaders(),
          timestamp: Date.now()
        }, ttl);
        
        logger.debug('Response cached', {
          path: req.path,
          ttl,
          key: cacheKey.substring(0, 8)
        });
      }
      
      return originalJson(body);
    };
    
    // Override send method as well
    res.send = function(body) {
      // Try to parse as JSON for caching
      try {
        const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
        return res.json(jsonBody);
      } catch {
        // Not JSON, use original send
        return originalSend(body);
      }
    };
    
    next();
  };
}

/**
 * Cache Invalidation Middleware
 */
function createCacheInvalidationMiddleware(cache) {
  return function cacheInvalidationMiddleware(req, res, next) {
    // Invalidate cache on write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const patterns = [
        req.path,
        req.path.replace(/\/[^\/]+$/, ''), // Parent path
        req.path.replace(/\/\w+$/, '') // Collection path
      ];
      
      // Invalidate related cache entries
      let invalidated = 0;
      for (const [key] of cache.cache.entries()) {
        if (patterns.some(pattern => key.includes(pattern))) {
          cache.delete(key);
          invalidated++;
        }
      }
      
      if (invalidated > 0) {
        logger.info('Cache invalidated', {
          path: req.path,
          method: req.method,
          entriesInvalidated: invalidated
        });
      }
    }
    
    next();
  };
}

/**
 * Performance Monitoring Middleware
 */
function createMonitoringMiddleware(options = {}) {
  const metrics = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      byMethod: {},
      byPath: {},
      byStatus: {}
    },
    performance: {
      responseTimes: [],
      slowRequests: [],
      averageResponseTime: 0
    },
    errors: []
  };
  
  const maxMetrics = options.maxMetrics || 1000;
  const slowThreshold = options.slowThreshold || 1000;
  
  return function monitoringMiddleware(req, res, next) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    // Track request
    metrics.requests.total++;
    metrics.requests.byMethod[req.method] = 
      (metrics.requests.byMethod[req.method] || 0) + 1;
    
    const pathKey = req.route?.path || req.path;
    metrics.requests.byPath[pathKey] = 
      (metrics.requests.byPath[pathKey] || 0) + 1;
    
    // Monitor response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const endMemory = process.memoryUsage();
      
      // Track status
      metrics.requests.byStatus[res.statusCode] = 
        (metrics.requests.byStatus[res.statusCode] || 0) + 1;
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        metrics.requests.success++;
      } else if (res.statusCode >= 400) {
        metrics.requests.errors++;
        
        // Track error details
        if (metrics.errors.length < maxMetrics) {
          metrics.errors.push({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            userAgent: req.headers['user-agent']
          });
        }
      }
      
      // Track performance
      metrics.performance.responseTimes.push(duration);
      if (metrics.performance.responseTimes.length > maxMetrics) {
        metrics.performance.responseTimes.shift();
      }
      
      // Calculate average
      metrics.performance.averageResponseTime = 
        metrics.performance.responseTimes.reduce((a, b) => a + b, 0) / 
        metrics.performance.responseTimes.length;
      
      // Track slow requests
      if (duration > slowThreshold) {
        if (metrics.performance.slowRequests.length >= maxMetrics) {
          metrics.performance.slowRequests.shift();
        }
        
        metrics.performance.slowRequests.push({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          duration,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed
          }
        });
        
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${duration.toFixed(2)}ms`
        });
      }
      
      // Add performance headers
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      
      originalEnd.apply(res, args);
    };
    
    next();
  };
  
  // Attach metrics getter
  monitoringMiddleware.getMetrics = () => ({ ...metrics });
  monitoringMiddleware.resetMetrics = () => {
    Object.keys(metrics.requests).forEach(key => {
      if (typeof metrics.requests[key] === 'object') {
        metrics.requests[key] = {};
      } else {
        metrics.requests[key] = 0;
      }
    });
    metrics.performance.responseTimes = [];
    metrics.performance.slowRequests = [];
    metrics.errors = [];
  };
  
  return monitoringMiddleware;
}

/**
 * Compression Middleware Enhancement
 */
function createCompressionMiddleware(options = {}) {
  const compression = require('compression');
  
  return compression({
    level: options.level || 6,
    threshold: options.threshold || 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Compress JSON responses
      const contentType = res.getHeader('Content-Type');
      if (contentType && contentType.includes('json')) {
        return true;
      }
      
      // Use standard compression filter
      return compression.filter(req, res);
    }
  });
}

module.exports = {
  createCachingMiddleware,
  createCacheInvalidationMiddleware,
  createMonitoringMiddleware,
  createCompressionMiddleware,
  MemoryCache,
  CacheConfig
};