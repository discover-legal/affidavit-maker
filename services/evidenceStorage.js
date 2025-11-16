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
      console.error('Error creating evidence directories:', error);
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

      // Get file metadata
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
      console.error('Error uploading evidence:', error);
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

    // For PDFs, try to count pages (requires pdf-parse)
    if (ext.toLowerCase() === '.pdf') {
      try {
        // We'll use a simple heuristic: count "/Type /Page" occurrences
        const pdfBuffer = await fs.readFile(filepath);
        const pdfText = pdfBuffer.toString('latin1');
        const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
        metadata.filePages = pageMatches ? pageMatches.length : 1;
      } catch (error) {
        console.warn('Could not count PDF pages:', error.message);
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
      console.warn('Could not generate thumbnail:', error.message);
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
      console.error('Error getting evidence:', error);
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
        await fs.unlink(thumbnailPath).catch(() => {});
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting evidence:', error);
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
      console.error('Error listing evidence:', error);
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
   * Generate unique evidence ID
   * @returns {string} UUID
   */
  generateEvidenceId() {
    return uuidv4();
  }
}

// Export singleton instance
module.exports = new EvidenceStorage();
