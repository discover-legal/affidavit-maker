// services/documentService.js - Enhanced document saving service
const logger = require('../utils/logger');

class DocumentService {
  constructor(apiBase, getAccessToken) {
    this.apiBase = apiBase;
    this.getAccessToken = getAccessToken;
    this.saveQueue = new Map(); // Queue for pending saves
    this.isProcessingSave = false;
  }

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

  generateTitle(affidavitData) {
    if (affidavitData.affiantName) {
      return `${affidavitData.affiantName}'s Affidavit`;
    }
    if (affidavitData.state) {
      return `${affidavitData.state} Affidavit`;
    }
    return `Affidavit Draft - ${new Date().toLocaleDateString()}`;
  }

  // Auto-save with debouncing
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

  // Force immediate save (bypass debouncing)
  async forceSave(affidavitData) {
    const saveId = affidavitData.documentId || 'new';
    
    // Clear any pending auto-save
    if (this.saveQueue.has(saveId)) {
      clearTimeout(this.saveQueue.get(saveId).timeoutId);
      this.saveQueue.delete(saveId);
    }

    return this.saveDocument(affidavitData);
  }

  // Clean up any pending saves
  cleanup() {
    for (const [saveId, saveInfo] of this.saveQueue) {
      clearTimeout(saveInfo.timeoutId);
    }
    this.saveQueue.clear();
  }
}

module.exports = DocumentService;