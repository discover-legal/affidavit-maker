// routes/payment.js - Payment Routes with Security
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const logger = require('../utils/logger');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { validatePayment, validateId } = require('../middleware/validation');
const { paymentLimiter, strictLimiter } = require('../middleware/rateLimiting');

// Initialize Stripe
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  logger.warn('Stripe not configured - payment routes will be disabled', {
    error: error.message
  });
}

/**
 * Middleware to check if Stripe is configured
 */
const requireStripe = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      error: 'Payment processing is currently unavailable',
      errorType: 'service_unavailable'
    });
  }
  next();
};

/**
 * Create payment intent for document generation
 */
router.post('/create-intent',
  requireStripe,
  paymentLimiter,
  auth0Middleware,
  validatePayment,
  asyncHandler(async (req, res) => {
    const { documentId, amount = 999 } = req.body; // Default $9.99 in cents
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Validate amount is within acceptable range
    if (amount < 999 || amount > 99999) { // $9.99 to $999.99
      throw new ValidationError('Invalid payment amount');
    }

    // If documentId provided, verify ownership
    if (documentId) {
      const docResult = await pool.query(
        'SELECT id, user_id, title FROM documents WHERE id = $1',
        [documentId]
      );

      if (docResult.rows.length === 0) {
        throw new ValidationError('Document not found');
      }

      if (docResult.rows[0].user_id !== userId) {
        throw new AuthorizationError('You do not have permission to pay for this document');
      }
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: {
          userId: userId.toString(),
          documentId: documentId?.toString() || 'new',
          userEmail: req.user.email || 'unknown'
        },
        // Add receipt email if available
        receipt_email: req.user.email || undefined
      });

      // Store payment intent in database for tracking
      await pool.query(
        `INSERT INTO payments (
          user_id, stripe_payment_intent_id, amount_cents, currency, 
          status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          userId,
          paymentIntent.id,
          amount,
          'usd',
          'pending',
          JSON.stringify({
            documentId,
            clientSecret: paymentIntent.client_secret.substring(0, 20) + '...' // Store partial for reference
          })
        ]
      );

      logger.logBusinessEvent('payment_intent_created', userId, {
        paymentIntentId: paymentIntent.id,
        amount,
        documentId,
        currency: 'usd'
      });

      res.sendSuccess({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency: 'usd'
      });

    } catch (error) {
      logger.logError(error, {
        type: 'stripe_payment_intent_creation_failed',
        userId,
        amount,
        documentId
      }, req.id);

      // Don't expose Stripe error details to client
      throw new Error('Payment setup failed. Please try again.');
    }
  })
);

/**
 * Confirm payment status
 */
router.get('/status/:paymentIntentId',
  requireStripe,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Verify this payment belongs to the user
    const paymentResult = await pool.query(
      'SELECT id, status, amount_cents, created_at FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
      [paymentIntentId, userId]
    );

    if (paymentResult.rows.length === 0) {
      throw new AuthorizationError('Payment not found or access denied');
    }

    const payment = paymentResult.rows[0];

    try {
      // Get latest status from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Update our database if status changed
      if (payment.status !== paymentIntent.status) {
        await pool.query(
          'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
          [paymentIntent.status, paymentIntentId]
        );

        logger.logBusinessEvent('payment_status_updated', userId, {
          paymentIntentId,
          oldStatus: payment.status,
          newStatus: paymentIntent.status,
          amount: payment.amount_cents
        });
      }

      res.sendSuccess({
        paymentIntentId,
        status: paymentIntent.status,
        amount: payment.amount_cents,
        currency: 'usd',
        createdAt: payment.created_at
      });

    } catch (error) {
      logger.logError(error, {
        type: 'stripe_payment_status_check_failed',
        paymentIntentId,
        userId
      }, req.id);

      // Return our database status if Stripe call fails
      res.sendSuccess({
        paymentIntentId,
        status: payment.status,
        amount: payment.amount_cents,
        currency: 'usd',
        createdAt: payment.created_at,
        note: 'Status from local records'
      });
    }
  })
);

/**
 * Get user's payment history
 */
router.get('/history',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const pool = req.app.locals.pool;
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM payments WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get payments with pagination
    const paymentsResult = await pool.query(
      `SELECT 
        stripe_payment_intent_id,
        amount_cents,
        currency,
        status,
        metadata,
        created_at,
        updated_at
       FROM payments 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Clean up metadata for response
    const payments = paymentsResult.rows.map(payment => ({
      ...payment,
      metadata: payment.metadata ? JSON.parse(payment.metadata) : {}
    }));

    logger.logBusinessEvent('payment_history_viewed', userId, {
      page,
      limit,
      total,
      resultCount: payments.length
    });

    res.sendPaginated(payments, page, limit, total);
  })
);

