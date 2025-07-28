// services/enhancedFactValidationService.js
class EnhancedFactValidationService {
  constructor(openaiClient, language = 'en') {
    this.openai = openaiClient;
    this.language = language;
    
    // Professional legal categories with subcategories
    this.legalCategories = {
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

    // Professional language standards
    this.languageStandards = {
      prohibited: [
        // Emotional/subjective language
        'terrible', 'horrible', 'awful', 'amazing', 'wonderful', 'devastating',
        // Uncertain language
        'maybe', 'probably', 'might', 'could be', 'i think', 'i believe', 'possibly',
        // Informal language
        'kinda', 'sorta', 'like totally', 'whatever', 'anyway',
        // Absolute statements without basis
        'always', 'never', 'everyone', 'nobody', 'constantly'
      ],
      preferred: {
        'maybe': 'to my knowledge',
        'i think': 'it is my understanding that',
        'probably': 'it appears that',
        'terrible': 'problematic',
        'awful': 'concerning',
        'amazing': 'notable',
        'always': 'consistently',
        'never': 'has not occurred to my knowledge'
      },
      legalTerms: [
        'pursuant to', 'heretofore', 'whereas', 'to wit', 'inter alia',
        'prima facie', 'bona fide', 'in good faith', 'willful', 'material'
      ]
    };
  }

  /**
   * Enhanced fact validation with professional language checking
   */
  async validateFactProfessional(fact, existingFacts = [], context = {}) {
    try {
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

      const result = JSON.parse(response.choices[0].message.content);
      
      // Add local language analysis
      const languageAnalysis = this.analyzeLanguageProfessionalism(fact.content || fact);
      
      return {
        ...result,
        languageAnalysis,
        enhancedCategory: this.enhanceCategory(result.category, result.subcategory),
        professionalRewrite: result.professionalVersion,
        legalStandard: this.assessLegalStandard(fact.content || fact, result)
      };
      
    } catch (error) {
      console.error('Professional fact validation failed:', error);
      return this.fallbackProfessionalValidation(fact, existingFacts);
    }
  }

  /**
   * Analyze language professionalism locally
   */
  analyzeLanguageProfessionalism(text) {
    const issues = [];
    const suggestions = [];
    const score = { total: 100 };

    const lowerText = text.toLowerCase();

    // Check for prohibited language
    this.languageStandards.prohibited.forEach(term => {
      if (lowerText.includes(term)) {
        issues.push(`Unprofessional language: "${term}"`);
        score.total -= 10;
        
        if (this.languageStandards.preferred[term]) {
          suggestions.push(`Replace "${term}" with "${this.languageStandards.preferred[term]}"`);
        }
      }
    });

    // Check for first person consistency
    const hasFirstPerson = /\b(I|me|my|mine)\b/i.test(text);
    const hasThirdPerson = /\b(he|she|they|them|his|her|their)\b/i.test(text);
    
    if (hasFirstPerson && hasThirdPerson) {
      issues.push('Mixed first and third person perspective');
      suggestions.push('Maintain consistent first-person perspective in affidavits');
      score.total -= 5;
    }

    // Check for proper legal structure
    if (!text.trim().endsWith('.')) {
      issues.push('Missing proper punctuation');
      suggestions.push('End statements with proper punctuation');
      score.total -= 2;
    }

    // Check for vague quantifiers
    const vague = ['some', 'many', 'few', 'several', 'often', 'sometimes'];
    vague.forEach(term => {
      if (lowerText.includes(term)) {
        suggestions.push(`Be more specific than "${term}" - provide exact numbers or timeframes`);
        score.total -= 3;
      }
    });

    // Check for proper legal language
    const hasLegalTerms = this.languageStandards.legalTerms.some(term => 
      lowerText.includes(term.toLowerCase())
    );
    
    if (hasLegalTerms) {
      score.total += 5; // Bonus for proper legal language
    }

    return {
      issues,
      suggestions,
      score: Math.max(0, Math.min(100, score.total)),
      hasProperLegalLanguage: hasLegalTerms,
      needsRewrite: score.total < 70
    };
  }

  /**
   * Enhanced category with subcategory
   */
  enhanceCategory(category, subcategory) {
    const categoryInfo = this.legalCategories[category];
    if (!categoryInfo) {
      return { category: 'general', subcategory: 'other', description: 'General factual statement' };
    }

    return {
      category,
      subcategory: subcategory || 'general',
      name: categoryInfo.name,
      description: categoryInfo.description,
      isValid: categoryInfo.subcategories.includes(subcategory) || subcategory === 'general'
    };
  }

  /**
   * Assess legal standard compliance
   */
  assessLegalStandard(text, validationResult) {
    const standards = {
      specificity: this.assessSpecificity(text),
      objectivity: this.assessObjectivity(text),
      relevance: this.assessRelevance(text, validationResult.category),
      admissibility: this.assessAdmissibility(text),
      clarity: this.assessClarity(text)
    };

    const overallScore = Object.values(standards).reduce((sum, std) => sum + std.score, 0) / 5;

    return {
      standards,
      overallScore,
      meetsLegalStandard: overallScore >= 70,
      recommendations: this.generateLegalRecommendations(standards)
    };
  }

  assessSpecificity(text) {
    const vague = ['some', 'many', 'often', 'sometimes', 'around', 'about', 'approximately'];
    const specific = /\b\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{1,2}:\d{2}\b/i;
    
    const hasVague = vague.some(term => text.toLowerCase().includes(term));
    const hasSpecific = specific.test(text);
    
    let score = 50;
    if (hasSpecific) score += 30;
    if (hasVague) score -= 20;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      hasSpecific,
      hasVague,
      recommendation: hasVague ? 'Add specific dates, times, amounts, or names' : null
    };
  }

