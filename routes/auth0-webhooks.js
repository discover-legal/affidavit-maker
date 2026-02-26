// routes/auth0-webhooks.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { dbService } = require('../services/DatabaseService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * Validate Auth0 ID format
 * Auth0 IDs are: provider|userid (e.g., "auth0|123abc", "google-oauth2|456def")
 */
const isValidAuth0Id = (id) => {
  if (!id || typeof id !== 'string') return false;
  // Provider: lowercase alphanumeric with hyphens, followed by pipe, followed by alphanumeric
  return /^[a-z0-9-]+\|[a-zA-Z0-9_-]+$/.test(id) && id.length <= 128;
};

// Verify Auth0 webhook signature
const verifyAuth0Webhook = (req, res, next) => {
  const auth0Secret = process.env.AUTH0_WEBHOOK_SECRET;
  const signature = req.headers['auth0-signature'];

  if (!auth0Secret) {
    logger.error('AUTH0_WEBHOOK_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook verification not configured'
    });
  }

  if (!signature) {
    logger.logSecurity('auth0_webhook_missing_signature', {
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Missing signature'
    });
  }

  try {
    // SECURITY (HIGH-02): Require rawBody - don't fall back to JSON.stringify
    // which can produce different bytes than the original request
    const requestBody = req.rawBody;
    if (!requestBody) {
      logger.logSecurity('auth0_webhook_missing_rawbody', {
        path: req.path,
        ip: req.ip
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request - missing raw body'
      });
    }

    // Compute HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', auth0Secret)
      .update(requestBody, 'utf8')
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      throw new Error('Signature length mismatch');
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new Error('Signature verification failed');
    }

    // Signature is valid
    logger.info('Auth0 webhook signature verified', {
      path: req.path
    });
    next();
  } catch (error) {
    logger.logSecurity('auth0_webhook_verification_failed', {
      error: error.message,
      path: req.path,
      ip: req.ip,
      signaturePreview: signature?.substring(0, 20) + '...'
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
  }
};

// Handle user profile updates from Auth0
router.post('/user-update', 
  verifyAuth0Webhook,
  asyncHandler(async (req, res) => {
    const { user, updateTime } = req.body;
    
    if (!user || !user.user_id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload'
      });
    }

    // Validate Auth0 ID format to prevent injection
    if (!isValidAuth0Id(user.user_id)) {
      logger.logSecurity('auth0_webhook_invalid_id_format', {
        receivedId: String(user.user_id).substring(0, 50),
        path: req.path
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    logger.info('Auth0 user update webhook received', {
      auth0Id: user.user_id,
      updateTime
    });
    
    try {
      // Check if user exists
      const userResult = await dbService.query(
        'SELECT id FROM users WHERE auth0_id = $1',
        [user.user_id]
      );
      
      if (userResult.rows.length === 0) {
        // Create new user
        await dbService.query(
          `INSERT INTO users (
            auth0_id, email, name, email_verified, 
            created_at, updated_at, last_login
          ) VALUES ($1, $2, $3, $4, $5, $5, $5)`,
          [
            user.user_id,
            user.email,
            user.name || user.nickname || user.email,
            user.email_verified || false,
            new Date()
          ]
        );
        
        logger.info('Created new user from Auth0 webhook', {
          auth0Id: user.user_id,
          email: user.email
        });
      } else {
        // Update existing user
        await dbService.query(
          `UPDATE users SET 
            email = $1, 
            name = $2, 
            email_verified = $3, 
            updated_at = $4
          WHERE auth0_id = $5`,
          [
            user.email,
            user.name || user.nickname || user.email,
            user.email_verified || false,
            new Date(),
            user.user_id
          ]
        );
        
        logger.info('Updated user from Auth0 webhook', {
          auth0Id: user.user_id,
          userId: userResult.rows[0].id
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error processing Auth0 webhook', {
        error: error.message,
        auth0Id: user.user_id
      });
      throw error;
    }
  })
);

// Handle user email update from Auth0
router.post('/email-update',
  verifyAuth0Webhook,
  asyncHandler(async (req, res) => {
    const { user, updateTime } = req.body;
    
    if (!user || !user.user_id || !user.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid webhook payload' 
      });
    }
    
    logger.info('Auth0 email update webhook received', {
      auth0Id: user.user_id,
      updateTime
    });
    
    try {
      // Update user email
      const result = await dbService.query(
        `UPDATE users SET 
          email = $1, 
          email_verified = $2,
          updated_at = $3
        WHERE auth0_id = $4
        RETURNING id`,
        [
          user.email,
          user.email_verified || false,
          new Date(),
          user.user_id
        ]
      );
      
      if (result.rowCount === 0) {
        logger.warn('User not found for Auth0 email update', {
          auth0Id: user.user_id
        });
      } else {
        logger.info('Updated user email from Auth0 webhook', {
          auth0Id: user.user_id,
          userId: result.rows[0].id
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error processing Auth0 email webhook', {
        error: error.message,
        auth0Id: user.user_id
      });
      throw error;
    }
  })
);

module.exports = router;