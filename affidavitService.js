// affidavitService.js - COMPLETE FIXED VERSION
// Fixes: (1) Fact duplication (2) No automatic rewrites (3) LLM sees existing facts

const logger = require('./utils/logger');

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
      MAX_COMPLETION_TOKENS: 2000,
      MAX_CONVERSATION_MESSAGES: 20,
      CHAT_TIMEOUT: 30000
    };
  }

  /**
   * ✅ FIXED: Main processing with existing facts context
   */
  async processMessage(message, conversationHistory = [], affidavitData = {}, userId = null, sessionId = null) {
    const processingKey = `${userId || 'anonymous'}_${sessionId || 'session'}_${Date.now()}`;
    
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        return {
          success: false,
          error: "Please provide a message to process.",
          chatResponse: "I didn't receive a message. Could you please try again?"
        };
      }

      if (message.length > this.constants.MAX_MESSAGE_LENGTH) {
        return {
          success: false,
          error: "Message is too long. Please send shorter messages.",
          chatResponse: "That message is quite long. Could you break it into smaller parts?"
        };
      }

      // Clean up conversation history
      const recentHistory = this.convertConversationHistory(conversationHistory);

      // ✅ NEW: Include existing facts to prevent duplicates
      const existingFactsSummary = this.formatExistingFacts(affidavitData.facts || []);

      // Call consolidated LLM with existing facts context
      const result = await this.callConsolidatedLLM(
        message, 
        recentHistory, 
        affidavitData,
        existingFactsSummary,
        sessionId
      );

      return {
        success: true,
        response: result.chatResponse,  // ← Changed to "response"!
        affidavitData: result.updatedAffidavitData,  // ← Changed to "affidavitData"!
        newFacts: result.extractedFacts,  // ← Changed to "newFacts"!
        validation: result.validationSummary || {},
        categories: result.categories || [],
        suggestions: result.suggestions || []
      };

    } catch (error) {
      logger.error('AffidavitService.processMessage error:', {
        error: error.message,
        stack: error.stack,
        sessionId
      });

      return {
        success: false,
        error: this.getUserFriendlyError(error),
        chatResponse: this.getUserFriendlyError(error)
      };
    }
  }

  /**
   * ✅ NEW: Format existing facts for LLM to see
   */
  formatExistingFacts(facts) {
    if (!facts || facts.length === 0) {
      return "No facts have been added yet.";
    }

    return `EXISTING FACTS (${facts.length} total):
${facts.map((fact, index) => {
  const content = typeof fact === 'string' ? fact : (fact.content || '');
  return `${index + 1}. ${content}`;
}).join('\n')}

IMPORTANT: Do NOT extract facts that are already captured above. Only extract NEW information that hasn't been mentioned yet.`;
  }

  /**
   * ✅ NEW: Create user prompt with existing facts
   */
  createUserPrompt(message, affidavitData, existingFactsSummary) {
    return `USER MESSAGE: "${message}"

CURRENT AFFIDAVIT STATUS:
- Name: ${affidavitData.affiantName || 'Not provided'}
- State: ${affidavitData.state || 'Not selected'}
- County: ${affidavitData.county || 'Not provided (ask if needed for this state)'}

${existingFactsSummary}

CRITICAL INSTRUCTION: Only extract NEW facts that are NOT already in the existing facts list above. If the user is clarifying or expanding on an existing fact, include the additional detail as a new fact with context.`;
  }

  /**
   * ✅ MODIFIED: Consolidated LLM call
   */
  async callConsolidatedLLM(message, conversationHistory, affidavitData, existingFactsSummary, sessionId) {
    const systemPrompt = this.createConsolidatedSystemPrompt();
    const userPrompt = this.createUserPrompt(message, affidavitData, existingFactsSummary);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userPrompt }
    ];

    const tools = [this.createAffidavitProcessingTool()];

    try {
      const completion = await this.openAIService.chat(messages, {
        model: 'gpt-4o-2024-08-06',
        tools,
        tool_choice: { type: "function", function: { name: "process_affidavit_message" } },
        temperature: 0.3,
        max_tokens: this.constants.MAX_COMPLETION_TOKENS
      });

      logger.info('OpenAI response debug', {
        hasToolCalls: !!completion.choices[0].message.tool_calls,
        toolCallsCount: completion.choices[0].message.tool_calls?.length || 0,
        messageContent: completion.choices[0].message.content || 'none',
        finishReason: completion.choices[0].finish_reason,
        sessionId
      });

      const toolCall = completion.choices[0].message.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('LLM did not call the required function');
      }

      const functionResult = JSON.parse(toolCall.function.arguments);

      logger.info('Function call extraction debug', {
        hasExtractedName: !!functionResult.extracted_name,
        extractedName: functionResult.extracted_name || 'none',
        hasExtractedState: !!functionResult.extracted_state,
        extractedState: functionResult.extracted_state || 'none',
        extractedFactsCount: functionResult.extracted_facts?.length || 0,
        chatResponseLength: functionResult.chat_response?.length || 0,
        sessionId
      });

      if (!functionResult.chat_response) {
        return {
          chatResponse: "I understand you're providing information for your affidavit. Please continue.",
          extracted_name: null,
          extracted_state: 'NONE',
          extracted_facts: [],
          validation_summary: {},
          suggestions: []
        };
      }

      const chatResponse = functionResult.chat_response || 
                          completion.choices[0].message.content || 
                          "I understand you're providing information for your affidavit. Please continue.";

      const extractedState = this.handleStateExtraction(functionResult, affidavitData);
      const extractedName = functionResult.extracted_name || null;
      
      // ✅ FIXED: Process facts without automatic rewrite
      const processedFacts = this.processExtractedFacts(functionResult.extracted_facts || []);
      
      // ✅ FIXED: Only add NEW facts
      const updatedAffidavitData = {
        ...affidavitData,
        ...(extractedName && { affiantName: extractedName }),
        ...(extractedState.state && { state: extractedState.state }),
        facts: [...(affidavitData.facts || []), ...processedFacts]
      };

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

    } catch (error) {
      logger.error('Consolidated LLM call failed:', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }

  /**
   * ✅ Handle state extraction gracefully
   */
  handleStateExtraction(functionResult, currentData) {
    const extractedState = functionResult.extracted_state;
    
    if (extractedState === 'UNSUPPORTED') {
      const stateName = functionResult.detected_unsupported_state || 'that state';
      return {
        state: null,
        warning: `I noticed you mentioned ${stateName}. Currently, I can only help with affidavits for Texas (TX), Utah (UT), and Arizona (AZ). Would you like to continue with one of those states? I can still help you gather your information for now, and you can adapt it later if needed.`
      };
    }
    
    if (extractedState === 'NONE') {
      return {
        state: currentData.state,
        warning: null
      };
    }
    
    if (['TX', 'UT', 'AZ'].includes(extractedState)) {
      return { state: extractedState };
    }
    
    return { state: currentData.state };
  }

  /**
   * ✅ FIXED: Process facts WITHOUT automatic professional rewrite
   */
  processExtractedFacts(extractedFacts) {
    if (!Array.isArray(extractedFacts)) return [];
    
    return extractedFacts.map((fact, index) => ({
      id: `fact_${Date.now()}_${index}`,
      content: fact.content || '',
      category: fact.category || 'general',
      subcategory: fact.subcategory || '',
      professionalRewrite: null, // ✅ REMOVED automatic rewrite
      validationIssues: fact.validation_issues || [],
      severity: fact.severity || 'success',
      confidence: fact.confidence || 0.8,
      timestamp: new Date().toISOString(),
      source: 'llm_extraction',
      needsRewrite: false // Will be triggered manually via sparkle icon
    }));
  }

  /**
   * ✅ NEW: Generate professional rewrite on-demand (called by sparkle icon)
   */
  async generateProfessionalRewrite(fact, context = {}) {
    const prompt = `Rewrite this affidavit fact professionally for legal use:

FACT: "${fact.content || fact}"

CONTEXT:
- State: ${context.state || 'General'}
- Case Type: ${context.caseType || 'General'}
- Category: ${fact.category || 'general'}

Rewrite to be:
1. Professional and formal
2. Legally appropriate
3. Specific and clear
4. First-person where appropriate
5. Free of emotional language

Return ONLY the rewritten fact, no explanations.`;

    try {
      const completion = await this.openAIService.chat([
        { role: 'system', content: 'You are a legal document expert. Rewrite facts for affidavits professionally.' },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-2024-08-06',
        temperature: 0.2,
        max_tokens: 300
      });


      return completion.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Professional rewrite generation failed:', error);
      throw error;
    }
  }

  /**
   * ✅ Categorize facts by type
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
    
    Object.keys(categories).forEach(key => {
      const facts = categories[key].facts;
      categories[key].avgConfidence = facts.length > 0 
        ? facts.reduce((sum, f) => sum + (f.confidence || 0), 0) / facts.length 
        : 0;
    });
    
    return categories;
  }

  /**
   * ✅ Convert conversation history
   */
  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];
    
    return history.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    })).slice(-10);
  }

  /**
   * ✅ User-friendly error messages
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
   * ✅ MODIFIED: System prompt emphasizes no duplicates
   */
  createConsolidatedSystemPrompt() {
    return `You are a legal assistant helping someone create an affidavit for family court. You MUST ALWAYS use the process_affidavit_message function to extract structured data while providing a conversational response.

CRITICAL RULES:
1. You must ALWAYS call the process_affidavit_message function with every response
2. ONLY extract NEW facts - the user will provide you with existing facts
3. If information is already captured, acknowledge it but DON'T extract it again
4. Ask follow-up questions to get missing details (like county, dates, amounts)
5. Be warm and conversational while silently extracting data

YOUR DUAL ROLE:
1. EXTRACT structured legal data (names, states, NEW facts only) via function calling
2. PROVIDE a warm, conversational response to keep them sharing

SUPPORTED STATES: Only Texas (TX), Utah (UT), Arizona (AZ)

EXTRACTION RULES:
- ALWAYS look for names, even partial ones (Mike = extract as "Mike")  
- ALWAYS look for states, even informal mentions (texas = extract as "TX")
- ONLY extract NEW facts that aren't already in the existing facts list
- Extract EVERYTHING relevant that's NEW
- Ask about missing information (county, specific dates, amounts)

CONVERSATION STYLE:
- Warm, supportive, professional
- Ask follow-up questions: "Can you tell me more about..." "What happened next?"
- Acknowledge their story: "I understand that must have been difficult"
- Guide toward specifics: "Can you be more specific about the date/location/amount?"
- Request county if it's missing: "What county did this occur in?"

LEGAL CATEGORIES for extraction:
${Object.entries(LEGAL_CATEGORIES).map(([key, cat]) => 
  `• ${key}: ${cat.description}`
).join('\n')}

Remember: Only extract NEW information. Existing facts will be shown to you.`;
  }

  /**
   * ✅ Create the affidavit processing tool
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
              description: "Full or partial name mentioned (e.g. 'Mike', 'Mike Jones'). Use null if none mentioned."
            },
            extracted_state: {
              type: "string",
              enum: ["TX", "UT", "AZ", "UNSUPPORTED", "NONE"],
              description: "State mentioned: TX=Texas, UT=Utah, AZ=Arizona, UNSUPPORTED=other states, NONE=not mentioned"
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_facts: {
              type: "array",
              description: "ONLY NEW legal facts not in the existing facts list",
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
                    description: "More specific subcategory"
                  },
                  validation_issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Potential issues (hearsay, vague, needs dates)"
                  },
                  severity: {
                    type: "string",
                    enum: ["success", "info", "warning", "critical"],
                    description: "Severity of any issues"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence in extraction (0.0-1.0)"
                  }
                },
                required: ["content", "category"]
              }
            },
            validation_summary: {
              type: "object",
              description: "Overall validation summary",
              properties: {
                has_critical_issues: { type: "boolean" },
                total_issues: { type: "number" },
                completeness_score: { type: "number" }
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for the user"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }
}

module.exports = AffidavitService;
