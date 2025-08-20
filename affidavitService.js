// affidavitService.js - Fixed version with no double initialization
const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
const { StateTemplateManager } = require('./templates/StateTemplateManager');
const logger = require('./services/logger');
const fs = require('fs').promises;
const path = require('path');

class AffidavitService {
  constructor(templateManager = null) {
    // Constants for stability
    this.constants = {
      MAX_TOKENS: 4000,
      MAX_COMPLETION_TOKENS: 1000,
      MAX_MESSAGE_LENGTH: 25000,
      MAX_CONVERSATION_MESSAGES: 15,
      REQUEST_TIMEOUT: 45000, // 45 seconds
      RETRY_ATTEMPTS: 2,
      CACHE_TTL: 10 * 60 * 1000 // 10 minutes
    };
    
    // FIXED: Use passed templateManager or create new one only if none provided
    this.templateManager = templateManager || new StateTemplateManager();
    
    // Initialize services
    this.initializeServices();
    this.conversationCache = new Map();
    this.processingQueue = new Map();

    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
  }

  initializeServices() {
    try {
      // Get OpenAI service from global or create new instance
      this.openAIService = global.openAIService || new ResilientOpenAIService();
           
      // Ensure documents directory exists
      this.ensureDirectoryExists('./documents').catch(err => {
        logger.error('Failed to create documents directory', { error: err.message });
      });
      
      logger.info('✅ AffidavitService initialized successfully');
    } catch (error) {
      logger.error('AffidavitService initialization failed', { error: error.message });
      this.openAIService = null;
    }
  }
  