/**
 * Stripe webhook handler for payment events
 */
router.post('/webhook',
  strictLimiter,
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      logger.warn('Stripe webhook secret not configured');
      return res.status(400).send('Webhook secret not configured');
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (error) {
      logger.logSecurity('stripe_webhook_verification_failed', {
        error: error.message,
        signature: sig?.substring(0, 20) + '...'
      });
      return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
    }

    const pool = req.app.locals.pool;

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          
          // Update payment status in database
          const updateResult = await pool.query(
            `UPDATE payments 
             SET status = 'succeeded', updated_at = CURRENT_TIMESTAMP 
             WHERE stripe_payment_intent_id = $1 
             RETURNING user_id, amount_cents`,
            [paymentIntent.id]
          );

          if (updateResult.rows.length > 0) {
            const payment = updateResult.rows[0];
            
            logger.logBusinessEvent('payment_succeeded', payment.user_id, {
              paymentIntentId: paymentIntent.id,
              amount: payment.amount_cents,
              currency: paymentIntent.currency
            });

            // Could trigger document generation here or send confirmation email
          }
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          
          await pool.query(
            'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            ['failed', failedPayment.id]
          );

          logger.logBusinessEvent('payment_failed', null, {
            paymentIntentId: failedPayment.id,
            lastPaymentError: failedPayment.last_payment_error?.message
          });
          break;

        case 'payment_intent.canceled':
          const canceledPayment = event.data.object;
          
          await pool.query(
            'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            ['canceled', canceledPayment.id]
          );

          logger.logBusinessEvent('payment_canceled', null, {
            paymentIntentId: canceledPayment.id
          });
          break;

        default:
          logger.info('Unhandled Stripe webhook event', {
            type: event.type,
            id: event.id
          });
      }

      res.status(200).send('Webhook processed');

    } catch (error) {
      logger.logError(error, {
        type: 'stripe_webhook_processing_error',
        eventType: event.type,
        eventId: event.id
      });

      res.status(500).send('Webhook processing failed');
    }
  })
);

/**
 * Cancel payment intent (if still pending)
 */
router.post('/cancel/:paymentIntentId',
  requireStripe,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Verify ownership
    const paymentResult = await pool.query(
      'SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
      [paymentIntentId, userId]
    );

    if (paymentResult.rows.length === 0) {
      throw new AuthorizationError('Payment not found or access denied');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'pending') {
      throw new ValidationError('Payment cannot be canceled in its current state');
    }

    try {
      const canceledPayment = await stripe.paymentIntents.cancel(paymentIntentId);

      // Update database
      await pool.query(
        'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
        ['canceled', paymentIntentId]
      );

      logger.logBusinessEvent('payment_canceled_by_user', userId, {
        paymentIntentId
      });

      res.sendSuccess({
        message: 'Payment canceled successfully',
        paymentIntentId,
        status: 'canceled'
      });

    } catch (error) {
      logger.logError(error, {
        type: 'stripe_payment_cancel_failed',
        paymentIntentId,
        userId
      }, req.id);

      throw new Error('Payment cancellation failed. Please contact support.');
    }
  })
);

module.exports = router;