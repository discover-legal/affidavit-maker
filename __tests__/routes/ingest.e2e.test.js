'use strict';

/**
 * Document Ingestion — End-to-End Tests
 *
 * Tests the full HTTP flow: upload PDF → parse → classify → extract → deadline →
 * store in DB → review/confirm → create case.
 *
 * All external deps are mocked:
 *   - pdf-parse: returns known text
 *   - LLM (global.openAIService): returns known classification
 *   - auth0Middleware: bypassed, injects req.user
 *   - database pool: in-memory mock with query tracking
 *
 * No local PostgreSQL or OpenAI key required.
 */

const request = require('supertest');
const express = require('express');

// ─── Mock pdf-parse BEFORE requiring the service ─────────────────────────────
// Jest hoists mock() calls — variable names must start with "mock" to be accessible.

const mockPetitionText = [
  'IN THE DISTRICT COURT OF HARRIS COUNTY, TEXAS',
  '247TH JUDICIAL DISTRICT',
  '',
  'CAUSE NO. 2026-FAM-12345',
  '',
  'JOHN DOE,',
  '  Petitioner,',
  '',
  'v.',
  '',
  'JANE DOE,',
  '  Respondent.',
  '',
  'ORIGINAL PETITION FOR DIVORCE',
  '',
  'TO THE HONORABLE JUDGE OF SAID COURT:',
  '',
  'Petitioner, John Doe, files this Original Petition for Divorce against',
  'Respondent, Jane Doe, and shows the Court:',
  '',
  'I. DISCOVERY LEVEL',
  'Discovery in this case is intended to be conducted under Level 2.',
  '',
  'II. PARTIES',
  'Petitioner, John Doe, resides at 123 Main Street, Houston, Harris County, Texas.',
  'Respondent, Jane Doe, resides at 456 Oak Avenue, Houston, Harris County, Texas.',
  '',
  'III. DOMICILE AND RESIDENCY',
  'Petitioner has been a domiciliary of the State of Texas for at least six months,',
  'and a resident of Harris County for at least ninety days.',
  '',
  'IV. SERVICE',
  'The parties have agreed to waiver of service.',
  '',
  'V. DATE OF MARRIAGE AND SEPARATION',
  'The parties were married on June 15, 2015, and ceased to live together as',
  'husband and wife on or about January 10, 2026.',
  '',
  'VI. GROUNDS FOR DIVORCE',
  'The marriage has become insupportable because of discord or conflict of',
  'personalities that destroys the legitimate ends of the marital relationship',
  'and prevents any reasonable expectation of reconciliation.',
  '',
  'VII. CHILDREN',
  'The following children were born of the marriage:',
  '1. Emma Doe, born March 5, 2018 (age 7)',
  '2. James Doe, born November 12, 2020 (age 5)',
  '',
  'VIII. PROPERTY',
  'The community estate should be divided in a just and right manner.',
  '',
  'IX. RELIEF REQUESTED',
  'Petitioner requests the Court to grant a divorce and divide the community estate.',
  '',
  'Filed: February 15, 2026',
  'Service Date: March 1, 2026',
  '',
  'Respectfully submitted,',
  'John Doe, Pro Se'
].join('\n');

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer) => {
    // Simulate scanned image if buffer is tiny
    if (buffer.length < 100) {
      return Promise.resolve({ text: '', numpages: 1 });
    }
    return Promise.resolve({ text: mockPetitionText, numpages: 3 });
  });
});

// ─── Mock auth middleware ────────────────────────────────────────────────────

jest.mock('../../middleware/auth0Middleware', () => ({
  auth0Middleware: (req, res, next) => {
    req.auth = { sub: 'auth0|test-ingest-user' };
    req.user = { id: 'test-user-42', email: 'testingest@example.com' };
    next();
  },
  cleanupDbClient: (req, res, next) => next()
}));

// ─── Mock rate limiter (don't throttle tests) ───────────────────────────────

jest.mock('../../middleware/rateLimiting', () => ({
  pdfLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
  chatLimiter: (req, res, next) => next()
}));

// ─── Mock LLM service ───────────────────────────────────────────────────────

