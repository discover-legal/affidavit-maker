// templates/core/validateMetadata.js
// Metadata validation utility

const schema = require('./templateMetadata.schema.json');

/**
 * Validate metadata against schema
 *
 * @param {Object} metadata - Metadata object to validate
 * @returns {Object} Validation result with valid flag and errors array
 */
function validateMetadata(metadata) {
  const errors = [];

  // Check required fields
  const requiredFields = schema.required || [];
  for (const field of requiredFields) {
    if (!(field in metadata)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate stateCode format
  if (metadata.stateCode) {
    if (!/^[A-Z]{2}$/.test(metadata.stateCode)) {
      errors.push('stateCode must be a 2-letter uppercase code (e.g., TX, UT, AZ)');
    }
  }

  // Validate stateName
  if (metadata.stateName) {
    if (typeof metadata.stateName !== 'string' || metadata.stateName.length < 2) {
      errors.push('stateName must be a string with at least 2 characters');
    }
  }

  // Validate documentTypes
  if (metadata.documentTypes) {
    if (!Array.isArray(metadata.documentTypes) || metadata.documentTypes.length === 0) {
      errors.push('documentTypes must be a non-empty array');
    }
  }

  // Validate version format
  if (metadata.version) {
    if (!/^\d+\.\d+(\.\d+)?$/.test(metadata.version)) {
      errors.push('version must follow semantic versioning (e.g., 2.0 or 1.0.0)');
    }
  }

  // Validate legallyCompliant
  if ('legallyCompliant' in metadata) {
    if (typeof metadata.legallyCompliant !== 'boolean') {
      errors.push('legallyCompliant must be a boolean');
    }
  }

  // Validate requiredFields
  if (metadata.requiredFields) {
    if (!Array.isArray(metadata.requiredFields)) {
      errors.push('requiredFields must be an array');
    }
  }

  // Validate features object
  if (metadata.features) {
    if (typeof metadata.features !== 'object') {
      errors.push('features must be an object');
    } else {
      // Check required feature fields
      const requiredFeatures = ['perjuryStatement', 'notaryBlock', 'caseNumberLabel'];
      for (const feature of requiredFeatures) {
        if (!(feature in metadata.features)) {
          errors.push(`Missing required feature field: ${feature}`);
        }
      }

      // Validate boolean features
      const booleanFeatures = ['perjuryStatement', 'notaryBlock', 'notaryInstruction', 'caseNumberRequired'];
      for (const feature of booleanFeatures) {
        if (feature in metadata.features && typeof metadata.features[feature] !== 'boolean') {
          errors.push(`features.${feature} must be a boolean`);
        }
      }

      // Validate string features
      if ('caseNumberLabel' in metadata.features) {
        if (typeof metadata.features.caseNumberLabel !== 'string') {
          errors.push('features.caseNumberLabel must be a string');
        }
      }
    }
  }

  // Validate legalCitations if present
  if (metadata.legalCitations) {
    if (!Array.isArray(metadata.legalCitations)) {
      errors.push('legalCitations must be an array');
    } else {
      metadata.legalCitations.forEach((citation, index) => {
        if (!citation.code) {
          errors.push(`legalCitations[${index}] missing required field: code`);
        }
        if (!citation.description) {
          errors.push(`legalCitations[${index}] missing required field: description`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validateMetadata };
