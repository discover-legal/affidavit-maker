// middleware/auth0Middleware.js - Updated import
const { expressjwt: jwt } = require('express-jwt');  // Note the change here
const jwksRsa = require('jwks-rsa');
const { dbService } = require('../services/DatabaseService');
const logger = require('../services/logger');

// Configure Auth0 JWT validation
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 2,  // ← Reduce from 5 to 2
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    handleSigningKeyError: (err, cb) => {
      if (err instanceof jwksRsa.JwksRateLimitError) {
        return cb(new Error('Too many requests to Auth0'));
      }
      return cb(err);
    }
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256']
});

// Middleware to load user from database based on Auth0 ID
const loadUser = async (req, res, next) => {
  try {
    // Skip if no auth user
    if (!req.auth || !req.auth.sub) {
      return next();
    }
    
    const auth0Id = req.auth.sub;
    const userResult = await dbService.query(
      'SELECT * FROM users WHERE auth0_id = $1 AND is_active = true AND deleted_at IS NULL',
      [auth0Id]
    );
    
    if (userResult.rows.length === 0) {
      // Create new user if not found
      try {
        // Extract info from token
        const email = req.auth.email || '';
        const name = req.auth.name || req.auth.nickname || email;
        
        const newUserResult = await dbService.query(
          `INSERT INTO users (
            auth0_id, email, name, email_verified, 
            created_at, updated_at, last_login
          ) VALUES ($1, $2, $3, $4, $5, $5, $5)
          RETURNING *`,
          [
            auth0Id,
            email,
            name,
            req.auth.email_verified || false,
            new Date()
          ]
        );
        
        req.user = newUserResult.rows[0];
        logger.info('Created new user from token', {
          auth0Id,
          userId: req.user.id
        });
      } catch (err) {
        // Check if user was created by another request
        const retryResult = await dbService.query(
          'SELECT * FROM users WHERE auth0_id = $1',
          [auth0Id]
        );
        
        if (retryResult.rows.length > 0) {
          req.user = retryResult.rows[0];
        } else {
          logger.error('Failed to create user from token', {
            error: err.message,
            auth0Id
          });
          return next(err);
        }
      }
    } else {
      req.user = userResult.rows[0];
      
      // Update last login time
      await dbService.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [req.user.id]
      );
    }
    
    next();
  } catch (error) {
    logger.error('Error loading user from database', {
      error: error.message,
      auth0Id: req.auth?.sub
    });
    next(error);
  }
};

// Combined middleware for auth
const auth0Middleware = [checkJwt, loadUser];

module.exports = {
  checkJwt,
  loadUser,
  auth0Middleware
};