// services/EnhancedFactValidationService.js - CommonJS Version
/**
 * Enhanced Professional Fact Validation Service with LRU Cache
 * Memory leak fixes and performance improvements
 * 
 * @version 3.0.0 (CommonJS)
 */

const logger = require('../utils/logger');

class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete least recently used (first item)
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

const VALIDATION_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success'
};

const LEGAL_CATEGORIES = {
  financial: {
    name: 'Financial',
    subcategories: ['income', 'assets', 'debts', 'payments', 'support', 'expenses'],
    description: 'Money, assets, income, debts, financial obligations'
  },
  property: {
    name: 'Property',
    subcategories: ['real_estate', 'personal_property', 'vehicles', 'intellectual_property'],
    description: 'Real estate, personal property, vehicles, ownership'
  },
  relational: {
    name: 'Relationships',
    subcategories: ['family', 'custody', 'visitation', 'marriage', 'divorce'],
    description: 'Family relationships, custody, marriage, divorce'
  },
  temporal: {
    name: 'Chronological',
    subcategories: ['dates', 'timelines', 'sequences', 'duration'],
    description: 'Dates, times, chronological sequences'
  },
  witness: {
    name: 'Witness Testimony',
    subcategories: ['observations', 'conversations', 'events', 'actions'],
    description: 'Direct observations, witnessed events'
  },
  communication: {
    name: 'Communications',
    subcategories: ['verbal', 'written', 'electronic', 'legal_notices'],
    description: 'Conversations, emails, texts, legal notices'
  },
  behavioral: {
    name: 'Conduct/Behavior',
    subcategories: ['actions', 'patterns', 'violations', 'compliance'],
    description: 'Actions, behavior patterns, compliance'
  },
  procedural: {
    name: 'Legal Procedures',
    subcategories: ['service', 'notices', 'filings', 'hearings'],
    description: 'Legal process, service, court proceedings'
  },
  background: {
    name: 'Background Information',
    subcategories: ['identity', 'qualifications', 'context', 'relationships'],
    description: 'Identity, qualifications, background context'
  }
};

class EnhancedFactValidationService {
  constructor(openaiClient, language = 'en', cacheSize = 100) {
    this.openai = openaiClient;
    this.language = language;
    this.validationCache = new LRUCache(cacheSize);
    this.rateLimit = {
      calls: 0,
      resetTime: Date.now() + 60000,
      maxCalls: 50
    };
    
    // Periodic cache cleanup
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 300000); // 5 minutes
    
