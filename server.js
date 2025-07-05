// server-enhanced.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { Pool } = require('pg');
const { auth, requiresAuth } = require('express-openid-connect');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Payment endpoints
app.post('/api/payment/create-intent', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { documentType, documentId } = req.body;
    
    // Get pricing
    const amount = documentType === 'single_affidavit' ? 4900 : 14900; // in cents
    
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        documentId: documentId || '',
        documentType: documentType
      }
    });
    
    // Record payment in database
    const payment = await pool.query(
      `INSERT INTO payments (user_id, document_id, amount, currency, gateway, gateway_reference, status, payment_type)
       VALUES ($1, $2, $3, $4, 'stripe', $5, 'pending', 'single_document')
       RETURNING id`,
      [userId, documentId, amount / 100, 'USD', paymentIntent.id]
    );
    
    // Update document with payment ID if exists
    if (documentId) {
      await pool.query(
        'UPDATE documents SET payment_id = $1 WHERE id = $2',
        [payment.rows[0].id, documentId]
      );
    }
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: amount / 100
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
});

// Subscription management with Stripe
app.post('/api/subscription/create', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { tier, paymentMethodId } = req.body;
    
    if (!SUBSCRIPTION_TIERS[tier] || tier === 'free') {
      return res.status(400).json({ success: false, error: 'Invalid subscription tier' });
    }
    
    // Get or create Stripe customer
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    let customerId = user.rows[0].stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.rows[0].email,
        name: user.rows[0].name,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env[`STRIPE_PRICE_${tier.toUpperCase()}`] }],
      trial_period_days: 7,
      metadata: { userId: userId.toString(), tier }
    });
    
    // Record in database
    await pool.query(
      `INSERT INTO subscriptions (user_id, tier, stripe_subscription_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        tier,
        subscription.id,
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000)
      ]
    );
    
    // Update user subscription status
    await pool.query(
      'UPDATE users SET subscription_status = $1, subscription_expires_at = $2 WHERE id = $3',
      [tier, new Date(subscription.current_period_end * 1000), userId]
    );
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
      }
    });
    
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

// Cancel subscription
app.post('/api/subscription/cancel', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    
    // Get active subscription
    const sub = await pool.query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    if (sub.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active subscription found' });
    }
    
    // Cancel at period end
    const subscription = await stripe.subscriptions.update(sub.rows[0].stripe_subscription_id, {
      cancel_at_period_end: true
    });
    
    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period'
    });
    
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Stripe webhook handling
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Update payment status
      await pool.query(
        'UPDATE payments SET status = $1, completed_at = NOW() WHERE gateway_reference = $2',
        ['completed', paymentIntent.id]
      );
      
      // Update document status if linked
      if (paymentIntent.metadata.documentId) {
        await pool.query(
          'UPDATE documents SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', paymentIntent.metadata.documentId]
        );
      }
      
      // Update user's total documents
      await pool.query(
        'UPDATE users SET total_documents_created = total_documents_created + 1 WHERE id = $1',
        [paymentIntent.metadata.userId]
      );
      break;
      
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await pool.query(
        `UPDATE subscriptions 
         SET status = $1, current_period_end = $2 
         WHERE stripe_subscription_id = $3`,
        [subscription.status, new Date(subscription.current_period_end * 1000), subscription.id]
      );
      
      await pool.query(
        `UPDATE users 
         SET subscription_status = $1, subscription_expires_at = $2 
         WHERE stripe_customer_id = $3`,
        [subscription.metadata.tier, new Date(subscription.current_period_end * 1000), subscription.customer]
      );
      break;
      
    case 'customer.subscription.deleted':
      const cancelledSub = event.data.object;
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE stripe_subscription_id = $1`,
        [cancelledSub.id]
      );
      
      await pool.query(
        `UPDATE users SET subscription_status = 'free' WHERE stripe_customer_id = $1`,
        [cancelledSub.customer]
      );
      break;
      
    case 'invoice.payment_failed':
      // Handle failed subscription payment
      const invoice = event.data.object;
      // Send email notification to user
      console.log('Subscription payment failed for customer:', invoice.customer);
      break;
  }
  
  res.json({ received: true });
});

