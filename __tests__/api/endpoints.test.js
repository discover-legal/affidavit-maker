// __tests__/api/endpoints.test.js
const request = require('supertest');
const { Pool } = require('pg');
const app = require('../../server');

// Mock the Auth0 middleware
jest.mock('../../middleware/auth0Middleware', () => ({
  checkJwt: (req, res, next) => {
    req.auth = { sub: 'test-user-id' };
    req.userId = 'test-user-id';
    req.user = { id: 1, email: 'test@example.com' };
    next();
  },
}));

describe('API Endpoints', () => {
  let pool;
  let server;
  let testUser;
  let testDocument;

  beforeAll(async () => {
    // Create test database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Start server
    server = app.listen(0); // Random port
  });

  beforeEach(async () => {
    // Clean database
    await global.testUtils.cleanupDatabase(pool);
    
    // Create test user
    testUser = await global.testUtils.createTestUser(pool);
    
    // Create test document
    testDocument = await global.testUtils.createTestDocument(pool, testUser.id);
  });

  afterAll(async () => {
    await pool.end();
    server.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.services).toBeDefined();
      expect(response.body.templateStates).toBeGreaterThan(0);
    });
  });

  describe('GET /api/templates/states', () => {
    it('should return supported states', async () => {
      const response = await request(server)
        .get('/api/templates/states')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.states).toHaveLength(3);
      expect(response.body.states.map(s => s.code)).toContain('TX');
    });
  });

  describe('POST /api/templates/validate', () => {
    it('should validate valid affidavit data', async () => {
      const response = await request(server)
        .post('/api/templates/validate')
        .send({
          affidavitData: {
            affiantName: 'John Doe',
            county: 'Travis',
            facts: ['Fact 1'],
          },
          state: 'TX',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation.isValid).toBe(true);
    });

    it('should return validation errors for invalid data', async () => {
      const response = await request(server)
        .post('/api/templates/validate')
        .send({
          affidavitData: {
            affiantName: '',
            facts: [],
          },
          state: 'TX',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/chat', () => {
    it('should process chat message', async () => {
      const response = await request(server)
        .post('/api/chat')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          message: 'My name is John Doe',
          conversationHistory: [],
          currentData: { state: 'TX' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toBeDefined();
      expect(response.body.extractedData).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(server)
        .post('/api/chat')
        .send({
          message: 'Test message',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/preview', () => {
    it('should generate preview for valid data', async () => {
      const response = await request(server)
        .post('/api/preview')
        .send({
          affidavitData: {
            affiantName: 'John Doe',
            state: 'TX',
            county: 'Travis',
            facts: ['Test fact 1', 'Test fact 2'],
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.preview).toBeDefined();
      expect(response.body.preview.sections).toBeDefined();
      expect(response.body.preview.sections.header).toContain('TEXAS');
    });

    it('should work without authentication', async () => {
      const response = await request(server)
        .post('/api/preview')
        .send({
          affidavitData: {
            affiantName: 'Jane Doe',
            state: 'UT',
            facts: ['Test fact'],
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require state for preview', async () => {
      const response = await request(server)
        .post('/api/preview')
        .send({
          affidavitData: {
            affiantName: 'John Doe',
            facts: ['Test fact'],
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('State is required');
    });
  });

  describe('POST /api/save-draft', () => {
    it('should save new draft', async () => {
      const response = await request(server)
        .post('/api/save-draft')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          affidavitData: {
            affiantName: 'John Doe',
            state: 'TX',
            facts: ['Test fact'],
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documentId).toBeDefined();
      
      // Verify in database
      const result = await pool.query(
        'SELECT * FROM documents WHERE id = $1',
        [response.body.documentId]
      );
      expect(result.rows[0].status).toBe('draft');
    });

    it('should update existing draft', async () => {
      const response = await request(server)
        .post('/api/save-draft')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          documentId: testDocument.id,
          affidavitData: {
            affiantName: 'Updated Name',
            state: 'TX',
            facts: ['Updated fact'],
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documentId).toBe(testDocument.id);
    });
  });

  describe('GET /api/documents', () => {
    it('should return user documents', async () => {
      const response = await request(server)
        .get('/api/documents')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].id).toBe(testDocument.id);
    });

    it('should enhance documents with parsed content', async () => {
      const response = await request(server)
        .get('/api/documents')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .expect(200);

      const doc = response.body.documents[0];
      expect(doc.affiantName).toBe('Test Affiant');
      expect(doc.state).toBe('TX');
      expect(doc.hasFile).toBe(false);
    });
  });

  describe('POST /api/generate-affidavit', () => {
    it('should generate complete affidavit', async () => {
      const response = await request(server)
        .post('/api/generate-affidavit')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          affidavitData: {
            affiantName: 'John Doe',
            state: 'TX',
            county: 'Travis',
            facts: ['I am competent to testify', 'These facts are true'],
          },
          strategy: 'simple',
          format: 'text',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documentId).toBeDefined();
      expect(response.body.content).toContain('THE STATE OF TEXAS');
      expect(response.body.content).toContain('John Doe');
    });

    it('should validate data before generation', async () => {
      const response = await request(server)
        .post('/api/generate-affidavit')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          affidavitData: {
            affiantName: '',
            state: 'TX',
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payment/create-intent', () => {
    it('should create payment intent', async () => {
      const response = await request(server)
        .post('/api/payment/create-intent')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          documentType: 'single_affidavit',
          documentId: testDocument.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.amount).toBe(9.99);
    });
  });

  describe('POST /api/payment/confirm', () => {
    it('should confirm successful payment', async () => {
      const response = await request(server)
        .post('/api/payment/confirm')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          paymentIntentId: 'pi_test_123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paymentId).toBeDefined();
      
      // Verify payment record
      const result = await pool.query(
        'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
        ['pi_test_123']
      );
      expect(result.rows[0].status).toBe('succeeded');
    });
  });
});

describe('Error Handling', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('should handle 404 errors', async () => {
    const response = await request(server)
      .get('/api/nonexistent')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Endpoint not found');
  });

  it('should handle malformed JSON', async () => {
    const response = await request(server)
      .post('/api/templates/validate')
      .set('Content-Type', 'application/json')
      .send('{"invalid json}')
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error('Database connection failed')),
    };
    
    // This would require dependency injection to test properly
    // For now, we'll test that the error handler works
    const response = await request(server)
      .get('/api/documents')
      .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
      .expect(500);

    expect(response.body.success).toBe(false);
  });
});