const mockClassificationResult = {
  document_type: 'divorce_petition',
  confidence: 0.95,
  petitioner_name: 'John Doe',
  respondent_name: 'Jane Doe',
  court_name: 'Harris County District Court, 247th Judicial District',
  case_number: '2026-FAM-12345',
  state: 'TX',
  county: 'Harris',
  filing_date: '2026-02-15',
  service_date: '2026-03-01',
  claims: ['Insupportability (no-fault)'],
  relief_requested: ['Grant divorce', 'Divide community estate'],
  children: [
    { name: 'Emma Doe', age: 7, dob: '2018-03-05' },
    { name: 'James Doe', age: 5, dob: '2020-11-12' }
  ],
  monetary_amounts: [],
  grounds: ['Insupportability — discord or conflict of personalities'],
  property_described: ['Community estate'],
  response_deadline_stated: null
};

global.openAIService = {
  chat: jest.fn().mockResolvedValue({
    choices: [{
      message: {
        tool_calls: [{
          function: {
            name: 'analyze_legal_document',
            arguments: JSON.stringify(mockClassificationResult)
          }
        }]
      }
    }]
  })
};

// ─── Mock database pool ──────────────────────────────────────────────────────

const insertedRows = [];
let nextId = 1;

const mockPool = {
  query: jest.fn().mockImplementation((sql, params) => {
    const sqlUpper = sql.toUpperCase().trim();

    // INSERT INTO ingested_documents
    if (sqlUpper.startsWith('INSERT INTO INGESTED_DOCUMENTS')) {
      const id = nextId++;
      const row = { id, status: params[12] || 'parsed' };
      insertedRows.push({ table: 'ingested_documents', id, params });
      return Promise.resolve({ rows: [row] });
    }

    // SELECT from ingested_documents
    if (sqlUpper.includes('FROM INGESTED_DOCUMENTS') && sqlUpper.startsWith('SELECT')) {
      const id = params[0];
      const inserted = insertedRows.find(r => r.table === 'ingested_documents' && r.id === id);
      if (!inserted) return Promise.resolve({ rows: [] });
      return Promise.resolve({
        rows: [{
          id: inserted.id,
          user_id: 'test-user-42',
          file_name: inserted.params[2] || 'test.pdf',
          file_size_bytes: inserted.params[3] || 1000,
          file_pages: inserted.params[4] || 3,
          document_class: inserted.params[6] || 'divorce_petition',
          classification_confidence: inserted.params[7] || 0.95,
          extracted_data: JSON.parse(inserted.params[8] || '{}'),
          service_date: inserted.params[9],
          response_deadline: inserted.params[10],
          deadline_source: inserted.params[11],
          status: inserted.params[12] || 'parsed',
          error_message: inserted.params[13],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      });
    }

    // INSERT INTO cases
    if (sqlUpper.startsWith('INSERT INTO CASES')) {
      const caseId = 100 + nextId++;
      return Promise.resolve({ rows: [{ id: caseId }] });
    }

    // UPDATE ingested_documents
    if (sqlUpper.startsWith('UPDATE INGESTED_DOCUMENTS')) {
      return Promise.resolve({ rowCount: 1 });
    }

    return Promise.resolve({ rows: [] });
  })
};

// ─── Build test Express app ──────────────────────────────────────────────────

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());

  // Inject mock pool and RLS-scoped client (routes use req.dbClient)
  app.locals.pool = mockPool;
  app.use((req, res, next) => {
    req.dbClient = mockPool;
    next();
  });

  // Response helpers (minimal)
  app.use((req, res, next) => {
    res.sendSuccess = (data) => res.json({ success: true, data });
    res.sendError = (msg, code) => res.status(code || 500).json({ success: false, error: msg });
    next();
  });

  // Mount the ingest router
  const ingestRouter = require('../../routes/ingest');
  app.use('/api/ingest', ingestRouter);

  // Error handler
  const { errorHandler } = require('../../middleware/errorMiddleware');
  app.use(errorHandler);
});

beforeEach(() => {
  mockPool.query.mockClear();
  global.openAIService.chat.mockClear();
});

// ─── Helper: create a buffer that looks like a PDF ───────────────────────────

function fakePdfBuffer(size = 500) {
  const buf = Buffer.alloc(size);
  // PDF magic bytes
  buf.write('%PDF-1.4', 0);
  return buf;
}

