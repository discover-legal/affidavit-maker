// services/affidavitService.js - Thin facade delegating to modular components
const logger = require('../utils/logger');
const courtNameService = require('./courtNameService');
const PromptBuilder = require('./llm/PromptBuilder');
const ToolDefinitions = require('./llm/ToolDefinitions');
const LLMOrchestrator = require('./llm/LLMOrchestrator');
const AffidavitToolProcessor = require('./processors/AffidavitToolProcessor');
const DivorceToolProcessor = require('./processors/DivorceToolProcessor');

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

    // Get dynamically supported states from template manager
    this.supportedStates = this.getSupportedStatesList();

    // Initialize modules
    this.promptBuilder = new PromptBuilder(this.supportedStates);
    this.toolDefinitions = new ToolDefinitions(this.supportedStates);
    this.affidavitProcessor = new AffidavitToolProcessor(courtNameService);
    this.divorceProcessor = new DivorceToolProcessor(courtNameService);
    this.llmOrchestrator = new LLMOrchestrator({
      openAIService: this.openAIService,
      promptBuilder: this.promptBuilder,
      toolDefinitions: this.toolDefinitions,
      affidavitProcessor: this.affidavitProcessor,
      divorceProcessor: this.divorceProcessor,
      constants: this.constants
    });
  }

  /**
   * Get list of supported states from template manager
   * @returns {Array} Array of {code, name} objects
   */
  getSupportedStatesList() {
    try {
      const states = this.templateManager.getSupportedStates();
      return states.map(s => ({ code: s.code, name: s.name }));
    } catch (error) {
      logger.error('Failed to get supported states, using fallback:', error);
      // Fallback to default states
      return [
        { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' },
        { code: 'AZ', name: 'Arizona' }
      ];
    }
  }

  /**
   * Main processing with county & case caption collection
   */
  async processMessage(message, conversationHistory = [], affidavitData = {}, userId = null, sessionId = null, skipExtraction = false) {
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

      // Include existing facts to prevent duplicates
      const existingFactsSummary = this.formatExistingFacts(affidavitData.facts || []);

      // Call consolidated LLM with existing facts context
      const result = await this.llmOrchestrator.callConsolidatedLLM(
        message,
        recentHistory,
        affidavitData,
        existingFactsSummary,
        sessionId,
        skipExtraction
      );

      return {
        success: true,
        response: result.chatResponse,
        affidavitData: result.updatedAffidavitData,
        newFacts: result.extractedFacts,
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
   * Format existing facts for LLM to see
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
   * Convert conversation history
   */
  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];

    return history.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    })).slice(-10);
  }

  /**
   * User-friendly error messages
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
}

module.exports = AffidavitService;