// Template purchase endpoint
app.post('/api/templates/:id/purchase', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const templateId = req.params.id;
    
    // Check if already purchased
    const existing = await pool.query(
      'SELECT * FROM template_purchases WHERE template_id = $1 AND purchased_by = $2',
      [templateId, userId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Template already purchased' });
    }
    
    // Get template details
    const template = await pool.query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (template.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    const templateData = template.rows[0];
    
    if (templateData.price === 0) {
      // Free template - just record the purchase
      await pool.query(
        'INSERT INTO template_purchases (template_id, purchased_by, purchase_price) VALUES ($1, $2, $3)',
        [templateId, userId, 0]
      );
      
      await pool.query(
        'UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1',
        [templateId]
      );
      
      return res.json({ success: true, message: 'Free template added to your library' });
    }
    
    // Paid template - create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(templateData.price * 100),
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        templateId: templateId,
        type: 'template_purchase'
      }
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: templateData.price
    });
    
  } catch (error) {
    console.error('Template purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to process template purchase' });
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Auth0 configuration
const authConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.BASE_URL || 'http://localhost:3001',
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  routes: {
    callback: '/callback',
    login: '/login',
    logout: '/logout'
  }
};

// Subscription tiers configuration
const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    documentsPerMonth: 1,
    saveProgress: false,
    templates: 'basic',
    price: 0
  },
  pro: {
    name: 'Professional',
    documentsPerMonth: 10,
    saveProgress: true,
    templates: 'premium',
    prioritySupport: true,
    price: 29.99
  },
  unlimited: {
    name: 'Unlimited',
    documentsPerMonth: Infinity,
    saveProgress: true,
    templates: 'all',
    whiteLabel: true,
    apiAccess: true,
    price: 99.99
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(auth(authConfig));

// Custom middleware to sync Auth0 user with database
app.use(async (req, res, next) => {
  if (req.oidc && req.oidc.isAuthenticated()) {
    try {
      const auth0User = req.oidc.user;
      
      // Check if user exists in database
      const userResult = await pool.query(
        'SELECT * FROM users WHERE auth0_id = $1',
        [auth0User.sub]
      );
      
      if (userResult.rows.length === 0) {
        // Create new user
        const newUser = await pool.query(
          `INSERT INTO users (auth0_id, email, name, created_at) 
           VALUES ($1, $2, $3, NOW()) 
           RETURNING *`,
          [auth0User.sub, auth0User.email, auth0User.name]
        );
        req.dbUser = newUser.rows[0];
      } else {
        // Update last login
        await pool.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [userResult.rows[0].id]
        );
        req.dbUser = userResult.rows[0];
      }
      
      // Log activity
      await logActivity(req.dbUser.id, 'login', null, null, req);
    } catch (error) {
      console.error('User sync error:', error);
    }
  }
  next();
});

// Utility functions
async function logActivity(userId, action, resourceType, resourceId, req) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, req.ip, req.get('user-agent')]
    );
  } catch (error) {
    console.error('Activity logging error:', error);
  }
}

