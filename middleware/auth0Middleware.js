// middleware/auth0Middleware.js - Complete fixed Auth0 JWT verification
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Configuration from environment variables
const config = {
  auth0: {
    domain: process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`,
    algorithms: ['RS256']
  }
};

// Validate Auth0 configuration on startup
if (!config.auth0.domain || !config.auth0.audience) {
  logger.error('❌ Auth0 configuration missing. Please check AUTH0_DOMAIN and AUTH0_AUDIENCE environment variables.');
  process.exit(1);
}

logger.info('🔧 Auth0 middleware configured:', {
  domain: config.auth0.domain,
  audience: config.auth0.audience,
  issuer: config.auth0.issuer
});

// JWKS client for fetching public keys
const client = jwksClient({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
  requestHeaders: {},
  timeout: 5000,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksRequestCacheLifetime: 600000 // 10 minutes
});

// Function to get signing key
const getKey = (header, callback) => {
  if (!header.kid) {
    logger.warn('No kid in JWT header');
    return callback(new Error('No kid in JWT header'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error('Error getting signing key:', err.message);
      return callback(err);
    }
    
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
};

// Helper function to get or create user in database
const getUserFromAuth = async (pool, authId, authData) => {
  try {
    // First, try to find existing user
    let result = await pool.query(
      'SELECT * FROM users WHERE auth0_id = $1',
      [authId]
    );

    if (result.rows.length > 0) {
      // Update last login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [result.rows[0].id]
      );
      return result.rows[0];
    }

    // Create new user if doesn't exist
    const email = authData.email || authData['https://your-domain.com/email'] || null;
    const name = authData.name || authData['https://your-domain.com/name'] || email?.split('@')[0] || 'User';

    result = await pool.query(
      `INSERT INTO users (auth0_id, email, name, created_at, last_login) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [authId, email, name]
    );

    logger.info('New user created:', {
      userId: result.rows[0].id,
      email: email,
      authId: authId
    });

    return result.rows[0];

  } catch (error) {
    logger.error('Database error in getUserFromAuth:', error);
    throw new Error('User verification failed');
  }
};

// Main Auth0 middleware
const auth0Middleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warn('No authorization header', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Authorization header required',
      errorType: 'authentication',
      requiresLogin: true,
      requestId: req.id
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid authorization header format',
      errorType: 'authentication',
      requiresLogin: true,
      requestId: req.id
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('No token provided', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'No token provided',
      errorType: 'authentication',
      requiresLogin: true,
      requestId: req.id
    });
  }

  // Basic token format validation
  if (token.split('.').length !== 3) {
    logger.warn('Invalid token format', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token format',
      errorType: 'authentication',
      requiresLogin: true,
      requestId: req.id
    });
  }

  // Verify JWT token
  jwt.verify(token, getKey, {
    audience: config.auth0.audience,
    issuer: config.auth0.issuer,
    algorithms: config.auth0.algorithms,
    clockTolerance: 60 // Allow 60 second clock skew
  }, async (err, decoded) => {
    if (err) {
      let errorMessage = 'Invalid or expired token';
      let errorType = 'authentication';

      // Handle specific JWT errors
      if (err.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired';
      } else if (err.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token';
      } else if (err.name === 'NotBeforeError') {
        errorMessage = 'Token not active';
      }

      logger.error('JWT verification error:', {
        error: err.message,
        name: err.name,
        path: req.path,
        requestId: req.id,
        expectedIssuer: config.auth0.issuer,
        expectedAudience: config.auth0.audience
      });
      
      return res.status(401).json({ 
        success: false, 
        error: errorMessage,
        errorType: errorType,
        requiresLogin: true,
        requestId: req.id
      });
    }

    try {
      // Store auth data
      req.auth = decoded;
      req.userId = decoded.sub;
      
      // Get or create user in database
      const pool = req.app.locals.pool;
      if (!pool) {
        logger.error('Database pool not available');
        return res.status(500).json({
          success: false,
          error: 'Database connection unavailable',
          requestId: req.id
        });
      }

      const user = await getUserFromAuth(pool, decoded.sub, decoded);
      req.user = user;
      
      logger.debug('Auth successful', {
        userId: user?.id,
        email: user?.email,
        authId: decoded.sub,
        path: req.path,
        requestId: req.id
      });
      
      next();

    } catch (error) {
      logger.error('User verification failed:', {
        error: error.message,
        stack: error.stack,
        authId: decoded?.sub,
        requestId: req.id
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'User verification failed',
        errorType: 'server_error',
        requestId: req.id
      });
    }
  });
};

// Optional Auth0 middleware for public endpoints
const optionalAuth0Middleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  
  if (!token || token.split('.').length !== 3) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    return next();
  }

  // Try to verify token, but don't fail if invalid
  jwt.verify(token, getKey, {
    audience: config.auth0.audience,
    issuer: config.auth0.issuer,
    algorithms: config.auth0.algorithms,
    clockTolerance: 60
  }, async (err, decoded) => {
    if (err) {
      logger.debug('Optional auth failed (continuing anyway):', err.message);
      req.auth = null;
      req.userId = null;
      req.user = null;
      return next();
    }

    try {
      req.auth = decoded;
      req.userId = decoded.sub;
      
      const pool = req.app.locals.pool;
      if (pool) {
        const user = await getUserFromAuth(pool, decoded.sub, decoded);
        req.user = user;
      }
      
      logger.debug('Optional auth successful', {
        userId: req.user?.id,
        authId: decoded.sub
      });

    } catch (error) {
      logger.debug('Optional auth user lookup failed (continuing anyway):', error.message);
      req.user = null;
    }

    next();
  });
};

// Admin middleware (requires specific role/permission)
const adminMiddleware = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requiresLogin: true
    });
  }

  // Check if user has admin role
  if (!req.user.is_admin && !req.auth.permissions?.includes('admin:access')) {
    logger.warn('Admin access denied', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      errorType: 'authorization'
    });
  }

  next();
};

// Export middleware functions
module.exports = {
  auth0Middleware,
  optionalAuth0Middleware,
  adminMiddleware,
  getUserFromAuth,
  config
};