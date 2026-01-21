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

// Helper function to extract provider from auth0_id
function extractProvider(auth0Id) {
  if (!auth0Id) return 'unknown';
  const parts = auth0Id.split('|');
  return parts.length > 0 ? parts[0] : 'unknown';
}

// Helper function to log audit events
async function logAuditEvent(client, userId, eventType, eventCategory, description, metadata = {}, severity = 'info') {
  try {
    await client.query(
      `INSERT INTO audit_log (user_id, event_type, event_category, description, metadata, severity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, eventType, eventCategory, description, JSON.stringify(metadata), severity]
    );
  } catch (error) {
    logger.error('Failed to log audit event', { error: error.message, eventType });
  }
}

// Helper function to set RLS context for user
async function setRLSContext(client, userId, isAdmin = false) {
  try {
    // Set session variables for Row Level Security
    // These variables are used by RLS policies to enforce data isolation
    // LOCAL scope ensures they only apply to current transaction
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', userId.toString()]);
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', isAdmin.toString()]);

    logger.debug('RLS context set for user', { userId, isAdmin });
  } catch (error) {
    logger.error('Failed to set RLS context', {
      error: error.message,
      userId,
      isAdmin
    });
    throw new Error('Failed to set security context');
  }
}

// Helper function to set RLS bypass (for system operations)
async function setRLSBypass(client) {
  try {
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);
    logger.debug('RLS bypass enabled for system operation');
  } catch (error) {
    logger.error('Failed to set RLS bypass', { error: error.message });
    throw new Error('Failed to set bypass context');
  }
}

// Middleware to clean up database client after request completes
const cleanupDbClient = (req, res, next) => {
  // Add cleanup to response finish event
  res.on('finish', () => {
    if (req.releaseDbClient) {
      try {
        req.releaseDbClient();
        logger.debug('DB client released', { requestId: req.id });
      } catch (error) {
        logger.error('Failed to release DB client', {
          error: error.message,
          requestId: req.id
        });
      }
    }
  });

  // Also clean up on error
  res.on('close', () => {
    if (req.releaseDbClient) {
      try {
        req.releaseDbClient();
      } catch (error) {
        // Ignore errors on close
      }
    }
  });

  next();
};

// Get or create user from Auth0 token - SECURE VERSION
async function getUserFromAuth(pool, authId, decoded) {
  let client;
  try {
    client = await pool.connect();
    const provider = extractProvider(authId);

    // First, try to find user by auth0_id in user_identities table
    let result = await client.query(
      `SELECT u.* FROM users u
       INNER JOIN user_identities ui ON u.id = ui.user_id
       WHERE ui.auth0_id = $1`,
      [authId]
    );

    // Fallback: Check legacy users.auth0_id for backwards compatibility
    if (result.rows.length === 0) {
      result = await client.query('SELECT * FROM users WHERE auth0_id = $1', [authId]);
    }

    if (result.rows.length === 0 && decoded) {
      // User not found - create new user
      const email = decoded.email || '';
      const name = decoded.name || '';

      logger.info('Creating new user:', { email, authId, provider });

      try {
        await client.query('BEGIN');

        // Create user account
        result = await client.query(
          `INSERT INTO users (auth0_id, email, name, created_at, updated_at, last_login)
           VALUES ($1, $2, $3, NOW(), NOW(), NOW())
           RETURNING *`,
          [authId, email, name]
        );

        const newUser = result.rows[0];

        // Create corresponding user_identity record
        await client.query(
          `INSERT INTO user_identities (user_id, auth0_id, provider, is_primary, verified)
           VALUES ($1, $2, $3, true, true)`,
          [newUser.id, authId, provider]
        );

        // Log audit event
        await logAuditEvent(
          client,
          newUser.id,
          'account_created',
          'authentication',
          'New user account created',
          { auth0_id: authId, provider, email },
          'info'
        );

        await client.query('COMMIT');

      } catch (insertError) {
        await client.query('ROLLBACK');

        // SECURITY FIX: Handle duplicate email constraint violation
        // Do NOT overwrite existing user's auth0_id - this was the vulnerability
        if (insertError.code === '23505' && insertError.constraint === 'users_email_key') {
          logger.warn('SECURITY: Blocked signup with existing email:', { email, authId, provider });

          // Log security event
          await logAuditEvent(
            client,
            null,
            'duplicate_email_signup_blocked',
            'authentication',
            'Blocked signup attempt with existing email address',
            { email, auth0_id: authId, provider },
            'warning'
          );

          // Return null to trigger authentication error
          // The caller should handle this by returning a 409 error to the user
          throw new Error('DUPLICATE_EMAIL: An account with this email already exists. Please sign in using your original authentication method.');
        } else {
          throw insertError;
        }
      }
    } else if (result.rows.length > 0) {
      // Update last login for existing user
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [result.rows[0].id]
      );

      // Update last_used_at for this identity
      await client.query(
        'UPDATE user_identities SET last_used_at = NOW() WHERE auth0_id = $1',
        [authId]
      );
    }

    return result.rows[0] || null;
  } catch (error) {
    // Re-throw with context
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

      if (!user) {
        logger.error('User verification returned null', {
          authId: decoded.sub,
          requestId: req.id
        });
        return res.status(401).json({
          success: false,
          error: 'User verification failed',
          requestId: req.id
        });
      }

      req.user = user;

      // CRITICAL: Set RLS context for this request
      // This ensures Row Level Security policies enforce data isolation
      const client = await pool.connect();
      try {
        await setRLSContext(client, user.id, user.is_admin || user.subscription_tier === 'admin');

        // Store client in request for use by route handlers
        // This client has the RLS context set
        req.dbClient = client;
        req.releaseDbClient = () => client.release();

        logger.debug('Auth successful with RLS context', {
          userId: user.id,
          email: user.email,
          isAdmin: user.is_admin || user.subscription_tier === 'admin',
          path: req.path,
          requestId: req.id
        });

        next();
      } catch (rlsError) {
        client.release();
        logger.error('Failed to set RLS context', {
          error: rlsError.message,
          userId: user.id,
          requestId: req.id
        });
        return res.status(500).json({
          success: false,
          error: 'Security context initialization failed',
          requestId: req.id
        });
      }
    } catch (error) {
      logger.error('User verification failed:', {
        error: error.message,
        authId: decoded?.sub,
        requestId: req.id
      });

      // Handle duplicate email error specially
      if (error.message && error.message.startsWith('DUPLICATE_EMAIL:')) {
        return res.status(409).json({
          success: false,
          error: error.message.replace('DUPLICATE_EMAIL: ', ''),
          errorType: 'account_exists',
          errorCode: 'DUPLICATE_EMAIL',
          requiresLogin: true,
          requestId: req.id
        });
      }

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
  getUserFromAuth,
  setRLSContext,
  setRLSBypass,
  cleanupDbClient
};