async function checkSubscriptionLimits(userId) {
  const user = await pool.query('SELECT subscription_status FROM users WHERE id = $1', [userId]);
  const subscription = await pool.query(
    `SELECT * FROM subscriptions 
     WHERE user_id = $1 AND status = 'active' 
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  
  const tier = SUBSCRIPTION_TIERS[user.rows[0].subscription_status || 'free'];
  const documentsThisMonth = subscription.rows[0]?.documents_used_this_period || 0;
  
  return {
    tier,
    documentsRemaining: tier.documentsPerMonth - documentsThisMonth,
    canCreateDocument: documentsThisMonth < tier.documentsPerMonth
  };
}

// Enhanced chat endpoint with user context
app.post('/api/chat', requiresAuth(), async (req, res) => {
  try {
    const { message, conversationHistory, currentData, documentId } = req.body;
    const userId = req.dbUser.id;

    // Check subscription limits
    const limits = await checkSubscriptionLimits(userId);
    if (!documentId && !limits.canCreateDocument) {
      return res.json({
        success: true,
        response: `You've reached your monthly document limit (${limits.tier.documentsPerMonth}). Please upgrade to ${limits.tier.name === 'Free' ? 'Pro' : 'Unlimited'} to create more documents this month.`,
        requiresUpgrade: true
      });
    }

    // If documentId provided, load existing document
    let existingData = {};
    if (documentId) {
      const doc = await pool.query(
        'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );
      if (doc.rows.length > 0) {
        existingData = doc.rows[0].content;
      }
    }

    // Build conversation context
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current data collected: ${JSON.stringify({...existingData, ...currentData})}` }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    // Save or update document
    if (aiResponse.extractedData) {
      const documentData = { ...existingData, ...currentData, ...aiResponse.extractedData };
      
      if (documentId) {
        // Update existing document
        await pool.query(
          'UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
          [JSON.stringify(documentData), documentId, userId]
        );
      } else if (limits.canCreateDocument) {
        // Create new document
        const newDoc = await pool.query(
          `INSERT INTO documents (user_id, document_type, state, case_number, case_type, affiant_name, content, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
           RETURNING id`,
          [
            userId,
            'affidavit',
            aiResponse.extractedData.state || currentData.state,
            aiResponse.extractedData.caseNumber || currentData.caseNumber,
            aiResponse.extractedData.caseType || currentData.caseType,
            aiResponse.extractedData.affiantName || currentData.affiantName,
            JSON.stringify(documentData)
          ]
        );
        
        // Update subscription usage
        await pool.query(
          `UPDATE subscriptions 
           SET documents_used_this_period = documents_used_this_period + 1 
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );
        
        aiResponse.documentId = newDoc.rows[0].id;
      }
    }

    res.json({
      success: true,
      response: aiResponse.response,
      extractedData: aiResponse.extractedData,
      documentId: aiResponse.documentId || documentId
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Get user's documents
app.get('/api/user/documents', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { status, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT d.*, p.amount as payment_amount, p.status as payment_status
      FROM documents d
      LEFT JOIN payments p ON d.payment_id = p.id
      WHERE d.user_id = $1
    `;
    const params = [userId];
    
    if (status) {
      query += ' AND d.status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY d.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      documents: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

// Save draft
app.post('/api/save-draft', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { documentId, affidavitData } = req.body;
    
    const limits = await checkSubscriptionLimits(userId);
    if (!limits.tier.saveProgress) {
      return res.status(403).json({
        success: false,
        error: 'Upgrade to Pro to save drafts',
        requiresUpgrade: true
      });
    }
    
    if (documentId) {
      // Update existing
      await pool.query(
        'UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [JSON.stringify(affidavitData), documentId, userId]
      );
    } else {
      // Create new draft
      const newDoc = await pool.query(
        `INSERT INTO documents (user_id, document_type, state, case_number, case_type, affiant_name, content, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING id`,
        [
          userId,
          'affidavit',
          affidavitData.state,
          affidavitData.caseNumber,
          affidavitData.caseType,
          affidavitData.affiantName,
          JSON.stringify(affidavitData)
        ]
      );
      
      return res.json({ success: true, documentId: newDoc.rows[0].id });
    }
    
    res.json({ success: true, documentId });
    
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ success: false, error: 'Failed to save draft' });
  }
});

// Enhanced payment endpoint with user association
app.post('/api/payment/create-intent', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { customerData, documentType, documentId } = req.body;
    
    // Create payment intent
    const session = await paymentProcessor.createCheckoutSession(
      { ...customerData, userId },
      documentType
    );
    
    // Record payment
    const payment = await pool.query(
      `INSERT INTO payments (user_id, document_id, amount, currency, gateway, gateway_reference, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'single_document')
       RETURNING id`,
      [userId, documentId, session.amount, 'USD', paymentProcessor.gateway, session.orderReference]
    );
    
    // Update document with payment ID
    if (documentId) {
      await pool.query(
        'UPDATE documents SET payment_id = $1 WHERE id = $2',
        [payment.rows[0].id, documentId]
      );
    }
    
    res.json({
      success: true,
      ...session,
      paymentId: payment.rows[0].id
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
});

// Subscription management
app.post('/api/subscription/create', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { tier } = req.body;
    
    if (!SUBSCRIPTION_TIERS[tier] || tier === 'free') {
      return res.status(400).json({ success: false, error: 'Invalid subscription tier' });
    }
    
    // Create Stripe subscription
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    let customerId = user.rows[0].stripe_customer_id;
    
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.rows[0].email,
        name: user.rows[0].name,
        metadata: { userId: userId.toString() }
      });
      customerId = customer.id;
      
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env[`STRIPE_PRICE_${tier.toUpperCase()}`] }],
      trial_period_days: 7,
      metadata: { userId: userId.toString(), tier }
    });
    
    // Record in database
    await pool.query(
      `INSERT INTO subscriptions (user_id, tier, stripe_subscription_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        tier,
        subscription.id,
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000)
      ]
    );
    
    // Update user subscription status
    await pool.query(
      'UPDATE users SET subscription_status = $1, subscription_expires_at = $2 WHERE id = $3',
      [tier, new Date(subscription.current_period_end * 1000), userId]
    );
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
      }
    });
    
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