function tinyBuffer() {
  return Buffer.from('tiny');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Document Ingestion E2E', () => {

  // ── Upload ──────────────────────────────────────────────────────────────

  describe('POST /api/ingest/upload', () => {

    it('uploads PDF, parses, classifies, and returns extraction', async () => {
      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'divorce_petition.pdf')
        .expect(201);

      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.ingestion_id).toBeDefined();
      expect(data.status).toBe('parsed');
      expect(data.document_class).toBe('divorce_petition');
      expect(data.classification_confidence).toBe(0.95);

      // Extracted data
      expect(data.extracted_data.petitioner_name).toBe('John Doe');
      expect(data.extracted_data.respondent_name).toBe('Jane Doe');
      expect(data.extracted_data.state).toBe('TX');
      expect(data.extracted_data.county).toBe('Harris');
      expect(data.extracted_data.case_number).toBe('2026-FAM-12345');
      expect(data.extracted_data.children).toHaveLength(2);

      // Deadline (TX divorce = 20 days from 2026-03-01)
      expect(data.response_deadline).toBe('2026-03-21');
      expect(data.deadline_days).toBe(20);
      expect(data.deadline_source).toContain('TX');

      // Suggested response documents
      expect(data.suggested_documents).toHaveLength(2);
      expect(data.suggested_documents[0].code).toBe('divorce_response');
      expect(data.suggested_documents[1].code).toBe('financial_disclosure');

      // Case profile
      expect(data.case_profile.matter_type_code).toBe('document_response');
      expect(data.case_profile.original_matter_type).toBe('divorce');
      expect(data.case_profile.practice_area).toBe('family');
      expect(data.case_profile.petitioner_first_name).toBe('John');
      expect(data.case_profile.petitioner_last_name).toBe('Doe');

      // DB insert was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ingested_documents'),
        expect.any(Array)
      );
    });

    it('calls the LLM with the extracted text', async () => {
      await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'test.pdf')
        .expect(201);

      expect(global.openAIService.chat).toHaveBeenCalledTimes(1);
      const callArgs = global.openAIService.chat.mock.calls[0];
      // First arg is messages array
      expect(callArgs[0][0].role).toBe('system');
      expect(callArgs[0][0].content).toContain('DOCUMENT TEXT:');
      // Second arg is options with tools
      expect(callArgs[1].tools).toBeDefined();
      expect(callArgs[1].tools[0].function.name).toBe('analyze_legal_document');
    });

    it('rejects non-PDF files', async () => {
      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', Buffer.from('hello world'), {
          filename: 'readme.txt',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/PDF/i);
    });

    it('returns 201 with ocrRequired flag for scanned-image PDF (no text)', async () => {
      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', tinyBuffer(), {
          filename: 'scanned.pdf',
          contentType: 'application/pdf'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ocr_required');
      expect(res.body.data.ocrRequired).toBe(true);
      expect(res.body.data.message).toMatch(/scanned|manual/i);
      expect(res.body.data.ingestion_id).toBeDefined();
    });

    it('returns 400 when no file is attached', async () => {
      const res = await request(app)
        .post('/api/ingest/upload')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No file|uploaded/i);
    });

    it('handles LLM failure gracefully', async () => {
      global.openAIService.chat.mockRejectedValueOnce(new Error('LLM timeout'));

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'test.pdf')
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/analyze|try again/i);
    });
  });

  // ── Get by ID ───────────────────────────────────────────────────────────

  describe('GET /api/ingest/:id', () => {

    it('retrieves an ingestion record by ID', async () => {
      // First upload to create a record
      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'test.pdf')
        .expect(201);

      const ingestionId = uploadRes.body.data.ingestion_id;

      const res = await request(app)
        .get(`/api/ingest/${ingestionId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ingestion_id).toBe(ingestionId);
      expect(res.body.data.document_class).toBe('divorce_petition');
      expect(res.body.data.suggested_documents).toBeDefined();
      expect(res.body.data.suggested_documents.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent ID', async () => {
      // Mock returns empty rows for unknown ID
      const originalQuery = mockPool.query.getMockImplementation();
      mockPool.query.mockImplementationOnce((sql, params) => {
        if (sql.toUpperCase().includes('FROM INGESTED_DOCUMENTS') && sql.toUpperCase().startsWith('SELECT')) {
          return Promise.resolve({ rows: [] });
        }
        return originalQuery(sql, params);
      });

      const res = await request(app)
        .get('/api/ingest/99999')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('rejects invalid ID format', async () => {
      const res = await request(app)
        .get('/api/ingest/abc')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Review/Confirm ──────────────────────────────────────────────────────

  describe('PUT /api/ingest/:id/review', () => {

    it('confirms extraction and creates a case', async () => {
      // Upload first
      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'petition.pdf')
        .expect(201);

      const ingestionId = uploadRes.body.data.ingestion_id;

      const res = await request(app)
        .put(`/api/ingest/${ingestionId}/review`)
        .send({
          confirmed: true,
          user_name: 'Jane Doe',
          service_date: '2026-03-01'
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.ingestion_id).toBe(ingestionId);
      expect(data.status).toBe('accepted');
      expect(data.case_id).toBeDefined();
      expect(data.response_deadline).toBe('2026-03-21');
      expect(data.deadline_source).toContain('TX');
      expect(data.response_documents).toHaveLength(2);
      expect(data.chat_url).toContain('matterTypeCode=document_response');
      expect(data.chat_url).toContain(`caseId=${data.case_id}`);

      // Verify case INSERT was called
      const caseInsertCall = mockPool.query.mock.calls.find(
        c => c[0].toUpperCase().includes('INSERT INTO CASES')
      );
      expect(caseInsertCall).toBeDefined();
      const caseParams = caseInsertCall[1];
      // user_id
      expect(caseParams[0]).toBe('test-user-42');
      // practice_area
      expect(caseParams[1]).toBe('family');
      // matter_type_code
      expect(caseParams[2]).toBe('document_response');
      // state
      expect(caseParams[3]).toBe('TX');
    });

    it('applies corrections to extracted data', async () => {
      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'petition.pdf')
        .expect(201);

      const res = await request(app)
        .put(`/api/ingest/${uploadRes.body.data.ingestion_id}/review`)
        .send({
          confirmed: true,
          user_name: 'Jane Smith-Doe',
          service_date: '2026-03-05',
          corrections: {
            county: 'Fort Bend',
            state: 'TX'
          }
        })
        .expect(200);

      // Deadline recalculated: 20 days from March 5 = March 25
      expect(res.body.data.response_deadline).toBe('2026-03-25');
    });

    it('rejects when confirmed is false', async () => {
      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'petition.pdf')
        .expect(201);

      const res = await request(app)
        .put(`/api/ingest/${uploadRes.body.data.ingestion_id}/review`)
        .send({ confirmed: false })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/[Cc]onfirm/);
    });

    it('returns 404 for non-existent ingestion', async () => {
      const originalQuery = mockPool.query.getMockImplementation();
      mockPool.query.mockImplementationOnce((sql, params) => {
        if (sql.toUpperCase().includes('FROM INGESTED_DOCUMENTS')) {
          return Promise.resolve({ rows: [] });
        }
        return originalQuery(sql, params);
      });

      const res = await request(app)
        .put('/api/ingest/99999/review')
        .send({ confirmed: true, user_name: 'Test' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Full pipeline flow ──────────────────────────────────────────────────

  describe('Full respondent flow', () => {

    it('upload → get → review: complete pipeline', async () => {
      // Step 1: Upload
      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(1000), 'served_papers.pdf')
        .expect(201);

      expect(uploadRes.body.success).toBe(true);
      const ingestionId = uploadRes.body.data.ingestion_id;

      // Step 2: Get (user reviews the extraction)
      const getRes = await request(app)
        .get(`/api/ingest/${ingestionId}`)
        .expect(200);

      expect(getRes.body.data.document_class).toBe('divorce_petition');
      expect(getRes.body.data.suggested_documents.length).toBeGreaterThan(0);

      // Step 3: Confirm (user corrects service date, enters their name)
      const reviewRes = await request(app)
        .put(`/api/ingest/${ingestionId}/review`)
        .send({
          confirmed: true,
          user_name: 'Jane Doe',
          service_date: '2026-03-10'
        })
        .expect(200);

      expect(reviewRes.body.data.status).toBe('accepted');
      expect(reviewRes.body.data.case_id).toBeDefined();
      // TX divorce: 20 days from March 10 = March 30
      expect(reviewRes.body.data.response_deadline).toBe('2026-03-30');
      expect(reviewRes.body.data.chat_url).toMatch(/matterTypeCode=document_response/);
    });
  });

  // ── Document type variations ────────────────────────────────────────────

  describe('Different document types', () => {

    it('handles debt collection complaint', async () => {
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'debt_collection_complaint',
                  confidence: 0.88,
                  petitioner_name: 'Capital One Bank',
                  respondent_name: 'Jane Doe',
                  state: 'FL',
                  county: 'Miami-Dade',
                  case_number: '2026-CC-5678',
                  claims: ['Breach of credit card agreement'],
                  relief_requested: ['$8,500 plus interest and fees'],
                  monetary_amounts: [{ description: 'Credit card balance', amount: 8500 }],
                  service_date: '2026-03-01'
                })
              }
            }]
          }
        }]
      });

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'collection.pdf')
        .expect(201);

      const data = res.body.data;
      expect(data.document_class).toBe('debt_collection_complaint');
      expect(data.extracted_data.petitioner_name).toBe('Capital One Bank');
      // FL civil complaint = 20 days
      expect(data.response_deadline).toBe('2026-03-21');
      expect(data.suggested_documents[0].code).toBe('debt_answer');
      expect(data.case_profile.original_matter_type).toBe('debt_defense');
      expect(data.case_profile.practice_area).toBe('civil');
    });

    it('handles eviction notice', async () => {
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'eviction_notice',
                  confidence: 0.92,
                  petitioner_name: 'ABC Property Management',
                  respondent_name: 'John Tenant',
                  state: 'CA',
                  county: 'Los Angeles',
                  claims: ['Nonpayment of rent'],
                  service_date: '2026-03-01'
                })
              }
            }]
          }
        }]
      });

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'eviction.pdf')
        .expect(201);

      expect(res.body.data.document_class).toBe('eviction_notice');
      // CA eviction = 5 days
      expect(res.body.data.response_deadline).toBe('2026-03-06');
      expect(res.body.data.deadline_days).toBe(5);
      expect(res.body.data.suggested_documents[0].code).toBe('ud_answer');
    });

    it('handles small claims complaint', async () => {
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'small_claims_complaint',
                  confidence: 0.90,
                  petitioner_name: 'Bob Builder',
                  respondent_name: 'Sam Homeowner',
                  state: 'NY',
                  county: 'Kings',
                  claims: ['Unpaid contractor invoice'],
                  monetary_amounts: [{ description: 'Invoice balance', amount: 4200 }],
                  service_date: '2026-03-01'
                })
              }
            }]
          }
        }]
      });

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'small_claims.pdf')
        .expect(201);

      expect(res.body.data.document_class).toBe('small_claims_complaint');
      // NY small claims = 20 days
      expect(res.body.data.response_deadline).toBe('2026-03-21');
      expect(res.body.data.suggested_documents[0].code).toBe('small_claims_answer');
    });

    it('handles unknown document type with low confidence', async () => {
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'unknown',
                  confidence: 0.25,
                  state: 'TX'
                })
              }
            }]
          }
        }]
      });

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'mystery.pdf')
        .expect(201);

      expect(res.body.data.document_class).toBe('unknown');
      expect(res.body.data.classification_confidence).toBe(0.25);
      // Should still suggest docs (falls back to general_civil)
      expect(res.body.data.suggested_documents.length).toBeGreaterThan(0);
    });
  });

  // ── Deadline edge cases ─────────────────────────────────────────────────

  describe('Deadline calculations via HTTP', () => {

    it('returns deadline_note when no service date found', async () => {
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'divorce_petition',
                  confidence: 0.85,
                  state: 'TX',
                  // No service_date
                })
              }
            }]
          }
        }]
      });

      const res = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'no_date.pdf')
        .expect(201);

      expect(res.body.data.response_deadline).toBeNull();
      expect(res.body.data.deadline_note).toMatch(/service date/i);
    });

    it('recalculates deadline when service date is provided in review', async () => {
      // Upload with no service date
      global.openAIService.chat.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'analyze_legal_document',
                arguments: JSON.stringify({
                  document_type: 'civil_complaint',
                  confidence: 0.90,
                  state: 'NJ'
                })
              }
            }]
          }
        }]
      });

      const uploadRes = await request(app)
        .post('/api/ingest/upload')
        .attach('document', fakePdfBuffer(), 'complaint.pdf')
        .expect(201);

      expect(uploadRes.body.data.response_deadline).toBeNull();

      // Now review with service date
      const reviewRes = await request(app)
        .put(`/api/ingest/${uploadRes.body.data.ingestion_id}/review`)
        .send({
          confirmed: true,
          user_name: 'Test User',
          service_date: '2026-04-01'
        })
        .expect(200);

      // NJ civil complaint = 35 days from April 1
      expect(reviewRes.body.data.response_deadline).toBe('2026-05-06');
    });
  });
});
