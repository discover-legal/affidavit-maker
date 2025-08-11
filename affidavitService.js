// affidavitService.js - Updated with Chat Stability
const { OpenAI } = require('openai');
const logger = require('./utils/logger');

class AffidavitService {
  constructor() {
    // Constants for stability - define these FIRST
    this.constants = {
      MAX_TOKENS: 4000,
      MAX_COMPLETION_TOKENS: 1000,
      MAX_MESSAGE_LENGTH: 25000, // 25k characters
      MAX_CONVERSATION_MESSAGES: 15,
      REQUEST_TIMEOUT: 45000, // 45 seconds
      RETRY_ATTEMPTS: 2,
      CACHE_TTL: 10 * 60 * 1000 // 10 minutes
    };
    
    // Initialize services after constants are defined
    this.initializeOpenAI();
    this.conversationCache = new Map();
    this.processingQueue = new Map();
    
    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
  }

  initializeOpenAI() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OpenAI API key not found - AI features will be disabled');
        this.openai = null;
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: this.constants.REQUEST_TIMEOUT // Set timeout on client, not per request
      });

      logger.info('✅ OpenAI client initialized successfully');
    } catch (error) {
      logger.logError(error, { type: 'openai_initialization_failed' });
      this.openai = null;
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
    
    // Log cache stats
    if (this.conversationCache.size > 0) {
      logger.logPerformance('conversation_cache_cleanup', this.conversationCache.size, {
        type: 'cache_size_after_cleanup'
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
        content: typeof msg === 'string' ? msg : (msg.content || '')
      };
    }).filter(msg => msg.content.trim().length > 0); // Remove empty messages
  }

  /**
   * Truncate conversation history to stay within token limits
   */
  truncateConversation(messages) {
    if (!Array.isArray(messages)) return [];

    let totalTokens = 0;
    const truncatedMessages = [];
    
    // Always keep system message if present
    const systemMessage = messages.find(msg => msg.role === 'system');
    if (systemMessage) {
      truncatedMessages.push(systemMessage);
      totalTokens += this.estimateTokens(systemMessage.content);
    }

    // Process user/assistant messages from most recent
    const conversationMessages = messages
      .filter(msg => msg.role !== 'system')
      .reverse();

    for (const message of conversationMessages) {
      const messageTokens = this.estimateTokens(message.content);
      
      if (totalTokens + messageTokens > this.constants.MAX_TOKENS - this.constants.MAX_COMPLETION_TOKENS) {
        break;
      }
      
      truncatedMessages.unshift(message);
      totalTokens += messageTokens;
      
      if (truncatedMessages.length >= this.constants.MAX_CONVERSATION_MESSAGES) {
        break;
      }
    }

    return truncatedMessages;
  }

  /**
   * Create system prompt for conversational legal assistant (NOT document generator)
   */
  createSystemPrompt() {
    return `You are a helpful conversational assistant that helps people gather information for legal affidavits.

Your role is to:
1. Have natural conversations to gather facts and information
2. Ask follow-up questions to get specific details
3. Guide users through what information is needed
4. Be supportive and understanding

You are NOT responsible for:
- Writing the actual affidavit (that's handled automatically)
- Formatting legal documents
- Providing legal advice

Keep responses conversational, helpful, and focused on gathering information. Ask one question at a time. Be empathetic when users share difficult situations.

For Texas, Utah, and Arizona affidavits, you typically need:
- Full legal name
- County (required for TX and UT, optional for AZ)  
- Specific facts with dates/details when possible

Keep responses under 3 sentences and always ask a follow-up question to gather more information.`;
  }

  /**
   * Process user message with enhanced error handling and stability
   */
  async processMessage(data) {
    console.log('🔍 AffidavitService.processMessage called');
    const startTime = Date.now();
    const { message, conversationHistory = [], affidavitData = {}, userId, sessionId } = data;

    // Generate processing key for deduplication
    const processingKey = `${userId || 'anon'}_${Date.now()}`;
    
    try {
      console.log('🔍 AffidavitService: Starting processing');
      
      // Check if OpenAI is available
      if (!this.openai) {
        console.log('🔍 AffidavitService: OpenAI not available');
        return {
          success: false,
          response: "AI service is currently unavailable. Please check your configuration and try again.",
          affidavitData,
          suggestions: ['Verify OpenAI API key is configured', 'Check internet connection']
        };
      }

      console.log('🔍 AffidavitService: OpenAI available, validating input');

      // Validate input lengths
      if (message.length > this.constants.MAX_MESSAGE_LENGTH) {
        console.log('🔍 AffidavitService: Message too long');
        return {
          success: false,
          response: `Message is too long (${message.length} characters). Please keep messages under ${this.constants.MAX_MESSAGE_LENGTH} characters.`,
          affidavitData,
          suggestions: ['Break your message into smaller parts', 'Focus on one topic at a time']
        };
      }

      console.log('🔍 AffidavitService: Input validated, checking for duplicates');

      // Check for duplicate processing
      if (this.processingQueue.has(processingKey)) {
        console.log('🔍 AffidavitService: Duplicate processing detected');
        logger.warn('Duplicate message processing attempt detected', {
          processingKey,
          userId,
          sessionId
        });
        return {
          success: false,
          response: "Your message is already being processed. Please wait a moment.",
          affidavitData
        };
      }

      console.log('🔍 AffidavitService: Marking as processing');

      // Mark as processing
      this.processingQueue.set(processingKey, { timestamp: Date.now(), userId, sessionId });

      console.log('🔍 AffidavitService: Logging chat event');

      logger.logChat('processing_started', sessionId, userId, {
        messageLength: message.length,
        messageWords: message.trim().split(/\s+/).length,
        historyLength: conversationHistory.length,
        processingKey
      });

      console.log('🔍 AffidavitService: Creating system prompt');

      // Prepare conversation with truncation
      const systemPrompt = this.createSystemPrompt();
      
      console.log('🔍 AffidavitService: Converting conversation history format');
      // Convert frontend format to OpenAI format
      const convertedHistory = this.convertConversationHistory(conversationHistory);
      
      console.log('🔍 AffidavitService: Conversion stats:', {
        originalLength: conversationHistory.length,
        convertedLength: convertedHistory.length,
        sampleOriginal: conversationHistory[0],
        sampleConverted: convertedHistory[0]
      });
      
      console.log('🔍 AffidavitService: Truncating conversation');
      const truncatedHistory = this.truncateConversation([
        { role: 'system', content: systemPrompt },
        ...convertedHistory,
        { role: 'user', content: message }
      ]);

      // Log if conversation was truncated
      if (truncatedHistory.length !== convertedHistory.length + 2) {
        console.log('🔍 AffidavitService: Conversation truncated');
        logger.logChat('conversation_truncated', sessionId, userId, {
          originalLength: convertedHistory.length + 2,
          truncatedLength: truncatedHistory.length,
          estimatedTokens: truncatedHistory.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0)
        });
      }

      console.log('🔍 AffidavitService: Starting OpenAI request with retry logic');

      // Make OpenAI request with retry logic
      let completion;
      let attempts = 0;

      while (attempts < this.constants.RETRY_ATTEMPTS) {
        attempts++;
        
        console.log(`🔍 AffidavitService: OpenAI attempt ${attempts}/${this.constants.RETRY_ATTEMPTS}`);
        
        try {
          const requestStart = Date.now();
          
          console.log('🔍 AffidavitService: Making OpenAI API call');
          console.log('🔍 AffidavitService: Messages to send:', JSON.stringify(truncatedHistory.map(m => ({role: m.role, contentLength: m.content.length})), null, 2));
          
          completion = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: truncatedHistory,
            max_tokens: this.constants.MAX_COMPLETION_TOKENS,
            temperature: 0.7
            // Removed timeout - it's set on the client initialization
          });

          const requestTime = Date.now() - requestStart;
          
          console.log(`🔍 AffidavitService: OpenAI request completed in ${requestTime}ms`);
          
          logger.logAI('gpt-4', 
            truncatedHistory.map(m => m.content).join(' '), 
            completion.choices[0]?.message?.content || '',
            requestTime,
            {
              sessionId,
              userId,
              attempt: attempts,
              tokensUsed: completion.usage?.total_tokens || 0
            }
          );

          break; // Success, exit retry loop

        } catch (error) {
          console.log(`🔍 AffidavitService: OpenAI attempt ${attempts} failed:`, error.message);
          
          logger.logError(error, {
            type: 'openai_request_failed',
            attempt: attempts,
            sessionId,
            userId,
            messageLength: message.length,
            errorCode: error.code,
            errorType: error.type
          });

          // Handle specific error types
          if (error.code === 'rate_limit_exceeded') {
            if (attempts >= this.constants.RETRY_ATTEMPTS) {
              console.log('🔍 AffidavitService: Rate limit exceeded, final attempt');
              return {
                success: false,
                response: "The AI service is currently busy. Please wait a moment and try again.",
                affidavitData,
                suggestions: ['Wait 30 seconds before trying again', 'Try a shorter message']
              };
            }
            // Wait before retry for rate limits
            console.log(`🔍 AffidavitService: Waiting ${2000 * attempts}ms for rate limit`);
            await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
          } else if (error.code === 'invalid_api_key' || error.code === 'insufficient_quota') {
            console.log('🔍 AffidavitService: API key or quota error');
            return {
              success: false,
              response: "AI service is temporarily unavailable. Please try again later.",
              affidavitData,
              suggestions: ['Try again in a few minutes', 'Contact support if issue persists']
            };
          } else if (attempts >= this.constants.RETRY_ATTEMPTS) {
            console.log('🔍 AffidavitService: Final attempt failed, throwing error');
            throw error; // Re-throw if final attempt
          }
        }
      }

      if (!completion || !completion.choices || !completion.choices[0]) {
        throw new Error('No response received from AI service');
      }

      const aiResponse = completion.choices[0].message.content;

      // Extract facts from the conversation
      const extractedFacts = await this.extractFactsFromConversation(message, affidavitData);
      
      const processingTime = Date.now() - startTime;

      logger.logChat('processing_completed', sessionId, userId, {
        processingTime,
        attempts,
        responseLength: aiResponse.length,
        factsExtracted: extractedFacts.newFacts?.length || 0,
        processingKey
      });

      return {
        success: true,
        response: aiResponse,
        affidavitData: extractedFacts.affidavitData || affidavitData,
        newFacts: extractedFacts.newFacts || [],
        suggestions: this.generateSuggestions(affidavitData, message)
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.logError(error, {
        type: 'message_processing_failed',
        sessionId,
        userId,
        processingTime,
        messageLength: message.length,
        processingKey
      });

      return {
        success: false,
        response: "I encountered an error processing your message. Please try rephrasing or contact support if the problem persists.",
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
   * Use AI to extract structured data from conversation - much better than regex!
   */
  async extractFactsFromConversation(message, existingData) {
    console.log('🔍 AffidavitService: Using AI to extract data from message:', message);
    
    if (!this.openai) {
      console.log('🔍 AffidavitService: OpenAI not available, skipping extraction');
      return { affidavitData: existingData, newFacts: [] };
    }

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

      console.log('🔍 AffidavitService: Asking AI to extract structured data');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for consistent extraction
      });

      const aiResponse = completion.choices[0].message.content.trim();
      console.log('🔍 AffidavitService: AI extraction response:', aiResponse);

      // Parse the JSON response
      let extractedData;
      try {
        // Remove any markdown code blocks if present
        const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        extractedData = JSON.parse(cleanResponse);
        console.log('🔍 AffidavitService: Parsed extraction data:', extractedData);
      } catch (parseError) {
        console.error('🔍 AffidavitService: Failed to parse AI response as JSON:', parseError);
        return { affidavitData: existingData, newFacts: [] };
      }

      // Build updated affidavit data
      let affidavitData = { ...existingData };
      const newFacts = [];

      // Update fields only if AI found something AND we don't already have it
      if (extractedData.affiantName && !affidavitData.affiantName) {
        affidavitData.affiantName = extractedData.affiantName;
        console.log('🔍 AffidavitService: AI extracted name:', extractedData.affiantName);
      }

      if (extractedData.state && !affidavitData.state) {
        affidavitData.state = extractedData.state;
        console.log('🔍 AffidavitService: AI extracted state:', extractedData.state);
      }

      if (extractedData.county && !affidavitData.county) {
        affidavitData.county = extractedData.county;
        console.log('🔍 AffidavitService: AI extracted county:', extractedData.county);
      }

      // Handle facts - add new ones that aren't duplicates
      if (extractedData.facts && Array.isArray(extractedData.facts)) {
        const existingFacts = affidavitData.facts || [];
        
        for (const newFactContent of extractedData.facts) {
          if (newFactContent && newFactContent.length > 10) { // Substantial facts only
            const isDuplicate = existingFacts.some(existingFact => 
              (typeof existingFact === 'string' ? existingFact : existingFact.content)
                .toLowerCase().includes(newFactContent.toLowerCase().substring(0, 50))
            );
            
            if (!isDuplicate) {
              const newFact = {
                content: newFactContent,
                category: 'general',
                timestamp: new Date().toISOString()
              };
              newFacts.push(newFact);
              affidavitData.facts = [...existingFacts, newFact];
              console.log('🔍 AffidavitService: AI extracted new fact:', newFactContent.substring(0, 100) + '...');
            }
          }
        }
      }

      console.log('🔍 AffidavitService: AI extraction reasoning:', extractedData.reasoning);

      const result = { affidavitData, newFacts };
      console.log('🔍 AffidavitService: Final AI extraction result:', {
        ...result,
        affidavitData: {
          ...result.affidavitData,
          facts: result.affidavitData.facts?.map(f => ({ ...f, content: f.content?.substring(0, 100) + '...' }))
        }
      });

      return result;

    } catch (error) {
      console.error('🔍 AffidavitService: AI extraction failed:', error);
      // Fallback to existing data
      return { affidavitData: existingData, newFacts: [] };
    }
  }

  /**
   * Generate contextual suggestions
   */
  generateSuggestions(affidavitData, message) {
    const suggestions = [];

    if (!affidavitData.affiantName) {
      suggestions.push("Tell me your full legal name");
    }

    if (!affidavitData.state) {
      suggestions.push("Which state is this affidavit for? (Texas, Utah, or Arizona)");
    }

    if (affidavitData.state && ['TX', 'UT'].includes(affidavitData.state) && !affidavitData.county) {
      suggestions.push(`Which county in ${this.getStateName(affidavitData.state)}?`);
    }

    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      suggestions.push("Start by telling me about the facts you need to swear to");
    }

    if (suggestions.length === 0) {
      suggestions.push("What other facts would you like to include?");
    }

    return suggestions;
  }

  /**
   * Generate document preview
   */
  async generatePreview(affidavitData) {
    logger.info('Generating preview', { 
      state: affidavitData.state,
      hasName: !!affidavitData.affiantName,
      factCount: affidavitData.facts?.length || 0
    });

    try {
      const preview = {
        sections: [
          {
            type: 'header',
            title: 'AFFIDAVIT',
            content: `State of ${this.getStateName(affidavitData.state)}`
          },
          {
            type: 'introduction',
            title: 'Introduction',
            content: `I, ${affidavitData.affiantName || '[Name]'}, being of legal age and competent to testify, do hereby swear and affirm under penalty of perjury that the following statements are true and correct to the best of my knowledge:`
          },
          {
            type: 'facts',
            title: 'Statement of Facts',
            content: affidavitData.facts && affidavitData.facts.length > 0 
              ? affidavitData.facts.map(fact => 
                  typeof fact === 'string' ? fact : fact.content
                ).filter(Boolean)
              : ['[Facts will be listed here]']
          },
          {
            type: 'signature',
            title: 'Signature',
            content: 'Signed under penalty of perjury.'
          },
          {
            type: 'notary',
            title: 'Notarization',
            content: 'Notary acknowledgment section'
          }
        ]
      };

      const validation = this.validateAffidavit(affidavitData);

      return {
        success: true,
        preview: preview,
        validation: validation,
        metadata: {
          state: affidavitData.state,
          stateName: this.getStateName(affidavitData.state),
          estimatedPages: Math.max(1, Math.ceil((affidavitData.facts?.length || 0) / 10))
        }
      };

    } catch (error) {
      logger.logError(error, { type: 'preview_generation_failed' });
      return {
        success: false,
        error: 'Preview generation failed'
      };
    }
  }

  /**
   * Validate affidavit data
   */
  validateAffidavit(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.affiantName) {
      errors.push('Affiant name is required');
    }

    if (!affidavitData.state) {
      errors.push('State is required');
    } else if (!['TX', 'UT', 'AZ'].includes(affidavitData.state)) {
      errors.push('Invalid state. Must be TX, UT, or AZ');
    }

    // State-specific validations
    if (['TX', 'UT'].includes(affidavitData.state) && !affidavitData.county) {
      errors.push(`County is required for ${this.getStateName(affidavitData.state)} affidavits`);
    }

    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts have been provided yet');
    } else if (affidavitData.facts.length > 25) {
      warnings.push('Consider consolidating facts for better readability');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      completionPercentage: this.calculateCompletionPercentage(affidavitData)
    };
  }

  /**
   * Calculate completion percentage
   */
  calculateCompletionPercentage(affidavitData) {
    const requiredFields = ['affiantName', 'state', 'facts'];
    
    // Add county as required for TX and UT
    if (['TX', 'UT'].includes(affidavitData.state)) {
      requiredFields.push('county');
    }

    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : true);
    });
    
    return Math.round((completedFields.length / requiredFields.length) * 100);
  }

  /**
   * Get state name from code
   */
  getStateName(stateCode) {
    const stateNames = {
      'TX': 'Texas',
      'UT': 'Utah',
      'AZ': 'Arizona'
    };
    return stateNames[stateCode] || stateCode;
  }

  /**
   * Generate final document (mock implementation)
   */
  async generateFinalDocument(affidavitData, options = {}) {
    logger.info('Generating final document', { 
      userId: options.userId,
      documentId: options.documentId,
      includeWatermark: options.includeWatermark 
    });

    // This would integrate with your PDF service
    // For now, return a mock response
    return {
      success: true,
      documentUrl: `/api/download/affidavit-${Date.now()}.pdf`,
      downloadToken: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
  }
}

module.exports = AffidavitService;