// Template marketplace endpoints
app.get('/api/templates', async (req, res) => {
  try {
    const { document_type, state, search, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT t.*, u.name as creator_name,
             COUNT(DISTINCT tp.id) as purchase_count,
             AVG(tr.rating) as avg_rating
      FROM templates t
      JOIN users u ON t.created_by = u.id
      LEFT JOIN template_purchases tp ON t.id = tp.template_id
      LEFT JOIN template_reviews tr ON t.id = tr.template_id
      WHERE t.is_public = true
    `;
    const params = [];
    
    if (document_type) {
      params.push(document_type);
      query += ` AND t.document_type = $${params.length}`;
    }
    
    if (state) {
      params.push(state);
      query += ` AND t.state = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`;
    }
    
    query += ` GROUP BY t.id, u.name ORDER BY t.usage_count DESC, t.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      templates: result.rows
    });
    
  } catch (error) {
    console.error('Fetch templates error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

// Create template
app.post('/api/templates', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { title, description, document_type, state, base_content, price = 0, tags = [] } = req.body;
    
    const limits = await checkSubscriptionLimits(userId);
    if (limits.tier.name === 'Free') {
      return res.status(403).json({
        success: false,
        error: 'Upgrade to Pro to create templates',
        requiresUpgrade: true
      });
    }
    
    const template = await pool.query(
      `INSERT INTO templates (created_by, title, description, document_type, state, base_content, price, tags, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, title, description, document_type, state, JSON.stringify(base_content), price, tags, true]
    );
    
    res.json({
      success: true,
      template: template.rows[0]
    });
    
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// Purchase template
app.post('/api/templates/:id/purchase', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const templateId = req.params.id;
    
    // Check if already purchased
    const existing = await pool.query(
      'SELECT * FROM template_purchases WHERE template_id = $1 AND purchased_by = $2',
      [templateId, userId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Template already purchased' });
    }
    
    // Get template details
    const template = await pool.query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (template.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    const templateData = template.rows[0];
    
    if (templateData.price === 0) {
      // Free template - just record the purchase
      await pool.query(
        'INSERT INTO template_purchases (template_id, purchased_by, purchase_price) VALUES ($1, $2, $3)',
        [templateId, userId, 0]
      );
      
      // Update usage count
      await pool.query(
        'UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1',
        [templateId]
      );
      
      return res.json({ success: true, message: 'Free template added to your library' });
    }
    
    // Paid template - use Global Payments
    const paymentSession = await paymentProcessor.createCheckoutSession(
      {
        name: req.dbUser.name,
        email: req.dbUser.email,
        userId: userId,
        state: 'US' // Default for templates
      },
      'template_purchase'
    );
    
    res.json({
      success: true,
      transactionData: paymentSession.transactionData,
      amount: templateData.price
    });
    
  } catch (error) {
    console.error('Template purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to process template purchase' });
  }
});

// Analytics endpoint for aggregated data (monetization)
app.get('/api/analytics/trends', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const user = await pool.query('SELECT subscription_status FROM users WHERE id = $1', [userId]);
    
    // Only available for unlimited tier
    if (user.rows[0].subscription_status !== 'unlimited') {
      return res.status(403).json({
        success: false,
        error: 'Analytics API requires Unlimited subscription',
        requiresUpgrade: true
      });
    }
    
    // Get anonymized trend data
    const trends = await pool.query(`
      SELECT 
        state,
        case_type,
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as document_count
      FROM documents
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY state, case_type, month
      ORDER BY month DESC, document_count DESC
    `);
    
    res.json({
      success: true,
      trends: trends.rows
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// Webhook endpoints for Global Payments
app.post('/webhooks/globalpayments', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-gp-signature'];
  const payload = JSON.parse(req.body);
  
  try {
    // Verify webhook signature
    if (!paymentProcessor.verifyWebhookSignature(payload, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Handle webhook events
    switch (payload.event_type) {
      case 'TRANSACTION_CAPTURED':
        // Handle successful payment
        const transaction = payload.data;
        
        if (transaction.reference_data && transaction.reference_data.type === 'template_purchase') {
          // Record template purchase
          await pool.query(
            'INSERT INTO template_purchases (template_id, purchased_by, purchase_price) VALUES ($1, $2, $3)',
            [transaction.reference_data.templateId, transaction.reference_data.userId, transaction.amount / 100]
          );
          
          await pool.query(
            'UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1',
            [transaction.reference_data.templateId]
          );
        }
        
        // Update payment record
        await pool.query(
          'UPDATE payments SET status = $1, completed_at = NOW() WHERE gateway_reference = $2',
          ['completed', transaction.reference]
        );
        break;
        
      case 'TRANSACTION_DECLINED':
        // Handle declined payment
        await pool.query(
          'UPDATE payments SET status = $1 WHERE gateway_reference = $2',
          ['failed', payload.data.reference]
        );
        break;
        
      case 'SCHEDULE_CREATED':
        // Handle subscription creation
        const schedule = payload.data;
        await pool.query(
          `UPDATE users 
           SET subscription_status = $1, subscription_expires_at = $2 
           WHERE id = $3`,
          [schedule.reference_data.tier, schedule.next_run_date, schedule.reference_data.userId]
        );
        break;
        
      case 'SCHEDULE_CANCELLED':
        // Handle subscription cancellation
        await pool.query(
          `UPDATE users SET subscription_status = 'free' WHERE id = $1`,
          [payload.data.reference_data.userId]
        );
        break;
        
      case 'SCHEDULE_PAYMENT_FAILED':
        // Handle failed subscription payment
        // Send email notification
        // Implement retry logic or downgrade
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Enhanced subscription creation with Global Payments
app.post('/api/subscription/create', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { tier, cardToken } = req.body;
    
    if (!SUBSCRIPTION_TIERS[tier] || tier === 'free') {
      return res.status(400).json({ success: false, error: 'Invalid subscription tier' });
    }
    
    // Create customer ID if not exists
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    let customerId = user.rows[0].stripe_customer_id || `CUST-${userId}`;
    
    // Create subscription with Global Payments
    const subscription = await paymentProcessor.createSubscription(
      customerId,
      tier === 'pro' ? 'monthly_pro' : 'monthly_unlimited',
      cardToken
    );
    
    // Record in database
    await pool.query(
      `INSERT INTO subscriptions (user_id, tier, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 month')`,
      [userId, tier, 'active']
    );
    
    // Update user subscription status
    await pool.query(
      'UPDATE users SET subscription_status = $1, subscription_expires_at = NOW() + INTERVAL \'1 month\' WHERE id = $2',
      [tier, userId]
    );
    
    res.json({
      success: true,
      subscription: {
        id: subscription.scheduleId,
        status: subscription.status,
        nextPaymentDate: subscription.nextPaymentDate
      }
    });
    
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

// View shared document
app.get('/api/shared/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const share = await pool.query(
      `SELECT ds.*, d.* 
       FROM document_shares ds
       JOIN documents d ON ds.document_id = d.id
       WHERE ds.access_token = $1 AND ds.expires_at > NOW()`,
      [token]
    );
    
    if (share.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Share link not found or expired' });
    }
    
    // Update access timestamp
    await pool.query(
      'UPDATE document_shares SET accessed_at = NOW() WHERE access_token = $1',
      [token]
    );
    
    res.json({
      success: true,
      document: share.rows[0],
      permission: share.rows[0].permission
    });
    
  } catch (error) {
    console.error('View shared document error:', error);
    res.status(500).json({ success: false, error: 'Failed to access shared document' });
  }
});

// User profile and settings
app.get('/api/user/profile', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    
    const profile = await pool.query(`
      SELECT 
        u.*,
        s.tier as subscription_tier,
        s.status as subscription_status,
        s.current_period_end,
        s.documents_used_this_period,
        COUNT(DISTINCT d.id) as total_documents,
        COUNT(DISTINCT t.id) as templates_created,
        COUNT(DISTINCT tp.id) as templates_purchased
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      LEFT JOIN documents d ON u.id = d.user_id
      LEFT JOIN templates t ON u.id = t.created_by
      LEFT JOIN template_purchases tp ON u.id = tp.purchased_by
      WHERE u.id = $1
      GROUP BY u.id, s.tier, s.status, s.current_period_end, s.documents_used_this_period
    `, [userId]);
    
    res.json({
      success: true,
      profile: profile.rows[0]
    });
    
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Update user preferences
app.put('/api/user/preferences', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const { preferences } = req.body;
    
    await pool.query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), userId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

// Export user data (GDPR compliance)
app.get('/api/user/export', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    
    const userData = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    const documents = await pool.query(
      'SELECT * FROM documents WHERE user_id = $1',
      [userId]
    );
    
    const payments = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1',
      [userId]
    );
    
    const activities = await pool.query(
      'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000',
      [userId]
    );
    
    res.json({
      success: true,
      export: {
        user: userData.rows[0],
        documents: documents.rows,
        payments: payments.rows,
        activities: activities.rows,
        exportDate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// Delete user account
app.delete('/api/user/account', requiresAuth(), async (req, res) => {
  try {
    const userId = req.dbUser.id;
    
    // Cancel any active subscriptions
    const user = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);
    if (user.rows[0].stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.rows[0].stripe_customer_id,
        status: 'active'
      });
      
      for (const sub of subscriptions.data) {
        await stripe.subscriptions.del(sub.id);
      }
    }
    
    // Soft delete user (mark as inactive)
    await pool.query(
      'UPDATE users SET is_active = false, email = email || \'-deleted-\' || NOW() WHERE id = $1',
      [userId]
    );
    
    // Log out from Auth0
    res.redirect('/logout');
    
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

// Get pricing
app.get('/api/payment/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: {
      single_affidavit: 49.00,
      family_law_bundle: 149.00,
      monthly_pro: 29.99,
      monthly_unlimited: 99.99
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Enhanced server with authentication running on port ${PORT}`);
});

module.exports = app;