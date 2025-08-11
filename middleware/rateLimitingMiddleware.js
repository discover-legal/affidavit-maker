// middleware/rateLimitingMiddleware.js
/**
 * Enhanced Rate Limiting Middleware with User Tiers
 * Provides flexible rate limiting based on user subscription levels
 * 
 * @version 1.0.0
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rate-limit.log' })
  ]
});

/**
 * In-memory store for rate limiting (fallback when Redis not available)
 */
class MemoryRateLimitStore {
  constructor(windowMs = 60000) {
    this.clients = new Map();
    this.windowMs = windowMs;
    
    // Cleanup old entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, windowMs);
  }
  
  async increment(key) {
    const now = Date.now();
    let client = this.clients.get(key);
    
    if (!client || now - client.resetTime > this.windowMs) {
      client = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.clients.set(key, client);
    }
    
    client.count++;
    
    return {
      totalHits: client.count,
      resetTime: new Date(client.resetTime)
    };
  }
  
  async decrement(key) {
    const client = this.clients.get(key);
    if (client && client.count > 0) {
      client.count--;
    }
  }
  
  async resetKey(key) {
    this.clients.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, client] of this.clients.entries()) {
      if (now - client.resetTime > this.windowMs) {
        this.clients.delete(key);
      }
    }
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clients.clear();
  }
}

/**
 * User tier configurations
 */
const UserTiers = {
  premium: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Premium rate limit exceeded. Please wait before making more requests.',
    standardHeaders: true,
    legacyHeaders: false
  },
  basic: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Basic rate limit exceeded. Consider upgrading to Premium for higher limits.',
    standardHeaders: true,
    legacyHeaders: false
  },
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Free tier rate limit exceeded. Sign up for a Basic or Premium account for higher limits.',
    standardHeaders: true,
    legacyHeaders: false
  },
  anonymous: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Rate limit exceeded. Please sign in or create an account.',
    standardHeaders: true,
    legacyHeaders: false
  }
};

/**
 * Route-specific rate limits
 */
const RouteRateLimits = {
  '/api/chat': {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10,
    message: 'Chat rate limit exceeded. Please wait a moment before sending more messages.'
  },
  '/api/generate-affidavit': {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,
    message: 'Document generation rate limit exceeded. Please wait before generating more documents.'
  },
  '/api/payment': {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 3,
    message: 'Payment rate limit exceeded for security. Please wait before retrying.'
  },
  '/api/auth': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Authentication rate limit exceeded. Please wait before trying again.'
  }
};

/**
 * Create rate limiter with user tier support
 */
function createUserTierRateLimiter(options = {}) {
  const store = options.store || new MemoryRateLimitStore();
  
  return async (req, res, next) => {
    // Determine user tier
    let tier = 'anonymous';
    let userId = req.ip; // Default to IP
    
    if (req.user) {
      userId = req.user.id || req.user.sub;
      tier = req.user.subscription || 'free';
    }
    
    // Get tier configuration
    const tierConfig = UserTiers[tier] || UserTiers.anonymous;
    
    // Create rate limiter for this tier
    const limiter = rateLimit({
      ...tierConfig,
      store: store,
      keyGenerator: () => `${tier}:${userId}`,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          tier,
          userId,
          path: req.path,
          method: req.method
        });
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: tierConfig.message,
          retryAfter: res.getHeader('Retry-After'),
          tier,
          limit: tierConfig.max
        });
      },
      skip: (req) => {
        // Skip rate limiting for certain conditions
        if (options.skipSuccessfulRequests && res.statusCode < 400) {
          return true;
        }
        if (options.skipFailedRequests && res.statusCode >= 400) {
          return true;
        }
        return false;
      }
    });
    
    // Apply rate limiting
    limiter(req, res, next);
  };
}

/**
 * Create route-specific rate limiter
 */
