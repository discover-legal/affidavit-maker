// routes/payments.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe');
const { validatePayment } = require('../middleware/validation');
const { asyncHandler, ValidationError, ExternalServiceError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Initialize Stripe
const getStripe = (config) => {
  if (!config.stripeSecretKey) {
    throw new Error('Stripe secret key not configured');
  }
  return stripe(config.stripeSecretKey, {
    apiVersion: config.stripeApiVersion || '2023-10-16'
  });
};

// Create payment intent with updated pricing
router.post('/create-intent', validatePayment, asyncHandler(async (req, res) => {
  const { documentType, documentId } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;
  const config = req.app.locals.config;
  const stripeClient = getStripe(config);
  
  // Updated payment amounts - $39.99 per affidavit
  const paymentAmounts = {
    'single_affidavit': 3999, // $39.99 in cents
    'family_law_package': 11999, // $119.99 for 5 documents
    'all_state_access': 19999 // $199.99 for unlimited
  };
  
  const amount = paymentAmounts[documentType] || paymentAmounts['single_affidavit'];
  
  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: user.id.toString(),
        userEmail: user.email,
        documentId: documentId || 'new',
        type: documentType,
        environment: config.nodeEnv,
        brand: 'discover.legal'
      }
    });
    
    // Log payment intent creation
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'payment_intent_created',
        'payment',
        paymentIntent.id,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ 
          requestId: req.id,
          amount,
          documentType,
          brand: 'discover.legal'
        })
      ]
    );
    
    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      userId: user.id,
      amount: amount / 100,
      documentType,
      requestId: req.id,
      brand: 'discover.legal'
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: amount / 100,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    logger.error('Payment intent creation failed:', {
      error: error.message,
      userId: user.id,
      documentType,
      requestId: req.id
    });
    
    if (error.type === 'StripeAuthenticationError') {
      throw new ExternalServiceError('Payment service configuration error', 'stripe');
    }
    
    if (error.type === 'StripeAPIError') {
      throw new ExternalServiceError('Payment service temporarily unavailable', 'stripe');
    }
    
    throw error;
  }
}));

// Get pricing information - updated
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: {
      single_affidavit: {
        name: 'Single Affidavit',
        price: 39.99,
        currency: 'USD',
        description: 'Generate one professional affidavit document'
      },
      family_law_package: {
        name: 'Family Law Package', 
        price: 119.99,
        currency: 'USD',
        description: 'Generate up to 5 family law documents'
      },
      all_state_access: {
        name: 'All State Access',
        price: 199.99,
        currency: 'USD',
        description: 'Unlimited documents for all supported states for 30 days'
      }
    },
    brand: {
      name: 'Discover.Legal',
      website: 'https://discover.legal',
      tagline: 'Professional Legal Document Creation'
    }
  });
});

// Confirm payment
router.post('/confirm', asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;
  const config = req.app.locals.config;
  const stripeClient = getStripe(config);
  
  if (!paymentIntentId) {
    throw new ValidationError('Payment intent ID is required');
  }
  
  try {
    // Verify payment with Stripe
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    
    // Verify the payment belongs to this user
    if (paymentIntent.metadata.userId !== user.id.toString()) {
      logger.warn('Payment intent user mismatch', {
        paymentIntentId,
        expectedUserId: user.id,
        actualUserId: paymentIntent.metadata.userId,
        requestId: req.id
      });
      throw new ValidationError('Payment verification failed');
    }
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }
    
    // Check if payment was already recorded
    const existingPayment = await pool.query(
      'SELECT id FROM payments WHERE stripe_payment_intent_id = $1',
      [paymentIntentId]
    );
    
    if (existingPayment.rows.length > 0) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        paymentId: existingPayment.rows[0].id,
        message: 'Payment already processed'
      });
    }
    
    // Record the payment
    const payment = await pool.query(
      `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_cents, currency, status, payment_type, billing_address, payment_method_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        user.id,
        paymentIntentId,
        paymentIntent.amount,
        paymentIntent.currency,
        'succeeded',
        paymentIntent.metadata.type || 'single_affidavit',
        JSON.stringify(paymentIntent.charges?.data?.[0]?.billing_details || {}),
        JSON.stringify(paymentIntent.charges?.data?.[0]?.payment_method_details || {})
      ]
    );
    
    // Update document status if documentId exists
    if (paymentIntent.metadata.documentId && paymentIntent.metadata.documentId !== 'new') {
      await pool.query(
        'UPDATE documents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        ['paid', paymentIntent.metadata.documentId, user.id]
      );
    }
    
    logger.info('Payment confirmed and recorded', {
      paymentIntentId,
      paymentId: payment.rows[0].id,
      userId: user.id,
      amount: paymentIntent.amount / 100,
      requestId: req.id
    });
    
    res.json({
      success: true,
      paymentId: payment.rows[0].id,
      message: 'Payment confirmed successfully'
    });
    
  } catch (error) {
    logger.error('Payment confirmation failed:', {
      error: error.message,
      paymentIntentId,
      userId: user.id,
      requestId: req.id
    });
    
    if (error.type === 'StripeInvalidRequestError') {
      throw new ValidationError('Invalid payment information');
    }
    
    if (error.type === 'StripeAPIError') {
      throw new ExternalServiceError('Payment verification temporarily unavailable', 'stripe');
    }
    
    throw error;
  }
}));

module.exports = router;