  assessObjectivity(text) {
    const subjective = ['beautiful', 'ugly', 'good', 'bad', 'nice', 'mean', 'terrible', 'wonderful'];
    const objective = ['stated', 'observed', 'measured', 'documented', 'recorded'];
    
    const hasSubjective = subjective.some(term => text.toLowerCase().includes(term));
    const hasObjective = objective.some(term => text.toLowerCase().includes(term));
    
    let score = 70;
    if (hasSubjective) score -= 30;
    if (hasObjective) score += 20;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      hasSubjective,
      hasObjective,
      recommendation: hasSubjective ? 'Remove subjective opinions and stick to observable facts' : null
    };
  }

  assessRelevance(text, category) {
    // Basic relevance assessment based on category keywords
    const categoryKeywords = {
      financial: ['money', 'paid', 'cost', 'income', 'debt', 'asset'],
      property: ['house', 'car', 'property', 'owned', 'vehicle'],
      witness: ['saw', 'observed', 'witnessed', 'heard'],
      relational: ['spouse', 'child', 'parent', 'family', 'married'],
      temporal: ['date', 'time', 'when', 'during', 'before', 'after']
    };

    const keywords = categoryKeywords[category] || [];
    const hasRelevantKeywords = keywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );

    return {
      score: hasRelevantKeywords ? 80 : 60,
      hasRelevantKeywords,
      recommendation: !hasRelevantKeywords ? `Add details relevant to ${category} matters` : null
    };
  }

  assessAdmissibility(text) {
    const hearsay = ['he said', 'she said', 'they told me', 'i heard that', 'someone said'];
    const firstHand = ['i saw', 'i observed', 'i witnessed', 'i experienced'];
    
    const hasHearsay = hearsay.some(phrase => text.toLowerCase().includes(phrase));
    const hasFirstHand = firstHand.some(phrase => text.toLowerCase().includes(phrase));
    
    let score = 70;
    if (hasHearsay) score -= 25;
    if (hasFirstHand) score += 20;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      hasHearsay,
      hasFirstHand,
      recommendation: hasHearsay ? 'Focus on personal knowledge and direct observations' : null
    };
  }

  assessClarity(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    let score = 80;
    if (avgLength > 150) score -= 20; // Too long
    if (avgLength < 20) score -= 10;  // Too short
    if (sentences.length === 1 && text.length > 200) score -= 15; // Run-on sentence
    
    return {
      score: Math.max(0, Math.min(100, score)),
      avgSentenceLength: avgLength,
      sentenceCount: sentences.length,
      recommendation: avgLength > 150 ? 'Break into shorter, clearer sentences' : null
    };
  }

  generateLegalRecommendations(standards) {
    const recommendations = [];
    
    Object.entries(standards).forEach(([area, assessment]) => {
      if (assessment.recommendation) {
        recommendations.push(`${area}: ${assessment.recommendation}`);
      }
    });

    return recommendations;
  }

  /**
   * Professional system prompt for LLM
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
   * Build professional validation prompt
   */
  buildProfessionalValidationPrompt(fact, existingFacts, context) {
    const factText = fact.content || fact;
    
    let prompt = `ANALYZE THIS FACT FOR LEGAL AFFIDAVIT:
"${factText}"

CONTEXT:
- Document: ${context.documentType || 'General Affidavit'}
- State: ${context.state || 'General'}
- Affiant: ${context.affiantName || 'Not specified'}
- Case Type: ${context.caseType || 'General'}`;

    if (existingFacts.length > 0) {
      prompt += `\n\nEXISTING FACTS (check for duplicates):`;
      existingFacts.slice(0, 5).forEach((existing, index) => {
        const existingText = existing.content || existing;
        prompt += `\n${index}: "${existingText.substring(0, 100)}..."`;
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
   * Batch professional validation
   */
  async validateFactsBatchProfessional(facts, context = {}) {
    try {
      const prompt = this.buildBatchProfessionalPrompt(facts, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: this.getBatchProfessionalSystemPrompt() },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      });

      const batchResult = JSON.parse(response.choices[0].message.content);
      
      // Enhance each fact result
      const enhancedResults = batchResult.facts.map((factResult, index) => ({
        index,
        originalFact: facts[index],
        ...factResult,
        enhancedCategory: this.enhanceCategory(factResult.category, factResult.subcategory),
        languageAnalysis: this.analyzeLanguageProfessionalism(facts[index].content || facts[index])
      }));

      return {
        ...batchResult,
        results: enhancedResults,
        professionalStandard: this.assessBatchProfessionalStandard(enhancedResults),
        readyForCourt: enhancedResults.every(r => r.legalStandardScore >= 70)
      };
      
    } catch (error) {
      console.error('Batch professional validation failed:', error);
      return this.fallbackBatchValidation(facts);
    }
  }

  assessBatchProfessionalStandard(results) {
    const scores = results.map(r => r.legalStandardScore || 50);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return {
      averageScore: avgScore,
      meetsProfessionalStandard: avgScore >= 75,
      needsImprovement: results.filter(r => (r.legalStandardScore || 50) < 70).length,
      recommendations: this.generateBatchRecommendations(results)
    };
  }

  generateBatchRecommendations(results) {
    const issues = [];
    
    const lowScores = results.filter(r => (r.legalStandardScore || 50) < 70);
    if (lowScores.length > 0) {
      issues.push(`${lowScores.length} facts need professional language improvement`);
    }

    const emotional = results.filter(r => 
      r.languageAnalysis?.issues?.some(issue => issue.includes('Unprofessional'))
    );
    if (emotional.length > 0) {
      issues.push('Remove emotional and subjective language');
    }

    return issues;
  }

  getBatchProfessionalSystemPrompt() {
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

  buildBatchProfessionalPrompt(facts, context) {
    let prompt = `ANALYZE THESE FACTS FOR PROFESSIONAL LEGAL AFFIDAVIT:

`;
    
    facts.forEach((fact, index) => {
      const factText = fact.content || fact;
      prompt += `${index}: "${factText}"\n`;
    });

    prompt += `
CONTEXT:
- Document: ${context.documentType || 'General Affidavit'}
- State: ${context.state || 'General'}
- Case Type: ${context.caseType || 'General'}
- Court: ${context.court || 'General'}

ANALYZE FOR PROFESSIONAL LEGAL STANDARDS and respond in JSON format only.`;
    
    return prompt;
  }

  fallbackProfessionalValidation(fact, existingFacts = []) {
    const content = fact.content || fact;
    const languageAnalysis = this.analyzeLanguageProfessionalism(content);
    
    return {
      isValid: languageAnalysis.score >= 50,
      category: 'general',
      subcategory: 'other',
      professionalVersion: content,
      languageIssues: languageAnalysis.issues,
      legalIssues: [],
      improvements: languageAnalysis.suggestions,
      confidence: 0.6,
      legalStandardScore: languageAnalysis.score,
      duplicateIndex: null,
      languageAnalysis,
      enhancedCategory: this.enhanceCategory('general', 'other')
    };
  }
}

export default EnhancedFactValidationService;