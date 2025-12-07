// middleware/auth0Middleware.js - FIXED VERSION
const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const logger = require('../utils/logger');

const config = {
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
  }
};

// JWKS client for Auth0 token verification
const jwksClient = jwks({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000 // 10 minutes
});

const getKey = (header, callback) => {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

const checkJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Authorization header required',
      errorType: 'authentication_error',
      requiresLogin: true,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Bearer token required',
      errorType: 'authentication_error', 
      requiresLogin: true,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token required',
      errorType: 'authentication_error',
      requiresLogin: true,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  if (token.split('.').length !== 3) {
    logger.warn('Invalid token format', { 
      path: req.path,
      requestId: req.id 
    });
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token format',
      errorType: 'authentication_error',
      requiresLogin: true,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }
  
  jwt.verify(token, getKey, {
    audience: config.auth0.audience,
    issuer: config.auth0.issuer,
    algorithms: config.auth0.algorithms
  }, async (err, decoded) => {
    if (err) {
      logger.warn('JWT verification failed', {
        error: err.message,
        path: req.path,
        requestId: req.id
      });
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        errorType: 'authentication_error',
        requiresLogin: true,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }
    
    try {
      req.auth = decoded;
      req.userId = decoded.sub;
      
      logger.debug('JWT verification successful', {
        userId: decoded.sub,
        path: req.path,
        requestId: req.id
      });
      
      next();
    } catch (error) {
      logger.error('Auth processing error', {
        error: error.message,
        authId: decoded?.sub,
        requestId: req.id
      });
      
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication processing failed',
        errorType: 'authentication_error',
        requiresLogin: true,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }
  });
};

const loadUser = async (req, res, next) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({
        success: false,
        error: 'Valid authentication required',
        errorType: 'authentication_error',
        requiresLogin: true,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }

    const pool = req.app.locals.pool;
    
    if (!pool) {
      logger.error('Database pool not available');
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable',
        errorType: 'server_error',
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }

    const auth0Id = req.auth.sub;
    
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE auth0_id = $1',
        [auth0Id]
      );

      if (userResult.rows.length === 0) {
        // Create user if not exists
        try {
          const email = req.auth.email || req.auth[`${config.auth0.audience}/email`] || null;
          const name = req.auth.name || req.auth.nickname || 'User';

          // Use UPSERT pattern to handle race conditions
          let createResult = await pool.query(
            `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (auth0_id) DO UPDATE SET
               last_login = NOW(),
               updated_at = NOW()
             RETURNING *`,
            [auth0Id, email, name]
          );

          req.user = createResult.rows[0];

          logger.info('New user created', {
            userId: req.user.id,
            auth0Id: auth0Id,
            email: email
          });
        } catch (createError) {
          // Handle duplicate email constraint violation (account linking scenario)
          if (createError.code === '23505' && createError.constraint === 'users_email_key') {
            const email = req.auth.email || req.auth[`${config.auth0.audience}/email`] || null;
            logger.info('User exists with same email, linking auth0_id:', { email, auth0Id });

            try {
              const linkResult = await pool.query(
                `UPDATE users
                 SET auth0_id = $1, last_login = NOW(), updated_at = NOW()
                 WHERE email = $2
                 RETURNING *`,
                [auth0Id, email]
              );

              if (linkResult.rows.length > 0) {
                req.user = linkResult.rows[0];
                logger.info('Account linked successfully', {
                  userId: req.user.id,
                  auth0Id: auth0Id,
                  email: email
                });
              } else {
                throw new Error('Failed to link account');
              }
            } catch (linkError) {
              logger.error('Failed to link user account', {
                error: linkError.message,
                auth0Id: auth0Id
              });

              return res.status(500).json({
                success: false,
                error: 'User account setup failed',
                errorType: 'server_error',
                timestamp: new Date().toISOString(),
                requestId: req.id
              });
            }
          } else {
            logger.error('Failed to create user', {
              error: createError.message,
              auth0Id: auth0Id
            });

            return res.status(500).json({
              success: false,
              error: 'User account setup failed',
              errorType: 'server_error',
              timestamp: new Date().toISOString(),
              requestId: req.id
            });
          }
        }
      } else {
        req.user = userResult.rows[0];
        
        // Update last login
        try {
          await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [req.user.id]
          );
        } catch (updateError) {
          logger.warn('Failed to update last login', {
            error: updateError.message,
            userId: req.user.id
          });
        }
      }
      
      logger.debug('User loaded successfully', {
        userId: req.user.id,
        email: req.user.email,
        path: req.path
      });
      
      next();
    } catch (dbError) {
      logger.error('Database error during user lookup', {
        error: dbError.message,
        auth0Id: auth0Id,
        requestId: req.id
      });
      
      return res.status(500).json({
        success: false,
        error: 'Database error during authentication',
        errorType: 'server_error',
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error.message,
      path: req.path,
      requestId: req.id
    });
    
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      errorType: 'authentication_error',
      requiresLogin: true,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }
};

// Optional auth for public endpoints
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

  try {
    jwt.verify(token, getKey, {
      audience: config.auth0.audience,
      issuer: config.auth0.issuer,
      algorithms: config.auth0.algorithms
    }, async (err, decoded) => {
      if (err) {
        req.auth = null;
        req.userId = null;
        req.user = null;
        return next();
      }
      
      req.auth = decoded;
      req.userId = decoded.sub;
      
      try {
        const pool = req.app.locals.pool;
        if (pool) {
          const userResult = await pool.query(
            'SELECT * FROM users WHERE auth0_id = $1',
            [decoded.sub]
          );
          req.user = userResult.rows[0] || null;
        }
      } catch (error) {
        req.user = null;
      }
      
      next();
    });
  } catch (error) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    next();
  }
};

// ✅ FIXED: Combined middleware as a single function, not an array
const auth0Middleware = (req, res, next) => {
  checkJwt(req, res, (err) => {
    if (err) return next(err);
    loadUser(req, res, next);
  });
};

module.exports = {
  checkJwt,
  loadUser,
  auth0Middleware,  // ✅ Now exports as a single function
  optionalAuth
};