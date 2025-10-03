// services/enhancedFactValidationService.js
// FINAL COMPLETE VERSION - Replace entire file with this

const logger = require('../utils/logger');

// LRU Cache
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

// Constants
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
  }
};

// Helper function - MUST be outside class
function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  if (value === null || value === undefined) return [];
  return [String(value)];
}

// Main class
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
    
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 300000);
    
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
    const cacheAge = Date.now() - (this.cacheCreatedAt || Date.now());
    if (cacheAge > 3600000) {
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
  
  detectCategory(factText) {
    let primaryCategory = 'general';
    let secondaryCategory = null;
    let confidence = 0.5;
    
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
    
    else if (/\b(property|house|home|land|real estate|vehicle|car|truck|apartment|condo)\b/i.test(factText)) {
      primaryCategory = 'property';
      confidence = 0.8;
      
      if (/\b(house|home|land|real estate|apartment|condo)\b/i.test(factText)) {
        secondaryCategory = 'real_estate';
      } else if (/\b(vehicle|car|truck|motorcycle)\b/i.test(factText)) {
        secondaryCategory = 'vehicles';
      }
    }
    
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
    
    else if (/\b(date|time|day|month|year|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night)\b/i.test(factText)) {
      primaryCategory = 'temporal';
      confidence = 0.75;
      secondaryCategory = 'dates';
    }
    
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
    
    else if (/\b(saw|witnessed|observed|heard|present at|noticed|watched)\b/i.test(factText)) {
      primaryCategory = 'witness';
      confidence = 0.8;
      secondaryCategory = 'observations';
    }
    
    return {
      primary: primaryCategory,
      secondary: secondaryCategory,
      confidence
    };
  }
  
  analyzeLanguageLocally(factText) {
    const issues = [];
    const suggestions = [];
    let score = 85;
    let severity = VALIDATION_SEVERITY.SUCCESS;
    
    const offensivePattern = /\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard|motherfucker)\b/gi;
    if (offensivePattern.test(factText)) {
      issues.push('Contains inappropriate language for legal documents');
      severity = VALIDATION_SEVERITY.CRITICAL;
      score -= 50;
    }
    
    if (/\b(maybe|probably|might|could be|i think|i believe|possibly|perhaps)\b/i.test(factText)) {
      issues.push('Contains uncertain language');
      suggestions.push('Use more definitive language like "to my knowledge" or "it is my understanding"');
      severity = VALIDATION_SEVERITY.WARNING;
      score -= 15;
    }
    
    if (/\b(terrible|horrible|awful|amazing|wonderful|devastating|fantastic)\b/i.test(factText)) {
      issues.push('Contains emotional or subjective language');
      suggestions.push('Use objective, factual language');
      severity = severity === VALIDATION_SEVERITY.CRITICAL ? severity : VALIDATION_SEVERITY.WARNING;
      score -= 10;
    }
    
    if (/\b(kinda|sorta|like totally|whatever|anyway|stuff|things|gonna|wanna)\b/i.test(factText)) {
      issues.push('Contains informal language');
      suggestions.push('Use formal legal language');
      score -= 10;
    }
    
    if (/\b(some|many|few|several|around|about)\b/i.test(factText)) {
      issues.push('Contains vague quantifiers');
      suggestions.push('Use specific numbers or dates when possible');
      score -= 5;
    }
    
    return {
      issues: ensureArray(issues),
      suggestions: ensureArray(suggestions),
      score: Math.max(0, Math.min(100, score)),
      severity,
      hasProblematicContent: severity === VALIDATION_SEVERITY.CRITICAL
    };
  }
  
  generateProfessionalVersion(factText, category) {
    let professional = factText
      .replace(/\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard)\b/gi, '[inappropriate]')
      .replace(/\b(kinda|sorta|like totally|like)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    professional = professional
      .replace(/\bi\b/g, 'I')
      .replace(/\bdont\b/gi, "don't")
      .replace(/\bdidnt\b/gi, "didn't")
      .replace(/\bwont\b/gi, "won't")
      .replace(/\bcant\b/gi, "can't");
    
    professional = professional
      .replace(/\b(i think|i believe)\b/gi, 'I state that')
      .replace(/\b(maybe|probably|possibly)\b/gi, '')
      .replace(/\b(might be|might have)\b/gi, 'was');
    
    if (!/^I\b/i.test(professional)) {
      professional = `I observed that ${professional}`;
    }
    
    if (!/[.!?]$/.test(professional)) {
      professional += '.';
    }
    
    professional = professional.charAt(0).toUpperCase() + professional.slice(1);
    
    return professional;
  }
  
  buildCriticalResult(fact, localAnalysis) {
    const factText = fact.content || fact;
    const categoryInfo = this.detectCategory(factText);

    return {
      isValid: false,
      category: categoryInfo.primary,
      subcategory: categoryInfo.secondary,
      professionalRewrite: "[INAPPROPRIATE CONTENT - REQUIRES COMPLETE REWRITE WITH FACTUAL INFORMATION ONLY]",
      languageIssues: ensureArray(localAnalysis.issues),
      legalIssues: ['Contains inappropriate content that must be removed before legal use'],
      improvements: ensureArray(localAnalysis.suggestions),
      issues: ensureArray(localAnalysis.issues),
      suggestions: ensureArray(localAnalysis.suggestions),
      legalStandardScore: localAnalysis.score,
      confidence: 0.95,
      duplicateIndex: null,
      severity: VALIDATION_SEVERITY.CRITICAL
    };
  }
  
  buildFallbackResult(fact, factText) {
    const localAnalysis = this.analyzeLanguageLocally(factText);
    const categoryInfo = this.detectCategory(factText);

    return {
      isValid: localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL,
      category: categoryInfo.primary,
      subcategory: categoryInfo.secondary,
      professionalRewrite: this.generateProfessionalVersion(factText, categoryInfo),
      languageIssues: ensureArray(localAnalysis.issues),
      legalIssues: localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL ? ['Contains inappropriate content'] : [],
      improvements: ensureArray(localAnalysis.suggestions),
      issues: ensureArray(localAnalysis.issues),
      suggestions: ensureArray(localAnalysis.suggestions),
      legalStandardScore: localAnalysis.score,
      confidence: 0.6,
      duplicateIndex: null,
      severity: localAnalysis.severity,
      fallbackUsed: true
    };
  }
  
  async performLLMValidation(fact, existingFacts, context) {
    const factText = fact.content || fact;
    
    const prompt = `Analyze this legal fact for an affidavit in ${context.state || 'the US'}:

  Fact: "${factText}"

  Context:
  - Document Type: ${context.documentType || 'General Affidavit'}
  - Case Type: ${context.caseType || 'General'}
  - Affiant: ${context.affiantName || 'Unknown'}

  Existing facts: ${existingFacts.length}

  Evaluate for:
  1. Legal admissibility and relevance
  2. Language professionalism and clarity
  3. Potential legal issues or concerns
  4. Suggested improvements
  5. Category classification

  Provide a professional rewrite and specific feedback.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
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
      max_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fact_validation_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              professionalRewrite: {
                type: "string",
                description: "A professionally rewritten version of the fact"
              },
              legalIssues: {
                type: "array",
                items: { type: "string" },
                description: "Array of legal concerns or issues"
              },
              languageIssues: {
                type: "array",
                items: { type: "string" },
                description: "Array of language or style issues"
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                description: "Array of specific suggestions for improvement"
              },
              category: {
                type: "string",
                description: "Primary category of the fact"
              },
              subcategory: {
                type: ["string", "null"],
                description: "Subcategory if applicable"
              },
              isAdmissible: {
                type: "boolean",
                description: "Whether the fact is legally admissible"
              },
              legalStandardScore: {
                type: "number",
                description: "Score from 0-100 rating legal quality"
              },
              confidence: {
                type: "number",
                description: "Confidence level from 0-1"
              }
            },
            required: [
              "professionalRewrite",
              "legalIssues",
              "languageIssues",
              "improvements",
              "category",
              "subcategory",
              "isAdmissible",
              "legalStandardScore",
              "confidence"
            ],
            additionalProperties: false
          }
        }
      }
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
  
  combineAnalysisResults(localAnalysis, llmResult, originalFact) {
    return {
      isValid: llmResult.isAdmissible && localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL,
      category: llmResult.category,
      subcategory: llmResult.subcategory,
      professionalRewrite: llmResult.professionalRewrite,
      languageIssues: ensureArray(localAnalysis.issues), 
      legalIssues: llmResult.legalIssues, 
      improvements: [
        ...ensureArray(localAnalysis.suggestions), 
        ...llmResult.improvements
      ],
      issues: ensureArray(localAnalysis.issues),  
      suggestions: [
        ...ensureArray(localAnalysis.suggestions),  
        ...llmResult.improvements  
      ],
      legalStandardScore: Math.min(localAnalysis.score, llmResult.legalStandardScore),
      confidence: llmResult.confidence,
      duplicateIndex: null,
      severity: localAnalysis.severity
    };
  }

  
  async validateFactProfessional(fact, existingFacts = [], context = {}) {
    const factText = fact.content || fact;
    const cacheKey = this.generateCacheKey(factText, context);
    
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      return { ...cached, fromCache: true };
    }
    
    try {
      const localAnalysis = this.analyzeLanguageLocally(factText);
      
      if (localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL) {
        const result = this.buildCriticalResult(fact, localAnalysis);
        this.validationCache.set(cacheKey, result);
        return result;
      }
      
      if (this.openai && factText.length > 20) {
        await this.respectRateLimit();
        const llmResult = await this.performLLMValidation(fact, existingFacts, context);
        const finalResult = this.combineAnalysisResults(localAnalysis, llmResult, fact);
        this.validationCache.set(cacheKey, finalResult);
        return finalResult;
      }
      
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

module.exports = EnhancedFactValidationService;
