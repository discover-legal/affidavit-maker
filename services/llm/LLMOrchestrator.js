// services/llm/LLMOrchestrator.js - LLM call orchestration
const logger = require('../../utils/logger');

class LLMOrchestrator {
  constructor({ openAIService, promptBuilder, toolDefinitions, affidavitProcessor, divorceProcessor, constants }) {
    this.openAIService = openAIService;
    this.promptBuilder = promptBuilder;
    this.toolDefinitions = toolDefinitions;
    this.affidavitProcessor = affidavitProcessor;
    this.divorceProcessor = divorceProcessor;
    this.constants = constants;
  }

  /**
   * Consolidated LLM call - supports both affidavit and divorce documents
   */
  async callConsolidatedLLM(message, conversationHistory, affidavitData, existingFactsSummary, sessionId, skipExtraction = false) {
    // If skipExtraction is true, use simple chat without function calling
    if (skipExtraction) {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant that provides concise, narrative summaries.' },
        { role: 'user', content: message }
      ];

      try {
        const completion = await this.openAIService.chat(messages, {
          model: 'gpt-4o-2024-08-06',
          temperature: 0.5,
          max_tokens: 500
        });

        const response = completion.choices[0].message.content;

        return {
          chatResponse: response,
          updatedAffidavitData: affidavitData,
          extractedFacts: [],
          hasNewData: false
        };
      } catch (error) {
        logger.error('Simple LLM call failed:', error);
        throw error;
      }
    }

    // Detect document type - check for divorce_petition, divorce_decree, or divorce_package
    const documentType = affidavitData.documentType || affidavitData.document_type || 'general';
    const isDivorceDocument = documentType === 'divorce_petition' ||
                              documentType === 'divorce_decree' ||
                              documentType === 'divorce_package';

    // Select appropriate prompts and tools based on document type
    let systemPrompt, userPrompt, tools, functionName;

    if (isDivorceDocument) {
      systemPrompt = this.promptBuilder.createDivorceSystemPrompt();
      userPrompt = this.promptBuilder.createDivorceUserPrompt(message, affidavitData, existingFactsSummary);
      tools = [this.toolDefinitions.createDivorceProcessingTool()];
      functionName = 'process_divorce_message';

      logger.info('Using divorce document processing', { documentType, sessionId });
    } else {
      systemPrompt = this.promptBuilder.createConsolidatedSystemPrompt();
      userPrompt = this.promptBuilder.createUserPrompt(message, affidavitData, existingFactsSummary);
      tools = [this.toolDefinitions.createAffidavitProcessingTool()];
      functionName = 'process_affidavit_message';

      logger.info('Using affidavit document processing', { documentType, sessionId });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userPrompt }
    ];

    try {
      const completion = await this.openAIService.chat(messages, {
        model: 'gpt-4o-2024-08-06',
        tools,
        tool_choice: { type: "function", function: { name: functionName } },
        temperature: 0.3,
        max_tokens: this.constants.MAX_COMPLETION_TOKENS
      });

      const toolCall = completion.choices[0].message.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('LLM did not call the required function');
      }

      const functionResult = JSON.parse(toolCall.function.arguments);

      // Log extraction results based on document type
      if (isDivorceDocument) {
        logger.info('Divorce function call extraction', {
          hasPetitionerFirstName: !!functionResult.petitioner_first_name,
          hasPetitionerLastName: !!functionResult.petitioner_last_name,
          hasRespondentFirstName: !!functionResult.respondent_first_name,
          hasState: !!functionResult.extracted_state,
          hasCounty: !!functionResult.extracted_county,
          hasMarriageDate: !!functionResult.marriage_date,
          hasChildren: !!functionResult.has_minor_children,
          factsCount: functionResult.extracted_facts?.length || 0,
          sessionId
        });

        return this.divorceProcessor.processDivorceToolCall(functionResult, affidavitData);
      } else {
        logger.info('Affidavit function call extraction', {
          hasFirstName: !!functionResult.extracted_first_name,
          hasLastName: !!functionResult.extracted_last_name,
          hasState: !!functionResult.extracted_state,
          hasCounty: !!functionResult.extracted_county,
          hasCaseNumber: !!functionResult.case_number,
          factsCount: functionResult.extracted_facts?.length || 0,
          sessionId
        });

        return this.affidavitProcessor.processToolCall(functionResult, affidavitData);
      }

    } catch (error) {
      logger.error('LLM call failed:', error);
      throw error;
    }
  }
}

module.exports = LLMOrchestrator;
