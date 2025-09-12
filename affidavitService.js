
// affidavitService.js - CONSOLIDATED LLM APPROACH WITH FORCED FUNCTION CALLING
// Replaces multiple LLM calls with single smart function calling - DEBUGGED VERSION

const logger = require('./services/logger');

// Legal categories for LLM function calling
const LEGAL_CATEGORIES = {
  financial: {
    name: 'Financial',
    subcategories: ['income', 'assets', 'debts', 'payments', 'support', 'expenses'],
    description: 'Money, assets, income, debts, financial obligations',
    validation_focus: 'specificity, amounts, documentation'
  },
  property: {
    name: 'Property',
    subcategories: ['real_estate', 'personal_property', 'vehicles', 'intellectual_property'],
    description: 'Real estate, personal property, vehicles, ownership',
    validation_focus: 'ownership clarity, specific descriptions, legal interest'
  },
  relational: {
    name: 'Relationships',
    subcategories: ['family', 'custody', 'visitation', 'marriage', 'divorce'],
    description: 'Family relationships, custody, marriage, divorce',
    validation_focus: 'avoid hearsay, personal knowledge only, formal language'
  },
  temporal: {
    name: 'Chronological',
    subcategories: ['dates', 'timelines', 'sequences', 'duration'],
    description: 'Dates, times, chronological sequences',
    validation_focus: 'specific dates, avoid approximations'
  },
  witness: {
    name: 'Witness Testimony',
    subcategories: ['observations', 'conversations', 'events', 'actions'],
    description: 'Direct observations, witnessed events',
    validation_focus: 'first-person observations only, no hearsay'
  },
  communication: {
    name: 'Communications',
    subcategories: ['verbal', 'written', 'electronic', 'legal_notices'],
    description: 'Conversations, emails, texts, legal notices',
    validation_focus: 'direct participation, avoid "I heard" statements'
  },
  parental: {
    name: 'Parental Care',
    subcategories: ['childcare', 'education', 'health', 'environment', 'routines'],
    description: 'Child care, education, health, living environment',
    validation_focus: 'specific examples, avoid emotional language, factual observations'
  }
};

class AffidavitService {
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.openAIService = global.openAIService;
    this.processingQueue = new Map();
    
