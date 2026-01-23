// middleware/auth0Middleware.js - ENHANCED WITH RLS SUPPORT
const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const logger = require('../utils/logger');

// Import RLS helper functions from auth.js
// These are minimal functions that don't require full middleware setup
const { setRLSContext, setRLSBypass } = require('./auth');

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

// Helper function to extract provider from auth0_id
const extractProvider = (auth0Id) => {
  if (!auth0Id) return 'unknown';
  const parts = auth0Id.split('|');
  return parts.length > 0 ? parts[0] : 'unknown';
};

// Helper function to log audit events
const logAuditEvent = async (pool, userId, eventType, eventCategory, description, metadata = {}, severity = 'info') => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, event_type, event_category, description, metadata, severity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, eventType, eventCategory, description, JSON.stringify(metadata), severity]
    );
  } catch (error) {
    logger.error('Failed to log audit event', { error: error.message, eventType });
  }
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
    const provider = extractProvider(auth0Id);

    try {
      // First, try to find user by auth0_id in user_identities table
      // This supports multi-provider authentication
      let userResult = await pool.query(
        `SELECT u.* FROM users u
         INNER JOIN user_identities ui ON u.id = ui.user_id
         WHERE ui.auth0_id = $1`,
        [auth0Id]
      );

      // Fallback: Check legacy users.auth0_id for backwards compatibility
      if (userResult.rows.length === 0) {
        userResult = await pool.query(
          'SELECT * FROM users WHERE auth0_id = $1',
          [auth0Id]
        );
      }

      if (userResult.rows.length === 0) {
        // Create new user
        try {
          const email = req.auth.email || req.auth[`${config.auth0.audience}/email`] || null;
          const name = req.auth.name || req.auth.nickname || 'User';

          // Start transaction for atomic user creation
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            // Create user account
            const createResult = await client.query(
              `INSERT INTO users (auth0_id, email, name, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               RETURNING *`,
              [auth0Id, email, name]
            );

            const newUser = createResult.rows[0];

            // Create corresponding user_identity record
            await client.query(
              `INSERT INTO user_identities (user_id, auth0_id, provider, is_primary, verified)
               VALUES ($1, $2, $3, true, true)`,
              [newUser.id, auth0Id, provider]
            );

            // Log audit event
            await client.query(
              `INSERT INTO audit_log (user_id, event_type, event_category, description, metadata, severity)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [newUser.id, 'account_created', 'authentication', 'New user account created',
               JSON.stringify({ auth0_id: auth0Id, provider, email }), 'info']
            );

            await client.query('COMMIT');

            req.user = newUser;

            logger.info('New user created', {
              userId: newUser.id,
              auth0Id: auth0Id,
              email: email,
              provider: provider
            });
          } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
          } finally {
            client.release();
          }
        } catch (createError) {
          // SECURITY FIX: Handle duplicate email constraint violation
          // Do NOT overwrite existing user's auth0_id - this was the vulnerability
          if (createError.code === '23505' && createError.constraint === 'users_email_key') {
            const email = req.auth.email || req.auth[`${config.auth0.audience}/email`] || null;

            // Log security event
            logger.warn('SECURITY: Attempted signup with existing email', {
              email,
              newAuth0Id: auth0Id,
              newProvider: provider,
              requestId: req.id
            });

            await logAuditEvent(
              pool,
              null, // No user_id since we're blocking the attempt
              'duplicate_email_signup_blocked',
              'authentication',
              'Blocked signup attempt with existing email address',
              { email, auth0_id: auth0Id, provider },
              'warning'
            );

            // SECURE RESPONSE: Do not overwrite - inform user to use original login method
            return res.status(409).json({
              success: false,
              error: 'An account with this email address already exists. Please sign in using your original authentication method, or contact support to link multiple accounts.',
              errorType: 'account_exists',
              errorCode: 'DUPLICATE_EMAIL',
              timestamp: new Date().toISOString(),
              requestId: req.id
            });
          } else {
            logger.error('Failed to create user', {
              error: createError.message,
              code: createError.code,
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

        // Update last login and last_used_at for this identity
        try {
          await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [req.user.id]
          );

          await pool.query(
            'UPDATE user_identities SET last_used_at = NOW() WHERE auth0_id = $1',
            [auth0Id]
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
        auth0Id: auth0Id,
        path: req.path
      });

      // ✅ NEW: Set RLS context for this request
      // RLS enforces data isolation at database level
      try {
        const dbClient = await pool.connect();
        try {
          await setRLSContext(
            dbClient,
            req.user.id,
            req.user.is_admin || req.user.subscription_tier === 'admin'
          );

          // Store client in request for routes to use
          // Routes should use req.dbClient instead of req.app.locals.pool
          req.dbClient = dbClient;
          req.releaseDbClient = () => dbClient.release();

          logger.debug('RLS context set for request', {
            userId: req.user.id,
            requestId: req.id
          });

          next();
        } catch (rlsError) {
          dbClient.release();
          logger.error('Failed to set RLS context', {
            error: rlsError.message,
            userId: req.user.id,
            requestId: req.id
          });

          return res.status(500).json({
            success: false,
            error: 'Security context initialization failed',
            errorType: 'server_error',
            timestamp: new Date().toISOString(),
            requestId: req.id
          });
        }
      } catch (clientError) {
        logger.error('Failed to acquire database client for RLS', {
          error: clientError.message,
          userId: req.user.id,
          requestId: req.id
        });

        return res.status(500).json({
          success: false,
          error: 'Database connection failed',
          errorType: 'server_error',
          timestamp: new Date().toISOString(),
          requestId: req.id
        });
      }
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
// ✅ ENHANCED: Also sets up RLS context when user is authenticated
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    req.dbClient = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.split('.').length !== 3) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    req.dbClient = null;
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
        req.dbClient = null;
        return next();
      }

      req.auth = decoded;
      req.userId = decoded.sub;

      try {
        const pool = req.app.locals.pool;
        if (pool) {
          // Try user_identities table first, then fallback to legacy users.auth0_id
          let userResult = await pool.query(
            `SELECT u.* FROM users u
             INNER JOIN user_identities ui ON u.id = ui.user_id
             WHERE ui.auth0_id = $1`,
            [decoded.sub]
          );

          if (userResult.rows.length === 0) {
            userResult = await pool.query(
              'SELECT * FROM users WHERE auth0_id = $1',
              [decoded.sub]
            );
          }

          req.user = userResult.rows[0] || null;

          // ✅ NEW: Set RLS context for authenticated optional auth too
          if (req.user) {
            try {
              const dbClient = await pool.connect();
              try {
                await setRLSContext(
                  dbClient,
                  req.user.id,
                  req.user.is_admin || req.user.subscription_tier === 'admin'
                );
                req.dbClient = dbClient;
                req.releaseDbClient = () => dbClient.release();

                logger.debug('RLS context set in optionalAuth', {
                  userId: req.user.id,
                  requestId: req.id
                });
              } catch (rlsError) {
                dbClient.release();
                logger.warn('Failed to set RLS context in optionalAuth', {
                  error: rlsError.message,
                  userId: req.user.id
                });
                // Don't fail - still authenticate user, just without RLS
                // This maintains backwards compatibility for optional endpoints
              }
            } catch (clientError) {
              logger.warn('Failed to acquire client for RLS in optionalAuth', {
                error: clientError.message,
                userId: req.user?.id
              });
              // Don't fail - still authenticate user
            }
          }
        }
      } catch (error) {
        req.user = null;
        req.dbClient = null;
        logger.debug('Optional auth user lookup failed', {
          error: error.message,
          requestId: req.id
        });
      }

      next();
    });
  } catch (error) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    req.dbClient = null;
    logger.debug('Optional auth token verification failed', {
      error: error.message,
      requestId: req.id
    });
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

// ✅ NEW: Cleanup middleware to release database clients
// Must be registered globally in server.js to ensure proper resource cleanup
const cleanupDbClient = (req, res, next) => {
  // Schedule cleanup when response finishes
  res.on('finish', () => {
    if (req.releaseDbClient) {
      try {
        req.releaseDbClient();
        logger.debug('DB client released', {
          requestId: req.id,
          userId: req.user?.id
        });
      } catch (error) {
        logger.error('Failed to release DB client', {
          error: error.message,
          requestId: req.id,
          userId: req.user?.id
        });
      }
    }
  });

  // Also clean up on connection close
  res.on('close', () => {
    if (req.releaseDbClient) {
      try {
        req.releaseDbClient();
      } catch (error) {
        // Silently ignore errors on close
        logger.debug('DB client release error on close (ignored)', {
          error: error.message,
          requestId: req.id
        });
      }
    }
  });

  next();
};

module.exports = {
  checkJwt,
  loadUser,
  auth0Middleware,  // ✅ Now exports as a single function
  optionalAuth,
  cleanupDbClient,  // ✅ NEW: Export cleanup middleware
  setRLSContext,    // ✅ Re-export from auth.js for convenience
  setRLSBypass      // ✅ Re-export from auth.js for use in webhooks
};