'use strict';

/**
 * TriageOrchestrator
 *
 * Sits at the front of the chat when no matter type has been identified yet.
 * Engages the user in a warm, open-ended conversation, classifies their legal
 * need into one of 17 matter types, and returns `matterTypeCode` in the
 * updated affidavitData.
 *
 * The chat router then routes subsequent messages to the correct matter
 * orchestrator, which starts at its own INTAKE phase. The full triage
 * conversation is preserved in conversationHistory so the matter orchestrator
 * has context from the start.
 *
 * Flow:
 *   Message 1: User describes situation → LLM classifies (or asks clarifying question)
 *   Message 2: (If clarification needed) User clarifies → LLM confirms + classifies
 *   Result: affidavitData.matterTypeCode is set
 *   Next message: chat.js routes to the specific matter orchestrator
 */

const logger = require('../../utils/logger');
const { TRIAGE_PROMPT, buildTriageTool } = require('./prompts/triage/index');

class TriageOrchestrator {
  constructor() {
    this.tool = buildTriageTool();
  }

  /**
   * Process a chat message during the triage phase.
   *
   * @param {string}   message             - Current user message
   * @param {Array}    conversationHistory - Prior messages
   * @param {Object}   matterData          - Current matter data (usually sparse at this point)
   * @param {string}   userId
   * @param {string}   sessionId
   * @returns {{ response, affidavitData, newFacts, orchestratorState }}
   */
  async processMessage(message, conversationHistory, matterData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) throw new Error('LLM service not available');

    logger.info('TriageOrchestrator: classifying matter type', {
      userId,
      sessionId,
      messageLength: message.length
    });

    // Inject country context so the LLM uses the right legal references
    const countryCode = matterData.countryCode || 'US';
    const countryHint = countryCode === 'CA'
      ? '\n[CONTEXT: This user is accessing from Canada. Use Canadian legal references, terminology, and resources.]'
      : '';

    const messages = [
      { role: 'system', content: TRIAGE_PROMPT + countryHint },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    const completion = await openAIService.chat(messages, {
      model:       process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      tools:       [this.tool],
      tool_choice: { type: 'function', function: { name: 'classify_matter_type' } },
      temperature: 0.4,
      max_tokens:  600
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('TriageOrchestrator: LLM did not call the required function');
    }

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error(`TriageOrchestrator: Failed to parse function arguments: ${e.message}`);
    }

    const { response, phase_complete, matter_type_code, confidence } = extracted;

    const updatedData = { ...matterData };

    if (phase_complete && matter_type_code) {
      updatedData.matterTypeCode = matter_type_code;

      // Divorce: the divorce orchestrators are keyed by documentType, not matterTypeCode.
      // Setting documentType here ensures getOrchestrator() picks them up correctly.
      if (matter_type_code === 'divorce') {
        updatedData.documentType = 'divorce_package';
      }

      // general_affidavit: route to GeneralAffidavitOrchestrator. The registry
      // uses 'general_affidavit' as the ID (not 'affidavit'), so set that value.
      if (matter_type_code === 'general_affidavit') {
        updatedData.documentType = updatedData.documentType || 'general_affidavit';
      }

      logger.info('TriageOrchestrator: matter type classified', {
        matterTypeCode: matter_type_code,
        confidence,
        userId,
        sessionId
      });
    } else {
      logger.info('TriageOrchestrator: awaiting clarification', {
        confidence,
        userId,
        sessionId
      });
    }

    // Preserve triage orchestrator state so subsequent messages before
    // the matter is classified still route back here, not to a matter orchestrator.
    updatedData.orchestratorState = {
      ...(matterData.orchestratorState || {}),
      triageComplete: phase_complete && !!matter_type_code,
      triageConfidence: confidence,
      matterTypeCode: matter_type_code || null
    };

    return {
      response,
      affidavitData: updatedData,
      newFacts: [],
      orchestratorState: updatedData.orchestratorState
    };
  }
}

module.exports = new TriageOrchestrator();
