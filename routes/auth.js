// routes/auth.js - Authentication related routes
const express = require('express');
const router = express.Router();
const { checkJwt } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../services/logger');

// Get current user profile
router.get('/me', checkJwt, asyncHandler(async (req, res) => {
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
      lastLoginAt: user.last_login_at
    }
  });
}));

// Update user profile
router.put('/me', checkJwt, asyncHandler(async (req, res) => {
  const user = req.user;
  const { name, preferences } = req.body;
  const pool = req.app.locals.pool;
  
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
  
  const result = await pool.query(
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
router.delete('/me', checkJwt, asyncHandler(async (req, res) => {
  const user = req.user;
  const pool = req.app.locals.pool;
  
  // This is a soft delete - we keep the user record but mark it as deleted
  await pool.query(
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
router.get('/subscription', checkJwt, asyncHandler(async (req, res) => {
  const user = req.user;
  const pool = req.app.locals.pool;
  
  const subscription = await pool.query(
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