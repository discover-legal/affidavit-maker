// affidavitService.js - CONSOLIDATED LLM APPROACH
// Replaces multiple LLM calls with single smart function calling
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
   * ✅ CONSOLIDATED: Single smart LLM call with function calling
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

    // ✅ SINGLE LLM CALL with function calling
    const completion = await this.openAIService.chat(messages, {
      max_tokens: this.constants.MAX_COMPLETION_TOKENS,
      temperature: 0.7,
      user: userId?.toString(),
      tools: [this.createAffidavitProcessingTool()],
      tool_choice: "auto"
    });

    // Extract function call result
    const toolCall = completion.choices[0].message.tool_calls?.[0];
    let functionResult = null;
    
    if (toolCall && toolCall.function.name === 'process_affidavit_message') {
      try {
        functionResult = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        logger.warn('Function call JSON parse failed, using fallback', { error: error.message });
      }
    }

    // Get chat response (either from function call or direct message)
    const chatResponse = functionResult?.chat_response || 
                        completion.choices[0].message.content || 
                        "I understand you're providing information for your affidavit. Please continue.";

    // ✅ SMART STATE HANDLING: Don't crash on unsupported states
    const extractedState = this.handleStateExtraction(functionResult, affidavitData);
    const extractedName = functionResult?.extracted_name || affidavitData.affiantName;
    
    // Process extracted facts with validation
    const processedFacts = this.processExtractedFacts(functionResult?.extracted_facts || []);
    
    // Update affidavit data
    const updatedAffidavitData = {
      ...affidavitData,
      ...(extractedName && { affiantName: extractedName }),
      ...(extractedState.state && { state: extractedState.state }),
      facts: [...(affidavitData.facts || []), ...processedFacts]
    };

    return {
      chatResponse,
      extractedState: extractedState.state,
      extractedName,
      extractedFacts: processedFacts,
      updatedAffidavitData,
      validationSummary: functionResult?.validation_summary || {},
      categories: this.categorizeFactsByType(processedFacts),
      suggestions: functionResult?.suggestions || [],
      stateWarning: extractedState.warning
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
   * ✅ Create story collection focused system prompt
   */
  createStoryCollectionSystemPrompt() {
    return `You are a compassionate legal assistant helping someone tell their story for an affidavit. Your role is to:

1. LISTEN actively and ask follow-up questions to get the full story
2. ENCOURAGE them to share details, dates, and specific events  
3. EXTRACT facts silently (via function calling) without interrupting the conversation
4. RESPOND conversationally - keep them talking and sharing their story

SUPPORTED STATES: Only Texas (TX), Utah (AZ), Arizona (AZ) - handle others gracefully

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

  /**
   * ✅ Create fact extraction tool (focused on silent extraction)
   */
  createFactExtractionTool() {
    return {
      type: "function",
      function: {
        name: "extract_facts_from_story",
        description: "Silently extract legal facts from user's story while providing conversational response",
        parameters: {
          type: "object", 
          properties: {
            extracted_name: {
              type: "string",
              description: "Full legal name if mentioned"
            },
            extracted_state: {
              type: "string", 
              enum: ["TX", "UT", "AZ", "UNSUPPORTED", "NONE"],
              description: "State abbreviation, UNSUPPORTED for others, NONE if not mentioned"
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if UNSUPPORTED selected"  
            },
            extracted_facts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Original fact as stated by user"
                  },
                  category: {
                    type: "string",
                    enum: Object.keys(LEGAL_CATEGORIES),
                    description: "Primary legal category"
                  },
                  subcategory: {
                    type: "string", 
                    description: "Specific subcategory"
                  },
                  professional_rewrite: {
                    type: "string",
                    description: "Professional, court-ready version for fact panel"
                  },
                  validation_issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Issues for fact validation panel"
                  },
                  severity: {
                    type: "string",
                    enum: ["critical", "warning", "info", "success"],
                    description: "Issue severity for fact panel"
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Extraction confidence"
                  },
                  legal_weight: {
                    type: "string", 
                    enum: ["high", "medium", "low"],
                    description: "Legal importance of this fact"
                  },
                  requires_clarification: {
                    type: "boolean",
                    description: "Whether this fact needs more details"
                  }
                },
                required: ["content", "category", "professional_rewrite", "confidence"]
              }
            },
            validation_data: {
              type: "object",
              properties: {
                overall_story_strength: {
                  type: "number",
                  minimum: 0,
                  maximum: 10,
                  description: "Overall strength of the story for legal purposes"
                },
                missing_details: {
                  type: "array", 
                  items: { type: "string" },
                  description: "Important details that are missing"
                },
                suggested_follow_ups: {
                  type: "array",
                  items: { type: "string" }, 
                  description: "Questions to ask to strengthen the case"
                }
              }
            },
            conversation_notes: {
              type: "object",
              properties: {
                case_type_detected: {
                  type: "string",
                  enum: ["custody", "divorce", "support", "paternity", "modification", "general"],
                  description: "Type of case based on story"
                },
                emotional_state: {
                  type: "string",
                  enum: ["calm", "upset", "angry", "confused", "determined"],
                  description: "User's emotional state for appropriate response"
                },
                story_completeness: {
                  type: "number",
                  minimum: 0,
                  maximum: 100,
                  description: "How complete their story seems"
                }
              }
            }
          },
          required: []
        }
      }
    };
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
}

module.exports = AffidavitService;