    logger.info('✅ EnhancedFactValidationService initialized', {
      cacheSize,
      language,
      hasOpenAI: !!openaiClient
    });
  }
  
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.validationCache.clear();
    logger.info('EnhancedFactValidationService destroyed');
  }
  
  cleanupCache() {
    // Clear cache if it's getting too old
    const cacheAge = Date.now() - (this.cacheCreatedAt || Date.now());
    if (cacheAge > 3600000) { // 1 hour
      this.validationCache.clear();
      this.cacheCreatedAt = Date.now();
      logger.debug('Validation cache cleared due to age');
    }
  }
  
  generateCacheKey(factText, context = {}) {
    const contextString = JSON.stringify({
      state: context.state,
      caseType: context.caseType,
      language: this.language
    });
    return `${factText.toLowerCase().trim()}_${contextString}`;
  }
  
  async respectRateLimit() {
    if (Date.now() > this.rateLimit.resetTime) {
      this.rateLimit.calls = 0;
      this.rateLimit.resetTime = Date.now() + 60000;
    }
    
    if (this.rateLimit.calls >= this.rateLimit.maxCalls) {
      const waitTime = this.rateLimit.resetTime - Date.now();
      logger.warn('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimit.calls = 0;
      this.rateLimit.resetTime = Date.now() + 60000;
    }
    
    this.rateLimit.calls++;
  }
  
  analyzeLanguageLocally(factText) {
    const issues = [];
    const suggestions = [];
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
    
    // Check for emotional language
    const emotionalPattern = /\b(hate|despise|love|adore|terrible|awful|amazing|wonderful|horrible)\b/gi;
    if (emotionalPattern.test(factText)) {
      issues.push('Contains emotional language - use neutral, factual terms');
      suggestions.push('Replace emotional descriptions with objective facts');
      if (severity === VALIDATION_SEVERITY.SUCCESS) {
        severity = VALIDATION_SEVERITY.WARNING;
      }
    }
    
    // Check for hearsay
    const hearsayPattern = /\b(heard|told me|said that|rumor|allegedly|supposedly)\b/gi;
    if (hearsayPattern.test(factText)) {
      issues.push('May contain hearsay - affidavits require first-hand knowledge');
      suggestions.push('Only include facts you personally witnessed or know to be true');
      if (severity === VALIDATION_SEVERITY.SUCCESS) {
        severity = VALIDATION_SEVERITY.WARNING;
      }
    }
    
    // Check minimum length
    if (factText.trim().length < 10) {
      issues.push('Statement is too brief');
      suggestions.push('Provide more specific details');
      if (severity === VALIDATION_SEVERITY.SUCCESS) {
        severity = VALIDATION_SEVERITY.INFO;
      }
    }
    
    return {
      issues,
      suggestions,
      severity
    };
  }
  
  detectCategory(factText) {
    const lowerText = factText.toLowerCase();
    let primaryCategory = 'general';
    let secondaryCategory = null;
    let confidence = 0.5;
    
    // Financial patterns
    if (/\b(money|dollar|payment|income|salary|wage|asset|debt|loan|mortgage|rent|cost|price|expense|financial|bank|account)\b/i.test(factText)) {
      primaryCategory = 'financial';
      confidence = 0.8;
      
      if (/\b(income|salary|wage|earn)\b/i.test(factText)) {
        secondaryCategory = 'income';
      } else if (/\b(debt|loan|mortgage|owe)\b/i.test(factText)) {
        secondaryCategory = 'debts';
      } else if (/\b(asset|property|own)\b/i.test(factText)) {
        secondaryCategory = 'assets';
      }
    }
    
    // Property patterns
    else if (/\b(property|house|home|land|real estate|vehicle|car|truck|apartment|condo)\b/i.test(factText)) {
      primaryCategory = 'property';
      confidence = 0.8;
      
      if (/\b(house|home|land|real estate|apartment|condo)\b/i.test(factText)) {
        secondaryCategory = 'real_estate';
      } else if (/\b(vehicle|car|truck|motorcycle)\b/i.test(factText)) {
        secondaryCategory = 'vehicles';
      }
    }
    
    // Relational patterns
    else if (/\b(spouse|husband|wife|child|children|kids|parent|mother|father|family|custody|visitation|marriage|divorce|separation)\b/i.test(factText)) {
      primaryCategory = 'relational';
      confidence = 0.85;
      
      if (/\b(custody|visitation|parenting)\b/i.test(factText)) {
        secondaryCategory = 'custody';
      } else if (/\b(marriage|wedding|married)\b/i.test(factText)) {
        secondaryCategory = 'marriage';
      } else if (/\b(divorce|separation|separated)\b/i.test(factText)) {
        secondaryCategory = 'divorce';
      }
    }
    
    // Temporal patterns
    else if (/\b(date|time|day|month|year|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night)\b/i.test(factText)) {
      primaryCategory = 'temporal';
      confidence = 0.75;
      secondaryCategory = 'dates';
    }
    
    // Communication patterns
    else if (/\b(email|text|message|call|phone|letter|told|said|wrote|communicated|contacted)\b/i.test(factText)) {
      primaryCategory = 'communication';
      confidence = 0.75;
      
      if (/\b(email|text|message|digital)\b/i.test(factText)) {
        secondaryCategory = 'electronic';
      } else if (/\b(letter|mail|written)\b/i.test(factText)) {
        secondaryCategory = 'written';
      } else if (/\b(call|phone|told|said|verbal)\b/i.test(factText)) {
        secondaryCategory = 'verbal';
      }
    }
    
    return {
      primary: primaryCategory,
      secondary: secondaryCategory,
      confidence
    };
  }
  
  generateProfessionalVersion(factText, category) {
    // Remove inappropriate language
    let professional = factText
      .replace(/\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard)\b/gi, '[inappropriate]')
      .replace(/\b(kinda|sorta|like totally|like)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Fix common grammar issues
    professional = professional
      .replace(/\bi\b/g, 'I')
      .replace(/\bdont\b/gi, "don't")
      .replace(/\bdidnt\b/gi, "didn't")
      .replace(/\bwont\b/gi, "won't")
      .replace(/\bcant\b/gi, "can't");
    
    // Improve uncertain language
    professional = professional
      .replace(/\b(i think|i believe)\b/gi, 'I state that')
      .replace(/\b(maybe|probably|possibly)\b/gi, '')
      .replace(/\b(might be|might have)\b/gi, 'was');
    
    // Add formal structure if needed
    if (!/^I\b/i.test(professional)) {
      professional = `I observed that ${professional}`;
    }
    
    // Ensure proper punctuation
    if (!/[.!?]$/.test(professional)) {
      professional += '.';
    }
    
    // Capitalize first letter
    professional = professional.charAt(0).toUpperCase() + professional.slice(1);
    
    return professional;
  }
  
  buildCriticalResult(fact, localAnalysis) {
    return {
      isValid: false,
      severity: VALIDATION_SEVERITY.CRITICAL,
      errors: localAnalysis.issues,
      warnings: [],
      suggestions: ['Remove inappropriate content and use professional language'],
      professionalRewrite: '[Content requires complete rewrite due to inappropriate language]',
      category: 'general',
      confidence: 1.0,
      requiresRewrite: true
    };
  }
  
  buildFallbackResult(fact, factText) {
    const localAnalysis = this.analyzeLanguageLocally(factText);
    const category = this.detectCategory(factText);
    
    return {
      isValid: localAnalysis.issues.length === 0,
      severity: localAnalysis.severity,
      errors: localAnalysis.issues.filter(i => i.includes('inappropriate')),
      warnings: localAnalysis.issues.filter(i => !i.includes('inappropriate')),
      suggestions: localAnalysis.suggestions,
      professionalRewrite: this.generateProfessionalVersion(factText, category),
      category: category.primary,
      subcategory: category.secondary,
      confidence: 0.7,
      fallbackUsed: true
    };
  }
  
  async performLLMValidation(fact, existingFacts, context) {
    const prompt = `Analyze this legal fact for an affidavit in ${context.state || 'the US'}:

Fact: "${fact.content || fact}"

Context:
- Document Type: ${context.documentType || 'General Affidavit'}
- Case Type: ${context.caseType || 'General'}
- Affiant: ${context.affiantName || 'Unknown'}

Existing facts in document: ${existingFacts.length}

Evaluate:
1. Legal admissibility and relevance
2. Language professionalism and clarity
3. Potential legal issues or concerns
4. Suggested improvements

Provide:
1. A professional rewrite of the fact
2. Specific issues found
3. Improvement suggestions
4. Category classification

Format response as JSON with keys: professionalRewrite, legalIssues, languageIssues, improvements, category, isAdmissible`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a legal document specialist reviewing affidavit facts for admissibility and professionalism."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
  
  combineAnalysisResults(localAnalysis, llmResult, fact) {
    return {
      isValid: llmResult.isAdmissible && localAnalysis.issues.length === 0,
      severity: localAnalysis.severity,
      errors: [
        ...localAnalysis.issues.filter(i => i.includes('inappropriate')),
        ...(llmResult.legalIssues || [])
      ],
      warnings: [
        ...localAnalysis.issues.filter(i => !i.includes('inappropriate')),
        ...(llmResult.languageIssues || [])
      ],
      suggestions: [
        ...localAnalysis.suggestions,
        ...(llmResult.improvements || [])
      ],
      professionalRewrite: llmResult.professionalRewrite || this.generateProfessionalVersion(fact.content || fact, this.detectCategory(fact.content || fact)),
      category: llmResult.category || this.detectCategory(fact.content || fact).primary,
      confidence: 0.9,
      llmEnhanced: true
    };
  }
  
  async validateFactProfessional(fact, existingFacts = [], context = {}) {
    const factText = fact.content || fact;
    const cacheKey = this.generateCacheKey(factText, context);
    
    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      return { ...cached, fromCache: true };
    }
    
    try {
      // Perform local language analysis first (fast)
      const localAnalysis = this.analyzeLanguageLocally(factText);
      
      // If critical issues found, no need to call LLM
      if (localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL) {
        const result = this.buildCriticalResult(fact, localAnalysis);
        this.validationCache.set(cacheKey, result);
        return result;
      }
      
      // Only call LLM if we have a client and it's worth it
      if (this.openai && factText.length > 20) {
        await this.respectRateLimit();
        const llmResult = await this.performLLMValidation(fact, existingFacts, context);
        const finalResult = this.combineAnalysisResults(localAnalysis, llmResult, fact);
        this.validationCache.set(cacheKey, finalResult);
        return finalResult;
      }
      
      // Fallback to local analysis only
      const fallbackResult = this.buildFallbackResult(fact, factText);
      this.validationCache.set(cacheKey, fallbackResult);
      return fallbackResult;
      
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
      return {
        isValid: true,
        facts: [],
        summary: 'No facts to validate'
      };
    }
    
    const results = await Promise.all(
      facts.map((fact, index) => 
        this.validateFactProfessional(fact, facts.filter((_, i) => i !== index), context)
      )
    );
    
    const hasErrors = results.some(r => !r.isValid);
    const criticalCount = results.filter(r => r.severity === VALIDATION_SEVERITY.CRITICAL).length;
    const warningCount = results.filter(r => r.severity === VALIDATION_SEVERITY.WARNING).length;
    
    return {
      isValid: !hasErrors,
      totalFacts: facts.length,
      validFacts: results.filter(r => r.isValid).length,
      criticalIssues: criticalCount,
      warnings: warningCount,
      results,
      summary: {
        criticalCount,
        warningCount,
        successCount: results.filter(r => r.severity === VALIDATION_SEVERITY.SUCCESS).length
      }
    };
  }
}

module.exports = {
  EnhancedFactValidationService,
  VALIDATION_SEVERITY,
  LEGAL_CATEGORIES
};