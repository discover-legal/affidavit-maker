// services/EnhancedFactValidationService.js
/**
 * Final Hybrid Professional Fact Validation Service
 *
 * Combines a sophisticated, LLM-powered analysis engine with robust,
 * memory-safe caching, lifecycle management, and AI-driven duplicate detection.
 *
 * @version 5.0.0

 */

import logger from '../utils/logger.js'; // Assuming ESM logger utility

/**
 * A memory-safe, size-limited cache that evicts the least recently used items.
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {

      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

export const VALIDATION_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success'
};


/**
 * Legal fact categories with subcategories
 */
export const LEGAL_CATEGORIES = {
  financial: { name: 'Financial', subcategories: ['income', 'assets', 'debts', 'payments', 'support', 'expenses'], description: 'Money, assets, income, debts, financial obligations' },
  property: { name: 'Property', subcategories: ['real_estate', 'personal_property', 'vehicles', 'intellectual_property'], description: 'Real estate, personal property, vehicles, ownership' },
  relational: { name: 'Relationships', subcategories: ['family', 'custody', 'visitation', 'marriage', 'divorce'], description: 'Family relationships, custody, marriage, divorce' },
  temporal: { name: 'Chronological', subcategories: ['dates', 'timelines', 'sequences', 'duration'], description: 'Dates, times, chronological sequences' },
  witness: { name: 'Witness Testimony', subcategories: ['observations', 'conversations', 'events', 'actions'], description: 'Direct observations, witnessed events' },
  communication: { name: 'Communications', subcategories: ['verbal', 'written', 'electronic', 'legal_notices'], description: 'Conversations, emails, texts, legal notices' },
  behavioral: { name: 'Conduct/Behavior', subcategories: ['actions', 'patterns', 'violations', 'compliance'], description: 'Actions, behavior patterns, compliance' },
  procedural: { name: 'Legal Procedures', subcategories: ['service', 'notices', 'filings', 'hearings'], description: 'Legal process, service, court proceedings' },
  background: { name: 'Background Information', subcategories: ['identity', 'qualifications', 'context', 'relationships'], description: 'Identity, qualifications, background context' }
};


/**
 * Professional language standards for local analysis
 */
