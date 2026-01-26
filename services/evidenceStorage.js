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

      const ext = path.extname(file.originalname);
      const filename = `${evidenceId}${ext}`;
      const filepath = path.join(userDir, filename);

      // Move uploaded file to final location
      await fs.rename(file.path, filepath);

      // SECURITY: Validate file content via magic bytes (prevents MIME spoofing)
      await this.validateFileContent(filepath);

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
      const thumbnailFilename = `${evidenceId}_thumb.jpg`;
      const thumbnailFullPath = path.join(this.thumbnailPath, thumbnailFilename);

      const fileType = this.getFileType(ext);

      if (fileType === 'pdf') {
        // For PDF, create a placeholder thumbnail for now
        // In production, use pdf-thumbnail or similar
        await this.createPlaceholderThumbnail(thumbnailFullPath, 'PDF');
      } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
        // For images, copy the original (we'll add sharp resizing later)
        await fs.copyFile(filepath, thumbnailFullPath);
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
   * Get evidence file
   * @param {number} userId - User ID
   * @param {number} documentId - Document ID
   * @param {string} fileKey - File key (relative path)
   * @returns {object} File info
   */
  async getEvidence(userId, documentId, fileKey) {
    try {
      const filepath = path.join(this.basePath, fileKey);

      // Verify file belongs to user
      const expectedDir = this.getUserEvidenceDir(userId, documentId);
      if (!filepath.startsWith(expectedDir)) {
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
        const filepath = path.join(this.basePath, fileKey);
        const expectedDir = this.getUserEvidenceDir(userId, documentId);

        if (filepath.startsWith(expectedDir)) {
          await fs.unlink(filepath).catch(() => {});
        }
      }

      // Delete thumbnail
      if (thumbnailKey) {
        const thumbnailPath = path.join(this.basePath, thumbnailKey);
        const expectedThumbnailDir = this.getUserEvidenceDir(userId, documentId);

        // SECURITY: Verify thumbnail is in expected directory (prevent path traversal)
        if (thumbnailPath.startsWith(expectedThumbnailDir)) {
          await fs.unlink(thumbnailPath).catch(() => {});
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
