// routes/auth.js - Authentication related routes
const express = require('express');
const router = express.Router();
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authLimiter, strictLimiter } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

// Get current user profile
router.get('/me', auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
      requestId: req.id
    });
  }

  logger.info('User profile accessed', {
    userId: user.id,
    requestId: req.id
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      subscriptionStatus: user.subscription_status,
      subscriptionTier: user.subscription_tier,
      createdAt: user.created_at,
      lastLoginAt: user.last_login,
      tosAccepted: user.tos_accepted,
      tosAcceptedAt: user.tos_accepted_at,
      tosVersionAccepted: user.tos_version_accepted
    }
  });
}));

// Accept Terms of Service
router.post('/accept-tos', authLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const { tosVersion, researchConsent = false } = req.body;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  if (!tosVersion) {
    return res.status(400).json({
      success: false,
      error: 'TOS version is required',
      requestId: req.id
    });
  }

  // Get IP address from request
  const ipAddress = req.ip || req.connection.remoteAddress ||
                    req.headers['x-forwarded-for']?.split(',')[0] ||
                    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Start transaction
  try {
    await client.query('BEGIN');

    // Update user's TOS acceptance
    await client.query(
      `UPDATE users
       SET tos_accepted = true,
           tos_accepted_at = NOW(),
           tos_version_accepted = $1,
           tos_ip_address = $2,
           research_consent = $3,
           research_consent_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $4`,
      [tosVersion, ipAddress, researchConsent, user.id]
    );

    // Log TOS acceptance for audit trail
    await client.query(
      `INSERT INTO tos_acceptance_log
       (user_id, tos_version, ip_address, user_agent, research_consent, accepted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, tos_version) DO UPDATE
       SET research_consent = EXCLUDED.research_consent,
           ip_address = EXCLUDED.ip_address,
           user_agent = EXCLUDED.user_agent,
           accepted_at = NOW()`,
      [user.id, tosVersion, ipAddress, userAgent, researchConsent]
    );

    await client.query('COMMIT');

    logger.info('User accepted TOS', {
      userId: user.id,
      tosVersion,
      researchConsent,
      ipAddress,
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Terms of Service accepted',
      tosAccepted: true,
      tosVersion,
      researchConsent
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}));

// Get TOS acceptance status
router.get('/tos-status', auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    tosAccepted: user.tos_accepted || false,
    tosAcceptedAt: user.tos_accepted_at,
    tosVersionAccepted: user.tos_version_accepted
  });
}));

// Update user profile
router.put('/me', authLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const { name, preferences } = req.body;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }

  if (preferences !== undefined) {
    updates.push(`preferences = $${paramCount++}`);
    values.push(JSON.stringify(preferences));
  }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No updates provided',
      requestId: req.id
    });
  }

  updates.push('updated_at = NOW()');
  values.push(user.id);

  const result = await client.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  
  logger.info('User profile updated', {
    userId: user.id,
    updates: updates.length,
    requestId: req.id
  });
  
  res.json({
    success: true,
    user: {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      preferences: result.rows[0].preferences,
      updatedAt: result.rows[0].updated_at
    }
  });
}));

// Delete user account
router.delete('/me', strictLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  // This is a soft delete - we keep the user record but mark it as deleted
  await client.query(
    `UPDATE users SET
     subscription_status = 'deleted',
     email = CONCAT('deleted_', id, '_', email),
     auth0_id = CONCAT('deleted_', id, '_', auth0_id),
     updated_at = NOW()
     WHERE id = $1`,
    [user.id]
  );
  
  logger.info('User account deleted', {
    userId: user.id,
    requestId: req.id
  });
  
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

// Get user's subscription status
router.get('/subscription', auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  const subscription = await client.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id]
  );
  
  if (subscription.rows.length === 0) {
    return res.json({
      success: true,
      hasSubscription: false,
      tier: 'pay_per_use'
    });
  }
  
  const sub = subscription.rows[0];
  
  res.json({
    success: true,
    hasSubscription: true,
    subscription: {
      id: sub.id,
      tier: sub.tier,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      documentsUsed: sub.documents_used_this_period,
      documentsIncluded: sub.documents_included
    }
  });
}));

module.exports = router;