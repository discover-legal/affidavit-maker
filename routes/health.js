// routes/health.js - Health Check Routes
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * Basic health check endpoint
 */
router.get('/health', asyncHandler(async (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  };

  // Check database if available
  if (req.app.locals.pool) {
    try {
      const client = await req.app.locals.pool.connect();
      await client.query('SELECT 1');
      client.release();
      healthData.database = { status: 'connected' };
    } catch (error) {
      healthData.database = { 
        status: 'error', 
        message: error.message 
      };
      healthData.status = 'degraded';
    }
  }

  // Check if services are initialized
  if (req.app.locals.affidavitService) {
    healthData.services = { affidavitService: 'initialized' };
  }

  res.sendSuccess(healthData);
}));

/**
 * Simple ping endpoint for load balancers
 */
router.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

/**
 * Detailed system status (admin only)
 */
router.get('/status', asyncHandler(async (req, res) => {
  // Basic system info
  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: {
      process: Math.floor(process.uptime()),
      system: Math.floor(require('os').uptime())
    },
    memory: {
      process: process.memoryUsage(),
      system: {
        total: Math.round(require('os').totalmem() / 1024 / 1024),
        free: Math.round(require('os').freemem() / 1024 / 1024)
      }
    },
    cpu: {
      loadAverage: require('os').loadavg(),
      cores: require('os').cpus().length
    }
  };

  // Database pool status
  if (req.app.locals.pool) {
    try {
      const client = await req.app.locals.pool.connect();
      const result = await client.query('SELECT version(), current_database(), current_user');
      client.release();
      
      status.database = {
        status: 'connected',
        version: result.rows[0].version,
        database: result.rows[0].current_database,
        user: result.rows[0].current_user,
        pool: {
          totalCount: req.app.locals.pool.totalCount,
          idleCount: req.app.locals.pool.idleCount,
          waitingCount: req.app.locals.pool.waitingCount
        }
      };
    } catch (error) {
      status.database = {
        status: 'error',
        error: error.message
      };
    }
  }

  // External services check
  status.services = {};
  
  // Check OpenAI (if configured)
  if (process.env.OPENAI_API_KEY) {
    status.services.openai = { configured: true };
  }
  
  // Check Auth0 (if configured)
  if (process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_SECRET) {
    status.services.auth0 = { configured: true };
  }
  
  // Check Stripe (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    status.services.stripe = { configured: true };
  }

  res.sendSuccess(status);
}));

/**
 * Readiness probe for Kubernetes/container orchestration
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const checks = {};
  let isReady = true;

  // Check database connection
  if (req.app.locals.pool) {
    try {
      const client = await req.app.locals.pool.connect();
      await client.query('SELECT 1');
      client.release();
      checks.database = true;
    } catch (error) {
      checks.database = false;
      isReady = false;
    }
  }

  // Check if required services are available
  checks.affidavitService = !!req.app.locals.affidavitService;
  if (!checks.affidavitService) isReady = false;

  if (isReady) {
    res.sendSuccess({ ready: true, checks });
  } else {
    res.status(503).json({
      success: false,
      error: 'Service not ready',
      errorType: 'service_unavailable',
      checks,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * Liveness probe for Kubernetes/container orchestration
 */
router.get('/live', (req, res) => {
  // Just check if the process is running
  res.sendSuccess({ alive: true, timestamp: new Date().toISOString() });
});

module.exports = router;