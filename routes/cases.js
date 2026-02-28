'use strict';

const express = require('express');
const router = express.Router();
const { asyncHandler, NotFoundError, AuthorizationError, ValidationError } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
// GET /api/cases
// List all cases for the authenticated user,
// with a count of associated documents.
// ─────────────────────────────────────────────
router.get('/',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.pool;
    const userId = req.user.id;

    const result = await client.query(
      `SELECT
         c.*,
         COUNT(d.id) AS document_count,
         json_agg(
           json_build_object(
             'id', d.id,
             'title', d.title,
             'document_type', d.document_type,
             'status', d.status,
             'updated_at', d.updated_at
           ) ORDER BY d.updated_at DESC
         ) FILTER (WHERE d.id IS NOT NULL) AS documents
       FROM cases c
       LEFT JOIN documents d ON d.case_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    res.sendSuccess({ cases: result.rows });
  })
);

// ─────────────────────────────────────────────
// GET /api/cases/:id
// Get a single case with its documents.
// ─────────────────────────────────────────────
router.get('/:id',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.pool;
    const userId = req.user.id;
    const caseId = parseInt(req.params.id, 10);

    if (!caseId || isNaN(caseId)) {
      throw new ValidationError('Invalid case ID');
    }

    const caseResult = await client.query(
      'SELECT * FROM cases WHERE id = $1',
      [caseId]
    );

    if (!caseResult.rows.length) {
      throw new NotFoundError('Case not found');
    }

    if (caseResult.rows[0].user_id !== userId) {
      throw new AuthorizationError('Access denied');
    }

    const docsResult = await client.query(
      `SELECT id, title, document_type, status, updated_at, created_at
       FROM documents
       WHERE case_id = $1
       ORDER BY updated_at DESC`,
      [caseId]
    );

    res.sendSuccess({
      case: caseResult.rows[0],
      documents: docsResult.rows
    });
  })
);

// ─────────────────────────────────────────────
// POST /api/cases
// Create a new case.
// ─────────────────────────────────────────────
router.post('/',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.pool;
    const userId = req.user.id;

    const {
      practice_area = 'family',
      matter_type_code,
      title,
      cause_number,
      court_name,
      state,
      county,
      petitioner_first_name,
      petitioner_last_name,
      respondent_first_name,
      respondent_last_name,
      children = [],
      case_metadata = {},
      interview_phase = 'INTAKE',
      interview_data = {}
    } = req.body;

    if (!['family', 'civil'].includes(practice_area)) {
      throw new ValidationError('practice_area must be "family" or "civil"');
    }

    const result = await client.query(
      `INSERT INTO cases (
         user_id, practice_area, matter_type_code, title, cause_number, court_name,
         state, county,
         petitioner_first_name, petitioner_last_name,
         respondent_first_name, respondent_last_name,
         children, case_metadata, interview_phase, interview_data
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        userId, practice_area, matter_type_code || null,
        title || null, cause_number || null, court_name || null,
        state || null, county || null,
        petitioner_first_name || null, petitioner_last_name || null,
        respondent_first_name || null, respondent_last_name || null,
        JSON.stringify(children), JSON.stringify(case_metadata),
        interview_phase, JSON.stringify(interview_data)
      ]
    );

    logger.info('Case created', { userId, caseId: result.rows[0].id, practice_area, matter_type_code });

    res.status(201).sendSuccess({ case: result.rows[0] });
  })
);

// ─────────────────────────────────────────────
// PUT /api/cases/:id
// Update case metadata (parties, court, children, etc.)
// Called by the orchestrator after each chat session to
// persist anything newly learned about the case.
// ─────────────────────────────────────────────
router.put('/:id',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.pool;
    const userId = req.user.id;
    const caseId = parseInt(req.params.id, 10);

    if (!caseId || isNaN(caseId)) {
      throw new ValidationError('Invalid case ID');
    }

    // Verify ownership
    const existing = await client.query(
      'SELECT user_id FROM cases WHERE id = $1',
      [caseId]
    );
    if (!existing.rows.length) throw new NotFoundError('Case not found');
    if (existing.rows[0].user_id !== userId) throw new AuthorizationError('Access denied');

    const {
      matter_type_code,
      title,
      cause_number,
      court_name,
      state,
      county,
      petitioner_first_name,
      petitioner_last_name,
      respondent_first_name,
      respondent_last_name,
      children,
      case_metadata,
      status,
      interview_phase,
      interview_data
    } = req.body;

    // Build dynamic SET clause — only update provided fields
    const updates = [];
    const values = [];
    let idx = 1;

    const addField = (col, val) => {
      if (val !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      }
    };

    addField('matter_type_code', matter_type_code);
    addField('title', title);
    addField('cause_number', cause_number);
    addField('court_name', court_name);
    addField('state', state);
    addField('county', county);
    addField('petitioner_first_name', petitioner_first_name);
    addField('petitioner_last_name', petitioner_last_name);
    addField('respondent_first_name', respondent_first_name);
    addField('respondent_last_name', respondent_last_name);
    if (children !== undefined) addField('children', JSON.stringify(children));
    if (case_metadata !== undefined) addField('case_metadata', JSON.stringify(case_metadata));
    addField('status', status);
    addField('interview_phase', interview_phase);
    if (interview_data !== undefined) addField('interview_data', JSON.stringify(interview_data));

    if (updates.length === 0) {
      throw new ValidationError('No fields provided to update');
    }

    values.push(caseId);
    const result = await client.query(
      `UPDATE cases SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    logger.info('Case updated', { userId, caseId, fields: updates.map(u => u.split(' ')[0]) });

    res.sendSuccess({ case: result.rows[0] });
  })
);

// ─────────────────────────────────────────────
// POST /api/cases/:id/documents
// Associate an existing document with a case.
// ─────────────────────────────────────────────
router.post('/:id/documents',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.pool;
    const userId = req.user.id;
    const caseId = parseInt(req.params.id, 10);
    const { document_id } = req.body;

    if (!caseId || isNaN(caseId)) throw new ValidationError('Invalid case ID');
    if (!document_id) throw new ValidationError('document_id is required');

    // Verify case ownership
    const caseCheck = await client.query(
      'SELECT user_id FROM cases WHERE id = $1',
      [caseId]
    );
    if (!caseCheck.rows.length) throw new NotFoundError('Case not found');
    if (caseCheck.rows[0].user_id !== userId) throw new AuthorizationError('Access denied');

    // Verify document ownership
    const docCheck = await client.query(
      'SELECT user_id FROM documents WHERE id = $1',
      [document_id]
    );
    if (!docCheck.rows.length) throw new NotFoundError('Document not found');
    if (docCheck.rows[0].user_id !== userId) throw new AuthorizationError('Access denied');

    await client.query(
      'UPDATE documents SET case_id = $1 WHERE id = $2',
      [caseId, document_id]
    );

    logger.info('Document linked to case', { userId, caseId, document_id });

    res.sendSuccess({ linked: true, case_id: caseId, document_id });
  })
);

module.exports = router;
