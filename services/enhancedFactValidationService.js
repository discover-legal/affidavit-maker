// services/EnhancedFactValidationService.js
/**
 * Enhanced Professional Fact Validation Service
 * 
 * Provides comprehensive validation of legal facts including:
 * - Professional language standards
 * - Legal admissibility assessment
 * - Inappropriate content detection
 * - Court-readiness scoring
 * - Professional fact rewriting
 * 
 * @author Affidavit Maker Team
 * @version 2.0.0
 */

/**
 * Validation severity levels
 */
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

/**
 * Professional language standards for legal documents
 */
const LANGUAGE_STANDARDS = {
  // Inappropriate language that must be flagged as critical
  offensiveWords: /\b(cunt|fuck|shit|bitch|asshole|damn|hell|piss|cock|dick|pussy|whore|slut|bastard|motherfucker|nigger|faggot|retard)\b/i,
  
  // Personal attacks and emotional statements
  personalAttacks: /(hate|despise|loathe|can't stand|makes me sick).*(wife|husband|spouse|ex|mother|father|child|person)/i,
  inappropriateEmotional: /(i hate|i despise|i can't stand|makes me sick|disgusting person|piece of shit|worthless)/i,
  
  // Unprofessional language (warning level)
  uncertainLanguage: /\b(maybe|probably|might|could be|i think|i believe|possibly|perhaps)\b/i,
  emotionalLanguage: /\b(terrible|horrible|awful|amazing|wonderful|devastating|fantastic|brilliant)\b/i,
  informalLanguage: /\b(kinda|sorta|like totally|whatever|anyway|stuff|things|gonna|wanna)\b/i,
  vagueQuantifiers: /\b(some|many|few|several|often|sometimes|around|about|approximately)\b/i,
  
  // Preferred replacements
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

class EnhancedFactValidationService {
  constructor(openaiClient, language = 'en') {
    this.openai = openaiClient;
    this.language = language;
    this.validationCache = new Map();
    this.rateLimitDelay = 1000; // 1 second between API calls
    this.lastApiCall = 0;
  }

  /**
   * Validate a single fact with comprehensive professional standards
   * 
   * @param {Object|string} fact - Fact to validate
   * @param {Array} existingFacts - Context of other facts
   * @param {Object} context - Document context (state, case type, etc.)
   * @returns {Promise<Object>} Validation result
   */
  async validateFactProfessional(fact, existingFacts = [], context = {}) {
    const factText = fact.content || fact;
    
    // Generate cache key for this validation
    const cacheKey = this.generateCacheKey(factText, context);
    
    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
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

      // Rate limiting for API calls
      await this.respectRateLimit();

      // Call LLM for comprehensive analysis
      const llmResult = await this.performLLMValidation(fact, existingFacts, context);
      
      // Combine local and LLM analysis
      const finalResult = this.combineAnalysisResults(localAnalysis, llmResult, fact);
      
      // Cache the result
      this.validationCache.set(cacheKey, finalResult);
      
      return finalResult;
      
    } catch (error) {
      console.error('Professional fact validation failed:', error);
      
      // Fallback to local analysis only
      const fallbackResult = this.buildFallbackResult(fact, factText);
      this.validationCache.set(cacheKey, fallbackResult);
      
      return fallbackResult;
    }
  }

  /**
   * Validate multiple facts in an efficient batch operation
   * 
   * @param {Array} facts - Facts to validate
   * @param {Object} context - Document context
   * @returns {Promise<Object>} Batch validation result
   */
  async validateFactsBatchProfessional(facts, context = {}) {
    if (!Array.isArray(facts) || facts.length === 0) {
      return this.buildEmptyBatchResult();
    }

    try {
      // Perform local analysis on all facts first
      const localResults = facts.map(fact => ({
        fact,
        localAnalysis: this.analyzeLanguageLocally(fact.content || fact)
      }));

      // Check if any facts have critical issues
      const criticalFacts = localResults.filter(result => 
        result.localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL
      );

      // If we have critical issues, we can return immediately for those
      // and still process non-critical facts via LLM
      const results = [];
      const factsForLLM = [];

      for (const result of localResults) {
        if (result.localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL) {
          results.push(this.buildCriticalResult(result.fact, result.localAnalysis));
        } else {
          factsForLLM.push(result.fact);
        }
      }

      // Process remaining facts via LLM if any
      if (factsForLLM.length > 0) {
        await this.respectRateLimit();
        const llmBatchResult = await this.performLLMBatchValidation(factsForLLM, context);
        
        // Merge LLM results with local results
        if (llmBatchResult && llmBatchResult.facts) {
          results.push(...llmBatchResult.facts.map((llmFact, index) => {
            const originalFact = factsForLLM[index];
            const localAnalysis = this.analyzeLanguageLocally(originalFact.content || originalFact);
            return this.combineAnalysisResults(localAnalysis, llmFact, originalFact);
          }));
        }
      }

      // Build comprehensive batch result
      return this.buildBatchResult(results, criticalFacts.length > 0);
      
    } catch (error) {
      console.error('Batch validation failed:', error);
      
      // Fallback to local analysis only
      return this.buildFallbackBatchResult(facts);
    }
  }

  /**
   * Analyze language locally for immediate feedback
   * This provides fast detection of critical issues without API calls
   * 
   * @param {string} text - Text to analyze
   * @returns {Object} Local analysis result
   */
  analyzeLanguageLocally(text) {
    const issues = [];
    const suggestions = [];
    let score = 85;
    let severity = VALIDATION_SEVERITY.SUCCESS;

    const lowerText = text.toLowerCase();

    // Critical: Check for offensive/inappropriate language
    if (LANGUAGE_STANDARDS.offensiveWords.test(text)) {
      issues.push('CRITICAL: Contains offensive language inappropriate for legal documents');
      suggestions.push('Remove all profanity and offensive language - this cannot be included in legal documents');
      score = 10;
      severity = VALIDATION_SEVERITY.CRITICAL;
    }

    if (LANGUAGE_STANDARDS.personalAttacks.test(text) || LANGUAGE_STANDARDS.inappropriateEmotional.test(text)) {
      issues.push('CRITICAL: Contains inappropriate personal attacks or emotional statements');
      suggestions.push('Focus on factual observations only - personal feelings and attacks are inadmissible');
      score = Math.min(score, 15);
      severity = VALIDATION_SEVERITY.CRITICAL;
    }

    // Warning level issues (only check if not already critical)
    if (severity !== VALIDATION_SEVERITY.CRITICAL) {
      if (LANGUAGE_STANDARDS.uncertainLanguage.test(text)) {
        issues.push('Contains uncertain language');
        suggestions.push('Replace uncertain terms with "to my knowledge" or "it is my understanding"');
        score -= 15;
        severity = VALIDATION_SEVERITY.WARNING;
      }

      if (LANGUAGE_STANDARDS.emotionalLanguage.test(text)) {
        issues.push('Contains emotional/subjective language');
        suggestions.push('Use objective, factual descriptions instead of emotional terms');
        score -= 10;
        severity = VALIDATION_SEVERITY.WARNING;
      }

      if (LANGUAGE_STANDARDS.informalLanguage.test(text)) {
        issues.push('Contains informal language');
        suggestions.push('Use formal, professional language appropriate for legal documents');
        score -= 10;
        severity = VALIDATION_SEVERITY.WARNING;
      }

      if (LANGUAGE_STANDARDS.vagueQuantifiers.test(text)) {
        issues.push('Contains vague quantifiers');
        suggestions.push('Provide specific numbers, dates, or timeframes instead of vague terms');
        score -= 5;
        if (severity === VALIDATION_SEVERITY.SUCCESS) {
          severity = VALIDATION_SEVERITY.INFO;
        }
      }
    }

    // Check for positive indicators
    const hasSpecificDates = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(text);
    const hasSpecificAmounts = /\$\d+(\.\d{2})?/.test(text);
    const hasSpecificTimes = /\b\d{1,2}:\d{2}\b/.test(text);

    if (hasSpecificDates || hasSpecificAmounts || hasSpecificTimes) {
      score += 5;
      suggestions.push('Good use of specific details');
    }

    return {
      issues,
      suggestions,
      score: Math.max(0, Math.min(100, score)),
      severity,
      hasProblematicContent: severity === VALIDATION_SEVERITY.CRITICAL
    };
  }

  /**
   * Generate professional rewrite of fact content
   * 
   * @param {string} originalText - Original fact text
   * @param {Object} analysis - Analysis results
   * @returns {string} Professional version
   */
  generateProfessionalRewrite(originalText, analysis) {
    if (analysis.severity === VALIDATION_SEVERITY.CRITICAL) {
      return "[INAPPROPRIATE CONTENT - REQUIRES COMPLETE REWRITE WITH FACTUAL INFORMATION ONLY]";
    }

    let rewritten = originalText;

    // Apply standard replacements
    Object.entries(LANGUAGE_STANDARDS.replacements).forEach(([original, replacement]) => {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      rewritten = rewritten.replace(regex, replacement);
    });

    // Clean up common issues
    rewritten = rewritten
      .replace(/\bkinda\b/gi, 'somewhat')
      .replace(/\bsorta\b/gi, 'somewhat')
      .replace(/\baround\s+(\$?\d+)/gi, 'approximately $1')
      .replace(/\babout\s+(\$?\d+)/gi, 'approximately $1');

    return rewritten;
  }

  /**
   * Determine fact category based on content analysis
   * 
   * @param {string} text - Fact text to categorize
   * @returns {Object} Category information
   */
  categorizeFact(text) {
    const lowerText = text.toLowerCase();

    // Financial indicators
    if (/\b(money|paid|cost|income|debt|asset|financial|support|payment|salary|wage|bank|loan)\b/.test(lowerText)) {
      const subcategory = /\b(support|alimony|child support)\b/.test(lowerText) ? 'support' : 'payments';
      return { category: 'financial', subcategory };
    }

    // Property indicators
    if (/\b(house|property|car|vehicle|owned|residence|address|real estate|land|building)\b/.test(lowerText)) {
      const subcategory = /\b(house|residence|address|real estate|land|building)\b/.test(lowerText) ? 'real_estate' : 'personal_property';
      return { category: 'property', subcategory };
    }

    // Witness testimony indicators
    if (/\b(saw|observed|witnessed|heard|present|observed|noticed|watched)\b/.test(lowerText)) {
      return { category: 'witness', subcategory: 'observations' };
    }

    // Relational indicators
    if (/\b(spouse|child|parent|family|married|divorce|custody|visitation|relationship)\b/.test(lowerText)) {
      const subcategory = /\b(custody|visitation)\b/.test(lowerText) ? 'custody' : 'family';
      return { category: 'relational', subcategory };
    }

    // Temporal indicators
    if (/\b(date|time|when|during|before|after|on|at|occurred|happened)\b/.test(lowerText)) {
      return { category: 'temporal', subcategory: 'dates' };
    }

    // Communication indicators
    if (/\b(said|told|email|called|message|conversation|spoke|text|letter|phone)\b/.test(lowerText)) {
      return { category: 'communication', subcategory: 'verbal' };
    }

    // Behavioral indicators
    if (/\b(did|action|behavior|acted|performed|conduct|actions)\b/.test(lowerText)) {
      return { category: 'behavioral', subcategory: 'actions' };
    }

    return { category: 'general', subcategory: 'other' };
  }

  /**
   * Perform LLM validation for comprehensive analysis
   * 
   * @param {Object} fact - Fact to validate
   * @param {Array} existingFacts - Context facts
   * @param {Object} context - Document context
   * @returns {Promise<Object>} LLM validation result
   */
  async performLLMValidation(fact, existingFacts, context) {
    const prompt = this.buildProfessionalValidationPrompt(fact, existingFacts, context);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: this.getProfessionalSystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 800
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Perform LLM batch validation
   * 
   * @param {Array} facts - Facts to validate
   * @param {Object} context - Document context
   * @returns {Promise<Object>} Batch validation result
   */
  async performLLMBatchValidation(facts, context) {
    const prompt = this.buildBatchValidationPrompt(facts, context);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: this.getBatchSystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Build validation prompt for single fact
   */
  buildProfessionalValidationPrompt(fact, existingFacts, context) {
    const factText = fact.content || fact;
    
    let prompt = `ANALYZE THIS FACT FOR LEGAL AFFIDAVIT: "${factText}"
    
CONTEXT:
- Document type: ${context.documentType || 'affidavit'}
- State: ${context.state || 'general'}
- Case type: ${context.caseType || 'general'}
- Affiant: ${context.affiantName || 'Not specified'}`;

    if (existingFacts.length > 0) {
      prompt += `\n\nEXISTING FACTS (check for duplicates):`;
      existingFacts.slice(0, 5).forEach((existing, index) => {
        const existingText = existing.content || existing;
        prompt += `\n${index}: "${existingText.substring(0, 100)}${existingText.length > 100 ? '...' : ''}"`;
      });
    }

    prompt += `\n\nANALYZE FOR:
1. Professional legal language standards
2. Proper categorization and subcategory
3. Legal admissibility concerns
4. Specificity and clarity
5. Duplicate detection
6. Rewrite in professional legal language

Respond in JSON format only.`;
    
    return prompt;
  }

  /**
   * Build batch validation prompt
   */
  buildBatchValidationPrompt(facts, context) {
    let prompt = `ANALYZE THESE FACTS FOR PROFESSIONAL LEGAL AFFIDAVIT:\n`;
    
    facts.forEach((fact, index) => {
      const factText = fact.content || fact;
      prompt += `${index}: "${factText}"\n`;
    });

    prompt += `
CONTEXT:
- Document type: ${context.documentType || 'affidavit'}
- State: ${context.state || 'general'}
- Case type: ${context.caseType || 'general'}
- Court: ${context.court || 'general'}

ANALYZE FOR PROFESSIONAL LEGAL STANDARDS and respond in JSON format only.`;
    
    return prompt;
  }

  /**
   * Get system prompt for professional validation
   */
  getProfessionalSystemPrompt() {
    return `You are a legal document expert specializing in affidavit preparation. Analyze facts for professional legal standards.

LEGAL CATEGORIES & SUBCATEGORIES:
- financial: income, assets, debts, payments, support, expenses
- property: real_estate, personal_property, vehicles, intellectual_property  
- relational: family, custody, visitation, marriage, divorce
- temporal: dates, timelines, sequences, duration
- witness: observations, conversations, events, actions
- communication: verbal, written, electronic, legal_notices
- behavioral: actions, patterns, violations, compliance
- procedural: service, notices, filings, hearings
- background: identity, qualifications, context, relationships

PROFESSIONAL LANGUAGE STANDARDS:
1. OBJECTIVE: No emotions, opinions, or subjective language
2. SPECIFIC: Exact dates, amounts, names, locations
3. FIRST-PERSON: Consistent "I" perspective 
4. FACTUAL: Based on personal knowledge only
5. CLEAR: Short, clear sentences
6. FORMAL: Professional legal language
7. COMPLETE: Full context and details

PROHIBITED LANGUAGE:
- Emotional: terrible, awful, amazing, wonderful
- Uncertain: maybe, probably, might, I think
- Informal: kinda, sorta, like totally
- Absolute without basis: always, never, everyone

RESPONSE FORMAT (JSON):
{
  "isValid": boolean,
  "category": "primary_category",
  "subcategory": "specific_subcategory", 
  "professionalVersion": "rewritten fact in professional legal language",
  "languageIssues": ["list of language problems"],
  "legalIssues": ["legal admissibility concerns"],
  "improvements": ["specific suggestions"],
  "confidence": 0.0-1.0,
  "legalStandardScore": 0-100,
  "duplicateIndex": null or index
}`;
  }

  /**
   * Get system prompt for batch validation
   */
  getBatchSystemPrompt() {
    return `You are analyzing multiple facts for a legal affidavit. Apply professional legal standards to each fact.

FOCUS ON:
- Professional legal language
- Proper categorization
- Legal admissibility  
- Coherent narrative flow
- Chronological organization
- Avoiding duplicates and contradictions

RESPONSE FORMAT (JSON):
{
  "overallProfessional": boolean,
  "narrativeFlow": "assessment of logical flow",
  "recommendedOrder": [array of indices for optimal fact order],
  "globalIssues": ["issues affecting entire document"],
  "professionalSummary": "brief professional assessment",
  "facts": [
    {
      "isValid": boolean,
      "category": "category",
      "subcategory": "subcategory",
      "professionalVersion": "rewritten fact",
      "languageIssues": [],
      "legalIssues": [],
      "improvements": [],
      "legalStandardScore": 0-100,
      "duplicateIndex": null
    }
  ]
}`;
  }

  /**
   * Combine local and LLM analysis results
   */
  combineAnalysisResults(localAnalysis, llmResult, originalFact) {
    const factText = originalFact.content || originalFact;
    const categoryInfo = this.categorizeFact(factText);

    return {
      isValid: localAnalysis.severity !== VALIDATION_SEVERITY.CRITICAL && (llmResult.isValid ?? true),
      category: llmResult.category || categoryInfo.category,
      subcategory: llmResult.subcategory || categoryInfo.subcategory,
      enhancedCategory: this.enhanceCategory(
        llmResult.category || categoryInfo.category, 
        llmResult.subcategory || categoryInfo.subcategory
      ),
      professionalRewrite: llmResult.professionalVersion || this.generateProfessionalRewrite(factText, localAnalysis),
      languageIssues: [...localAnalysis.issues, ...(llmResult.languageIssues || [])],
      legalIssues: llmResult.legalIssues || (localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL ? ['Contains inappropriate content for legal documents'] : []),
      improvements: [...localAnalysis.suggestions, ...(llmResult.improvements || [])],
      legalStandardScore: Math.min(localAnalysis.score, llmResult.legalStandardScore || 85),
      confidence: llmResult.confidence || 0.8,
      duplicateIndex: llmResult.duplicateIndex || null,
      severity: localAnalysis.severity
    };
  }

  /**
   * Build result for critical validation failures
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
      languageIssues: localAnalysis.issues,
      legalIssues: ['Contains inappropriate content that must be removed before legal use'],
      improvements: localAnalysis.suggestions,
      legalStandardScore: localAnalysis.score,
      confidence: 0.95,
      duplicateIndex: null,
      severity: VALIDATION_SEVERITY.CRITICAL
    };
  }

  /**
   * Build fallback result when LLM fails
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
      languageIssues: localAnalysis.issues,
      legalIssues: localAnalysis.severity === VALIDATION_SEVERITY.CRITICAL ? ['Contains inappropriate content'] : [],
      improvements: localAnalysis.suggestions,
      legalStandardScore: localAnalysis.score,
      confidence: 0.6,
      duplicateIndex: null,
      severity: localAnalysis.severity
    };
  }

  /**
   * Build comprehensive batch result
   */
  buildBatchResult(results, hasCriticalIssues) {
    const validResults = results.filter(r => r.isValid);
    const avgScore = results.reduce((sum, r) => sum + r.legalStandardScore, 0) / results.length;

    return {
      overallProfessional: !hasCriticalIssues && avgScore >= 70,
      readyForCourt: validResults.length === results.length && avgScore >= 75,
      professionalStandard: {
        averageScore: avgScore,
        meetsProfessionalStandard: avgScore >= 70 && !hasCriticalIssues
      },
      narrativeFlow: hasCriticalIssues ? 
        'Document contains critical issues that must be resolved' : 
        'Facts appear to follow a logical sequence for legal proceedings',
      recommendedOrder: results.map((_, index) => index),
      globalIssues: this.identifyGlobalIssues(results, hasCriticalIssues),
      professionalSummary: `${results.length} facts analyzed. Average score: ${Math.round(avgScore)}/100. ${hasCriticalIssues ? 'CRITICAL issues detected.' : 'Professional standards assessment complete.'}`,
      facts: results,
      results
    };
  }

  /**
   * Identify global issues across all facts
   */
  identifyGlobalIssues(results, hasCriticalIssues) {
    const issues = [];

    if (hasCriticalIssues) {
      issues.push('CRITICAL: Document contains inappropriate content that must be removed before legal use');
    }

    const lowScoreFacts = results.filter(r => r.legalStandardScore < 60);
    if (lowScoreFacts.length > 0) {
      issues.push(`${lowScoreFacts.length} facts need significant improvement for legal use`);
    }

    const unprofessionalFacts = results.filter(r => 
      r.languageIssues.some(issue => !issue.includes('CRITICAL'))
    );
    if (unprofessionalFacts.length > 0) {
      issues.push('Some facts contain unprofessional language that should be revised');
    }

    return issues;
  }

  /**
   * Build empty batch result
   */
  buildEmptyBatchResult() {
    return {
      overallProfessional: false,
      readyForCourt: false,
      professionalStandard: { averageScore: 0, meetsProfessionalStandard: false },
      narrativeFlow: 'No facts to analyze',
      recommendedOrder: [],
      globalIssues: ['No facts provided for analysis'],
      professionalSummary: 'No facts to analyze',
      facts: [],
      results: []
    };
  }

  /**
   * Build fallback batch result
   */
  buildFallbackBatchResult(facts) {
    const results = facts.map(fact => this.buildFallbackResult(fact, fact.content || fact));
    return this.buildBatchResult(results, results.some(r => r.severity === VALIDATION_SEVERITY.CRITICAL));
  }

  /**
   * Enhance category information
   */
  enhanceCategory(category, subcategory) {
    const categoryInfo = LEGAL_CATEGORIES[category] || LEGAL_CATEGORIES.background;
    
    return {
      category,
      subcategory: subcategory || 'general',
      name: categoryInfo.name,
      description: categoryInfo.description,
      isValid: categoryInfo.subcategories.includes(subcategory) || subcategory === 'general'
    };
  }

  /**
   * Generate cache key for validation results
   */
  generateCacheKey(text, context) {
    const contextKey = `${context.state || ''}_${context.caseType || ''}_${context.documentType || ''}`;
    const textHash = text.length + text.substring(0, 50);
    return `${contextKey}_${textHash}`;
  }

  /**
   * Respect rate limiting for API calls
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
    }
    
    this.lastApiCall = Date.now();
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      keys: Array.from(this.validationCache.keys())
    };
  }
}

export default EnhancedFactValidationService;