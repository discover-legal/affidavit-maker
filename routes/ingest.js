'use strict';

/**
 * Document Ingestion Routes
 *
 * Respondent path: upload a served document, get it parsed + classified,
 * review/correct the extraction, then enter the chat flow to generate responses.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const logger = require('../utils/logger');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { pdfLimiter, standardLimiter } = require('../middleware/rateLimiting');
const { validateIngestionReview, requireDbClient } = require('../middleware/validation');
const ingestionService = require('../services/DocumentIngestionService');
const evidenceStorage = require('../services/evidenceStorage');

// ─── Multer config (in-memory buffer, PDF only, 25MB limit) ─────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new ValidationError('Only PDF files are accepted. Please upload a PDF.'));
    }
  }
});

// ─── POST /api/ingest/upload ─────────────────────────────────────────────────
// Upload a served document, parse + classify it, return extraction results.

router.post('/upload',
  pdfLimiter,
  auth0Middleware,
  requireDbClient,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded. Please attach a PDF document.');
    }

    const client = req.dbClient;
    const userId = req.user.id;
    const buffer = req.file.buffer;
    const fileName = req.file.originalname || 'uploaded.pdf';
    const fileSize = req.file.size;

    logger.info('Ingestion upload started', { userId, fileName, fileSize });

    // Run the full pipeline
    const result = await ingestionService.processDocument(buffer, fileName, userId);

    // Persist uploaded PDF to evidence storage
    const fileKey = `ingest_${crypto.randomUUID()}`;
    const ingestDir = path.join(evidenceStorage.basePath, 'ingested', String(userId));
    await fs.mkdir(ingestDir, { recursive: true });
    const filePath = path.join(ingestDir, `${fileKey}.pdf`);
    await fs.writeFile(filePath, buffer);

    const insertResult = await client.query(
      `INSERT INTO ingested_documents
        (user_id, file_key, file_name, file_size_bytes, file_pages,
         raw_text, document_class, classification_confidence, extracted_data,
         service_date, response_deadline, deadline_source, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, status`,
      [
        userId,
        fileKey,
        fileName,
        fileSize,
        result.pages || 1,
        result.rawText || null,
        result.documentClass || null,
        result.confidence || null,
        JSON.stringify(result.extractedData || {}),
        result.serviceDate || null,
        result.deadline || null,
        result.deadlineSource || null,
        result.status,
        result.error || null
      ]
    );

    const ingestionId = insertResult.rows[0].id;

    if (!result.success) {
      return res.sendError(result.error, 422);
    }

    res.status(201).json({
      success: true,
      data: {
        ingestion_id: ingestionId,
        status: result.status,
        ocrRequired: result.ocrRequired || false,
        message: result.message || null,
        document_class: result.documentClass,
        classification_confidence: result.confidence,
        extracted_data: result.extractedData,
        response_deadline: result.deadline,
        deadline_source: result.deadlineSource,
        deadline_days: result.deadlineDays,
        deadline_note: result.serviceDate
          ? null
          : 'Enter your service date to calculate the response deadline.',
        suggested_documents: result.suggestedDocuments,
        case_profile: result.caseProfile
      },
      timestamp: new Date().toISOString()
    });
  })
);

// ─── GET /api/ingest/:id ─────────────────────────────────────────────────────
// Retrieve ingestion result by ID.

router.get('/:id',
  standardLimiter,
  auth0Middleware,
  requireDbClient,
  asyncHandler(async (req, res) => {
    const client = req.dbClient;
    const userId = req.user.id;
    const ingestionId = parseInt(req.params.id, 10);

    if (isNaN(ingestionId) || ingestionId < 1) {
      throw new ValidationError('Invalid ingestion ID');
    }

    const result = await client.query(
      `SELECT id, file_name, file_size_bytes, file_pages,
              document_class, classification_confidence, extracted_data,
              service_date, response_deadline, deadline_source,
              status, error_message, created_at, updated_at
       FROM ingested_documents
       WHERE id = $1 AND user_id = $2`,
      [ingestionId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Ingestion record not found');
    }

    const row = result.rows[0];

    // Recompute suggested documents from stored extracted_data
    const suggestedDocs = ingestionService.selectResponseDocs(row.extracted_data || {});

    res.sendSuccess({
      ingestion_id: row.id,
      file_name: row.file_name,
      file_size_bytes: row.file_size_bytes,
      file_pages: row.file_pages,
      document_class: row.document_class,
      classification_confidence: parseFloat(row.classification_confidence),
      extracted_data: row.extracted_data,
      service_date: row.service_date,
      response_deadline: row.response_deadline,
      deadline_source: row.deadline_source,
      status: row.status,
      error_message: row.error_message,
      suggested_documents: suggestedDocs.documents,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  })
);

// ─── PUT /api/ingest/:id/review ──────────────────────────────────────────────
// User confirms/corrects extraction → creates case → returns chat redirect.

router.put('/:id/review',
  standardLimiter,
  auth0Middleware,
  requireDbClient,
  validateIngestionReview,
  asyncHandler(async (req, res) => {
    const client = req.dbClient;
    const userId = req.user.id;
    const ingestionId = parseInt(req.params.id, 10);

    if (isNaN(ingestionId) || ingestionId < 1) {
      throw new ValidationError('Invalid ingestion ID');
    }

    const { confirmed, corrections, user_name, service_date } = req.body;

    if (!confirmed) {
      throw new ValidationError('Confirmation required. Set confirmed: true to proceed.');
    }

    // Wrap case creation + ingestion update in a transaction
    await client.query('BEGIN');

    try {
      // Fetch the ingestion record
      const ingestionResult = await client.query(
        `SELECT * FROM ingested_documents WHERE id = $1 AND user_id = $2`,
        [ingestionId, userId]
      );

      if (ingestionResult.rows.length === 0) {
        throw new NotFoundError('Ingestion record not found');
      }

      const ingestion = ingestionResult.rows[0];
      let extractedData = ingestion.extracted_data || {};

      // Apply corrections — only allow user-correctable fields (prevent overwriting
      // internal fields like document_class, confidence, etc.)
      if (corrections && typeof corrections === 'object') {
        const ALLOWED_CORRECTION_FIELDS = [
          'state', 'county', 'court_name', 'cause_number',
          'petitioner_name', 'respondent_name', 'petitioner_first_name',
          'petitioner_last_name', 'respondent_first_name', 'respondent_last_name',
          'marriage_date', 'separation_date', 'filing_date', 'service_date',
          'children', 'has_children', 'grounds', 'matter_type',
        ];
        for (const key of ALLOWED_CORRECTION_FIELDS) {
          if (corrections[key] !== undefined) {
            extractedData[key] = corrections[key];
          }
        }
      }

      // Update service date if provided
      const finalServiceDate = service_date || ingestion.service_date;

      // Recalculate deadline with updated data
      const deadlineResult = ingestionService.calculateDeadline(
        extractedData.state,
        ingestion.document_class,
        finalServiceDate
      );

      // Build case profile
      const caseProfile = ingestionService.buildCaseProfile(extractedData);

      // Split user_name into respondent fields if provided
      if (user_name) {
        const parts = user_name.trim().split(/\s+/);
        caseProfile.respondent_first_name = parts[0] || null;
        caseProfile.respondent_last_name = parts.slice(1).join(' ') || null;
      }

      // Create case
      const caseResult = await client.query(
        `INSERT INTO cases
          (user_id, practice_area, matter_type_code, state, county,
           petitioner_first_name, petitioner_last_name,
           respondent_first_name, respondent_last_name,
           cause_number, court_name, case_metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
         RETURNING id`,
        [
          userId,
          caseProfile.practice_area,
          caseProfile.matter_type_code,
          caseProfile.state,
          caseProfile.county,
          caseProfile.petitioner_first_name,
          caseProfile.petitioner_last_name,
          caseProfile.respondent_first_name,
          caseProfile.respondent_last_name,
          caseProfile.cause_number,
          caseProfile.court_name,
          JSON.stringify(caseProfile.case_metadata)
        ]
      );

      const caseId = caseResult.rows[0].id;

      // Update ingestion record: link to case, mark accepted
      await client.query(
        `UPDATE ingested_documents
         SET case_id = $1, status = 'accepted', extracted_data = $2,
             service_date = $3, response_deadline = $4, deadline_source = $5
         WHERE id = $6 AND user_id = $7`,
        [
          caseId,
          JSON.stringify(extractedData),
          finalServiceDate || null,
          deadlineResult.deadline || null,
          deadlineResult.source || null,
          ingestionId,
          userId
        ]
      );

      await client.query('COMMIT');

      // Get response documents
      const responseDocs = ingestionService.selectResponseDocs(extractedData);

      res.sendSuccess({
        ingestion_id: ingestionId,
        status: 'accepted',
        case_id: caseId,
        response_deadline: deadlineResult.deadline,
        deadline_source: deadlineResult.source,
        response_documents: responseDocs.documents,
        chat_url: `/chat?caseId=${caseId}&matterTypeCode=document_response`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  })
);

module.exports = router;
