// affidavitService.js - Complete drop-in with resilient error handling
const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
const { StateTemplateManager } = require('./templates/StateTemplateManager');
const logger = require('./services/logger');
const fs = require('fs').promises;
const path = require('path');

class AffidavitService {
  constructor(templateManager) {
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
    
    // Initialize services
    this.initializeServices();
    this.conversationCache = new Map();
    this.processingQueue = new Map();
    this.templateManager = new StateTemplateManager();

    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
  }

// Modify line 20-21 in affidavitService.js
  initializeServices() {
    try {
      // Instead of creating a new instance, get it from server.js
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
    
    // Also clean up old processing queue entries
    for (const [key, entry] of this.processingQueue.entries()) {
      if (now - entry.timestamp > 2 * 60 * 1000) { // 2 minutes
        this.processingQueue.delete(key);
      }
    }
    
    // Log cache stats
    if (this.conversationCache.size > 0 || this.processingQueue.size > 0) {
      logger.info('Cache cleanup stats', {
        conversationCacheSize: this.conversationCache.size,
        processingQueueSize: this.processingQueue.size
      });
    }
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4); // Rough approximation
  }

  /**
   * Create system prompt for chat
   */
  createSystemPrompt() {
    return `You are a legal assistant helping users create affidavits. Extract relevant information from their messages and provide guidance on writing clear, factual statements.

Your task is to:
1. Help the user provide all necessary information for their affidavit
2. Extract information like their name, state, county, and factual statements
3. Guide them to write statements based on personal knowledge
4. Be conversational but professional

Key information to collect:
- Affiant's full name
- State (Texas, Utah, or Arizona only)
- County (required for Texas)
- Factual statements (things the person knows firsthand)

Affidavit Rules:
- Statements should be factual, not opinions
- Use clear, direct language
- Avoid legal jargon
- Include specific details when possible (dates, times, locations)
- Each statement should be distinct and specific

DO NOT:
- Make up legal requirements
- Provide legal advice beyond affidavit preparation
- Include false or misleading information
- Use overly emotional language

Be helpful, accurate, and conversational. Ask clarifying questions if needed.`;
  }

  /**
   * Convert frontend conversation format to OpenAI format
   */
  convertConversationHistory(frontendHistory) {
    if (!Array.isArray(frontendHistory)) return [];
    
    return frontendHistory.map(msg => {
      // Handle frontend format: {type: "user|bot", content: "..."}
      if (msg.type) {
        return {
          role: msg.type === 'bot' ? 'assistant' : 'user',
          content: msg.content || ''
        };
      }
      
      // Handle OpenAI format: {role: "user|assistant|system", content: "..."}
      if (msg.role) {
        return {
          role: msg.role,
          content: msg.content || ''
        };
      }
      
      // Fallback: assume it's a user message
      return {
        role: 'user',
        content: typeof msg === 'string' ? msg : JSON.stringify(msg)
      };
    });
  }

  /**
   * Truncate conversation to fit within token limits
   */
  truncateConversation(messages) {
    // Always keep system message and last user message
    const systemMessage = messages.find(m => m.role === 'system') || null;
    const lastUserMessage = messages.filter(m => m.role === 'user').pop() || null;
    
    let availableTokens = this.constants.MAX_TOKENS - this.constants.MAX_COMPLETION_TOKENS;
    let currentTokens = 0;
    let truncatedMessages = [];
    
    // Calculate tokens for essential messages
    if (systemMessage) {
      const systemTokens = this.estimateTokens(systemMessage.content);
      currentTokens += systemTokens;
      availableTokens -= systemTokens;
    }
    
    if (lastUserMessage) {
      const lastUserTokens = this.estimateTokens(lastUserMessage.content);
      currentTokens += lastUserTokens;
      availableTokens -= lastUserTokens;
    }
    
    // Add other messages until limit
    const otherMessages = messages.filter(m => 
      (m.role !== 'system') && 
      (m !== lastUserMessage)
    ).reverse(); // Start from most recent
    
    for (const message of otherMessages) {
      const messageTokens = this.estimateTokens(message.content);
      
      if (currentTokens + messageTokens <= availableTokens) {
        truncatedMessages.unshift(message); // Add to beginning
        currentTokens += messageTokens;
      } else {
        // No more room for full messages
        break;
      }
    }
    
    // Reconstruct conversation with essential messages
    const result = [];
    if (systemMessage) result.push(systemMessage);
    result.push(...truncatedMessages);
    if (lastUserMessage) result.push(lastUserMessage);
    
    return result;
  }