    this.constants = {
      MAX_MESSAGE_LENGTH: 5000,
      MAX_COMPLETION_TOKENS: 2000, // Increased for function calling
      MAX_CONVERSATION_MESSAGES: 20,
      CHAT_TIMEOUT: 30000
    };
  }

  /**
   * ✅ MAIN: Single LLM call processes everything
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

      // ✅ CONSOLIDATED: Single LLM call does everything
      const result = await this.processWithConsolidatedLLM(
        message, 
        conversationHistory, 
        affidavitData,
        userId,
        sessionId
      );

      logger.info('Chat processing completed', {
        sessionId,
        userId,
        processingKey,
        newFactsCount: result.extractedFacts?.length || 0,
        hasState: !!result.extractedState,
        hasName: !!result.extractedName,
        processingMethod: 'consolidated_llm'
      });

      return {
        success: true,
        response: result.chatResponse,
        affidavitData: result.updatedAffidavitData,
        newFacts: result.extractedFacts || [],
        validation: result.validationSummary || {},
        categories: result.categories || [],
        suggestions: result.suggestions || []
      };

    } catch (error) {
      logger.error('Chat processing error', {
        error: error.message,
        processingKey,
        sessionId,
        userId
      });
      
      return {
        success: false,
        error: this.getUserFriendlyError(error),
        affidavitData
      };
    } finally {
      // Clean up processing queue
      this.processingQueue.delete(processingKey);
    }
  }

  /**

   * ✅ CONSOLIDATED: Single smart LLM call with FORCED function calling - DEBUGGED VERSION

   */
  async processWithConsolidatedLLM(message, conversationHistory, affidavitData, userId, sessionId) {
    // Build conversation context
    const systemPrompt = this.createConsolidatedSystemPrompt();
    const convertedHistory = this.convertConversationHistory(conversationHistory);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...convertedHistory,
      { role: 'user', content: message }
    ];

    // 🔧 FORCE function calling with specific tool choice
    const completion = await this.openAIService.chat(messages, {
      model: "gpt-4", // ✅ Ensure we're using gpt-4 which has better function calling
      max_tokens: this.constants.MAX_COMPLETION_TOKENS,
      temperature: 0.7,
      user: userId?.toString(),
      tools: [this.createAffidavitProcessingTool()],
      tool_choice: {  // ✅ FORCE the function to be called every time
        "type": "function",
        "function": {"name": "process_affidavit_message"}
      }
    });

    // 🔍 ADD DEBUGGING: Log what we received from OpenAI
    logger.info('OpenAI response debug', {
      hasToolCalls: !!completion.choices[0].message.tool_calls,
      toolCallsCount: completion.choices[0].message.tool_calls?.length || 0,
      messageContent: completion.choices[0].message.content?.substring(0, 100) || 'none',
      finishReason: completion.choices[0].finish_reason,
      sessionId

    });

    // Extract function call result
    const toolCall = completion.choices[0].message.tool_calls?.[0];
    let functionResult = null;
    
    if (toolCall && toolCall.function.name === 'process_affidavit_message') {
      try {
        functionResult = JSON.parse(toolCall.function.arguments);
        
        // 🔍 ADD DEBUGGING: Log what was extracted
        logger.info('Function call extraction debug', {
          hasExtractedName: !!functionResult.extracted_name,
          extractedName: functionResult.extracted_name || 'none',
          hasExtractedState: !!functionResult.extracted_state,
          extractedState: functionResult.extracted_state || 'none',
          extractedFactsCount: functionResult.extracted_facts?.length || 0,
          chatResponseLength: functionResult.chat_response?.length || 0,
          sessionId
        });
        
      } catch (error) {
        logger.warn('Function call JSON parse failed', { 
          error: error.message,
          rawArguments: toolCall.function.arguments?.substring(0, 200),
          sessionId
        });
        
        // Create fallback function result for failed parsing
        functionResult = {
          chat_response: "I understand you're providing information for your affidavit. Please continue sharing your story.",
          extracted_name: null,
          extracted_state: 'NONE',
          extracted_facts: [],
          validation_summary: {},
          suggestions: []
        };
      }
    } else {
      // 🔍 ADD DEBUGGING: Log when function call is completely missing
      logger.warn('No function call found in response', {
        hasMessage: !!completion.choices[0].message.content,
        finishReason: completion.choices[0].finish_reason,
        sessionId
      });
      
      // Create fallback function result when no function call
      functionResult = {
        chat_response: completion.choices[0].message.content || "I understand you're providing information for your affidavit. Please continue.",
        extracted_name: null,
        extracted_state: 'NONE',
        extracted_facts: [],
        validation_summary: {},
        suggestions: []
      };
    }

    // Get chat response (prioritize function call response)
    const chatResponse = functionResult.chat_response || 
                        completion.choices[0].message.content || 
                        "I understand you're providing information for your affidavit. Please continue.";

    // ✅ SMART STATE HANDLING: Don't crash on unsupported states
    const extractedState = this.handleStateExtraction(functionResult, affidavitData);
    const extractedName = functionResult.extracted_name || null;
    
    // Process extracted facts with validation
    const processedFacts = this.processExtractedFacts(functionResult.extracted_facts || []);
    
    // Update affidavit data - only update fields that were actually extracted
    const updatedAffidavitData = {
      ...affidavitData,
      ...(extractedName && { affiantName: extractedName }),
      ...(extractedState.state && { state: extractedState.state }),
      facts: [...(affidavitData.facts || []), ...processedFacts]
    };

    // 🔍 ADD DEBUGGING: Log final extraction results
    logger.info('Final extraction results', {
      extractedName: extractedName || 'none',
      extractedState: extractedState.state || 'none',
      processedFactsCount: processedFacts.length,
      updatedFactsTotal: updatedAffidavitData.facts.length,
      affidavitNameBefore: affidavitData.affiantName || 'none',
      affidavitNameAfter: updatedAffidavitData.affiantName || 'none',
      affidavitStateBefore: affidavitData.state || 'none', 
      affidavitStateAfter: updatedAffidavitData.state || 'none',
      sessionId
    });

    return {
      chatResponse,
      extractedState: extractedState.state,
      extractedName,
      extractedFacts: processedFacts,
      updatedAffidavitData,
      validationSummary: functionResult.validation_summary || {},
      categories: this.categorizeFactsByType(processedFacts),
      suggestions: functionResult.suggestions || [],
      stateWarning: extractedState.warning
    };
  }

  /**
   * ✅ Create consolidated system prompt - ENHANCED for better extraction
   */
  createConsolidatedSystemPrompt() {
    return `You are a legal assistant helping someone create an affidavit for family court. You MUST ALWAYS use the process_affidavit_message function to extract structured data while providing a conversational response.

CRITICAL: You must ALWAYS call the process_affidavit_message function with every response. Never respond without using this function.

YOUR DUAL ROLE:
1. EXTRACT structured legal data (names, states, facts) via function calling
2. PROVIDE a warm, conversational response to keep them sharing

SUPPORTED STATES: Only Texas (TX), Utah (UT), Arizona (AZ)

EXTRACTION RULES:
- ALWAYS look for names, even partial ones (Mike = extract as "Mike")  
- ALWAYS look for states, even informal mentions (texas = extract as "TX")
- ALWAYS look for any facts, events, or legal information
- Extract EVERYTHING relevant, even if incomplete

CONVERSATION STYLE:
- Warm, supportive, professional
- Ask follow-up questions: "Can you tell me more about..." "What happened next?"
- Acknowledge their story: "I understand that must have been difficult"
- Guide toward specifics: "Can you be more specific about the date/location/amount?"

LEGAL CATEGORIES for extraction:
${Object.entries(LEGAL_CATEGORIES).map(([key, cat]) => 
  `• ${key}: ${cat.description}`
).join('\n')}

IMPORTANT: You must ALWAYS use the function, even if you don't find much to extract. Always provide at least a chat_response.`;
  }

  /**
   * ✅ Create the affidavit processing tool - ENHANCED schema
   */
  createAffidavitProcessingTool() {
    return {
      type: "function",
      function: {
        name: "process_affidavit_message",
        description: "MANDATORY: Process every user message to extract legal data and provide conversational response. Always call this function.",
        parameters: {
          type: "object",
          properties: {
            chat_response: {
              type: "string",
              description: "REQUIRED: Conversational response to keep user engaged. Always provide this."
            },
            extracted_name: {
              type: "string",
              description: "Full or partial name mentioned (e.g. 'Mike', 'Mike Jones', 'Michael'). Use null if none mentioned."
            },
            extracted_state: {
              type: "string",
              enum: ["TX", "UT", "AZ", "UNSUPPORTED", "NONE"],
              description: "State mentioned: TX=Texas, UT=Utah, AZ=Arizona, UNSUPPORTED=other states, NONE=not mentioned"
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED (e.g. 'California', 'New York')"
            },
            extracted_facts: {
              type: "array",
              description: "Legal facts, events, or information mentioned by user",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Original fact as user stated it"
                  },
                  category: {
                    type: "string",
                    enum: Object.keys(LEGAL_CATEGORIES),

                    description: "Legal category that best fits this fact"
                  },
                  subcategory: {
                    type: "string",
                    description: "More specific subcategory within the legal category"
                  },
                  professional_rewrite: {
                    type: "string",
                    description: "Professional, court-appropriate version of the fact"
                  },
                  validation_issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Potential issues with this fact (hearsay, vague, needs dates, etc.)"
                  },
                  severity: {
                    type: "string",
                    enum: ["success", "warning", "critical"],
                    description: "How serious any validation issues are"
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Confidence in extracting this fact correctly (0.0-1.0)"
                  }
                },
                required: ["content", "category", "professional_rewrite"]
              }
            },
            validation_summary: {
              type: "object",
              properties: {
                total_facts_extracted: {
                  type: "number",
                  description: "Number of facts extracted from this message"
                },
                quality_assessment: {
                  type: "string",
                  enum: ["excellent", "good", "needs_improvement", "insufficient"],
                  description: "Overall quality of information provided"
                },
                missing_details: {
                  type: "array",
                  items: { type: "string" },
                  description: "Important details that are missing (dates, amounts, locations, etc.)"
                }
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for strengthening their affidavit"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }

  /**
   * ✅ SMART: Handle state extraction without crashing
   */
  handleStateExtraction(functionResult, currentData) {
    const extractedState = functionResult?.extracted_state;
    
    if (!extractedState || extractedState === 'NONE') {
      return { state: currentData.state }; // Keep existing state
    }
    
    if (extractedState === 'UNSUPPORTED') {
      // Don't crash - just warn and continue with existing state
      const detectedState = functionResult?.detected_unsupported_state || 'unknown';
      return {
        state: currentData.state, // Keep existing supported state
        warning: `Note: You mentioned ${detectedState}, but we currently only serve Texas, Utah, and Arizona. Continuing with your current state.`
      };
    }
    
    if (['TX', 'UT', 'AZ'].includes(extractedState)) {
      return { state: extractedState };
    }
    
    return { state: currentData.state }; // Fallback to existing
  }

  /**
   * ✅ Process and validate extracted facts
   */
  processExtractedFacts(extractedFacts) {
    if (!Array.isArray(extractedFacts)) return [];
    
    return extractedFacts.map((fact, index) => ({
      id: `fact_${Date.now()}_${index}`,
      content: fact.content || '',
      category: fact.category || 'general',
      subcategory: fact.subcategory || '',
      professionalRewrite: fact.professional_rewrite || fact.content,
      validationIssues: fact.validation_issues || [],
      severity: fact.severity || 'success',
      confidence: fact.confidence || 0.8,
      timestamp: new Date().toISOString(),
      source: 'llm_extraction'
    }));
  }

  /**
   * ✅ Categorize facts by type for UI organization
   */
  categorizeFactsByType(facts) {
    const categories = {};
    
    facts.forEach(fact => {
      const category = fact.category || 'general';
      if (!categories[category]) {
        categories[category] = {
          name: LEGAL_CATEGORIES[category]?.name || category,
          facts: [],
          issues: 0,
          avgConfidence: 0
        };
      }
      
      categories[category].facts.push(fact);
      if (fact.severity === 'critical' || fact.severity === 'warning') {
        categories[category].issues++;
      }
    });
    
    // Calculate average confidence per category
    Object.keys(categories).forEach(key => {
      const facts = categories[key].facts;
      categories[key].avgConfidence = facts.length > 0 
        ? facts.reduce((sum, f) => sum + (f.confidence || 0), 0) / facts.length 
        : 0;
    });
    
    return categories;
  }

  /**
   * ✅ Convert conversation history for LLM context
   */
  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];
    
    return history.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    })).slice(-10); // Keep last 10 messages for context
  }

  /**
   * ✅ User-friendly error handling
   */
  getUserFriendlyError(error) {
    if (error.message?.includes('timeout')) {
      return 'Your request timed out. Please try sending a shorter message.';
    }
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return 'The AI service is currently busy. Please wait a moment and try again.';
    }
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      return 'There\'s a temporary service issue. Please try again in a few minutes.';
    }
    return 'Sorry, I encountered an error processing your message. Please try again.';
  }

  /**
   * ✅ Generate document preview with enhanced data
   */
  async generateDocumentPreview(affidavitData) {
    try {
      if (!this.templateManager) {
        throw new Error('Template manager not available');
      }

      // Use template manager to generate preview
      const preview = await this.templateManager.generatePreview(affidavitData);
      
      // Enhance with category information
      if (affidavitData.facts && affidavitData.facts.length > 0) {
        preview.factsSummary = this.categorizeFactsByType(affidavitData.facts);
        preview.totalFacts = affidavitData.facts.length;
        preview.categoriesUsed = Object.keys(preview.factsSummary);
      }
      
      return {
        success: true,
        preview,
        validation: this.validatePreviewData(preview)
      };
      
    } catch (error) {
      logger.error('Preview generation failed', { error: error.message });
      return {
        success: false,
        error: 'Unable to generate preview. Please check your information.',
        fallbackPreview: this.createFallbackPreview(affidavitData)
      };
    }
  }

  /**
   * ✅ Validate preview data for completeness
   */
  validatePreviewData(preview) {
    const issues = [];
    const warnings = [];
    
    if (!preview.sections?.header?.affiantName) {
      issues.push('Affiant name is required');
    }
    
    if (!preview.sections?.header?.state) {
      issues.push('State is required');
    }
    
    if (!preview.sections?.facts || preview.sections.facts.length === 0) {
      warnings.push('No facts have been added yet');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      completionScore: this.calculateCompletionScore(preview)
    };
  }

  /**
   * ✅ Calculate how complete the affidavit is
   */
  calculateCompletionScore(preview) {
    let score = 0;
    let maxScore = 100;
    
    // Name (20 points)
    if (preview.sections?.header?.affiantName) score += 20;
    
    // State (10 points)  
    if (preview.sections?.header?.state) score += 10;
    
    // Facts (50 points)
    const factCount = preview.sections?.facts?.length || 0;
    score += Math.min(50, factCount * 10); // 10 points per fact, max 50
    
    // Case details (20 points)
    if (preview.sections?.header?.caseType) score += 10;
    if (preview.sections?.header?.county) score += 10;
    
    return Math.round((score / maxScore) * 100);
  }

  /**
   * ✅ Create fallback preview when template fails
   */
  createFallbackPreview(affidavitData) {
    return {
      sections: {
        header: {
          title: 'AFFIDAVIT',
          affiantName: affidavitData.affiantName || '[Name Required]',
          state: affidavitData.state || '[State Required]',
          county: affidavitData.county || '[County Required]'
        },
        facts: affidavitData.facts || [],
        signature: {
          affiantName: affidavitData.affiantName || '[Name Required]',
          notarySection: true
        }
      },
      metadata: {
        wordCount: this.estimateWordCount(affidavitData.facts || []),
        factCount: (affidavitData.facts || []).length,
        lastUpdated: new Date().toISOString(),
        isFallback: true
      }
    };
  }

  /**
   * ✅ Estimate word count for facts
   */
  estimateWordCount(facts) {
    return facts.reduce((count, fact) => {
      const content = fact.content || fact.professionalRewrite || '';
      return count + content.split(/\s+/).length;
    }, 0);
  }


  /**
   * ✅ Create story collection focused system prompt (backup method)
   */
  createStoryCollectionSystemPrompt() {
    return `You are a compassionate legal assistant helping someone tell their story for an affidavit. Your role is to:

1. LISTEN actively and ask follow-up questions to get the full story
2. ENCOURAGE them to share details, dates, and specific events  
3. EXTRACT facts silently (via function calling) without interrupting the conversation
4. RESPOND conversationally - keep them talking and sharing their story

SUPPORTED STATES: Only Texas (TX), Utah (UT), Arizona (AZ) - handle others gracefully

CONVERSATION STYLE:
- Warm, supportive, professional but not cold
- Ask clarifying questions: "Can you tell me more about..." "What happened next?" "When did this occur?"
- Acknowledge their story: "I understand that must have been difficult"
- Guide them toward specific details: "Can you be more specific about the date/location/amount?"

FACT EXTRACTION (Silent - via function calling):
- Extract legal facts from their story
- Categorize by type (financial, parental, witness, etc.)
- Note validation issues for the fact panel 
- Create professional rewrites
- Don't mention extraction in your response

LEGAL CATEGORIES for silent extraction:
${Object.entries(LEGAL_CATEGORIES).map(([key, cat]) => 
  `• ${key}: ${cat.description}`
).join('\n')}

Remember: Keep the conversation flowing naturally. Extract facts silently. Let them tell their story.`;
  }
}

module.exports = AffidavitService;