// utils/factNormalizer.js
/**
 * Fact Normalization Utilities
 * Provides standardized fact structure across the application
 *
 * ── Supported fact categories ─────────────────────────────────────────────────
 * general      - General background facts
 * event        - Specific events or incidents (time, place, action)
 * financial    - Financial facts (income, assets, debts, amounts)
 * property     - Real or personal property facts
 * relational   - Facts about the relationship between parties
 * children     - Facts about minor children and their wellbeing
 * safety       - Safety concerns, threats, or history of violence
 * pattern      - Pattern of behavior (for DV, harassment, debt collection)
 * injury       - Physical or emotional injuries and medical facts
 * evidence     - Documentary evidence being attached as an exhibit
 * habitability - Property conditions (landlord-tenant habitability disputes)
 * exemption    - Legal exemptions or defenses (debt defense, bankruptcy)
 * heirship     - Estate, inheritance, and family tree facts (probate)
 * identity     - Identity, name, and relationship status facts
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Canonical Fact Structure (Option B):
 * {
 *   content: string,                      // Current displayed content
 *   originalContent: string,              // Original user-provided text (never changes)
 *   initialRewrite: string|null,          // First professional rewrite generated
 *   professionalRewrite: string|null,     // Current professional rewrite (can be regenerated)
 *   type: 'fact'|'evidence',              // Fact type (default: 'fact')
 *   category: string,
 *   subcategory: string|null,
 *   confidence: number,
 *   severity: string,
 *   issues: array,
 *   suggestions: array,
 *   metadata: object,
 *   evidenceData: {                       // Only present when type='evidence'
 *     exhibitLabel: string,               // Auto-calculated: A, B, C...
 *     description: string,                // User-provided description
 *     fileName: string,                   // Original upload filename
 *     fileKey: string,                    // Storage path/key
 *     fileType: string,                   // 'pdf' | 'jpg' | 'png'
 *     fileSizeBytes: number,
 *     filePages: number,                  // For PDFs
 *     uploadedAt: string,                 // ISO timestamp
 *     thumbnailKey: string,               // Path to thumbnail
 *     requiresUpload: boolean             // TRUE until file uploaded
 *   }
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
    const invalidContent = '[Invalid fact - requires review]';
    return {
      content: invalidContent,
      originalContent: invalidContent,
      initialRewrite: null,
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
    const trimmedContent = fact.trim() || '[Invalid fact - requires review]';
    return {
      content: trimmedContent,
      originalContent: trimmedContent,
      initialRewrite: null,
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

    // Migration: Set originalContent if not present
    const originalContent = fact.originalContent || String(content).trim();

    // Migration: Set initialRewrite from professionalRewrite if not present but rewrite exists
    const initialRewrite = fact.initialRewrite ||
                          (fact.professionalRewrite && !fact.initialRewrite ? fact.professionalRewrite : null);

    // Determine type: 'fact' or 'evidence'
    const type = fact.type === 'evidence' ? 'evidence' : 'fact';

    // Base normalized fact
    const normalized = {
      content: String(content).trim(),
      originalContent: originalContent,
      initialRewrite: initialRewrite,
      professionalRewrite: fact.professionalRewrite || null,
      type: type,
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

    // Add evidenceData if this is evidence type
    if (type === 'evidence') {
      normalized.evidenceData = {
        exhibitLabel: fact.evidenceData?.exhibitLabel || '',
        description: fact.evidenceData?.description || '',
        fileName: fact.evidenceData?.fileName || null,
        fileKey: fact.evidenceData?.fileKey || null,
        fileType: fact.evidenceData?.fileType || null,
        fileSizeBytes: fact.evidenceData?.fileSizeBytes || 0,
        filePages: fact.evidenceData?.filePages || 1,
        uploadedAt: fact.evidenceData?.uploadedAt || null,
        thumbnailKey: fact.evidenceData?.thumbnailKey || null,
        requiresUpload: fact.evidenceData?.requiresUpload !== false // Default true
      };
    }

    return normalized;
  }

  // Fallback for unknown types
  const invalidContent = '[Invalid fact format - requires review]';
  return {
    content: invalidContent,
    originalContent: invalidContent,
    initialRewrite: null,
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
 * Extract original content (user-provided text, never changes)
 *
 * @param {string|object} fact - Fact in any format
 * @returns {string} Original content
 */
