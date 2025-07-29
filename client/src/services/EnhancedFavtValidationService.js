// client/src/services/EnhancedFactValidationService.js
class EnhancedFactValidationService {
  constructor() {
    this.apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.validationCache = new Map();
    this.categories = this.initializeCategories();
  }

  initializeCategories() {
    return {
      financial: {
        name: 'Financial',
        description: 'Money, assets, income, debts, financial transactions',
        subcategories: ['income', 'expenses', 'assets', 'debts', 'support', 'payments']
      },
      property: {
        name: 'Property',
        description: 'Real estate, personal property, vehicles',
        subcategories: ['real_estate', 'personal_property', 'vehicles', 'ownership']
      },
      witness: {
        name: 'Witness Testimony',
        description: 'Direct observations, witnessed events',
        subcategories: ['observations', 'events', 'conversations', 'behavior']
      },
      relational: {
        name: 'Relationships',
        description: 'Family, custody, marriage, divorce',
        subcategories: ['family', 'custody', 'marriage', 'divorce', 'children']
      },
      temporal: {
        name: 'Chronological',
        description: 'Dates, times, sequences, timelines',
        subcategories: ['dates', 'times', 'sequences', 'duration']
      },
      personal: {
        name: 'Personal Information',
        description: 'Identity, background, qualifications',
        subcategories: ['identity', 'background', 'qualifications', 'employment']
      },
      legal: {
        name: 'Legal Matters',
        description: 'Court proceedings, legal documents, compliance',
        subcategories: ['proceedings', 'documents', 'compliance', 'orders']
      },
      communication: {
        name: 'Communications',
        description: 'Conversations, emails, letters, agreements',
        subcategories: ['verbal', 'written', 'electronic', 'agreements']
      },
      general: {
        name: 'General',
        description: 'General factual statements',
        subcategories: ['other', 'miscellaneous']
      }
    };
  }

  // Validate a single fact
  async validateFact(fact, existingFacts = [], context = {}) {
    const factText = fact.content || fact;
    const cacheKey = this.generateCacheKey(factText, context);

    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
    }

    try {
      // Try API validation first
      const apiResult = await this.validateFactWithAPI(fact, existingFacts, context);
      if (apiResult) {
        this.validationCache.set(cacheKey, apiResult);
        return apiResult;
      }
    } catch (error) {
      console.error('API validation failed, using fallback:', error);
    }

