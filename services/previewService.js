// services/previewService.js - FIXED: No duplicate county validation

const { StateTemplateManager } = require('../templates/StateTemplateManager');

class PreviewService {
  constructor() {
    this.templateManager = new StateTemplateManager();
  }

  validateDocument(affidavitData, template) {
    const errors = [];
    const warnings = [];

    // Required field validation (basic fields only)
    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }

    if (!affidavitData.state) {
      errors.push('State selection is required');
    }

    // ✅ REMOVED: Duplicate county validation
    // County validation is ONLY done in state-specific templates via performStateSpecificValidation

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

    // County format validation (but not requirement check - that's in templates)
    if (affidavitData.county && affidavitData.county.length > 100) {
      errors.push('County name is too long (maximum 100 characters)');
    }

    // ✅ State-specific validation from template (includes county requirement)
    if (template) {
      const stateValidation = template.performStateSpecificValidation(affidavitData);
      if (stateValidation.errors) {
        errors.push(...stateValidation.errors);
      }
      if (stateValidation.warnings) {
        warnings.push(...stateValidation.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completion: this.calculateCompletion(affidavitData, template)
    };
  }

  calculateCompletion(affidavitData, template) {
    // Get required fields from template
    const requiredFields = template ? template.requiredFields : ['affiantName', 'state', 'facts'];
    
    let completedCount = 0;
    
    // Check each required field
    requiredFields.forEach(field => {
      const value = affidavitData[field];
      if (value) {
        if (Array.isArray(value)) {
          if (value.length > 0) completedCount++;
        } else if (typeof value === 'string') {
          if (value.trim().length > 0) completedCount++;
        } else {
          completedCount++;
        }
      }
    });

    return Math.round((completedCount / requiredFields.length) * 100);
  }

  async generatePreview(affidavitData) {
    try {
      // Get appropriate template
      const template = this.templateManager.getTemplate(affidavitData.state);
      
      // Validate document
      const validation = this.validateDocument(affidavitData, template);
      
      // Generate document sections
      const document = template.generateDocument(affidavitData);
      
      return {
        success: true,
        htmlPreview: document.htmlContent,
        validation: validation,
        sections: document.sections,
        wordCount: template.calculateWordCount(affidavitData.facts),
        categories: template.extractCategories(affidavitData.facts)
      };
      
    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        success: false,
        error: error.message,
        htmlPreview: '<p>Error generating preview</p>',
        validation: {
          isValid: false,
          errors: ['Preview generation failed'],
          warnings: [],
          completion: 0
        }
      };
    }
  }

  async generatePDF(affidavitData) {
    try {
      const template = this.templateManager.getTemplate(affidavitData.state);
      const document = template.generateDocument(affidavitData);
      
      // Validate before PDF generation
      const validation = this.validateDocument(affidavitData, template);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Document validation failed',
          errors: validation.errors
        };
      }
      
      // PDF generation logic here
      // (Implementation depends on your PDF library)
      
      return {
        success: true,
        pdfBuffer: null, // Replace with actual PDF buffer
        filename: `affidavit_${affidavitData.affiantName.replace(/\s+/g, '_')}.pdf`
      };
      
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PreviewService;