function extractOriginalContent(fact) {
  const normalized = normalizeFact(fact);
  return normalized.originalContent;
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
    // Preserve originalContent (never changes)
    originalContent: normalized.originalContent,
    // Preserve initialRewrite (never changes once set)
    initialRewrite: normalized.initialRewrite,
    // Update professional rewrite from validation
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
    displayContent: fact.content,
    hasIssues: fact.issues.length > 0,
    hasSuggestions: fact.suggestions.length > 0,
    needsAttention: factNeedsReview(fact)
  }));
}

/**
 * Check if a fact is evidence type
 *
 * @param {object} fact - Fact to check
 * @returns {boolean} True if evidence
 */
function isEvidence(fact) {
  const normalized = normalizeFact(fact);
  return normalized.type === 'evidence';
}

/**
 * Check if evidence item has uploaded file
 *
 * @param {object} evidence - Evidence fact to check
 * @returns {boolean} True if file is uploaded
 */
function evidenceHasFile(evidence) {
  const normalized = normalizeFact(evidence);
  if (normalized.type !== 'evidence') return false;
  return !normalized.evidenceData?.requiresUpload && !!normalized.evidenceData?.fileKey;
}

/**
 * Get all evidence items from facts array
 *
 * @param {array} facts - Array of facts
 * @returns {array} Only evidence items
 */
function getEvidenceItems(facts) {
  return normalizeFacts(facts).filter(fact => fact.type === 'evidence');
}

/**
 * Calculate exhibit labels for evidence items based on position
 * Uses letters (A, B, C...) by default, configurable for state-specific rules
 *
 * @param {array} facts - Array of all facts (mixed types)
 * @param {object} options - { style: 'letters' | 'numbers' }
 * @returns {array} Facts with updated exhibit labels
 */
function calculateExhibitLabels(facts, options = { style: 'letters' }) {
  const normalized = normalizeFacts(facts);
  let evidenceIndex = 0;

  return normalized.map(fact => {
    if (fact.type === 'evidence') {
      const label = options.style === 'numbers'
        ? String(evidenceIndex + 1)
        : String.fromCharCode(65 + evidenceIndex); // A, B, C...

      evidenceIndex++;

      return {
        ...fact,
        evidenceData: {
          ...fact.evidenceData,
          exhibitLabel: label
        }
      };
    }
    return fact;
  });
}

/**
 * Create a new evidence fact placeholder
 *
 * @param {object} options - { description, content }
 * @returns {object} New evidence fact with requiresUpload=true
 */
function createEvidencePlaceholder(options = {}) {
  const { description = '', content = '' } = options;

  return normalizeFact({
    content: content || `I attach as Exhibit [TBD] ${description}.`,
    originalContent: content || `I attach as Exhibit [TBD] ${description}.`,
    type: 'evidence',
    category: 'evidence',
    evidenceData: {
      exhibitLabel: '',
      description: description,
      fileName: null,
      fileKey: null,
      fileType: null,
      fileSizeBytes: 0,
      filePages: 1,
      uploadedAt: null,
      thumbnailKey: null,
      requiresUpload: true
    }
  });
}

/**
 * Valid fact categories across all matter types.
 * Used for validation and UI display labels.
 */
const VALID_CATEGORIES = {
  general:      'General',
  event:        'Event',
  financial:    'Financial',
  property:     'Property',
  relational:   'Relationship',
  children:     'Children',
  safety:       'Safety',
  pattern:      'Pattern of Behavior',
  injury:       'Injury / Harm',
  evidence:     'Evidence',
  habitability: 'Habitability',
  exemption:    'Defense / Exemption',
  heirship:     'Heirship / Estate',
  identity:     'Identity',
};

/**
 * Get the display label for a fact category.
 *
 * @param {string} category
 * @returns {string}
 */
function getCategoryLabel(category) {
  return VALID_CATEGORIES[category] || category || 'General';
}

module.exports = {
  normalizeFact,
  normalizeFacts,
  extractFactContent,
  extractOriginalContent,
  factNeedsReview,
  mergeValidation,
  prepareFactsForStorage,
  prepareFactsForDisplay,
  // Evidence-specific functions
  isEvidence,
  evidenceHasFile,
  getEvidenceItems,
  calculateExhibitLabels,
  createEvidencePlaceholder,
  // Category utilities
  VALID_CATEGORIES,
  getCategoryLabel
};