    // Fallback to local validation
    const fallbackResult = this.fallbackValidation(fact, existingFacts, context);
    this.validationCache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }

  // API-based validation
  async validateFactWithAPI(fact, existingFacts, context) {
    try {
      const response = await fetch(`${this.apiBase}/api/validate/fact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fact,
          existingFacts: existingFacts.slice(0, 10), // Limit to prevent large payloads
          context
        })
      });

      if (response.ok) {
        const result = await response.json();
        return this.enhanceValidationResult(result);
      }
      
      throw new Error(`API validation failed: ${response.status}`);
    } catch (error) {
      console.error('API validation error:', error);
      return null;
    }
  }

  // Enhanced fallback validation
  fallbackValidation(fact, existingFacts = [], context = {}) {
    const factText = fact.content || fact;
    
    // Basic validation checks
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Length validation
    if (factText.length < 10) {
      validation.warnings.push('Fact may be too brief for legal purposes');
    }
    if (factText.length > 500) {
      validation.warnings.push('Consider breaking this into multiple facts');
    }

    // Language analysis
    const languageAnalysis = this.analyzeLanguage(factText);
    validation.languageIssues = languageAnalysis.issues;
    validation.suggestions.push(...languageAnalysis.suggestions);

    // Category detection
    const category = this.detectCategory(factText);
    
    // Professional rewrite
    const professionalVersion = this.generateProfessionalVersion(factText, category);

    // Duplicate detection
    const duplicateIndex = this.findDuplicates(factText, existingFacts);

    // Legal standard scoring
    const legalStandardScore = this.calculateLegalScore(factText, languageAnalysis);

    return {
      isValid: validation.errors.length === 0,
      category: category.primary,
      subcategory: category.secondary,
      professionalVersion,
      languageIssues: validation.languageIssues,
      legalIssues: validation.errors,
      improvements: validation.suggestions,
      confidence: 0.75, // Fallback confidence
      legalStandardScore,
      duplicateIndex,
      enhancedCategory: this.enhanceCategory(category.primary, category.secondary)
    };
  }

  // Analyze language quality
  analyzeLanguage(text) {
    const issues = [];
    const suggestions = [];

    // Check for problematic language
    const problematicPatterns = [
      { pattern: /\b(maybe|probably|might|i think|i believe)\b/gi, issue: 'Uncertain language detected' },
      { pattern: /\b(terrible|awful|amazing|wonderful)\b/gi, issue: 'Emotional language detected' },
      { pattern: /\b(kinda|sorta|like totally)\b/gi, issue: 'Informal language detected' },
      { pattern: /\b(always|never|everyone|nobody)\b/gi, issue: 'Absolute statements without basis' }
    ];

    problematicPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(text)) {
        issues.push(issue);
        suggestions.push(`Consider rephrasing to avoid ${issue.toLowerCase()}`);
      }
    });

    // Check for offensive content
    const offensivePattern = /\b(fuck|shit|damn|hell|bitch|asshole|cunt|bastard)\b/gi;
    if (offensivePattern.test(text)) {
      issues.push('CRITICAL: Inappropriate language for legal documents');
      suggestions.push('Remove all inappropriate language and use professional terms');
    }

    // Check for first-person consistency
    if (!/\bi\b/i.test(text) && text.length > 20) {
      suggestions.push('Consider using first-person perspective (I) for affidavit statements');
    }

    return { issues, suggestions };
  }

  // Detect category of the fact
  detectCategory(text) {
    const lowerText = text.toLowerCase();
    
    // Financial indicators
    if (/\b(money|dollar|income|salary|pay|cost|price|asset|debt|loan|mortgage|rent|support|alimony)\b/.test(lowerText)) {
      return { primary: 'financial', secondary: this.detectFinancialSubcategory(lowerText) };
    }
    
    // Property indicators
    if (/\b(house|home|property|car|vehicle|land|real estate|apartment|condo)\b/.test(lowerText)) {
      return { primary: 'property', secondary: this.detectPropertySubcategory(lowerText) };
    }
    
    // Witness indicators
    if (/\b(saw|observed|witnessed|heard|present|noticed|watched)\b/.test(lowerText)) {
      return { primary: 'witness', secondary: 'observations' };
    }
    
    // Relational indicators
    if (/\b(spouse|husband|wife|child|children|parent|family|custody|divorce|marriage)\b/.test(lowerText)) {
      return { primary: 'relational', secondary: this.detectRelationalSubcategory(lowerText) };
    }
    
    // Temporal indicators
    if (/\b(date|time|when|during|before|after|on|at|from|until|since)\b/.test(lowerText)) {
      return { primary: 'temporal', secondary: 'dates' };
    }
    
    // Personal indicators
    if (/\b(name|age|address|occupation|education|qualification|background)\b/.test(lowerText)) {
      return { primary: 'personal', secondary: 'identity' };
    }
    
    // Legal indicators
    if (/\b(court|judge|lawyer|attorney|legal|lawsuit|case|proceeding|order)\b/.test(lowerText)) {
      return { primary: 'legal', secondary: 'proceedings' };
    }
    
    // Communication indicators
    if (/\b(said|told|conversation|email|letter|text|message|agreement|contract)\b/.test(lowerText)) {
      return { primary: 'communication', secondary: this.detectCommunicationSubcategory(lowerText) };
    }
    
    return { primary: 'general', secondary: 'other' };
  }

  // Subcategory detection helpers
  detectFinancialSubcategory(text) {
    if (/\b(income|salary|wages|earnings)\b/.test(text)) return 'income';
    if (/\b(expenses|costs|bills|spending)\b/.test(text)) return 'expenses';
    if (/\b(assets|property|investments)\b/.test(text)) return 'assets';
    if (/\b(debt|loan|mortgage|owe)\b/.test(text)) return 'debts';
    if (/\b(support|alimony|maintenance)\b/.test(text)) return 'support';
    return 'payments';
  }

  detectPropertySubcategory(text) {
    if (/\b(house|home|land|real estate|apartment|condo)\b/.test(text)) return 'real_estate';
    if (/\b(car|vehicle|truck|motorcycle)\b/.test(text)) return 'vehicles';
    return 'personal_property';
  }

  detectRelationalSubcategory(text) {
    if (/\b(custody|visitation|parenting)\b/.test(text)) return 'custody';
    if (/\b(divorce|separation|split)\b/.test(text)) return 'divorce';
    if (/\b(marriage|married|wedding)\b/.test(text)) return 'marriage';
    return 'family';
  }

  detectCommunicationSubcategory(text) {
    if (/\b(email|text|message|electronic)\b/.test(text)) return 'electronic';
    if (/\b(letter|document|written)\b/.test(text)) return 'written';
    if (/\b(agreement|contract|deal)\b/.test(text)) return 'agreements';
    return 'verbal';
  }

  // Generate professional version
  generateProfessionalVersion(text, category) {
    let professional = text;
    
    // Replace uncertain language
    professional = professional.replace(/\bmaybes?\b/gi, 'to my knowledge');
    professional = professional.replace(/\bprobably\b/gi, 'likely');
    professional = professional.replace(/\bi think\b/gi, 'it is my understanding that');
    professional = professional.replace(/\bi believe\b/gi, 'it is my belief that');
    
    // Replace informal language
    professional = professional.replace(/\bkinda\b/gi, 'somewhat');
    professional = professional.replace(/\bsorta\b/gi, 'somewhat');
    professional = professional.replace(/\baround\b/gi, 'approximately');
    professional = professional.replace(/\babout\b/gi, 'approximately');
    
    // Replace emotional language
    professional = professional.replace(/\bterrible\b/gi, 'concerning');
    professional = professional.replace(/\bawful\b/gi, 'problematic');
    professional = professional.replace(/\bamazing\b/gi, 'notable');
    professional = professional.replace(/\bwonderful\b/gi, 'positive');
    
    // Ensure first-person perspective
    if (!/\bi\b/i.test(professional) && professional.length > 20) {
      professional = `I attest that ${professional.toLowerCase()}`;
    }
    
    // Capitalize first letter
    professional = professional.charAt(0).toUpperCase() + professional.slice(1);
    
    // Ensure proper ending
    if (!/[.!?]$/.test(professional.trim())) {
      professional += '.';
    }
    
    return professional;
  }

  // Find duplicates
  findDuplicates(text, existingFacts) {
    const similarity = 0.8; // 80% similarity threshold
    
    for (let i = 0; i < existingFacts.length; i++) {
      const existingText = existingFacts[i].content || existingFacts[i];
      if (this.calculateSimilarity(text, existingText) > similarity) {
        return i;
      }
    }
    
    return null;
  }

  // Calculate text similarity (simple implementation)
  calculateSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  // Calculate legal standard score
  calculateLegalScore(text, languageAnalysis) {
    let score = 100;
    
    // Deduct for language issues
    score -= languageAnalysis.issues.length * 15;
    
    // Deduct for length issues
    if (text.length < 10) score -= 20;
    if (text.length > 500) score -= 10;
    
    // Deduct for missing first-person
    if (!/\bi\b/i.test(text) && text.length > 20) score -= 15;
    
    // Deduct for vague language
    if (/\b(some|many|few|several|various)\b/i.test(text)) score -= 10;
    
    // Deduct for lack of specificity
    if (!/\b\d+\b/.test(text) && text.length > 50) score -= 5; // No numbers
    
    return Math.max(0, Math.min(100, score));
  }

  // Enhance category information
  enhanceCategory(primary, secondary) {
    const categoryInfo = this.categories[primary];
    if (!categoryInfo) {
      return { category: primary, subcategory: secondary, name: 'Unknown', description: 'Unknown category' };
    }
    
    return {
      category: primary,
      subcategory: secondary,
      name: categoryInfo.name,
      description: categoryInfo.description,
      subcategories: categoryInfo.subcategories
    };
  }

  // Enhance validation result
  enhanceValidationResult(result) {
    return {
      ...result,
      enhancedCategory: this.enhanceCategory(result.category, result.subcategory),
      timestamp: new Date(),
      source: 'api'
    };
  }

  // Generate cache key
  generateCacheKey(text, context) {
    return `${text.substring(0, 50)}_${context.state || 'general'}_${context.documentType || 'general'}`;
  }

  // Batch validation
  async validateBatch(facts, context = {}) {
    const results = [];
    
    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      const existingFacts = facts.slice(0, i); // Facts before current one
      
      try {
        const result = await this.validateFact(fact, existingFacts, context);
        results.push(result);
      } catch (error) {
        console.error(`Validation failed for fact ${i}:`, error);
        results.push(this.fallbackValidation(fact, existingFacts, context));
      }
    }
    
    return {
      facts: results,
      overallValid: results.every(r => r.isValid),
      summary: this.generateBatchSummary(results)
    };
  }

  // Generate batch summary
  generateBatchSummary(results) {
    const totalFacts = results.length;
    const validFacts = results.filter(r => r.isValid).length;
    const categories = {};
    
    results.forEach(result => {
      const category = result.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    const avgScore = results.reduce((sum, r) => sum + (r.legalStandardScore || 0), 0) / totalFacts;
    
    return {
      totalFacts,
      validFacts,
      validityRate: (validFacts / totalFacts) * 100,
      categories,
      averageScore: Math.round(avgScore),
      needsAttention: results.filter(r => (r.legalStandardScore || 0) < 70).length
    };
  }

  // Clear cache
  clearCache() {
    this.validationCache.clear();
  }

  // Get cache size
  getCacheSize() {
    return this.validationCache.size;
  }
}

export default EnhancedFactValidationService;