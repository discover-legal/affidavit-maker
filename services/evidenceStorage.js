// services/evidenceStorage.js
/**
 * Evidence Storage Service
 * Handles file upload, storage, retrieval, and deletion for evidence attachments
 * Supports local filesystem storage with abstraction for future cloud migration
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { randomUUID } = require('node:crypto');
const FileType = require('../utils/allowedFileType');
const logger = require('../utils/logger');

// Allowed file types with their MIME types
const ALLOWED_FILE_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png']
]);

// PDF limits for bomb protection
const PDF_MAX_PAGES = 500;
const PDF_MIN_BYTES_PER_PAGE = 100;
const IMAGE_MAX_DIMENSION = 10000;
const IMAGE_MAX_PIXELS = 25_000_000;

class EvidenceStorage {
  constructor() {
    // EVIDENCE_STORAGE_PATH takes precedence; otherwise derive from the
    // resolved DOCUMENTS_PATH so the tenant sandbox always sits on the
    // configured storage mount.
    this.basePath = process.env.EVIDENCE_STORAGE_PATH || path.join(
      path.resolve(process.env.DOCUMENTS_PATH || path.join(__dirname, '..', 'documents')),
      'evidence'
    );
    this.ensureDirectories();
    this.quotaLocks = new Map();
  }

  /**
   * Ensure base directories exist
   */
  async ensureDirectories() {
    try {
      if (!fsSync.existsSync(this.basePath)) {
        await fs.mkdir(this.basePath, { recursive: true });
      }
    } catch (error) {
      logger.error('Error creating evidence directories:', error);
    }
  }

  /**
   * Get user's evidence directory path
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @returns {string} Directory path
   */
  getUserEvidenceDir(userId, documentId) {
    return path.join(this.basePath, String(userId), String(documentId));
  }

  positiveLimit(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  async withQuotaLock(userId, fn) {
    const key = String(userId);
    for (;;) {
      const active = this.quotaLocks.get(key);
      if (!active) break;
      await active;
    }
    let release;
    const lock = new Promise(resolve => { release = resolve; });
    this.quotaLocks.set(key, lock);
    try {
      return await fn();
    } finally {
      if (this.quotaLocks.get(key) === lock) this.quotaLocks.delete(key);
      release();
    }
  }

  async storageUsage(root) {
    let bytes = 0;
    let files = 0;
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return { bytes, files };
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.storageUsage(candidate);
        bytes += nested.bytes;
        files += nested.files;
      } else if (entry.isFile()) {
        bytes += (await fs.stat(candidate)).size;
        if (!/_thumb\.[A-Za-z0-9]+$/i.test(entry.name)) files += 1;
      }
    }
    return { bytes, files };
  }

  async assertStorageQuota(userId, documentId, incomingBytes) {
    const userRoot = path.join(this.basePath, String(userId));
    const documentRoot = this.getUserEvidenceDir(userId, documentId);
    const [userUsage, documentUsage] = await Promise.all([
      this.storageUsage(userRoot),
      this.storageUsage(documentRoot),
    ]);
    const documentByteLimit = this.positiveLimit('EVIDENCE_DOCUMENT_MAX_BYTES', 100 * 1024 * 1024);
    const userByteLimit = this.positiveLimit('EVIDENCE_USER_MAX_BYTES', 250 * 1024 * 1024);
    const documentFileLimit = this.positiveLimit('EVIDENCE_DOCUMENT_MAX_FILES', 100);
    const userFileLimit = this.positiveLimit('EVIDENCE_USER_MAX_FILES', 1000);
    if (
      documentUsage.bytes + incomingBytes > documentByteLimit
      || userUsage.bytes + incomingBytes > userByteLimit
      || documentUsage.files + 1 > documentFileLimit
      || userUsage.files + 1 > userFileLimit
    ) {
      throw new Error('Evidence storage quota exceeded');
    }
  }

  /**
   * Upload evidence file
   * @param {object} file - Multer file object
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @returns {object} Evidence metadata
   */
  async uploadEvidence(file, userId, documentId, evidenceId = this.generateEvidenceId()) {
    let filepath;
    try {
      const userDir = this.getUserEvidenceDir(userId, documentId);
      await fs.mkdir(userDir, { recursive: true });

      // Browser names and MIME values are untrusted metadata. Detect the
      // staged bytes first, then use only that result for the stored extension
      // and all type-specific resource checks.
      const detected = await this.validateFileContent(file.path, false);
      const ext = `.${detected.ext}`;
      const filename = `${evidenceId}${ext}`;
      // Runtime tenant path; never ask the standalone tracer to enumerate it.
      filepath = path.join(/* turbopackIgnore: true */ userDir, filename);

      // Admission and move are serialized per user so concurrent uploads
      // cannot all observe the same remaining quota. copyFile + unlink
      // instead of rename so staging and tenant storage may live on
      // different mounts (DOCUMENTS_PATH / EVIDENCE_STORAGE_PATH).
      const incomingBytes = (await fs.stat(file.path)).size;
      await this.withQuotaLock(userId, async () => {
        await this.assertStorageQuota(userId, documentId, incomingBytes);
        await fs.copyFile(file.path, filepath);
        await fs.unlink(file.path).catch(() => {});
      });

      // Get file metadata (includes PDF bomb protection)
      const metadata = await this.getFileMetadata(filepath, ext);

      // Generate thumbnail
      const thumbnailKey = await this.generateThumbnail(filepath, ext, evidenceId);

      return {
        evidenceId,
        fileKey: path.relative(this.basePath, filepath),
        fileName: file.originalname,
        fileType: this.getFileType(ext),
        fileSizeBytes: metadata.fileSizeBytes,
        filePages: metadata.filePages,
        thumbnailKey: thumbnailKey,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      if (filepath) await fs.unlink(filepath).catch(() => {});
      if (file?.path) await fs.unlink(file.path).catch(() => {});
      logger.error('Error uploading evidence:', error);
      throw new Error(`Failed to upload evidence: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   * @param {string} filepath - Absolute file path
   * @param {string} ext - File extension
   * @returns {object} Metadata
   */
  async getFileMetadata(filepath, ext) {
    const stats = await fs.stat(filepath);
    const metadata = {
      fileSizeBytes: stats.size,
      filePages: 1
    };

    // For PDFs, use the real parser page tree. Regex counting misses pages
    // stored in compressed object streams and is not a security boundary.
    if (ext.toLowerCase() === '.pdf') {
      try {
        const pdfBuffer = await fs.readFile(filepath);
        const { PDFDocument } = require('pdf-lib');
        const parsedPdf = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
        metadata.filePages = parsedPdf.getPageCount();

        if (metadata.filePages < 1 || metadata.filePages > PDF_MAX_PAGES) {
          await fs.unlink(filepath).catch(() => {});
          throw new Error(`PDF exceeds maximum allowed pages (${PDF_MAX_PAGES})`);
        }

        // PDF bomb protection: check for suspiciously low bytes per page (compression bomb)
        if (metadata.filePages > 1) {
          const bytesPerPage = metadata.fileSizeBytes / metadata.filePages;
          if (bytesPerPage < PDF_MIN_BYTES_PER_PAGE) {
            await fs.unlink(filepath).catch(() => {});
            throw new Error('PDF structure appears malformed or suspicious');
          }
        }
      } catch (error) {
        await fs.unlink(filepath).catch(() => {});
        if (error.message.includes('exceeds') || error.message.includes('malformed')) throw error;
        throw new Error('PDF could not be parsed safely');
      }
    } else if (ext.toLowerCase() === '.png' || ext.toLowerCase() === '.jpg') {
      const imageBuffer = await fs.readFile(filepath);
      const dimensions = ext.toLowerCase() === '.png'
        ? this.getPngDimensions(imageBuffer)
        : this.getJpegDimensions(imageBuffer);
      this.assertSafeImageDimensions(dimensions.width, dimensions.height);
    }

    return metadata;
  }

  /**
   * Generate thumbnail for evidence file
   * @param {string} filepath - Source file path
   * @param {string} ext - File extension
   * @param {string} evidenceId - Evidence ID
   * @returns {string} Thumbnail key
   */
  async generateThumbnail(filepath, ext, evidenceId) {
    try {
      const thumbnailFilename = `${evidenceId}_thumb.jpg`;
      // Derivatives stay in the same tenant/document sandbox as the source.
      const thumbnailFullPath = path.join(path.dirname(filepath), thumbnailFilename);

      const fileType = this.getFileType(ext);

      if (fileType === 'pdf') {
        // For PDF, create a placeholder thumbnail for now
        // In production, use pdf-thumbnail or similar
        await this.createPlaceholderThumbnail(thumbnailFullPath, 'PDF');
      } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
        // Do not duplicate the full-resolution upload as a "thumbnail".
        // The UI can display the source through the authenticated endpoint.
        return null;
      }

      return path.relative(this.basePath, thumbnailFullPath);
    } catch (error) {
      logger.warn('Could not generate thumbnail:', error.message);
      return null;
    }
  }

  /**
   * Create placeholder thumbnail
   * @param {string} thumbnailPath - Thumbnail path
   * @param {string} label - Label text
   */
  async createPlaceholderThumbnail(thumbnailPath, label) {
    // Create a simple text file placeholder for now
    // In production, use canvas or image library to create actual image
    const placeholder = `Thumbnail placeholder for ${label}`;
    await fs.writeFile(thumbnailPath, placeholder);
  }

  /**
   * Assert that `candidate` resolves to a path strictly inside `expectedDir`.
   * Uses `path.relative` so the comparison is structural, not a fragile
   * `startsWith` prefix match (which would let `/.../1/10/file` pass when
   * the expected dir is `/.../1/1`).
   *
   * Throws if the resolved path escapes the expected directory.
   *
   * @param {string} candidate - Untrusted absolute path
   * @param {string} expectedDir - Trusted absolute directory
   */
  assertWithin(candidate, expectedDir) {
    const resolvedCandidate = path.resolve(candidate);
    const resolvedExpected = path.resolve(expectedDir);
    const rel = path.relative(resolvedExpected, resolvedCandidate);
    if (rel === '' || rel === '.') return; // candidate == expected dir, fine
    if (rel.startsWith('..') || path.isAbsolute(rel) || rel.includes('\0')) {
      throw new Error('Path traversal blocked');
    }
  }

  /**
   * Get evidence file
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @param {string} fileKey - File key (relative path)
   * @returns {object} File info
   */
  async getEvidence(userId, documentId, fileKey) {
    try {
      const filepath = path.join(this.basePath, fileKey);
      const expectedDir = this.getUserEvidenceDir(userId, documentId);

      // Defense in depth — refuse paths that resolve outside the user/doc
      // sandbox, even if a future caller hands us untrusted input.
      this.assertWithin(filepath, expectedDir);

      // Check file exists
      await fs.access(filepath);

      return {
        filepath: filepath,
        exists: true
      };
    } catch (error) {
      logger.error('Error getting evidence:', error);
      throw new Error(`Evidence file not found: ${error.message}`);
    }
  }

  /**
   * Delete evidence file and thumbnail
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @param {string} fileKey - File key
   * @param {string} thumbnailKey - Thumbnail key
   */
  async deleteEvidence(userId, documentId, fileKey, _thumbnailKey) {
    try {
      const expectedDir = this.getUserEvidenceDir(userId, documentId);

      // Delete main file
      if (fileKey) {
        const filepath = path.join(this.basePath, fileKey);
        try {
          this.assertWithin(filepath, expectedDir);
          await fs.unlink(filepath).catch(() => {});
        } catch (err) {
          logger.warn('Refusing to delete out-of-bounds evidence path:', err.message);
        }
      }

      // Thumbnail identity is always derived from the already-bounded
      // evidence key; never trust a caller-supplied path to choose a file.
      // Derivatives live next to their source in the user/doc sandbox.
      const evidenceBasename = fileKey ? path.basename(fileKey, path.extname(fileKey)) : null;
      const derivedThumbnailKey = evidenceBasename
        ? path.join(String(userId), String(documentId), `${evidenceBasename}_thumb.jpg`)
        : null;
      if (derivedThumbnailKey) {
        const thumbnailPath = path.join(this.basePath, derivedThumbnailKey);
        try {
          this.assertWithin(thumbnailPath, expectedDir);
          await fs.unlink(thumbnailPath).catch(() => {});
        } catch (err) {
          logger.warn('Refusing to delete out-of-bounds thumbnail path:', err.message);
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error deleting evidence:', error);
      throw new Error(`Failed to delete evidence: ${error.message}`);
    }
  }

  /**
   * List all evidence files for a document
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @returns {array} List of evidence files
   */
  async listEvidenceForDocument(userId, documentId) {
    try {
      const userDir = this.getUserEvidenceDir(userId, documentId);

      // Check if directory exists
      try {
        await fs.access(userDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(userDir);
      const evidenceFiles = [];

      for (const file of files) {
        // Derivatives are implementation details, not separate evidence.
        if (/_thumb\.[A-Za-z0-9]+$/i.test(file)) continue;
        const filepath = path.join(userDir, file);
        const stats = await fs.stat(filepath);

        if (stats.isFile()) {
          evidenceFiles.push({
            filename: file,
            fileKey: path.relative(this.basePath, filepath),
            fileSizeBytes: stats.size,
            modifiedAt: stats.mtime
          });
        }
      }

      return evidenceFiles;
    } catch (error) {
      logger.error('Error listing evidence:', error);
      return [];
    }
  }

  /**
   * Remove the exact evidence sandbox belonging to a user/document pair.
   * Alias of deleteDocumentEvidence kept for callers written against the
   * hardening branch API.
   */
  async deleteEvidenceForDocument(userId, documentId) {
    return this.deleteDocumentEvidence(userId, documentId);
  }

  /**
   * Get file type from extension
   * @param {string} ext - File extension with dot
   * @returns {string} Normalized file type
   */
  getFileType(ext) {
    const normalized = ext.toLowerCase().replace('.', '');
    const typeMap = {
      'pdf': 'pdf',
      'jpg': 'jpg',
      'jpeg': 'jpg',
      'png': 'png'
    };
    return typeMap[normalized] || normalized;
  }

  /**
   * Validate file type
   * @param {string} mimetype - File mimetype
   * @returns {boolean} True if allowed
   */
  isAllowedFileType(mimetype) {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];
    return allowed.includes(mimetype);
  }

  /**
   * Validate file content by checking magic bytes
   * This prevents MIME type spoofing attacks
   * @param {string} filepath - Path to the uploaded file
   * @returns {object} Detected file type info
   * @throws {Error} If file type cannot be verified or is not allowed
   */
  async validateFileContent(filepath, removeInvalid = true) {
    // Narrow local magic-byte parser (utils/allowedFileType) detects only the
    // formats this feature accepts, keeping attacker-controlled uploads out of
    // broad multimedia container parsers.
    const detected = await FileType.fromFile(filepath);

    if (!detected) {
      // Clean up the invalid file
      if (removeInvalid) await fs.unlink(filepath).catch(() => {});
      throw new Error('Could not determine file type from content');
    }

    if (!ALLOWED_FILE_TYPES.has(detected.mime)) {
      // Clean up the invalid file
      if (removeInvalid) await fs.unlink(filepath).catch(() => {});
      throw new Error(`File type ${detected.mime} is not allowed`);
    }

    return {
      mime: detected.mime,
      ext: ALLOWED_FILE_TYPES.get(detected.mime)
    };
  }

  async deleteDocumentEvidence(userId, documentId) {
    const documentDir = this.getUserEvidenceDir(userId, documentId);
    const userDir = path.join(this.basePath, String(userId));
    this.assertWithin(documentDir, userDir);
    await fs.rm(documentDir, { recursive: true, force: true });
    return { success: true };
  }

  getPngDimensions(buffer) {
    if (buffer.length < 24) throw new Error('PNG is truncated');
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  getJpegDimensions(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new Error('JPEG is malformed');
    }
    const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) break;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (sofMarkers.has(marker)) {
        if (segmentLength < 7) break;
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5)
        };
      }
      offset += segmentLength;
    }
    throw new Error('JPEG dimensions could not be determined');
  }

  assertSafeImageDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error('Image dimensions are invalid');
    }
    if (
      width > IMAGE_MAX_DIMENSION
      || height > IMAGE_MAX_DIMENSION
      || width * height > IMAGE_MAX_PIXELS
    ) {
      throw new Error(`Image exceeds safe dimensions (${IMAGE_MAX_DIMENSION}px / ${IMAGE_MAX_PIXELS} pixels)`);
    }
  }

  /**
   * Generate unique evidence ID
   * @returns {string} UUID
   */
  generateEvidenceId() {
    return randomUUID();
  }
}

// Export singleton instance
module.exports = new EvidenceStorage();
