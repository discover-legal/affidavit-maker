// client/src/utils/factNormalizer.js
// Evidence helper functions for client-side use

/**
 * Check if a fact is an evidence item
 */
export function isEvidence(fact) {
  if (!fact || typeof fact !== 'object') return false;
  return fact.type === 'evidence';
}

/**
 * Check if evidence item has a file uploaded
 */
export function evidenceHasFile(evidence) {
  if (!isEvidence(evidence)) return false;

  const evidenceData = evidence.evidenceData || {};

  // Check if file upload is NOT required and fileKey exists
  return !evidenceData.requiresUpload && !!evidenceData.fileKey;
}

/**
 * Get all evidence items from facts array
 */
export function getEvidenceItems(facts) {
  if (!Array.isArray(facts)) return [];
  return facts.filter(fact => isEvidence(fact));
}

/**
 * Calculate and assign exhibit labels (A, B, C... or 1, 2, 3...) to evidence items
 */
export function calculateExhibitLabels(facts, options = {}) {
  const { style = 'letters' } = options;

  if (!Array.isArray(facts)) return facts;

  let evidenceCounter = 0;

  return facts.map(fact => {
    if (isEvidence(fact)) {
      evidenceCounter++;

      // Generate label based on style
      let label;
      if (style === 'numbers') {
        label = String(evidenceCounter);
      } else {
        // Default to letters (A, B, C, ...)
        label = String.fromCharCode(64 + evidenceCounter); // 65 = 'A'
      }

      return {
        ...fact,
        evidenceData: {
          ...fact.evidenceData,
          exhibitLabel: label
        },
        content: `I attach as Exhibit ${label} ${fact.evidenceData?.description || ''}.`
      };
    }

    return fact;
  });
}

/**
 * Create a new evidence placeholder
 */
export function createEvidencePlaceholder(options = {}) {
  const {
    description = '',
    content = null
  } = options;

  const defaultContent = content || `I attach as Exhibit [TBD] ${description}.`;

  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'evidence',
    content: defaultContent,
    category: 'evidence',
    evidenceData: {
      exhibitLabel: '',
      description: description,
      requiresUpload: true,
      fileKey: null,
      fileName: null,
      fileType: null,
      fileSizeBytes: null,
      filePages: null,
      thumbnailKey: null,
      uploadedAt: null
    }
  };
}