function createRouteRateLimiter(route, customConfig = {}) {
  const config = { ...RouteRateLimits[route], ...customConfig };
  
  if (!config) {
    throw new Error(`No rate limit configuration found for route: ${route}`);
  }
  
  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      if (req.user) {
        return `route:${route}:user:${req.user.id || req.user.sub}`;
      }
      return `route:${route}:ip:${req.ip}`;
    },
    handler: (req, res) => {
      logger.warn('Route rate limit exceeded', {
        route,
        userId: req.user?.id,
        ip: req.ip,
        method: req.method
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter: res.getHeader('Retry-After')
      });
    }
  });
}

/**
 * Create API key rate limiter
 */
function createApiKeyRateLimiter(options = {}) {
  const limits = options.limits || {
    default: { windowMs: 60000, max: 100 },
    unlimited: { windowMs: 60000, max: 999999 }
  };
  
  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return next();
    }
    
    // Look up API key limits (this would typically query a database)
    const keyConfig = await getApiKeyConfig(apiKey);
    
    if (!keyConfig) {
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }
    
    const limit = limits[keyConfig.tier] || limits.default;
    
    const limiter = rateLimit({
      ...limit,
      keyGenerator: () => `api:${apiKey}`,
      handler: (req, res) => {
        logger.warn('API key rate limit exceeded', {
          apiKey: apiKey.substring(0, 8) + '...',
          tier: keyConfig.tier
        });
        
        res.status(429).json({
          error: 'API rate limit exceeded',
          message: `Rate limit exceeded for API key. Limit: ${limit.max} requests per ${limit.windowMs / 1000} seconds`,
          retryAfter: res.getHeader('Retry-After')
        });
      }
    });
    
    limiter(req, res, next);
  };
}

/**
 * Distributed rate limiting with Redis
 */
function createDistributedRateLimiter(redisClient, options = {}) {
  const store = new RedisStore({
    client: redisClient,
    prefix: options.prefix || 'rl:',
    sendCommand: (...args) => redisClient.sendCommand(args)
  });
  
  return createUserTierRateLimiter({ ...options, store });
}

/**
 * Dynamic rate limiting based on system load
 */
class DynamicRateLimiter {
  constructor(options = {}) {
    this.baseConfig = options.baseConfig || UserTiers.free;
    this.loadThresholds = options.loadThresholds || {
      low: 0.5,
      medium: 0.7,
      high: 0.9
    };
    this.adjustments = options.adjustments || {
      low: 1.5,    // 150% of normal limit
      medium: 1.0, // 100% of normal limit
      high: 0.5,   // 50% of normal limit
      critical: 0.25 // 25% of normal limit
    };
  }
  
  getCurrentLoad() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    // Simple load calculation (can be enhanced)
    const cpuLoad = (cpuUsage.user + cpuUsage.system) / 1000000000; // Convert to seconds
    const memLoad = memUsage.heapUsed / memUsage.heapTotal;
    
