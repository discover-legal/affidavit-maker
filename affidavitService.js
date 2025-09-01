// affidavitService.js - COMPLETE REPLACEMENT FILE
const { StateExtractionService, UnsupportedStateError } = require('./services/stateExtractionService');
const logger = require('./services/logger');

class AffidavitService {
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.openAIService = global.openAIService;
    this.processingQueue = new Map();
    
    // Initialize state extraction service
    this.stateExtractor = new StateExtractionService(this.openAIService);
    
    this.constants = {
      MAX_MESSAGE_LENGTH: 5000,
      MAX_COMPLETION_TOKENS: 1500,
      MAX_CONVERSATION_MESSAGES: 20,
      CHAT_TIMEOUT: 30000
    };
  }

  /**
   * ✅ MAIN: Process chat message with early state validation and streaming support
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

      // ✅ CRITICAL: Early state validation - fail fast for unsupported states
      try {
        const stateCheckResult = await this.checkUserState(message, conversationHistory, affidavitData);
        if (!stateCheckResult.canProceed) {
          return {
            success: false,
            error: stateCheckResult.message,
            affidavitData,
            unsupportedState: true,
            detectedState: stateCheckResult.detectedState
          };
        }
        
        // Update affidavit data if state was extracted
        if (stateCheckResult.extractedState) {
          affidavitData.state = stateCheckResult.extractedState.state;
          logger.info('State extracted early', {
            state: stateCheckResult.extractedState.state,
            confidence: stateCheckResult.extractedState.confidence,
            sessionId
          });
        }
      } catch (error) {
        if (error instanceof UnsupportedStateError) {
          return {
            success: false,
            error: error.message,
            affidavitData,
            unsupportedState: true,
            detectedState: error.detectedState
          };
        }
        // Continue processing if state extraction fails (don't block user)
        logger.warn('State extraction failed, continuing', { error: error.message });
      }

      // Continue with normal chat processing
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
        user: userId?.toString()
      });

      // Extract response
      const aiResponse = completion.choices[0].message.content.trim();

      // Extract structured data from response (now using robust extraction)
      const extractionResult = await this.extractFactsFromConversation(message, affidavitData, conversationHistory);
      
      logger.info('Chat processing completed', {
        sessionId,
        userId,
        processingKey,
        newFactsCount: extractionResult.newFacts?.length || 0,
        hasState: !!extractionResult.affidavitData.state
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
   * ✅ NEW: Check user state early and fail fast if unsupported
   */
  async checkUserState(message, conversationHistory, currentAffidavitData) {
    // If we already have a valid state, no need to check again
    if (currentAffidavitData.state && ['TX', 'UT', 'AZ'].includes(currentAffidavitData.state)) {
      return { canProceed: true };
    }

    // Only run extraction if message likely contains location info
    if (!this.stateExtractor.shouldExtract(message)) {
      return { canProceed: true };
    }

    try {
      const stateResult = await this.stateExtractor.extractFromMessage(message, conversationHistory);
      
      if (stateResult && stateResult.state) {
        // State successfully extracted and it's supported
        return {
          canProceed: true,
          extractedState: stateResult
        };
      }
      
      // No state extracted, continue normally
      return { canProceed: true };
      
    } catch (error) {
      if (error instanceof UnsupportedStateError) {
        // This is the key part - reject unsupported states early
        return {
          canProceed: false,
          message: error.message,
          detectedState: error.detectedState
        };
      }
      
      // Other extraction errors - continue processing
      logger.warn('State check failed', { error: error.message });
      return { canProceed: true };
    }
  }

  /**
   * ✅ ROBUST: Extract facts using multi-strategy approach
   * Continues chat even if extraction fails
   */
  async extractFactsFromConversation(message, existingData = {}, conversationHistory = []) {
    const affidavitData = { ...existingData };
    const newFacts = [];
    
    try {
      console.log('🔍 Starting comprehensive extraction for:', message.substring(0, 50) + '...');
      
      // Strategy 1: Use StateExtractionService for name extraction
      try {
        if (this.stateExtractor.shouldExtract(message)) {
          const extractionResult = await this.stateExtractor.extractFromMessage(message, conversationHistory);
          
          if (extractionResult.name && !affidavitData.affiantName) {
            affidavitData.affiantName = extractionResult.name;
            console.log('✅ Extracted name via StateExtractor:', extractionResult.name);
          }
          
          if (extractionResult.state && !affidavitData.state) {
            affidavitData.state = extractionResult.state;
            console.log('✅ Extracted state via StateExtractor:', extractionResult.state);
          }
        }
      } catch (error) {
        if (error instanceof UnsupportedStateError) {
          throw error; // Re-throw unsupported state errors
        }
        console.log('⚠️ StateExtractor failed, trying LLM extraction:', error.message);
      }

      // Strategy 2: LLM-based fact extraction
      try {
        const llmFacts = await this.performLLMFactExtraction(message, conversationHistory, affidavitData);
        if (llmFacts && llmFacts.length > 0) {
          newFacts.push(...llmFacts);
          console.log('✅ LLM extracted facts:', llmFacts.length);
        }
      } catch (error) {
        console.log('⚠️ LLM fact extraction failed, trying regex fallback:', error.message);
        
        // Strategy 3: Enhanced regex fallback
        const regexFacts = this.performRegexFactExtraction(message);
        if (regexFacts && regexFacts.length > 0) {
          newFacts.push(...regexFacts);
          console.log('✅ Regex extracted facts:', regexFacts.length);
        }
      }

      // Initialize facts array if needed
      if (!affidavitData.facts) {
        affidavitData.facts = [];
      }

      // Add new facts to existing data
      affidavitData.facts = [...affidavitData.facts, ...newFacts];

      logger.info('Fact extraction completed', {
        extractedName: !!affidavitData.affiantName,
        extractedState: !!affidavitData.state,
        extractedFactsCount: newFacts.length
      });
      
      return {
        affidavitData,
        newFacts,
        extractionMethod: newFacts.length > 0 ? 'llm' : 'regex'
      };
      
    } catch (error) {
      if (error instanceof UnsupportedStateError) {
        throw error; // Re-throw unsupported state errors
      }
      
      console.error('❌ All extraction strategies failed:', error.message);
      
      // ✅ CRITICAL: Continue chat even if extraction completely fails
      logger.warn('Fact extraction failed completely, continuing chat', { 
        error: error.message,
        message: message.substring(0, 100)
      });
      
      return {
        affidavitData,
        newFacts: [],
        extractionMethod: 'failed'
      };
    }
  }

  /**
   * ✅ NEW: LLM-based fact extraction with proper error handling
   */
  async performLLMFactExtraction(message, conversationHistory, currentData) {
    const prompt = `Extract factual statements from this message that would be appropriate for a legal affidavit:
"${message}"

RULES:
- Only extract clear, factual statements
- Each fact should be a complete sentence
- Suitable for legal document
- Handle informal language

RESPOND WITH FACTS (one per line):
- [fact 1]
- [fact 2]
- [fact 3]

If no facts found, respond with: NO_FACTS`;

    try {
      const completion = await this.openAIService.chat([
        {
          role: 'system',
          content: 'You are an expert at extracting factual statements from informal text for legal documents.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        max_tokens: 300,
        temperature: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      
      if (response === 'NO_FACTS' || !response.includes('-')) {
        return [];
      }
      
      // Parse facts from response
      const facts = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.substring(1).trim())
        .filter(fact => fact.length > 10) // Filter out tiny facts
        .map(factText => ({
          id: Date.now() + Math.random(),
          text: factText,
          extracted: true,
          timestamp: new Date().toISOString()
        }));

      return facts;
      
    } catch (error) {
      console.warn('LLM fact extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * ✅ ENHANCED: Regex fact extraction for obvious factual statements
   */
  performRegexFactExtraction(message) {
    const facts = [];
    
    // Extract obvious factual statements
    const factPatterns = [
      /I (saw|witnessed|observed|heard|know that) (.+)/i,
      /On (.+) I (.+)/i,
      /The fact is (.+)/i,
      /It is true that (.+)/i,
      /I can testify that (.+)/i,
      /I swear that (.+)/i,
      /I affirm that (.+)/i
    ];

    for (const pattern of factPatterns) {
      const match = message.match(pattern);
      if (match && match[0].length > 15) { // Avoid tiny matches
        facts.push({
          id: Date.now() + Math.random(),
          text: match[0],
          extracted: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    return facts;
  }

  /**
   * ✅ UPDATED: System prompt optimized for natural conversation
   */
  createSystemPrompt() {
    return `You are a professional legal document assistant helping users create affidavits for Texas, Utah, and Arizona.

Your role:
1. Gather information conversationally and naturally
2. Ask follow-up questions to clarify details  
3. Explain legal requirements simply
4. Help organize information clearly
5. Be warm but professional

IMPORTANT NOTES:
- Information extraction happens automatically in the background
- Focus on natural conversation flow
- If someone mentions being from another state, explain you only serve TX/UT/AZ
- Keep responses concise but helpful
- Ask one clear question at a time

You're helping someone create a legal document, so accuracy and completeness matter.`;
  }

  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];
    
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || msg.message || ''
    })).filter(msg => msg.content.trim().length > 0);
  }

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
   * ✅ NEW: Background extraction for streaming (non-blocking)
   */
  async performBackgroundExtraction(message, conversationHistory, affidavitData, userId, sessionId) {
    try {
      console.log('🔍 Background extraction starting...');
      
      const result = await this.extractFactsFromConversation(message, affidavitData, conversationHistory);
      
      console.log('✅ Background extraction completed:', {
        hasState: !!result.affidavitData.state,
        hasName: !!result.affidavitData.affiantName,
        newFactsCount: result.newFacts?.length || 0
      });
      
      return result;
      
    } catch (error) {
      console.log('⚠️ Background extraction failed, continuing with original data:', error.message);
      
      return {
        affidavitData,
        newFacts: [],
        extractionMethod: 'failed'
      };
    }
  }
}

module.exports = AffidavitService;