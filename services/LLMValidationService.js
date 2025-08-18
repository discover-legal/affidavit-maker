// services/LLMValidationService.js
const { ResilientOpenAIService } = require('./ResilientOpenAIService');
const { StateTemplateManager } = require('../templates/StateTemplateManager');
const logger = require('./logger');

class LLMValidationService {
  constructor() {
    this.openAIService = new ResilientOpenAIService();
    this.templateManager = new StateTemplateManager();
    this.validationCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 15 * 60 * 1000); // 15 minutes
  }
  
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.validationCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.validationCache.delete(key);
      }
    }
  }
  
  /**
   * Get cache key for validation request
   */
  getCacheKey(affidavitData) {
    const relevantData = {
      state: affidavitData.state,
      affiantName: affidavitData.affiantName,
      facts: affidavitData.facts,
      county: affidavitData.county
    };
    
    return JSON.stringify(relevantData);
  }
  
  /**
   * Comprehensive validation using LLM and template rules
   * @param {Object} affidavitData Document data
   * @returns {Object} Validation results
   */
  async validateAffidavit(affidavitData) {
    try {
      // First run template-based validation
      const templateValidation = this.templateManager.validateDocument(affidavitData);
      
      // If critical errors, return early
      if (templateValidation.errors.length > 0) {
        return templateValidation;
      }
      
      // Check cache for LLM validation
      const cacheKey = this.getCacheKey(affidavitData);
      const cachedResult = this.validationCache.get(cacheKey);
      
      if (cachedResult) {
        logger.info('Using cached LLM validation result');
        return {
          ...templateValidation,
          ...cachedResult.result,
          cached: true
        };
      }
      
      // Perform LLM-based validation
      const llmValidation = await this.performLLMValidation(affidavitData);
      
      // Cache result
      this.validationCache.set(cacheKey, {
        timestamp: Date.now(),
        result: llmValidation
      });
      
      // Combine results
      return {
        ...templateValidation,
        ...llmValidation,
        isValid: templateValidation.isValid && llmValidation.isValid
      };
    } catch (error) {
      logger.error('Validation error', { error: error.message });
      
      // Fallback to template validation only
      return this.templateManager.validateDocument(affidavitData);
    }
  }
  
  /**
   * Perform LLM-based validation
   * @param {Object} affidavitData Document data
   * @returns {Object} LLM validation results
   */
  async performLLMValidation(affidavitData) {
    try {
      const { state, affiantName, facts } = affidavitData;
      
      if (!facts || !Array.isArray(facts) || facts.length === 0) {
        return {
          isValid: false,
          errors: ['No facts provided'],
          warnings: [],
          llmAnalysis: null
        };
      }
      
      // Create validation prompt
      const validationPrompt = `
You are a legal expert specializing in affidavits for ${state || 'the United States'}. 
Analyze the following affidavit facts and provide a detailed assessment of their legal validity.

AFFIANT: ${affiantName || 'Unnamed'}

FACTS:
${facts.map((fact, i) => `${i+1}. ${fact}`).join('\n')}

Analyze these statements and provide:
1. Overall validity: Are these statements appropriate for a legal affidavit?
2. Specific issues: Identify problematic statements (if any)
3. Improvement suggestions: How can these statements be improved?
4. Categorization: Label each fact as "Personal Knowledge", "Hearsay", "Opinion", or "Factual"

Return your analysis as a JSON object with this structure:
{
  "isValid": boolean,
  "errors": [list of critical issues that must be fixed],
  "warnings": [list of potential issues that should be considered],
  "factAnalysis": [
    {
      "factIndex": number,
      "category": "Personal Knowledge|Hearsay|Opinion|Factual",
      "issues": [list of issues with this fact],
      "suggestions": [list of improvement suggestions]
    }
  ],
  "overallAssessment": "brief summary of the affidavit quality"
}
`;

      // Call LLM for validation
      const completion = await this.openAIService.createChatCompletion([
        { role: "user", content: validationPrompt }
      ], {
        model: "gpt-4",
        max_tokens: 1000,
        temperature: 0.2
      });

      const aiResponse = completion.choices[0].message.content.trim();
      
      // Parse JSON response
      try {
        const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        const analysis = JSON.parse(cleanResponse);
        
        return {
          isValid: analysis.isValid,
          errors: analysis.errors || [],
          warnings: analysis.warnings || [],
          llmAnalysis: {
            factAnalysis: analysis.factAnalysis || [],
            overallAssessment: analysis.overallAssessment || ''
          }
        };
      } catch (parseError) {
        logger.error('Failed to parse LLM validation response', {
          error: parseError.message,
          aiResponse
        });
        
        // Fallback to basic validation
        return {
          isValid: true,
          errors: [],
          warnings: ['LLM validation failed to parse. Using basic validation only.'],
          llmAnalysis: null
        };
      }
    } catch (error) {
      logger.error('LLM validation error', { error: error.message });
      
      // Fallback response
      return {
        isValid: true,
        errors: [],
        warnings: ['LLM validation unavailable. Using basic validation only.'],
        llmAnalysis: null
      };
    }
  }
}

// Export singleton instance
const llmValidationService = new LLMValidationService();

module.exports = {
  llmValidationService,
  LLMValidationService
};