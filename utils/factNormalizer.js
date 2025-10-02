// utils/factNormalizer.js
/**
 * Fact Normalization Utilities
 * Provides standardized fact structure across the application
 * 
 * Canonical Fact Structure (Option B):
 * {
 *   content: string,
 *   professionalRewrite: string|null,
 *   category: string,
 *   subcategory: string|null,
 *   confidence: number,
 *   severity: string,
 *   issues: array,
 *   suggestions: array,
 *   metadata: object
 * }
 */

/**
 * Normalize a fact to canonical structure
 * Handles all legacy formats and ensures consistent structure
 * 
 * @param {string|object} fact - Fact in any format
 * @returns {object} Normalized fact object
 */
function normalizeFact(fact) {
  // Handle null/undefined
  if (!fact) {
    return {
      content: '[Invalid fact - requires review]',
      professionalRewrite: null,
      category: 'general',
      subcategory: null,
      confidence: 0,
      severity: 'error',
      issues: ['Fact is null or undefined'],
      suggestions: ['Please provide valid fact content'],
      metadata: { normalized: true, originalType: typeof fact }
    };
  }

  // Handle string facts
  if (typeof fact === 'string') {
    return {
      content: fact.trim() || '[Invalid fact - requires review]',
      professionalRewrite: null,
      category: 'general',
      subcategory: null,
      confidence: 0.5,
      severity: 'info',
      issues: [],
      suggestions: [],
      metadata: { normalized: true, originalType: 'string' }
    };
  }

  // Handle object facts - merge with defaults
  if (typeof fact === 'object' && fact !== null) {
    // Extract content from various possible fields
    const content = fact.content || 
                   fact.text || 
                   fact.description || 
                   fact.professionalRewrite ||
                   '[Invalid fact - requires review]';

    return {
      content: String(content).trim(),
      professionalRewrite: fact.professionalRewrite || null,
      category: fact.category || 'general',
      subcategory: fact.subcategory || null,
      confidence: typeof fact.confidence === 'number' ? fact.confidence : 0.5,
      severity: fact.severity || 'info',
      issues: Array.isArray(fact.issues) ? fact.issues : 
              Array.isArray(fact.languageIssues) ? fact.languageIssues : [],
      suggestions: Array.isArray(fact.suggestions) ? fact.suggestions :
                  Array.isArray(fact.improvements) ? fact.improvements : [],
      metadata: {
        ...(fact.metadata || {}),
        normalized: true,
        originalType: 'object',
        hasRewrite: !!fact.professionalRewrite,
        needsReview: fact.needsReview || false,
        lastEdited: fact.lastEdited || null
      }
    };
  }

  // Fallback for unknown types
  return {
    content: '[Invalid fact format - requires review]',
    professionalRewrite: null,
    category: 'general',
    subcategory: null,
    confidence: 0,
    severity: 'error',
    issues: [`Unknown fact type: ${typeof fact}`],
    suggestions: ['Please provide valid fact content'],
    metadata: { normalized: true, originalType: typeof fact }
  };
}

/**
 * Normalize an array of facts
 * 
 * @param {array} facts - Array of facts in any format
 * @returns {array} Array of normalized facts
 */
function normalizeFacts(facts) {
  if (!Array.isArray(facts)) {
    return [];
  }

  return facts.map(normalizeFact);
}

/**
 * Extract display content from a fact (prioritizes professionalRewrite)
 * 
 * @param {string|object} fact - Fact in any format
 * @returns {string} Content to display
 */
function extractFactContent(fact) {
  const normalized = normalizeFact(fact);
  return normalized.professionalRewrite || normalized.content;
}

/**
 * Extract original content (ignores professionalRewrite)
 * 
 * @param {string|object} fact - Fact in any format
 * @returns {string} Original content
 */
function extractOriginalContent(fact) {
  const normalized = normalizeFact(fact);
  return normalized.content;
}

/**
 * Check if fact needs validation/review
 * 
 * @param {object} fact - Normalized fact
 * @returns {boolean} True if needs review
 */
function factNeedsReview(fact) {
  const normalized = normalizeFact(fact);
  
  return normalized.severity === 'error' ||
         normalized.severity === 'critical' ||
         normalized.issues.length > 0 ||
         normalized.metadata?.needsReview === true ||
         !normalized.professionalRewrite;
}

/**
 * Merge validation results into a fact
 * 
 * @param {object} fact - Existing fact
 * @param {object} validationResult - Validation result to merge
 * @returns {object} Updated fact with validation
 */
function mergeValidation(fact, validationResult) {
  const normalized = normalizeFact(fact);
  
  if (!validationResult || typeof validationResult !== 'object') {
    return normalized;
  }

  return {
    ...normalized,
    professionalRewrite: validationResult.professionalRewrite || normalized.professionalRewrite,
    category: validationResult.category || normalized.category,
    subcategory: validationResult.subcategory || normalized.subcategory,
    confidence: typeof validationResult.confidence === 'number' ? validationResult.confidence : normalized.confidence,
    severity: validationResult.severity || normalized.severity,
    issues: Array.isArray(validationResult.issues) ? validationResult.issues :
            Array.isArray(validationResult.languageIssues) ? validationResult.languageIssues :
            normalized.issues,
    suggestions: Array.isArray(validationResult.suggestions) ? validationResult.suggestions :
                Array.isArray(validationResult.improvements) ? validationResult.improvements :
                normalized.suggestions,
    metadata: {
      ...normalized.metadata,
      lastValidated: new Date().toISOString(),
      validationScore: validationResult.legalStandardScore || null,
      isValid: validationResult.isValid || false
    }
  };
}

/**
 * Prepare facts for database storage
 * Ensures all facts are in normalized format before JSON.stringify
 * 
 * @param {array} facts - Facts to prepare
 * @returns {array} Normalized facts ready for storage
 */
function prepareFactsForStorage(facts) {
  return normalizeFacts(facts);
}

/**
 * Prepare facts for display in UI
 * Adds display-specific properties
 * 
 * @param {array} facts - Facts to prepare
 * @returns {array} Facts with display properties
 */
function prepareFactsForDisplay(facts) {
  return normalizeFacts(facts).map((fact, index) => ({
    ...fact,
    index: index + 1,
    displayContent: fact.professionalRewrite || fact.content,
    hasIssues: fact.issues.length > 0,
    hasSuggestions: fact.suggestions.length > 0,
    needsAttention: factNeedsReview(fact)
  }));
}

module.exports = {
  normalizeFact,
  normalizeFacts,
  extractFactContent,
  extractOriginalContent,
  factNeedsReview,
  mergeValidation,
  prepareFactsForStorage,
  prepareFactsForDisplay
};