const LANGUAGE_STANDARDS = {
  offensiveWords: /\b(cunt|fuck|shit|bitch|asshole|damn|hell|piss|cock|dick|pussy|whore|slut|bastard|motherfucker|nigger|faggot|retard)\b/i,
  personalAttacks: /(hate|despise|loathe|can't stand|makes me sick).*(wife|husband|spouse|ex|mother|father|child|person)/i,
  inappropriateEmotional: /(i hate|i despise|i can't stand|makes me sick|disgusting person|piece of shit|worthless)/i,
  uncertainLanguage: /\b(maybe|probably|might|could be|i think|i believe|possibly|perhaps)\b/i,
  emotionalLanguage: /\b(terrible|horrible|awful|amazing|wonderful|devastating|fantastic|brilliant)\b/i,
  informalLanguage: /\b(kinda|sorta|like totally|whatever|anyway|stuff|things|gonna|wanna)\b/i,
  vagueQuantifiers: /\b(some|many|few|several|often|sometimes|around|about|approximately)\b/i,
  replacements: {
    'maybe': 'to my knowledge',
    'probably': 'it appears that',
    'i think': 'it is my understanding that',
    'i believe': 'it is my understanding that',
    'terrible': 'concerning',
    'awful': 'problematic',
    'amazing': 'notable',
    'wonderful': 'positive',
    'kinda': 'somewhat',
    'sorta': 'somewhat'
  }
};


  /**
 * Safe array converter - ensures value is always an array
 */
function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  if (value === null || value === undefined) return [];
  return [String(value)];
}


class EnhancedFactValidationService {



  constructor(openaiClient, language = 'en', cacheSize = 100) {
    this.openai = openaiClient;
    this.language = language;
    this.validationCache = new LRUCache(cacheSize);
    this.cacheCreatedAt = Date.now();
    this.rateLimit = {
      calls: 0,
      resetTime: Date.now() + 60000,
      maxCalls: 50 // Max calls per minute
    };

    this.cacheCleanupInterval = setInterval(() => this.cleanupCache(), 300000); // 5 minutes
    logger.info('✅ EnhancedFactValidationService initialized', {
      cacheSize,
      language,
      hasOpenAI: !!openaiClient
    });
  }


  /**
   * Cleans up resources used by the service instance.
   */
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.validationCache.clear();
    logger.info('EnhancedFactValidationService destroyed');
  }


  /**
   * Periodically clears the cache to prevent serving very stale data.
   */
  cleanupCache() {
    const cacheAge = Date.now() - this.cacheCreatedAt;
    if (cacheAge > 3600000) { // 1 hour
      this.validationCache.clear();
      this.cacheCreatedAt = Date.now();
      logger.debug('Validation cache cleared due to age');
    }
  }

  /**
   * Generates a consistent cache key from the fact and its context.
   */
  generateCacheKey(factText, context = {}) {
    const contextString = JSON.stringify({
      state: context.state,
      caseType: context.caseType,
      language: this.language
    });
    // Create a key from the text content and the context
    return `${factText.trim()}_${contextString}`;
  }

  /**
   * Pauses execution if the rate limit for the LLM API has been reached.
   */
  async respectRateLimit() {
    const now = Date.now();
    if (now > this.rateLimit.resetTime) {
      this.rateLimit.calls = 0;
      this.rateLimit.resetTime = now + 60000;
    }

    if (this.rateLimit.calls >= this.rateLimit.maxCalls) {
      const waitTime = this.rateLimit.resetTime - now;
      if (waitTime > 0) {
        logger.warn('Rate limit reached, waiting', { waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      // Reset after waiting
      this.rateLimit.calls = 0;
      this.rateLimit.resetTime = Date.now() + 60000;
    }

    this.rateLimit.calls++;
  }

  
  analyzeLanguageLocally(factText) {
    const issues = [];
    const suggestions = [];
    let score = 85;
    let severity = VALIDATION_SEVERITY.SUCCESS;
    
    // Check for offensive language
    const offensivePattern = /\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard|motherfucker|nigger|faggot|retard)\b/gi;
    if (offensivePattern.test(factText)) {
      issues.push('Contains inappropriate language for legal documents');
      severity = VALIDATION_SEVERITY.CRITICAL;
    }
    
    // Check for uncertain language
    const uncertainPattern = /\b(maybe|probably|might|i think|i believe|possibly|perhaps)\b/gi;
    if (uncertainPattern.test(factText)) {
      issues.push('Contains uncertain language - affidavits require definitive statements');
      suggestions.push('Replace uncertain phrases with definitive statements');
      if (severity === VALIDATION_SEVERITY.SUCCESS) {
        severity = VALIDATION_SEVERITY.WARNING;
      }

    }

    try {
      const localAnalysis = this.analyzeLanguageLocally(factText);

      if (localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL) {
        const result = this.buildCriticalResult(fact, localAnalysis);
        this.validationCache.set(cacheKey, result);
        return result;
      }

      if (!this.openai || factText.length < 20) {
          const fallbackResult = this.buildFallbackResult(fact, factText);
          this.validationCache.set(cacheKey, fallbackResult);
          return fallbackResult;
      }

      await this.respectRateLimit();
      const llmResult = await this.performLLMValidation(fact, existingFacts, context);
      const finalResult = this.combineAnalysisResults(localAnalysis, llmResult, fact);
      
      this.validationCache.set(cacheKey, finalResult);
      return finalResult;

    } catch (error) {
      logger.error('Professional fact validation failed', {
        error: error.message,
        factText: factText.substring(0, 50) + '...'
      });

      const fallbackResult = this.buildFallbackResult(fact, factText);
      this.validationCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    }
  }

  async validateFactsBatchProfessional(facts, context = {}) {
    if (!Array.isArray(facts) || facts.length === 0) {
      return this.buildEmptyBatchResult();
    }

    
    return {
      issues: ensureArray(issues), // ✅ FIXED
      suggestions: ensureArray(suggestions), // ✅ FIXED
      score: Math.max(0, Math.min(100, score)),
      severity,
      hasProblematicContent: severity === VALIDATION_SEVERITY.CRITICAL
    };
  }

  analyzeLanguageLocally(text) {
    const issues = [], suggestions = [];
    let score = 85, severity = VALIDATION_SEVERITY.SUCCESS;

    if (LANGUAGE_STANDARDS.offensiveWords.test(text)) {
      issues.push('CRITICAL: Contains offensive language inappropriate for legal documents');
      suggestions.push('Remove all profanity and offensive language.');
      score = 10;
      severity = VALIDATION_SEVERITY.CRITICAL;
    }
    if (LANGUAGE_STANDARDS.personalAttacks.test(text) || LANGUAGE_STANDARDS.inappropriateEmotional.test(text)) {
      issues.push('CRITICAL: Contains inappropriate personal attacks or emotional statements');
      suggestions.push('Focus on factual observations only.');
      score = Math.min(score, 15);
      severity = VALIDATION_SEVERITY.CRITICAL;
    }

    if (severity !== VALIDATION_SEVERITY.CRITICAL) {
      if (LANGUAGE_STANDARDS.uncertainLanguage.test(text)) {
        issues.push('Contains uncertain language');
        suggestions.push('Replace uncertain terms with "to my knowledge" or definitive statements.');
        score -= 15;
        severity = VALIDATION_SEVERITY.WARNING;
      }
      if (LANGUAGE_STANDARDS.emotionalLanguage.test(text)) {
        issues.push('Contains emotional/subjective language');
        suggestions.push('Use objective, factual descriptions instead of emotional terms.');
        score -= 10;
        severity = VALIDATION_SEVERITY.WARNING;
      }
      if (LANGUAGE_STANDARDS.informalLanguage.test(text)) {
        issues.push('Contains informal language');
        suggestions.push('Use formal, professional language.');
        score -= 10;
        if (severity === VALIDATION_SEVERITY.SUCCESS) severity = VALIDATION_SEVERITY.WARNING;
      }
    }
    return { issues, suggestions, score: Math.max(0, Math.min(100, score)), severity };
  }

  categorizeFact(text) {
    const lowerText = text.toLowerCase();
    if (/\b(money|paid|cost|income|debt|asset|financial|support|payment)\b/.test(lowerText)) return { category: 'financial', subcategory: 'payments' };
    if (/\b(house|property|car|vehicle|owned|residence|address)\b/.test(lowerText)) return { category: 'property', subcategory: 'real_estate' };
    if (/\b(saw|observed|witnessed|heard|present|noticed)\b/.test(lowerText)) return { category: 'witness', subcategory: 'observations' };
    if (/\b(spouse|child|parent|family|married|divorce|custody)\b/.test(lowerText)) return { category: 'relational', subcategory: 'family' };
    if (/\b(date|time|when|during|on|at|occurred)\b/.test(lowerText)) return { category: 'temporal', subcategory: 'dates' };
    if (/\b(said|told|email|called|message|text|phone)\b/.test(lowerText)) return { category: 'communication', subcategory: 'verbal' };
    if (/\b(did|action|behavior|acted|conduct)\b/.test(lowerText)) return { category: 'behavioral', subcategory: 'actions' };
    return { category: 'general', subcategory: 'other' };
  }

  async performLLMValidation(fact, existingFacts, context) {
    const prompt = this.buildProfessionalValidationPrompt(fact, existingFacts, context);
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        { role: "system", content: this.getProfessionalSystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content);
  }

  buildProfessionalValidationPrompt(fact, existingFacts, context) {
    const factText = fact.content || fact;
    let prompt = `ANALYZE THIS FACT FOR A LEGAL AFFIDAVIT: "${factText}"

CONTEXT:
- Document type: ${context.documentType || 'affidavit'}
- State: ${context.state || 'general'}
- Case type: ${context.caseType || 'general'}`;

    if (existingFacts.length > 0) {
      prompt += `\n\nEXISTING FACTS (check for duplicates and return the index if found):`;
      existingFacts.slice(0, 5).forEach((existing, index) => {
        const existingText = existing.content || existing;
        prompt += `\n${index}: "${existingText.substring(0, 100)}${existingText.length > 100 ? '...' : ''}"`;
      });
    }

    prompt += `\n\nANALYZE FOR:
1. Professional legal language standards and clarity.
2. Legal admissibility concerns (e.g., hearsay).
3. Duplicate detection (compare against EXISTING FACTS).
4. A professional rewrite of the fact.

Respond in JSON format only.`;
    return prompt;
  }
  
    /**
   * ✅ FIXED: Build result for critical validation failures
   */
  buildCriticalResult(fact, localAnalysis) {
    const factText = fact.content || fact;
    const categoryInfo = this.categorizeFact(factText);

    return {
      isValid: false,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      enhancedCategory: this.enhanceCategory(categoryInfo.category, categoryInfo.subcategory),
      professionalRewrite: "[INAPPROPRIATE CONTENT - REQUIRES COMPLETE REWRITE WITH FACTUAL INFORMATION ONLY]",
      languageIssues: ensureArray(localAnalysis.issues), // ✅ FIXED
      legalIssues: ['Contains inappropriate content that must be removed before legal use'],
      improvements: ensureArray(localAnalysis.suggestions), // ✅ FIXED
      issues: ensureArray(localAnalysis.issues), // ✅ FIXED - add for compatibility
      suggestions: ensureArray(localAnalysis.suggestions), // ✅ FIXED - add for compatibility
      legalStandardScore: localAnalysis.score,
      confidence: 0.95,
      duplicateIndex: null,
      severity: VALIDATION_SEVERITY.CRITICAL
    };
  }
  
  /**
   * ✅ FIXED: Build fallback result when LLM fails
   */
  buildFallbackResult(fact, factText) {
    const localAnalysis = this.analyzeLanguageLocally(factText);
    const categoryInfo = this.categorizeFact(factText);

    return {
      isValid: localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      enhancedCategory: this.enhanceCategory(categoryInfo.category, categoryInfo.subcategory),
      professionalRewrite: this.generateProfessionalRewrite(factText, localAnalysis),
      languageIssues: ensureArray(localAnalysis.issues), // ✅ FIXED
      legalIssues: localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL ? ['Contains inappropriate content'] : [],
      improvements: ensureArray(localAnalysis.suggestions), // ✅ FIXED
      issues: ensureArray(localAnalysis.issues), // ✅ FIXED - add for compatibility
      suggestions: ensureArray(localAnalysis.suggestions), // ✅ FIXED - add for compatibility
      legalStandardScore: localAnalysis.score,
      confidence: 0.6,
      duplicateIndex: null,
      severity: localAnalysis.severity,
      fallbackUsed: true

    };
  }
  
  generateProfessionalRewrite(originalText, analysis) {
    if (analysis.severity === VALIDATION_SEVERITY.CRITICAL) {
      return "[INAPPROPRIATE CONTENT - REQUIRES COMPLETE REWRITE]";
    }
    let rewritten = originalText;
    Object.entries(LANGUAGE_STANDARDS.replacements).forEach(([original, replacement]) => {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      rewritten = rewritten.replace(regex, replacement);
    });
    return rewritten;
  }
  
  /**
   * ✅ FIXED: Combine local and LLM analysis results
   */
  combineAnalysisResults(localAnalysis, llmResult, originalFact) {
    return {
      isValid: llmResult.isValid && localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL,
      category: llmResult.category || 'general',
      subcategory: llmResult.subcategory || null,
      enhancedCategory: llmResult.enhancedCategory || null,
      professionalRewrite: llmResult.professionalRewrite || originalFact.content || originalFact,
      languageIssues: ensureArray(localAnalysis.issues), // ✅ FIXED
      legalIssues: ensureArray(llmResult.legalIssues || []), // ✅ FIXED
      improvements: ensureArray([
        ...localAnalysis.suggestions,
        ...(llmResult.improvements || [])
      ]), // ✅ FIXED
      issues: ensureArray(localAnalysis.issues), // ✅ FIXED - add for compatibility
      suggestions: ensureArray([
        ...localAnalysis.suggestions,
        ...(llmResult.improvements || [])
      ]), // ✅ FIXED - add for compatibility
      legalStandardScore: Math.min(localAnalysis.score, llmResult.legalStandardScore || 85),
      confidence: llmResult.confidence || 0.8,
      duplicateIndex: llmResult.duplicateIndex || null,
      severity: localAnalysis.severity
    };
  }

  
  buildEmptyBatchResult() {
      return {
          overallProfessional: true,
          summary: { message: "No facts provided for validation." },
          results: []
      };
  }
}

export default EnhancedFactValidationService;