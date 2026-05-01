// services/evidenceStorage.js
/**
 * Evidence Storage Service
 * Handles file upload, storage, retrieval, and deletion for evidence attachments
 * Supports local filesystem storage with abstraction for future cloud migration
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');
const logger = require('../utils/logger');
const { validatePath, isValidFilename } = require('../utils/pathSecurity');

// Allowed file types with their MIME types
const ALLOWED_FILE_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png']
]);

// PDF limits for bomb protection
const PDF_MAX_PAGES = 500;
const PDF_MIN_BYTES_PER_PAGE = 100;

class EvidenceStorage {
  constructor() {
    this.basePath = path.join(__dirname, '..', 'documents', 'evidence');
    this.thumbnailPath = path.join(__dirname, '..', 'documents', 'thumbnails');
    this.ensureDirectories();
  }

  /**
   * Ensure base directories exist
   */
  async ensureDirectories() {
    try {
      if (!fsSync.existsSync(this.basePath)) {
        await fs.mkdir(this.basePath, { recursive: true });
      }
      if (!fsSync.existsSync(this.thumbnailPath)) {
        await fs.mkdir(this.thumbnailPath, { recursive: true });
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

  /**
   * Upload evidence file
   * @param {object} file - Multer file object
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @param {string} evidenceId - Evidence ID (UUID)
   * @returns {object} Evidence metadata
   */
  async uploadEvidence(file, userId, documentId, evidenceId) {
    try {
      const userDir = this.getUserEvidenceDir(userId, documentId);
      await fs.mkdir(userDir, { recursive: true });

      // Use user-supplied extension temporarily for the initial write
      const tempExt = path.extname(file.originalname);
      const tempFilename = `${evidenceId}${tempExt}`;
      const tempFilepath = path.join(userDir, tempFilename);

      // Move uploaded file to temp location
      await fs.rename(file.path, tempFilepath);

      // SECURITY: Validate file content via magic bytes (prevents MIME spoofing)
      // Derive the canonical extension from the detected type, not the user-supplied name
      const detected = await this.validateFileContent(tempFilepath);
      const ext = `.${detected.ext}`;
      const filename = `${evidenceId}${ext}`;
      const filepath = path.join(userDir, filename);

      // Rename to use the verified extension if it differs
      if (tempFilepath !== filepath) {
        await fs.rename(tempFilepath, filepath);
      }

      // Get file metadata (includes PDF bomb protection)
      const metadata = await this.getFileMetadata(filepath, ext);

      // Generate thumbnail
      const thumbnailKey = await this.generateThumbnail(filepath, ext, evidenceId);

      return {
        fileKey: path.relative(this.basePath, filepath),
        fileName: file.originalname,
        fileType: this.getFileType(ext),
        fileSizeBytes: metadata.fileSizeBytes,
        filePages: metadata.filePages,
        thumbnailKey: thumbnailKey,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
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

    // For PDFs, count pages and apply bomb protection
    if (ext.toLowerCase() === '.pdf') {
      try {
        // Count pages using simple heuristic
        const pdfBuffer = await fs.readFile(filepath);
        const pdfText = pdfBuffer.toString('latin1');
        const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
        metadata.filePages = pageMatches ? pageMatches.length : 1;

        // PDF bomb protection: check page count
        if (metadata.filePages > PDF_MAX_PAGES) {
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
        // Re-throw our own security errors
        if (error.message.includes('exceeds') || error.message.includes('malformed')) {
          throw error;
        }
        // Log and continue for parsing errors
        metadata.filePages = 1;
      }
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
      const thumbnailFilename = `${evidenceId}_thumb.json`;
      const thumbnailFullPath = path.join(this.thumbnailPath, thumbnailFilename);

      const fileType = this.getFileType(ext);
      const stats = await fs.stat(filepath);

      const metadata = {
        type: fileType,
        originalFile: path.basename(filepath),
        fileSizeBytes: stats.size,
        createdAt: new Date().toISOString()
      };

      if (fileType === 'pdf') {
        // Extract page count from PDF
        const pdfBuffer = await fs.readFile(filepath);
        const pdfText = pdfBuffer.toString('latin1');
        const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
        metadata.pages = pageMatches ? pageMatches.length : 1;
        metadata.thumbnail = 'pdf-placeholder';
      } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
        metadata.thumbnail = 'original';
        // Store reference to original — frontend uses CSS object-fit for display
        metadata.originalPath = path.relative(this.basePath, filepath);
      }

      await fs.writeFile(thumbnailFullPath, JSON.stringify(metadata, null, 2));
      return path.relative(this.basePath, thumbnailFullPath);
    } catch (error) {
      logger.warn('Could not generate thumbnail:', error.message);
      return null;
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
      // SECURITY: Validate filename and use path traversal prevention
      if (!isValidFilename(fileKey)) {
        throw new Error('Invalid file key');
      }
      const filepath = validatePath(this.basePath, fileKey);

      // Verify file belongs to this user's document directory
      const expectedDir = this.getUserEvidenceDir(userId, documentId);
      if (!filepath.startsWith(expectedDir + path.sep) && filepath !== expectedDir) {
        throw new Error('Unauthorized access to evidence file');
      }

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
  async deleteEvidence(userId, documentId, fileKey, thumbnailKey) {
    try {
      // Delete main file
      if (fileKey) {
        if (!isValidFilename(fileKey)) {
          throw new Error('Invalid file key');
        }
        const filepath = validatePath(this.basePath, fileKey);
        const expectedDir = this.getUserEvidenceDir(userId, documentId);

        if (filepath.startsWith(expectedDir + path.sep) || filepath === expectedDir) {
          await fs.unlink(filepath).catch(() => {});
        }
      }

      // Delete thumbnail — validated against thumbnailPath, not evidence basePath
      if (thumbnailKey) {
        if (!isValidFilename(thumbnailKey)) {
          throw new Error('Invalid thumbnail key');
        }
        const thumbFullPath = validatePath(this.thumbnailPath, thumbnailKey);

        // SECURITY: Verify thumbnail is within the thumbnails directory
        if (thumbFullPath.startsWith(this.thumbnailPath + path.sep)) {
          await fs.unlink(thumbFullPath).catch(() => {});
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
  async validateFileContent(filepath) {
    const detected = await FileType.fromFile(filepath);

    if (!detected) {
      // Clean up the invalid file
      await fs.unlink(filepath).catch(() => {});
      throw new Error('Could not determine file type from content');
    }

    if (!ALLOWED_FILE_TYPES.has(detected.mime)) {
      // Clean up the invalid file
      await fs.unlink(filepath).catch(() => {});
      throw new Error(`File type ${detected.mime} is not allowed`);
    }

    return {
      mime: detected.mime,
      ext: ALLOWED_FILE_TYPES.get(detected.mime)
    };
  }

  /**
   * Generate unique evidence ID
   * @returns {string} UUID
   */
  generateEvidenceId() {
    return uuidv4();
  }
}

// Export singleton instance
module.exports = new EvidenceStorage();
