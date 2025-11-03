// services/enhancedFactValidationService.js
// FIXED VERSION - Corrected async/await syntax

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
      } else if (/\b(asset|property|account|investment)\b/i.test(factText)) {
        secondaryCategory = 'assets';
      } else if (/\b(debt|loan|mortgage|owe)\b/i.test(factText)) {
        secondaryCategory = 'debts';
      }
    } else if (/\b(house|home|property|real estate|land|building|apartment|condo|vehicle|car|truck)\b/i.test(factText)) {
      primaryCategory = 'property';
      confidence = 0.8;
      
      if (/\b(house|home|real estate|land|building)\b/i.test(factText)) {
        secondaryCategory = 'real_estate';
      } else if (/\b(car|vehicle|truck|motorcycle)\b/i.test(factText)) {
        secondaryCategory = 'vehicles';
      }
    } else if (/\b(child|children|custody|visitation|parent|spouse|divorce|marriage|family)\b/i.test(factText)) {
      primaryCategory = 'relational';
      confidence = 0.8;
      
      if (/\b(custody|visitation)\b/i.test(factText)) {
        secondaryCategory = 'custody';
      } else if (/\b(divorce|separation)\b/i.test(factText)) {
        secondaryCategory = 'divorce';
      }
    } else if (/\b(on|date|time|hour|day|month|year|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(factText)) {
      primaryCategory = 'temporal';
      confidence = 0.7;
    } else if (/\b(saw|witnessed|observed|heard|noticed|present)\b/i.test(factText)) {
      primaryCategory = 'witness';
      confidence = 0.7;
    }
    
    return {
      primary: primaryCategory,
      secondary: secondaryCategory,
      confidence
    };
  }
  
  analyzeLanguageLocally(factText) {
    let score = 100;
    const issues = [];
    const suggestions = [];
    let severity = VALIDATION_SEVERITY.SUCCESS;
    
    if (!factText || factText.trim().length === 0) {
      return {
        issues: ['Fact is empty'],
        suggestions: ['Provide fact content'],
        score: 0,
        severity: VALIDATION_SEVERITY.CRITICAL,
        hasProblematicContent: true
      };
    }
    
    if (factText.length < 10) {
      issues.push('Fact is too short');
      suggestions.push('Provide more detail');
      score -= 20;
      severity = VALIDATION_SEVERITY.WARNING;
    }
    
    if (/\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard)\b/i.test(factText)) {
      issues.push('Contains inappropriate language');
      suggestions.push('Remove profanity and use professional language');
      score = 0;
      severity = VALIDATION_SEVERITY.CRITICAL;
    }
    
    if (!/^[A-Z]/.test(factText)) {
      issues.push('Does not start with capital letter');
      suggestions.push('Start with a capital letter');
      score -= 5;
      severity = severity === VALIDATION_SEVERITY.SUCCESS ? VALIDATION_SEVERITY.INFO : severity;
    }
    
    if (!/[.!?]$/.test(factText)) {
      issues.push('Missing ending punctuation');
      suggestions.push('End with proper punctuation');
      score -= 5;
      severity = severity === VALIDATION_SEVERITY.SUCCESS ? VALIDATION_SEVERITY.INFO : severity;
    }
    
    if (/\b(I think|I believe|maybe|probably|possibly|might|could)\b/i.test(factText)) {
      issues.push('Contains uncertain language');
      suggestions.push('State facts with certainty or remove uncertain statements');
      severity = severity === VALIDATION_SEVERITY.SUCCESS ? VALIDATION_SEVERITY.WARNING : severity;
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
  
  generateProfessionalVersion(factText, category, context = {}) {
    const affiantName = context.affiantName || null;

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

    // Ensure first-person perspective without over-prefixing
    if (!/^I\b/i.test(professional)) {
      // Convert to first person by adding "I" prefix
      // Choose appropriate verb based on content
      const firstChar = professional.charAt(0).toLowerCase();
      const rest = professional.slice(1);

      // Determine if this describes an observation/event or a state/fact
      const isObservation = /\b(happen|occur|see|notice|take place|went|came|arrived|left)\b/i.test(professional);
      const isStateOfBeing = /\b(is|am|are|was|were|have|has|had|own|reside|live|work)\b/i.test(professional);

      if (isStateOfBeing) {
        // Direct statement: "I am..." "I have..." "I reside..."
        professional = `I ${firstChar}${rest}`;
      } else if (isObservation) {
        // Observation: "I witnessed that..." or "I observed that..."
        professional = `I witnessed that ${firstChar}${rest}`;
      } else {
        // General case: "I state that..." for declarative facts
        professional = `I state that ${firstChar}${rest}`;
      }
    }

    // Note: We deliberately do NOT add "I, [Name]," format in the fallback function
    // The "I, [Name]," format should be used by the LLM when appropriate (e.g., first fact in affidavit)
    // but not mechanically added to every fact, as it would be repetitive and less persuasive

    if (!/[.!?]$/.test(professional)) {
      professional += '.';
    }

    // Ensure first character is uppercase (should already be "I")
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
  
  buildFallbackResult(fact, factText, context = {}) {
    const localAnalysis = this.analyzeLanguageLocally(factText);
    const categoryInfo = this.detectCategory(factText);

    return {
      isValid: localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL,
      category: categoryInfo.primary,
      subcategory: categoryInfo.secondary,
      professionalRewrite: this.generateProfessionalVersion(factText, categoryInfo, context),
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
    const affiantName = context.affiantName || 'Unknown';

    // Extract original content and initial rewrite for context
    const originalContent = fact.originalContent || factText;
    const initialRewrite = fact.initialRewrite || null;

    // Build prompt with original context
    let factContext = `Current fact text: "${factText}"`;

    // If we have original content that differs from current, include it
    if (originalContent && originalContent !== factText) {
      factContext = `Original user-provided text: "${originalContent}"\nCurrent fact text: "${factText}"`;
    }

    // If we have an initial rewrite, include it for context
    if (initialRewrite && initialRewrite !== factText) {
      factContext += `\nInitial professional rewrite: "${initialRewrite}"`;
    }

    const prompt = `Analyze this legal fact for an affidavit in ${context.state || 'the US'}:

${factContext}

Context:
- Document Type: ${context.documentType || 'General Affidavit'}
- Case Type: ${context.caseType || 'General'}
- Affiant: ${affiantName}

Existing facts: ${existingFacts.length}

Evaluate for:
1. Legal admissibility and relevance
2. Language professionalism and clarity
3. Potential legal issues or concerns
4. Suggested improvements
5. Category classification

IMPORTANT: For the professional rewrite, write in FIRST PERSON from the affiant's perspective.
${affiantName !== 'Unknown' ? `The affiant is ${affiantName}.` : ''}
${initialRewrite ? `NOTE: When generating the rewrite, consider the original user-provided text and the initial rewrite for context, but create a fresh rewrite that addresses any issues. Do not base it on any existing professional rewrite.` : ''}
Use natural, persuasive affidavit language:
- State facts directly in first person: "I am 45 years old", "I reside at...", "I own..."
- For observations/events: "I witnessed...", "I observed...", "I saw..."
- For information from others: "I was informed by [person] that...", "I learned from [source] that..."
- For beliefs: "I believe, based on [reason], that..."
- Use the formal "I, ${affiantName !== 'Unknown' ? affiantName : '[name]'}," format ONLY when it enhances clarity or formality (e.g., first statement, key declarations), not for every fact
- Use declarative statements suitable for sworn testimony
- Avoid repetitive prefixes - vary sentence structure naturally while maintaining first person

Provide a professional rewrite following these guidelines and specific feedback.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: "You are a legal document specialist reviewing affidavit facts for admissibility and professionalism. When rewriting facts, always use first-person perspective as sworn testimony from the affiant, following proper affidavit conventions."
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
                description: "A professionally rewritten version of the fact in first-person affidavit format from the affiant's perspective"
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
  
  // ✅ FIXED: Properly declared async function
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

      const fallbackResult = this.buildFallbackResult(fact, factText, context);
      this.validationCache.set(cacheKey, fallbackResult);
      return fallbackResult;

    } catch (error) {
      logger.error('Professional fact validation failed', {
        error: error.message,
        factText: factText.substring(0, 50) + '...'
      });
      const fallbackResult = this.buildFallbackResult(fact, factText, context);
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

  // Method specifically for on-demand professional rewriting
  // This is a wrapper around validateFactProfessional that returns just the rewrite
  async generateProfessionalRewriteWithLLM(fact, context = {}) {
    const result = await this.validateFactProfessional(fact, [], context);
    return result.professionalRewrite;
  }
}

module.exports = EnhancedFactValidationService;
