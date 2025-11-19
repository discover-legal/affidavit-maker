// middleware/auth.js - Fixed Auth0 JWT verification
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Process Auth0 domain to get jwksUri
const processAuth0Domain = (domain) => {
  if (!domain) return null;
  // Remove any protocol if present
  domain = domain.replace(/^https?:\/\//, '');
  // Remove any trailing slash
  domain = domain.replace(/\/$/, '');
  // Add https:// protocol
  return `https://${domain}`;
};

const auth0Domain = processAuth0Domain(process.env.AUTH0_DOMAIN);
const jwksUri = `${auth0Domain}/.well-known/jwks.json`;
const auth0Audience = process.env.AUTH0_AUDIENCE;
const auth0Issuer = `${auth0Domain}/`;
const auth0Algorithms = ['RS256'];

// Create JWKS client
const client = jwksClient({
  jwksUri: jwksUri,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// Get signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error('JWKS key retrieval error:', err);
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Get or create user from Auth0 token
async function getUserFromAuth(pool, authId, decoded) {
  let client;
  try {
    client = await pool.connect();
    
    // Try to find existing user
    let result = await client.query('SELECT * FROM users WHERE auth0_id = $1', [authId]);
    
    if (result.rows.length === 0 && decoded) {
      // Create new user
      logger.info('Creating new user:', { email: decoded.email, authId });
      result = await client.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at, last_login)
         VALUES ($1, $2, $3, NOW(), NOW(), NOW())
         RETURNING *`,
        [authId, decoded.email || '', decoded.name || '']
      );
    } else if (result.rows.length > 0) {
      // Update last login
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [result.rows[0].id]
      );
    }
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('User lookup/creation error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

// Main JWT verification middleware
const checkJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', { 
      path: req.path,
      ip: req.ip,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Authorization token required',
      requiresLogin: true,
      requestId: req.id
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Validate token format
  if (!token || token.split('.').length !== 3) {
    logger.warn('Invalid token format', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token format',
      requiresLogin: true,
      requestId: req.id
    });
  }
  
  jwt.verify(token, getKey, {
    audience: auth0Audience,
    issuer: auth0Issuer,
    algorithms: auth0Algorithms
  }, async (err, decoded) => {
    if (err) {
      logger.error('JWT verification error:', {
        error: err.message,
        path: req.path,
        requestId: req.id,
        expectedIssuer: auth0Issuer,
        expectedAudience: auth0Audience
      });
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        requiresLogin: true,
        requestId: req.id
      });
    }
    
    try {
      req.auth = decoded;
      req.userId = decoded.sub;
      
      // Get or create user in database
      const pool = req.app.locals.pool;
      const user = await getUserFromAuth(pool, decoded.sub, decoded);
      req.user = user;
      
      logger.debug('Auth successful', {
        userId: user?.id,
        email: user?.email,
        path: req.path,
        requestId: req.id
      });
      
      next();
    } catch (error) {
      logger.error('User verification failed:', {
        error: error.message,
        authId: decoded?.sub,
        requestId: req.id
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'User verification failed',
        requestId: req.id
      });
    }
  });
};

// Optional JWT verification for public endpoints
const optionalAuth = async (req, res, next) => {
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
  
  jwt.verify(token, getKey, {
    audience: auth0Audience,
    issuer: auth0Issuer,
    algorithms: auth0Algorithms
  }, async (err, decoded) => {
    if (err) {
      // Log but don't fail - this is optional auth
      logger.debug('Optional auth failed:', {
        error: err.message,
        path: req.path,
        requestId: req.id
      });
      
      req.auth = null;
      req.userId = null;
      req.user = null;
    } else {
      try {
        req.auth = decoded;
        req.userId = decoded.sub;
        
        const pool = req.app.locals.pool;
        req.user = await getUserFromAuth(pool, decoded.sub, decoded);
      } catch (error) {
        logger.error('Optional auth user lookup failed:', {
          error: error.message,
          requestId: req.id
        });
        
        req.auth = decoded;
        req.userId = decoded.sub;
        req.user = null;
      }
    }
    
    next();
  });
};

// Admin check middleware
const checkAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      requestId: req.id
    });
  }
  
  // Check if user has admin privileges
  if (req.user.subscription_tier !== 'admin') {
    logger.warn('Non-admin user attempted admin access', {
      userId: req.user.id,
      path: req.path,
      requestId: req.id
    });
    
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      requestId: req.id
    });
  }
  
  next();
};

module.exports = {
  checkJwt,
  optionalAuth,
  checkAdmin,
  getUserFromAuth
};