  /**
   * Process chat message with resilient error handling
   */
  async processMessage(message, conversationHistory = [], affidavitData = {}, { userId, sessionId }) {
    // Generate a unique key for this processing request
    const processingKey = `${userId || 'anonymous'}_${sessionId || Date.now()}`;
    
    try {
      // Check if already processing
      if (this.processingQueue.has(processingKey)) {
        logger.warn('Duplicate processing request detected', { processingKey });
        return {
          success: false, 
          error: "Your message is already being processed. Please wait a moment.",
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
      const completion = await this.openAIService.createChatCompletion(messages, {
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
        affidavitData,
        suggestions: [
          'Try rephrasing your message',
          'Break complex requests into smaller parts',
          'Contact support if issue continues'
        ]
      };
    } finally {
      // Clean up processing queue
      this.processingQueue.delete(processingKey);
    }
  }

  /**
   * Extract facts using AI with resilient error handling
   */
  async extractFactsFromConversation(message, existingData) {
    logger.info('Extracting data from message');
    
    try {
      const extractionPrompt = `
Extract information from this message for a legal affidavit:

Message: "${message}"

Current data: ${JSON.stringify(existingData)}

Return ONLY a JSON object with this structure:
{
  "affiantName": "extracted name or null",
  "state": "TX/UT/AZ or null", 
  "county": "county name or null",
  "facts": ["new fact 1", "new fact 2"],
  "reasoning": "brief explanation of what you found"
}

Rules:
- Only extract if clearly stated
- For state: convert "Texas"→"TX", "Utah"→"UT", "Arizona"→"AZ" 
- For facts: extract substantial statements, not single words
- Don't override existing data unless new info is clearly different
- Return null for fields not found
`;

      // Use resilient service for extraction
      const completion = await this.openAIService.createChatCompletion([
        { role: "user", content: extractionPrompt }
      ], {
        model: "gpt-4",
        max_tokens: 500,
        temperature: 0.1
      });

      const aiResponse = completion.choices[0].message.content.trim();

      // Parse the JSON response
      let extractedData;
      try {
        // Remove any markdown code blocks if present
        const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        extractedData = JSON.parse(cleanResponse);
        logger.info('Extraction parsed successfully');
      } catch (parseError) {
        logger.error('Failed to parse AI response as JSON', { parseError: parseError.message });
        return { affidavitData: existingData, newFacts: [] };
      }

      // Build updated affidavit data
      let affidavitData = { ...existingData };
      const newFacts = [];

      // Update name
      if (extractedData.affiantName && (!affidavitData.affiantName || affidavitData.affiantName.trim() === '')) {
        affidavitData.affiantName = extractedData.affiantName;
      }

      // Update state
      if (extractedData.state && (!affidavitData.state || affidavitData.state.trim() === '')) {
        affidavitData.state = extractedData.state;
      }

      // Update county
      if (extractedData.county && (!affidavitData.county || affidavitData.county.trim() === '')) {
        affidavitData.county = extractedData.county;
      }

      // Process facts
      if (Array.isArray(extractedData.facts) && extractedData.facts.length > 0) {
        // Add new facts
        extractedData.facts.forEach(fact => {
          if (fact && fact.trim() !== '') {
            newFacts.push(fact);
            if (!affidavitData.facts) {
              affidavitData.facts = [];
            }
            affidavitData.facts.push(fact);
          }
        });
      }

      logger.info('Data extraction completed', {
        extractedName: !!extractedData.affiantName,
        extractedState: !!extractedData.state,
        extractedCounty: !!extractedData.county,
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
      
      // First validate
      const validation = this.validateAffidavit(affidavitData);
      
      if (!validation.isValid && !options.ignoreValidation) {
        return {
          success: false,
          error: 'Document validation failed',
          validation
        };
      }
      
      // Generate document sections
      const sections = this.templateManager.generateDocumentSections(affidavitData);
      
      // Generate unique filename
      const userId = options.userId || 'anonymous';
      const documentId = options.documentId || Date.now();
      const filename = `affidavit_${userId}_${documentId}.pdf`;
      const outputPath = path.join('./documents', filename);
      
      // Generate PDF (assuming we have a PDF service available)
      const pdfResult = await this.generatePDF(sections, {
        outputPath,
        includeWatermark: options.includeWatermark,
        metadata: {
          documentId,
          userId,
          generatedAt: new Date().toISOString()
        }
      });
      
      if (!pdfResult.success) {
        throw new Error(pdfResult.error || 'PDF generation failed');
      }
      
      // Generate download token
      const downloadToken = require('crypto').randomBytes(16).toString('hex');
      
      return {
        success: true,
        documentPath: pdfResult.filepath,
        documentUrl: `/api/documents/download/${downloadToken}`,
        downloadToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      logger.error('Document generation error', { error: error.message });
      return {
        success: false,
        error: 'Failed to generate document: ' + error.message
      };
    }
  }

  /**
   * Generate PDF (placeholder - would normally use a PDF service)
   */
  async generatePDF(sections, options = {}) {
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