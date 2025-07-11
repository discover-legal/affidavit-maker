// tests/setup.js - Fixed version
const { Pool } = require('pg');

// Use your actual database for tests or create a test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:your_password@localhost:5432/affidavit_test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.AUTH0_DOMAIN = 'https://test.auth0.com';
process.env.AUTH0_AUDIENCE = 'test-audience';
process.env.AUTH0_CLIENT_ID = 'test-client-id';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: async (pool, userData = {}) => {
    const defaultData = {
      auth0_id: `auth0|${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      name: 'Test User',
      subscription_status: 'active',
      subscription_tier: 'pay_per_use',
    };
    
    const data = { ...defaultData, ...userData };
    
    try {
      const result = await pool.query(
        `INSERT INTO users (auth0_id, email, name, subscription_status, subscription_tier, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [data.auth0_id, data.email, data.name, data.subscription_status, data.subscription_tier]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating test user:', error);
      return null;
    }
  },

  // Create test document
  createTestDocument: async (pool, userId, documentData = {}) => {
    const defaultData = {
      content: JSON.stringify({
        affiantName: 'Test Affiant',
        state: 'TX',
        facts: ['Test fact 1', 'Test fact 2'],
      }),
      status: 'draft',
      template_state: 'TX',
      document_type: 'general',
    };
    
    const data = { ...defaultData, ...documentData };
    
    try {
      const result = await pool.query(
        `INSERT INTO documents (user_id, content, status, template_state, document_type, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [userId, data.content, data.status, data.template_state, data.document_type]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating test document:', error);
      return null;
    }
  },

  // Generate test JWT token
  generateTestToken: (userId = 'test-user-id') => {
    const jwt = require('jsonwebtoken');
    const payload = {
      sub: userId,
      email: 'test@example.com',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: process.env.AUTH0_AUDIENCE,
      iss: process.env.AUTH0_DOMAIN,
    };
    
    return jwt.sign(payload, 'test-secret', { algorithm: 'HS256' });
  },

  // Clean up database - with error handling
  cleanupDatabase: async (pool) => {
    try {
      // Check if tables exist before trying to delete
      const tables = ['activity_logs', 'payments', 'documents', 'subscriptions', 'users'];
      
      for (const table of tables) {
        try {
          await pool.query(`DELETE FROM ${table}`);
        } catch (error) {
          // Table might not exist, that's OK
          console.log(`Table ${table} cleanup skipped:`, error.message);
        }
      }
    } catch (error) {
      console.error('Database cleanup error:', error);
    }
  },

  // Mock OpenAI response
  mockOpenAIResponse: (response) => {
    return {
      choices: [{
        message: {
          content: JSON.stringify({
            response: response.response || 'Test response',
            extractedData: response.extractedData || {},
            conversationComplete: response.conversationComplete || false,
            nextSteps: response.nextSteps || [],
          }),
        },
      }],
    };
  },

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Mock external services
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount: 999,
        currency: 'usd',
        status: 'requires_payment_method',
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        amount: 999,
        currency: 'usd',
        status: 'succeeded',
        metadata: { userId: '1', type: 'single_affidavit' },
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123' } },
      }),
    },
  }));
});

// Fix OpenAI mock
jest.mock('openai', () => {
  return class OpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: jest.fn().mockResolvedValue(
            global.testUtils.mockOpenAIResponse({
              response: 'Test AI response',
              extractedData: { affiantName: 'Test User' },
            })
          ),
        },
      };
    }
  };
});

// Fix nodemailer mock
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});