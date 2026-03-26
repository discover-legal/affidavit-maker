// routes/payment.js - Payment Routes with Security
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const logger = require('../utils/logger');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { validatePayment, validateId, requireDbClient } = require('../middleware/validation');
const { paymentLimiter, strictLimiter, standardLimiter } = require('../middleware/rateLimiting');
const {
  sendServiceUnavailableError,
  sendValidationError,
  sendAuthorizationError,
  sendServerError
} = require('../utils/responseHelpers');

// Initialize Stripe
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  logger.warn('Stripe not configured - payment routes will be disabled', {
    error: error.message
  });
}

// Server-side pricing configuration - DO NOT expose to client or accept from client
const PRICING_CONFIG = {
  single_affidavit: 7900, // $79.00 in cents
  divorce_package: 24900, // $249.00 for full divorce package (petition + decree)
  all_state_access: 19999 // $199.99 for unlimited
};

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
 * @description Create a Stripe PaymentIntent. Amount is determined server-side from documentType.
 *   Requires disclaimerAccepted: true. Creates a Stripe Customer if one doesn't exist.
 * @returns {{ success: boolean, data: { clientSecret, paymentIntentId, amount, currency } }}
 */
router.post('/create-intent',
  requireStripe,
  paymentLimiter,
  auth0Middleware,
  requireDbClient,
  validatePayment,
  asyncHandler(async (req, res) => {
    const { documentId, documentType, disclaimerAccepted } = req.body;
    const userId = req.user.id;
    const client = req.dbClient;

    // LEGAL: Require explicit disclaimer acknowledgment before processing payment
    if (disclaimerAccepted !== true) {
      return res.status(400).json({
        success: false,
        error: 'Legal disclaimer must be accepted before purchase',
        errorType: 'validation_error'
      });
    }

    // SECURITY: Determine amount server-side based on documentType - never trust client
    const amount = PRICING_CONFIG[documentType] || PRICING_CONFIG.single_affidavit;

    // If documentId provided, validate it is a positive integer then verify ownership
    if (documentId) {
      const parsedDocId = parseInt(documentId, 10);
      if (isNaN(parsedDocId) || parsedDocId < 1 || String(parsedDocId) !== String(documentId)) {
        return res.status(400).json({
          success: false,
          error: 'documentId must be a positive integer',
          errorType: 'validation_error'
        });
      }

      const docResult = await client.query(
        'SELECT id, user_id, title, content FROM documents WHERE id = $1',
        [parsedDocId]
      );

      if (docResult.rows.length === 0) {
        throw new ValidationError('Document not found');
      }

      if (docResult.rows[0].user_id !== userId) {
        throw new AuthorizationError('You do not have permission to pay for this document');
      }

      // COMPLIANCE: Block payment for states requiring LDP registration
      const { isRegistrationPending } = require('../config/jurisdictions');
      const docState = docResult.rows[0].content?.state;
      if (docState && isRegistrationPending(docState)) {
        return res.status(403).json({
          success: false,
          error: `Document services for ${docState} are coming soon. We are completing legal document preparer registration for this state.`,
          errorType: 'registration_pending'
        });
      }
    }

    try {
      // Check if user already has a Stripe customer ID
      const userResult = await client.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      let customerId = userResult.rows[0]?.stripe_customer_id;

      // Create Stripe Customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          metadata: {
            userId: userId.toString(),
            source: 'affidavit-maker'
          }
        });

        customerId = customer.id;

        // Store customer ID in database
        await client.query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [customerId, userId]
        );

        logger.logBusinessEvent('stripe_customer_created', userId, {
          customerId,
          email: req.user.email
        });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        metadata: {
          userId: userId.toString(),
          documentId: documentId?.toString() || 'new',
          documentType: documentType,
          userEmail: req.user.email || 'unknown'
        },
        // Add receipt email if available
        receipt_email: req.user.email || undefined
      });

      // Store payment intent in database for tracking
      await client.query(
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
            documentType,
            // PRIVACY: client_secret is ephemeral — not stored in DB
          })
        ]
      );

      logger.logBusinessEvent('payment_intent_created', userId, {
        paymentIntentId: paymentIntent.id,
        amount,
        documentId,
        documentType,
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
        documentId,
        documentType
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
  standardLimiter,
  auth0Middleware,
  requireDbClient,
  asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;
    const client = req.dbClient;

    // Verify this payment belongs to the user
    const paymentResult = await client.query(
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
        await client.query(
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
  standardLimiter,
  auth0Middleware,
  requireDbClient,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const client = req.dbClient;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM payments WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    // Get payments with pagination
    const paymentsResult = await client.query(
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
 * @description Stripe webhook handler. Verifies signature using rawBody, processes
 *   payment_intent.succeeded/failed/canceled events in a transaction, and records
 *   processed events for idempotency.
 * @returns {{ success: boolean, eventId: string, eventType: string }}
 */
router.post('/webhook',
  // Note: rawBody is captured by verify middleware in server.js for all webhook routes
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      logger.warn('Stripe webhook secret not configured');
      return sendValidationError(res, 'Webhook secret not configured', {
        type: 'configuration_error'
      });
    }

    let event;

    try {
      // SECURITY: Use rawBody for signature verification
      // The raw body is captured by the verify middleware in server.js
      const webhookBody = req.rawBody || req.body;

      if (!req.rawBody) {
        logger.warn('Stripe webhook: rawBody not available, using parsed body (may fail verification)');
      }

      // Verify webhook signature
      event = stripe.webhooks.constructEvent(webhookBody, sig, endpointSecret);
    } catch (error) {
      logger.logSecurity('stripe_webhook_verification_failed', {
        error: error.message,
        signature: sig?.substring(0, 20) + '...',
        hasRawBody: !!req.rawBody
      });
      return sendValidationError(res, 'Webhook signature verification failed', {
        type: 'signature_verification_failed'
      });
    }

    const pool = req.app.locals.pool;
    const { setRLSBypass } = require('../middleware/auth0Middleware');

    // Get database client with RLS bypass for webhook processing
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // CRITICAL: Set RLS bypass for system operation (webhooks don't have user context)
      await setRLSBypass(client);

      // IDEMPOTENCY CHECK: Has this event already been processed?
      const existingEvent = await client.query(
        'SELECT id, status FROM processed_webhook_events WHERE stripe_event_id = $1',
        [event.id]
      );

      if (existingEvent.rows.length > 0) {
        logger.info('Webhook event already processed (idempotency check)', {
          eventId: event.id,
          eventType: event.type,
          previousStatus: existingEvent.rows[0].status
        });

        await client.query('COMMIT');
        client.release();
        return res.status(200).json({
          success: true,
          message: 'Event already processed',
          eventId: event.id,
          eventType: event.type,
          previousStatus: existingEvent.rows[0].status,
          timestamp: new Date().toISOString()
        });
      }

      // Process the event
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;

          // Extract postal code from billing details (if available)
          const billingDetails = paymentIntent.charges?.data?.[0]?.billing_details;
          const postalCode = billingDetails?.address?.postal_code || null;

          // Extract payment method details (last 4, brand, etc.)
          const paymentMethodDetails = paymentIntent.charges?.data?.[0]?.payment_method_details;
          const paymentMethodInfo = paymentMethodDetails ? {
            type: paymentMethodDetails.type,
            card: paymentMethodDetails.card ? {
              brand: paymentMethodDetails.card.brand,
              last4: paymentMethodDetails.card.last4,
              exp_month: paymentMethodDetails.card.exp_month,
              exp_year: paymentMethodDetails.card.exp_year
            } : null
          } : null;

          // SECURITY FIX (HIGH-01): Both payment and document updates in same transaction
          // to prevent race condition where payment succeeds but document stays unpaid
          const updateResult = await client.query(
            `UPDATE payments
             SET status = 'succeeded',
                 billing_postal_code = $2,
                 payment_method_details = $3,
                 stripe_customer_id = $4,
                 succeeded_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE stripe_payment_intent_id = $1
             RETURNING user_id, amount_cents`,
            [
              paymentIntent.id,
              postalCode,
              paymentMethodInfo ? JSON.stringify(paymentMethodInfo) : null,
              paymentIntent.customer || null
            ]
          );

          if (updateResult.rows.length > 0) {
            const payment = updateResult.rows[0];

            // Update document payment_status if documentId is in metadata
            // SECURITY: This is now inside the same transaction - if it fails, payment update rolls back too
            const documentId = paymentIntent.metadata?.documentId;
            if (documentId && documentId !== 'new') {
              const docUpdateResult = await client.query(
                'UPDATE documents SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
                ['paid', documentId]
              );
              if (docUpdateResult.rowCount === 0) {
                logger.warn('Document not found for payment update', { documentId, paymentIntentId: paymentIntent.id });
              } else {
                logger.info('Document payment status updated', { documentId, paymentIntentId: paymentIntent.id });
              }
            }

            logger.logBusinessEvent('payment_succeeded', payment.user_id, {
              paymentIntentId: paymentIntent.id,
              amount: payment.amount_cents,
              currency: paymentIntent.currency,
              postalCode: postalCode ? 'captured' : 'not_provided',
              documentId: documentId || 'none'
            });
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const failedPayment = event.data.object;

          await client.query(
            'UPDATE payments SET status = $1, failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            ['failed', failedPayment.id]
          );

          // SECURITY (MED-10): Log error code only, not message which may contain sensitive details
          logger.logBusinessEvent('payment_failed', null, {
            paymentIntentId: failedPayment.id,
            errorCode: failedPayment.last_payment_error?.code || 'unknown'
          });
          break;
        }

        case 'payment_intent.canceled': {
          const canceledPayment = event.data.object;

          await client.query(
            'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
            ['canceled', canceledPayment.id]
          );

          logger.logBusinessEvent('payment_canceled', null, {
            paymentIntentId: canceledPayment.id
          });
          break;
        }

        default:
          logger.info('Unhandled Stripe webhook event', {
            type: event.type,
            id: event.id
          });
      }

      // Record webhook event as processed (prevents duplicate processing)
      await client.query(
        `INSERT INTO processed_webhook_events (stripe_event_id, event_type, status, metadata, processed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          event.id,
          event.type,
          'success',
          JSON.stringify({
            processed_at: new Date().toISOString(),
            event_object: event.data.object?.id || null
          })
        ]
      );

      await client.query('COMMIT');
      client.release();

      logger.info('Webhook processed successfully', {
        eventId: event.id,
        eventType: event.type
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        eventId: event.id,
        eventType: event.type,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK').catch(() => {});
      client.release();

      // Try to record failed event (without transaction)
      try {
        await pool.query(
          `INSERT INTO processed_webhook_events (stripe_event_id, event_type, status, error_message, processed_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (stripe_event_id) DO UPDATE
           SET status = 'failed', error_message = $4, processed_at = NOW()`,
          [event.id, event.type, 'failed', error.message]
        );
      } catch (logError) {
        logger.error('Failed to log webhook error', { error: logError.message });
      }

      logger.logError(error, {
        type: 'stripe_webhook_processing_error',
        eventType: event.type,
        eventId: event.id
      });

      return sendServerError(res, 'Webhook processing failed', {
        eventType: event?.type,
        eventId: event?.id
      });
    }
  })
);

/**
 * Cancel payment intent (if still pending)
 */
router.post('/cancel/:paymentIntentId',
  requireStripe,
  auth0Middleware,
  requireDbClient,
  asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;
    const client = req.dbClient;

    // Verify ownership
    const paymentResult = await client.query(
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
      await client.query(
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

/**
 * @description Return public pricing info for all document types (no auth required).
 * @returns {{ success: boolean, pricing: { single_affidavit, divorce_package, all_state_access } }}
 */
router.get('/pricing', strictLimiter, (req, res) => {
  res.json({
    success: true,
    pricing: {
      single_affidavit: {
        name: 'Single Affidavit',
        price: PRICING_CONFIG.single_affidavit / 100,
        priceCents: PRICING_CONFIG.single_affidavit,
        currency: 'USD',
        description: 'Generate one professional affidavit document'
      },
      divorce_package: {
        name: 'Divorce Package',
        price: PRICING_CONFIG.divorce_package / 100,
        priceCents: PRICING_CONFIG.divorce_package,
        currency: 'USD',
        description: 'Complete divorce document package (petition + decree)'
      },
      all_state_access: {
        name: 'All State Access',
        price: PRICING_CONFIG.all_state_access / 100,
        priceCents: PRICING_CONFIG.all_state_access,
        currency: 'USD',
        description: 'Unlimited documents for all supported states for 30 days'
      }
    }
  });
});

module.exports = router;