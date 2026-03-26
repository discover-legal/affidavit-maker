// services/documentService.js - Enhanced document saving service
const logger = require('../utils/logger');

/**
 * Client-side document CRUD service.
 *
 * Wraps the `/api/documents` REST endpoints with automatic token injection,
 * debounced auto-save, and a save queue that prevents concurrent writes to
 * the same document.
 */
class DocumentService {
  /**
   * @param {string} apiBase - Base URL for the backend API (e.g. `''` for same-origin
   *   or `'http://localhost:3001'` in development).
   * @param {Function} getAccessToken - Async function that returns a valid Auth0
   *   access token string (typically from the Auth0 React SDK).
   */
  constructor(apiBase, getAccessToken) {
    this.apiBase = apiBase;
    this.getAccessToken = getAccessToken;
    this.saveQueue = new Map(); // Queue for pending saves
    this.isProcessingSave = false;
  }

  /**
   * Save (create or update) a document. If `affidavitData.documentId` is set
   * the document is updated; otherwise a new document is created.
   *
   * @param {object} affidavitData - The full affidavit/document data object.
   * @param {object} [options]
   * @param {string} [options.status='draft'] - Document status (e.g. 'draft', 'final').
   * @returns {Promise<{ success: boolean, document?: object, documentId?: string, error?: string }>}
   */
  async saveDocument(affidavitData, options = {}) {
    const saveData = {
      content: affidavitData,
      title: this.generateTitle(affidavitData),
      status: options.status || 'draft',
      documentId: affidavitData.documentId,
      timestamp: Date.now()
    };

    // If we have a document ID, update; otherwise create
    if (affidavitData.documentId) {
      return this.updateDocument(affidavitData.documentId, saveData);
    } else {
      return this.createDocument(saveData);
    }
  }

  /**
   * Create a new document via `POST /api/documents`.
   *
   * @param {object} saveData - Prepared save payload with `content`, `title`, and `status`.
   * @returns {Promise<{ success: boolean, document?: object, documentId?: string, error?: string }>}
   */
  async createDocument(saveData) {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/api/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: saveData.content,
          title: saveData.title,
          status: saveData.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create document');
      }

      const result = await response.json();
      return {
        success: true,
        document: result.document,
        documentId: result.document.id
      };
    } catch (error) {
      logger.error('Create document error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update an existing document via `PUT /api/documents/:id`.
   *
   * @param {string|number} documentId - The document's database ID.
   * @param {object} saveData - Prepared save payload with `content`, `title`, and `status`.
   * @returns {Promise<{ success: boolean, document?: object, error?: string }>}
   */
  async updateDocument(documentId, saveData) {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: saveData.content,
          title: saveData.title,
          status: saveData.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update document');
      }

      const result = await response.json();
      return {
        success: true,
        document: result.document
      };
    } catch (error) {
      logger.error('Update document error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch all documents for the authenticated user via `GET /api/documents`.
   *
   * @returns {Promise<{ success: boolean, documents: object[], error?: string }>}
   */
  async loadDocuments() {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load documents');
      }

      const result = await response.json();
      return {
        success: true,
        documents: result.documents || []
      };
    } catch (error) {
      logger.error('Load documents error', { error: error.message });
      return {
        success: false,
        error: error.message,
        documents: []
      };
    }
  }

  /**
   * Delete a document via `DELETE /api/documents/:id`.
   *
   * @param {string|number} documentId - The document's database ID.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async deleteDocument(documentId) {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      return { success: true };
    } catch (error) {
      logger.error('Delete document error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a human-readable title from the document data.
   *
   * @param {object} affidavitData - The document data object.
   * @returns {string} A title string.
   */
  generateTitle(affidavitData) {
    if (affidavitData.affiantName) {
      return `${affidavitData.affiantName}'s Affidavit`;
    }
    if (affidavitData.state) {
      return `${affidavitData.state} Affidavit`;
    }
    return `Affidavit Draft - ${new Date().toLocaleDateString()}`;
  }

  /**
   * Schedule a debounced auto-save. If called again for the same document
   * before the delay elapses, the previous timer is cancelled.
   *
   * @param {object} affidavitData - The document data to save.
   * @param {number} [delay=2000] - Debounce delay in milliseconds.
   * @returns {Promise<void>}
   */
  async autoSave(affidavitData, delay = 2000) {
    const saveId = affidavitData.documentId || 'new';

    // Clear existing timeout for this document
    if (this.saveQueue.has(saveId)) {
      clearTimeout(this.saveQueue.get(saveId).timeoutId);
    }

    // Set up new save timeout
    const timeoutId = setTimeout(async () => {
      if (!this.isProcessingSave) {
        this.isProcessingSave = true;
        try {
          const result = await this.saveDocument(affidavitData);
          if (result.success && result.documentId) {
            // Return the document ID so the calling component can update
            this.saveQueue.delete(saveId);
            return result.documentId;
          }
        } catch (error) {
          logger.error('Auto-save failed', { error: error.message });
        } finally {
          this.isProcessingSave = false;
        }
      }
    }, delay);

    this.saveQueue.set(saveId, { timeoutId });
  }

  /**
   * Immediately save the document, bypassing the auto-save debounce.
   * Any pending auto-save for the same document is cancelled.
   *
   * @param {object} affidavitData - The document data to save.
   * @returns {Promise<{ success: boolean, document?: object, documentId?: string, error?: string }>}
   */
  async forceSave(affidavitData) {
    const saveId = affidavitData.documentId || 'new';

    // Clear any pending auto-save
    if (this.saveQueue.has(saveId)) {
      clearTimeout(this.saveQueue.get(saveId).timeoutId);
      this.saveQueue.delete(saveId);
    }

    return this.saveDocument(affidavitData);
  }

  /**
   * Cancel all pending auto-save timers. Call this when the component
   * unmounts or the user navigates away.
   */
  cleanup() {
    for (const [saveId, saveInfo] of this.saveQueue) {
      clearTimeout(saveInfo.timeoutId);
    }
    this.saveQueue.clear();
  }
}

module.exports = DocumentService;