  async ensureDirectoryExists(directory) {
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      logger.error('Error creating directory', { directory, error: error.message });
      throw error;
    }
  }

  /**
   * Clean up old conversation cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.conversationCache.entries()) {
      if (now - entry.timestamp > this.constants.CACHE_TTL) {
        this.conversationCache.delete(key);
      }
    }
  }

  /**
   * Create a system prompt for the AI
   */
  createSystemPrompt() {
    return `You are a helpful legal assistant that helps users create affidavits. You should:

1. Ask clear, specific questions to gather the necessary information
2. Explain legal concepts in simple terms
3. Help organize facts in a logical order
4. Ensure all required information is collected
5. Be professional but approachable
6. Never provide legal advice - only help with document preparation

Focus on gathering:
- The affiant's full name and address
- The specific facts they want to swear to
- Relevant dates, times, and locations
- Whether they have personal knowledge of the facts
- The state where the affidavit will be used

Keep responses concise and helpful.`;
  }

  /**
   * Convert conversation history to OpenAI format
   */
  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];
    
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || msg.message || ''
    })).filter(msg => msg.content.trim().length > 0);
  }

  /**
   * Truncate conversation if it gets too long
   */
  truncateConversation(messages) {
    if (messages.length <= this.constants.MAX_CONVERSATION_MESSAGES) {
      return messages;
    }

    // Keep system message and recent messages
    const systemMessage = messages.find(msg => msg.role === 'system');
    const recentMessages = messages.slice(-this.constants.MAX_CONVERSATION_MESSAGES + 1);
    
    return systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
  }

  /**
   * Process chat message with the AI
   */
  async processMessage(message, conversationHistory = [], affidavitData = {}, userId = null, sessionId = null) {
    const processingKey = `${userId || 'anonymous'}_${sessionId || 'session'}_${Date.now()}`;
    
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        return {
          success: false,
          error: "Please provide a message to process.",
          affidavitData
        };
      }

      if (message.length > this.constants.MAX_MESSAGE_LENGTH) {
        return {
          success: false,
          error: "Your message is too long. Please try a shorter message.",
          affidavitData
        };
      }

      // Check if already processing
      if (this.processingQueue.has(processingKey)) {
        return {
          success: false,
          error: "Please wait a moment.",
          affidavitData
        };
      }

      // Check services availability
      if (!this.openAIService) {
        logger.error('OpenAI service not available');
        return {
          success: false,
          error: "The AI service is currently unavailable. Please try again later.",
          affidavitData
        };
      }

      // Mark as processing
      this.processingQueue.set(processingKey, { timestamp: Date.now(), userId, sessionId });

      logger.info('Chat processing started', {
        sessionId,
        userId,
        messageLength: message.length,
        historyLength: conversationHistory.length,
        processingKey
      });

      // Prepare conversation with system prompt
      const systemPrompt = this.createSystemPrompt();
      const convertedHistory = this.convertConversationHistory(conversationHistory);
      
      // Combine messages with truncation if needed
      const messages = this.truncateConversation([
        { role: 'system', content: systemPrompt },
        ...convertedHistory,
        { role: 'user', content: message }
      ]);

      // Use resilient service for chat completion
      const completion = await this.openAIService.chat(messages, {
        max_tokens: this.constants.MAX_COMPLETION_TOKENS,
        temperature: 0.7,
        context: { userId, sessionId, processingKey }
      });

      // Extract response
      const aiResponse = completion.choices[0].message.content.trim();

      // Extract structured data from response
      const extractionResult = await this.extractFactsFromConversation(message, affidavitData);
      
      logger.info('Chat processing completed', {
        sessionId,
        userId,
        processingKey,
        newFactsCount: extractionResult.newFacts?.length || 0
      });
      
      return {
        success: true,
        response: aiResponse,
        affidavitData: extractionResult.affidavitData,
        newFacts: extractionResult.newFacts || []
      };
    } catch (error) {
      logger.error('Chat processing error', {
        error: error.message,
        userId,
        sessionId,
        processingKey
      });
      
      return {
        success: false,
        error: "I'm having trouble processing your message. Please try again in a moment.",
        affidavitData
      };
    } finally {
      // Clean up processing queue
      this.processingQueue.delete(processingKey);
    }
  }

  /**
   * Extract facts from conversation
   */
  async extractFactsFromConversation(message, existingData = {}) {
    try {
      // Simple extraction logic for now
      const affidavitData = { ...existingData };
      const newFacts = [];
      
      // Extract basic information using patterns
      const nameMatch = message.match(/my name is ([A-Za-z\s]+)/i);
      if (nameMatch && !affidavitData.affiantName) {
        affidavitData.affiantName = nameMatch[1].trim();
      }
      
      const stateMatch = message.match(/in ([A-Z]{2}|Texas|Utah|Arizona)/i);
      if (stateMatch && !affidavitData.state) {
        const state = stateMatch[1].toUpperCase();
        if (state.length === 2) {
          affidavitData.state = state;
        } else {
          // Convert full state names to abbreviations
          const stateMap = { 'TEXAS': 'TX', 'UTAH': 'UT', 'ARIZONA': 'AZ' };
          affidavitData.state = stateMap[state] || state;
        }
      }

      // Look for factual statements
      const factPatterns = [
        /I (saw|witnessed|observed|heard) (.+)/i,
        /On (.+) I (.+)/i,
        /The fact is (.+)/i,
        /It is true that (.+)/i
      ];

      for (const pattern of factPatterns) {
        const match = message.match(pattern);
        if (match) {
          newFacts.push({
            id: Date.now() + Math.random(),
            text: match[0],
            extracted: true,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Initialize facts array if it doesn't exist
      if (!affidavitData.facts) {
        affidavitData.facts = [];
      }

      // Add new facts to existing data
      affidavitData.facts = [...affidavitData.facts, ...newFacts];

      logger.info('Fact extraction completed', {
        extractedName: !!nameMatch,
        extractedState: !!stateMatch,
        extractedFactsCount: newFacts.length
      });

      return { affidavitData, newFacts };
    } catch (error) {
      logger.error('Fact extraction error', { error: error.message });
      return { affidavitData: existingData, newFacts: [] };
    }
  }

  /**
   * Validate affidavit data
   */
  validateAffidavit(affidavitData) {
    try {
      if (!this.templateManager) {
        logger.error('Template manager not available');
        return {
          isValid: false,
          errors: ['Validation service is currently unavailable'],
          warnings: []
        };
      }
      
      return this.templateManager.validateDocument(affidavitData);
    } catch (error) {
      logger.error('Validation error', { error: error.message });
      return {
        isValid: false,
        errors: ['An error occurred during validation'],
        warnings: []
      };
    }
  }

  /**
   * Generate document preview
   */
  generatePreview(affidavitData) {
    try {
      if (!this.templateManager) {
        logger.error('Template manager not available');
        return {
          success: false,
          error: 'Preview service is currently unavailable'
        };
      }
      
      const preview = this.templateManager.generatePreview(affidavitData);
      const validation = this.validateAffidavit(affidavitData);
      
      return {
        success: true,
        preview,
        validation
      };
    } catch (error) {
      logger.error('Preview generation error', { error: error.message });
      return {
        success: false,
        error: 'Failed to generate preview'
      };
    }
  }

  /**
   * Generate final document
   */
  async generateFinalDocument(affidavitData, options = {}) {
    try {
      if (!this.templateManager) {
        logger.error('Template manager not available');
        return {
          success: false,
          error: 'Document generation service is currently unavailable'
        };
      }
      
      const validation = this.validateAffidavit(affidavitData);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Document validation failed',
          validation
        };
      }
      
      const finalDocument = this.templateManager.generateFinalDocument(affidavitData);
      
      // Generate PDF if requested
      if (options.generatePdf) {
        const pdfResult = await this.generatePDF(finalDocument, options);
        return {
          success: true,
          document: finalDocument,
          pdf: pdfResult,
          validation
        };
      }
      
      return {
        success: true,
        document: finalDocument,
        validation
      };
    } catch (error) {
      logger.error('Document generation error', { error: error.message });
      return {
        success: false,
        error: 'Failed to generate document'
      };
    }
  }

  /**
   * Generate PDF (placeholder implementation)
   */
  async generatePDF(documentContent, options = {}) {
    try {
      // This is a placeholder - in real implementation, this would call PDF service
      logger.info('PDF generation requested', { options });
      
      // For testing purposes
      const outputPath = options.outputPath || path.join('./documents', `document_${Date.now()}.pdf`);
      
      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(outputPath));
      
      // Write a placeholder file
      await fs.writeFile(outputPath, 'PDF content would go here');
      
      return {
        success: true,
        filepath: outputPath,
        filename: path.basename(outputPath)
      };
    } catch (error) {
      logger.error('PDF generation error', { error: error.message });
      return {
        success: false,
        error: 'Failed to generate PDF: ' + error.message
      };
    }
  }
  
  /**
   * Save session data
   */
  async saveSession(sessionData, userId) {
    try {
      logger.info('Saving session', { userId });
      
      // In a real implementation, this would save to database
      // For now, just return success
      return {
        success: true,
        sessionId: `session_${Date.now()}`
      };
    } catch (error) {
      logger.error('Session save error', { error: error.message, userId });
      return {
        success: false,
        error: 'Failed to save session'
      };
    }
  }
  
  /**
   * Load session data
   */
  async loadSession(sessionId, userId) {
    try {
      logger.info('Loading session', { sessionId, userId });
      
      // In a real implementation, this would load from database
      // For now, just return not found
      return {
        success: false,
        error: 'Session not found'
      };
    } catch (error) {
      logger.error('Session load error', { error: error.message, sessionId, userId });
      return {
        success: false,
        error: 'Failed to load session'
      };
    }
  }
}

module.exports = AffidavitService;