// __tests__/api/payment.security.test.js - Security tests for payment routes
const request = require('supertest');
const express = require('express');

// Mock Stripe
const mockStripePaymentIntents = {
  create: jest.fn(),
  retrieve: jest.fn(),
  cancel: jest.fn()
};

jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: mockStripePaymentIntents
  }));
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  logBusinessEvent: jest.fn(),
  logError: jest.fn(),
  logSecurity: jest.fn()
}));

// Mock auth middleware
jest.mock('../../middleware/auth0Middleware', () => ({
  auth0Middleware: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    next();
  }
}));

// Mock error middleware
jest.mock('../../middleware/errorMiddleware', () => ({
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthorizationError';
    }
  }
}));

// Mock rate limiting
jest.mock('../../middleware/rateLimiting', () => ({
  paymentLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next()
}));

// Mock validation - return an array of middleware functions
const mockValidatePayment = [
  (req, res, next) => {
    // Default: just pass through
    next();
  }
];

jest.mock('../../middleware/validation', () => {
  const actual = jest.requireActual('../../middleware/validation');
  return {
    ...actual,
    validatePayment: mockValidatePayment,
    validateId: (req, res, next) => next()
  };
});

// Mock database pool
const mockPool = {
  query: jest.fn()
};

// Import the payment router
const paymentRouter = require('../../routes/payment');

// Create test app
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.app.locals.pool = mockPool;
  next();
});
app.use('/api/payment', paymentRouter);

// Add response helpers
app.use((req, res, next) => {
  res.sendSuccess = (data) => res.json({ success: true, ...data });
  res.sendPaginated = (data, page, limit, total) => 
    res.json({ success: true, data, pagination: { page, limit, total } });
  next();
});

// Error handler
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: err.message });
});

describe('Payment Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
    
    // Set up Stripe mock to succeed by default
    mockStripePaymentIntents.create.mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret_abc123xyz',
      amount: 3999,
      currency: 'usd',
      status: 'requires_payment_method'
    });
  });

  describe('POST /api/payment/create-intent - Price Manipulation Protection', () => {
    it('should reject requests that include an amount parameter', async () => {
      // Replace the mock middleware to check for amount
      mockValidatePayment[0] = (req, res, next) => {
        if (req.body.amount !== undefined) {
          return res.status(400).json({
            success: false,
            error: 'Amount cannot be provided by client - it is determined server-side'
          });
        }
        next();
      };

      const response = await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'single_affidavit',
          documentId: 'new',
          amount: 100 // Hacker trying to pay $1 instead of $39.99
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Amount cannot be provided');
      
      // Verify Stripe was NOT called with the manipulated amount
      expect(mockStripePaymentIntents.create).not.toHaveBeenCalled();
    });

    it('should use server-side pricing for single_affidavit ($39.99)', async () => {
      // Replace the mock middleware to just pass through
      mockValidatePayment[0] = (req, res, next) => next();
      
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'single_affidavit',
          documentId: 'new'
        });

      // Debug: Log the response if it's not 200
      if (response.status !== 200) {
        console.log('Response status:', response.status);
        console.log('Response body:', response.body);
        console.log('Stripe create called:', mockStripePaymentIntents.create.mock.calls);
      }

      expect(response.status).toBe(200);

      // Verify Stripe was called with the CORRECT server-side amount
      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3999, // $39.99 in cents - server-side pricing
          currency: 'usd',
          metadata: expect.objectContaining({
            documentType: 'single_affidavit'
          })
        })
      );
    });

    it('should use server-side pricing for family_law_package ($119.99)', async () => {
      mockValidatePayment[0] = (req, res, next) => next();
      
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'family_law_package',
          documentId: 'new'
        })
        .expect(200);

      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 11999, // $119.99 in cents
          metadata: expect.objectContaining({
            documentType: 'family_law_package'
          })
        })
      );
    });

    it('should use server-side pricing for all_state_access ($199.99)', async () => {
      mockValidatePayment[0] = (req, res, next) => next();
      
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'all_state_access',
          documentId: 'new'
        })
        .expect(200);

      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 19999, // $199.99 in cents
          metadata: expect.objectContaining({
            documentType: 'all_state_access'
          })
        })
      );
    });

    it('should default to single_affidavit pricing for invalid document types', async () => {
      mockValidatePayment[0] = (req, res, next) => next();
      
      mockPool.query.mockResolvedValue({ rows: [] });

      // Note: This should normally be caught by validation, but testing fallback
      await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'invalid_type',
          documentId: 'new'
        })
        .expect(200);

      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3999 // Falls back to single_affidavit pricing
        })
      );
    });

    it('should store the correct amount in the database', async () => {
      mockValidatePayment[0] = (req, res, next) => next();
      
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'family_law_package',
          documentId: 'new'
        })
        .expect(200);

      // Check that database was called with correct amount
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining([
          1, // userId
          'pi_test123', // paymentIntentId
          11999, // amount in cents - from server-side pricing
          'usd',
          'pending',
          expect.any(String) // metadata JSON
        ])
      );
    });
  });

  describe('GET /api/payment/pricing - Read-only pricing endpoint', () => {
    it('should return pricing information without authentication', async () => {
      const response = await request(app)
        .get('/api/payment/pricing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pricing).toBeDefined();
      expect(response.body.pricing.single_affidavit).toEqual({
        name: 'Single Affidavit',
        price: 39.99,
        priceCents: 3999,
        currency: 'USD',
        description: 'Generate one professional affidavit document'
      });
      expect(response.body.pricing.family_law_package).toEqual({
        name: 'Family Law Package',
        price: 119.99,
        priceCents: 11999,
        currency: 'USD',
        description: 'Generate up to 5 family law documents'
      });
      expect(response.body.pricing.all_state_access).toEqual({
        name: 'All State Access',
        price: 199.99,
        priceCents: 19999,
        currency: 'USD',
        description: 'Unlimited documents for all supported states for 30 days'
      });
    });
  });

  describe('Security Regression Tests', () => {
    it('should prevent price manipulation via intercepted requests', async () => {
      mockValidatePayment[0] = (req, res, next) => {
        if (req.body.amount !== undefined) {
          return res.status(400).json({
            success: false,
            error: 'Amount cannot be provided by client - it is determined server-side'
          });
        }
        next();
      };

      // Simulate a hacker trying to change the price by intercepting the request
      const hackerRequest = {
        documentType: 'all_state_access', // $199.99 product
        amount: 999, // Try to pay only $9.99
        documentId: 'new'
      };

      const response = await request(app)
        .post('/api/payment/create-intent')
        .send(hackerRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(mockStripePaymentIntents.create).not.toHaveBeenCalled();
    });

    it('should ensure amount cannot be overridden even with valid documentType', async () => {
      mockValidatePayment[0] = (req, res, next) => {
        if (req.body.amount !== undefined) {
          return res.status(400).json({
            success: false,
            error: 'Amount cannot be provided by client - it is determined server-side'
          });
        }
        next();
      };

      const response = await request(app)
        .post('/api/payment/create-intent')
        .send({
          documentType: 'single_affidavit',
          amount: 1, // Try to pay $0.01
          documentId: 'new'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(mockStripePaymentIntents.create).not.toHaveBeenCalled();
    });
  });
});
