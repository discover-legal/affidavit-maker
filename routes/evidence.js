// routes/evidence.js
/**
 * Evidence upload and management routes
 * Handles file uploads, retrieval, and deletion for evidence attachments
 *
 * SECURITY: Path traversal protection added
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { asyncHandler, ValidationError, safeErrorMessage } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const evidenceStorage = require('../services/evidenceStorage');
const { isValidFilename, sanitizeFilename } = require('../utils/pathSecurity');

/**
 * SECURITY: Validate file upload inputs to prevent path traversal
 */
function validateFileInputs(documentId, evidenceId) {
  // Validate documentId is positive integer
  const docIdNum = parseInt(documentId, 10);
  if (isNaN(docIdNum) || docIdNum < 1 || docIdNum > 2147483647) {
    throw new ValidationError('Invalid document ID');
  }

  // Validate evidenceId is safe alphanumeric (prevent path traversal like ../../etc/passwd)
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(evidenceId)) {
    throw new ValidationError('Invalid evidence ID format. Only alphanumeric characters, hyphens, and underscores allowed.');
  }

  // Check for path traversal attempts
  if (evidenceId.includes('..') || evidenceId.includes('/') || evidenceId.includes('\\')) {
    logger.logSecurity('path_traversal_attempt', {
      evidenceId,
      type: 'file_upload'
    });
    throw new ValidationError('Invalid evidence ID: path traversal attempt detected');
  }

  return { documentId: docIdNum, evidenceId };
}

// Multer configuration will be added after installation
let upload = null;
try {
  const multer = require('multer');

  upload = multer({
    dest: 'temp/uploads',
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB per file
      files: 1 // One file at a time
    },
    fileFilter: (req, file, cb) => {
      if (evidenceStorage.isAllowedFileType(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
      }
    }
  });
} catch (error) {
  logger.warn('Multer not available - evidence upload disabled', { error: error.message });
}

/**
 * POST /api/evidence/upload
 * Upload evidence file
 */
router.post('/upload',
  auth0Middleware,
  standardLimiter,
  (req, res, next) => {
    if (!upload) {
      return res.status(503).json({
        success: false,
        error: 'File upload service not available. Please install multer dependency.'
      });
    }
    upload.single('evidence')(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const { documentId, evidenceId, description } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!documentId || !evidenceId) {
      return res.status(400).json({
        success: false,
        error: 'documentId and evidenceId are required'
      });
    }

    // SECURITY: Validate inputs to prevent path traversal
    let validatedInputs;
    try {
      validatedInputs = validateFileInputs(documentId, evidenceId);
    } catch (validationError) {
      // Clean up uploaded file on validation error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      throw validationError;
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    try {
      // Verify user owns the document
      const client = req.dbClient;  // ✅ Use RLS-context client
      if (!client) {
        return res.status(500).json({
          success: false,
          error: 'Database connection unavailable',
          errorType: 'server_error'
        });
      }
      const docResult = await client.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      if (docResult.rows.length === 0) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Upload evidence
      const result = await evidenceStorage.uploadEvidence(
        req.file,
        userId,
        documentId,
        evidenceId
      );

      logger.info('Evidence uploaded successfully', {
        userId,
        documentId,
        evidenceId,
        fileName: result.fileName,
        fileSize: result.fileSizeBytes
      });

      res.json({
        success: true,
        evidence: result
      });
    } catch (error) {
      logger.error('Evidence upload failed', {
        userId,
        documentId,
        evidenceId,
        error: error.message
      });

      // Clean up uploaded file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: safeErrorMessage(error, 'Failed to upload evidence')
      });
    }
  })
);

/**
 * GET /api/evidence/:documentId/:fileKey
 * Get evidence file
 * SECURITY (HIGH-03): Added rate limiting
 */
router.get('/:documentId/:fileKey',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { documentId, fileKey } = req.params;
    const userId = req.user.id;

    // Validate fileKey to prevent path traversal
    if (!isValidFilename(fileKey)) {
      logger.logSecurity('invalid_filekey_attempt', { fileKey: String(fileKey).substring(0, 50), userId });
      return res.status(400).json({ success: false, error: 'Invalid file key format' });
    }

    try {
      // Verify user owns the document
      const client = req.dbClient;  // ✅ Use RLS-context client
      if (!client) {
        return res.status(500).json({
          success: false,
          error: 'Database connection unavailable',
          errorType: 'server_error'
        });
      }
      const docResult = await client.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      if (docResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Get evidence file
      const evidence = await evidenceStorage.getEvidence(userId, documentId, fileKey);

      if (!evidence.exists) {
        return res.status(404).json({
          success: false,
          error: 'Evidence file not found'
        });
      }

      // Determine content type
      const ext = path.extname(evidence.filepath).toLowerCase();
      const contentTypeMap = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      };
      const contentType = contentTypeMap[ext] || 'application/octet-stream';

      // Stream file to response with security headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(path.basename(evidence.filepath))}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");

      const fileStream = require('fs').createReadStream(evidence.filepath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        logger.error('Error streaming evidence file', {
          userId,
          documentId,
          fileKey,
          error: error.message
        });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to stream file'
          });
        }
      });
    } catch (error) {
      logger.error('Error getting evidence', {
        userId,
        documentId,
        fileKey,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: safeErrorMessage(error, 'Failed to retrieve evidence')
      });
    }
  })
);

/**
 * DELETE /api/evidence/:documentId/:evidenceId
 * Delete evidence file
 * SECURITY (HIGH-03): Added rate limiting
 */
router.delete('/:documentId/:evidenceId',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { documentId, evidenceId } = req.params;
    const { fileKey, thumbnailKey } = req.body;
    const userId = req.user.id;

    try {
      // Verify user owns the document
      const client = req.dbClient;  // ✅ Use RLS-context client
      if (!client) {
        return res.status(500).json({
          success: false,
          error: 'Database connection unavailable',
          errorType: 'server_error'
        });
      }
      const docResult = await client.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      if (docResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Delete evidence
      await evidenceStorage.deleteEvidence(userId, documentId, fileKey, thumbnailKey);

      logger.info('Evidence deleted successfully', {
        userId,
        documentId,
        evidenceId
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting evidence', {
        userId,
        documentId,
        evidenceId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete evidence'
      });
    }
  })
);

/**
 * GET /api/evidence/document/:documentId
 * List all evidence for a document
 * SECURITY (HIGH-03): Added rate limiting
 */
router.get('/document/:documentId',
  standardLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const userId = req.user.id;

    try {
      // Verify user owns the document
      const client = req.dbClient;  // ✅ Use RLS-context client
      if (!client) {
        return res.status(500).json({
          success: false,
          error: 'Database connection unavailable',
          errorType: 'server_error'
        });
      }
      const docResult = await client.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      if (docResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // List evidence
      const evidenceFiles = await evidenceStorage.listEvidenceForDocument(userId, documentId);

      res.json({
        success: true,
        evidence: evidenceFiles
      });
    } catch (error) {
      logger.error('Error listing evidence', {
        userId,
        documentId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list evidence'
      });
    }
  })
);

module.exports = router;