    return Math.max(cpuLoad, memLoad);
  }
  
  getLoadLevel() {
    const load = this.getCurrentLoad();
    
    if (load < this.loadThresholds.low) return 'low';
    if (load < this.loadThresholds.medium) return 'medium';
    if (load < this.loadThresholds.high) return 'high';
    return 'critical';
  }
  
  getAdjustedLimit(baseLimit) {
    const level = this.getLoadLevel();
    const adjustment = this.adjustments[level];
    
    return Math.floor(baseLimit * adjustment);
  }
  
  createMiddleware() {
    return (req, res, next) => {
      const tier = req.user?.subscription || 'free';
      const tierConfig = UserTiers[tier];
      const adjustedMax = this.getAdjustedLimit(tierConfig.max);
      
      const limiter = rateLimit({
        ...tierConfig,
        max: adjustedMax,
        handler: (req, res) => {
          const loadLevel = this.getLoadLevel();
          
          logger.warn('Dynamic rate limit exceeded', {
            tier,
            loadLevel,
            originalLimit: tierConfig.max,
            adjustedLimit: adjustedMax
          });
          
          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit temporarily reduced due to high system load (${loadLevel})`,
            currentLimit: adjustedMax,
            normalLimit: tierConfig.max,
            retryAfter: res.getHeader('Retry-After')
          });
        }
      });
      
      limiter(req, res, next);
    };
  }
}

/**
 * Rate limit bypass for trusted sources
 */
function createTrustedSourceBypass(trustedIPs = [], trustedTokens = []) {
  return (req, res, next) => {
    // Check trusted IPs
    if (trustedIPs.includes(req.ip)) {
      req.skipRateLimit = true;
      return next();
    }
    
    // Check trusted tokens
    const token = req.headers['x-bypass-token'];
    if (token && trustedTokens.includes(token)) {
      req.skipRateLimit = true;
      logger.info('Rate limit bypassed for trusted token', {
        token: token.substring(0, 8) + '...',
        ip: req.ip
      });
      return next();
    }
    
    next();
  };
}

/**
 * Mock function to get API key configuration
 * In production, this would query a database
 */
async function getApiKeyConfig(apiKey) {
  // Simulate database lookup
  const configs = {
    'test_key_premium': { tier: 'unlimited', owner: 'premium_user' },
    'test_key_basic': { tier: 'default', owner: 'basic_user' }
  };
  
  return configs[apiKey] || null;
}

/**
 * Rate limiting statistics collector
 */
class RateLimitStats {
  constructor() {
    this.stats = {
      totalRequests: 0,
      limitedRequests: 0,
      byTier: {},
      byRoute: {},
      byTime: []
    };
    
    // Keep hourly stats for the last 24 hours
    this.hourlyStats = new Array(24).fill(null).map(() => ({
      requests: 0,
      limited: 0,
      timestamp: null
    }));
    
    this.currentHour = new Date().getHours();
  }
  
  recordRequest(tier, route, limited = false) {
    this.stats.totalRequests++;
    
    if (limited) {
      this.stats.limitedRequests++;
    }
    
    // By tier
    if (!this.stats.byTier[tier]) {
      this.stats.byTier[tier] = { total: 0, limited: 0 };
    }
    this.stats.byTier[tier].total++;
    if (limited) {
      this.stats.byTier[tier].limited++;
    }
    
    // By route
    if (!this.stats.byRoute[route]) {
      this.stats.byRoute[route] = { total: 0, limited: 0 };
    }
    this.stats.byRoute[route].total++;
    if (limited) {
      this.stats.byRoute[route].limited++;
    }
    
    // Hourly stats
    const hour = new Date().getHours();
    if (hour !== this.currentHour) {
      this.rotateHourlyStats();
      this.currentHour = hour;
    }
    
    this.hourlyStats[hour].requests++;
    if (limited) {
      this.hourlyStats[hour].limited++;
    }
    this.hourlyStats[hour].timestamp = new Date().toISOString();
  }
  
  rotateHourlyStats() {
    const hour = new Date().getHours();
    this.hourlyStats[hour] = {
      requests: 0,
      limited: 0,
      timestamp: null
    };
  }
  
  getStats() {
    return {
      ...this.stats,
      hourlyStats: this.hourlyStats,
      limitRate: this.stats.totalRequests > 0 
        ? (this.stats.limitedRequests / this.stats.totalRequests) 
        : 0
    };
  }
  
  reset() {
    this.stats = {
      totalRequests: 0,
      limitedRequests: 0,
      byTier: {},
      byRoute: {},
      byTime: []
    };
    this.hourlyStats = this.hourlyStats.map(() => ({
      requests: 0,
      limited: 0,
      timestamp: null
    }));
  }
}

// Global stats instance
const globalStats = new RateLimitStats();

/**
 * Stats collection middleware
 */
function createStatsMiddleware() {
  return (req, res, next) => {
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const tier = req.user?.subscription || 'anonymous';
      const route = req.route?.path || req.path;
      const limited = res.statusCode === 429;
      
      globalStats.recordRequest(tier, route, limited);
      
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

module.exports = {
  createUserTierRateLimiter,
  createRouteRateLimiter,
  createApiKeyRateLimiter,
  createDistributedRateLimiter,
  createTrustedSourceBypass,
  createStatsMiddleware,
  DynamicRateLimiter,
  MemoryRateLimitStore,
  RateLimitStats,
  UserTiers,
  RouteRateLimits,
  getStats: () => globalStats.getStats(),
  resetStats: () => globalStats.reset()
};