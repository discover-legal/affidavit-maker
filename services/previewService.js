// services/previewService.js - Enhanced preview generation
// FIXED: Removed duplicate county validation (now handled by templates)
const { StateTemplateManager } = require('../templates/StateTemplateManager');

class PreviewService {
  constructor() {
    this.templateManager = new StateTemplateManager();
  }

  validateDocument(affidavitData, template) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }

    if (!affidavitData.state) {
      errors.push('State selection is required');
    }

    // ✅ REMOVED: Duplicate county validation - now handled by state-specific templates

    // Facts validation
    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts provided - affidavit will be incomplete');
    } else if (affidavitData.facts.length > 20) {
      warnings.push('Consider consolidating facts for better readability (20+ facts provided)');
    }

    // Name format validation
    if (affidavitData.affiantName) {
      if (affidavitData.affiantName.length > 255) {
        errors.push('Affiant name is too long (maximum 255 characters)');
      }
      
      if (!/^[A-Za-z\s\-'.]+$/.test(affidavitData.affiantName)) {
        warnings.push('Affiant name contains unusual characters');
      }
      
      if (affidavitData.affiantName.split(' ').length < 2) {
        warnings.push('Consider providing both first and last name');
      }
    }

    // County format validation (but not requirement check)
    if (affidavitData.county && affidavitData.county.length > 100) {
      errors.push('County name is too long (maximum 100 characters)');
    }

    // ✅ ADD: State-specific validation from template
    const stateValidation = template.performStateSpecificValidation(affidavitData);
    if (stateValidation.errors) {
      errors.push(...stateValidation.errors);
    }
    if (stateValidation.warnings) {
      warnings.push(...stateValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completion: this.calculateCompletion(affidavitData)
    };
  }

  calculateCompletion(affidavitData) {
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    });

    return Math.round((completedFields.length / requiredFields.length) * 100);
  }

  // ... rest of the PreviewService methods remain unchanged
}

module.exports = PreviewService;
