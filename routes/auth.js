// routes/auth.js - Authentication related routes
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { authLimiter, strictLimiter, standardLimiter } = require('../middleware/rateLimiting');
const { validateProfileUpdate } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get current user profile
router.get('/me', standardLimiter, auth0Middleware, asyncHandler(async (req, res) => {
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
router.get('/tos-status', standardLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    tosAccepted: user.tos_accepted || false,
    tosAcceptedAt: user.tos_accepted_at,
    tosVersionAccepted: user.tos_version_accepted
  });
}));

// Update user profile
router.put('/me', authLimiter, auth0Middleware, validateProfileUpdate, asyncHandler(async (req, res) => {
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

// Export user data (GDPR/privacy compliance)
router.get('/export', standardLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  // Query all user data in parallel (only tables that exist in the schema)
  const [userResult, documentsResult, casesResult, paymentsResult] = await Promise.all([
    client.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [user.id]
    ),
    client.query(
      'SELECT id, title, content, status, document_type, created_at, updated_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    ),
    client.query(
      'SELECT id, title, practice_area, state, county, court_name, cause_number, status, created_at, updated_at FROM cases WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    ),
    client.query(
      'SELECT id, document_type, amount, status, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    ),
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    user: userResult.rows[0] || null,
    documents: documentsResult.rows,
    cases: casesResult.rows,
    payments: paymentsResult.rows,
  };

  logger.info('User data exported', {
    userId: user.id,
    documentCount: documentsResult.rows.length,
    requestId: req.id
  });

  res.setHeader('Content-Disposition', 'attachment; filename="my-data-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportData, null, 2));
}));

// Delete user account (hard delete with data cleanup)
router.delete('/me', strictLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const userId = user.id;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  try {
    await client.query('BEGIN');

    // 1. Delete evidence files from filesystem
    const evidenceDir = path.join(__dirname, '..', 'documents', 'evidence', String(userId));
    try {
      await fs.rm(evidenceDir, { recursive: true, force: true });
      logger.info('Evidence files deleted', { userId, evidenceDir, requestId: req.id });
    } catch (fsError) {
      // Directory may not exist — that's fine
      if (fsError.code !== 'ENOENT') {
        logger.warn('Failed to delete evidence directory', {
          userId,
          error: fsError.message,
          requestId: req.id
        });
      }
    }

    // Delete order matters — FK constraints require children before parents.
    // ingested_documents.case_id → cases (no CASCADE), so delete ingested first.

    // 2. Delete ingested documents (user_id is TEXT in this table; has FK to cases)
    await client.query('DELETE FROM ingested_documents WHERE user_id = $1', [String(userId)]);

    // 3. Delete all documents
    await client.query('DELETE FROM documents WHERE user_id = $1', [userId]);

    // 4. Delete all cases (safe now that ingested_documents are gone)
    await client.query('DELETE FROM cases WHERE user_id = $1', [userId]);

    // 5. Delete all payments
    await client.query('DELETE FROM payments WHERE user_id = $1', [userId]);

    // 6. Anonymize activity logs (retain for analytics, strip PII)
    await client.query(
      `UPDATE activity_logs SET user_id = NULL, ip_address = 'redacted' WHERE user_id = $1`,
      [userId]
    );

    // 7. Anonymize TOS acceptance log (legal requirement to retain, but strip PII)
    await client.query(
      `UPDATE tos_acceptance_log SET ip_address = 'redacted' WHERE user_id = $1`,
      [userId]
    );

    // 8. Delete user identities
    await client.query('DELETE FROM user_identities WHERE user_id = $1', [userId]);

    // 9. Delete the user row (last — all FKs are cleared)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    logger.info('User account and all associated data hard-deleted', {
      userId,
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Account and all associated data deleted'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}));

// Get user's subscription status
router.get('/subscription', standardLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  const client = req.dbClient;  // RLS-protected client from auth0Middleware

  // Subscription info lives on the users table (no separate subscriptions table)
  const result = await client.query(
    'SELECT subscription_tier, subscription_status FROM users WHERE id = $1',
    [user.id]
  );

  if (result.rows.length === 0 || result.rows[0].subscription_status !== 'active') {
    return res.json({
      success: true,
      hasSubscription: false,
      tier: 'pay_per_use'
    });
  }

  const sub = result.rows[0];
  
  res.json({
    success: true,
    hasSubscription: true,
    subscription: {
      tier: sub.subscription_tier,
      status: sub.subscription_status,
    }
  });
}));

module.exports = router;