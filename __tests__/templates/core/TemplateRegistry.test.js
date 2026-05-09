/** @jest-environment node */
// __tests__/templates/core/TemplateRegistry.test.js
const TemplateRegistry = require('../../../templates/core/TemplateRegistry');
const BaseAffidavitTemplate = require('../../../templates/core/BaseAffidavitTemplate');

// Factory function to create mock templates with specific state codes
function createMockTemplateClass(stateCode, stateName) {
  return class MockTemplate extends BaseAffidavitTemplate {
    constructor() {
      super();
      this.state = stateCode;
      this.stateName = stateName;
      this.requiredFields = ['affiantName', 'state'];
    }
  };
}

// Default mock template for testing (state MK)
const MockTemplate = createMockTemplateClass('MK', 'Mock State');

// Texas mock template for testing default state fallback
const TXMockTemplate = createMockTemplateClass('TX', 'Texas');

// Mock divorce template for testing
class MockDivorceTemplate {
  constructor() {
    this.state = 'MK';
    this.stateName = 'Mock State';
    this.documentType = 'petition';
    this.documentTitle = 'MOCK DIVORCE PETITION';
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county'];
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true
    };
  }

  generateDocument(data) {
    return {
      id: 'test-id',
      state: this.state,
      documentType: this.documentType,
      sections: {},
      fullText: 'test',
      htmlContent: '<html></html>',
      validation: { isValid: true, errors: [], warnings: [] }
    };
  }

  validateData(data) {
    return { isValid: true, errors: [], warnings: [] };
  }

  generateTitle() {
    return this.documentTitle;
  }
}

describe('TemplateRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  describe('constructor', () => {
    it('should initialize with empty templates map', () => {
      expect(registry.templates).toBeDefined();
      expect(registry.templates.size).toBe(0);
    });

    it('should initialize with empty metadata map', () => {
      expect(registry.metadata).toBeDefined();
      expect(registry.metadata.size).toBe(0);
    });

    it('should set default state to TX', () => {
      expect(registry.defaultState).toBe('TX');
    });

    it('should set default document type to affidavit', () => {
      expect(registry.defaultDocumentType).toBe('affidavit');
    });
  });

  describe('register', () => {
    const mockMetadata = {
      stateCode: 'MK',
      stateName: 'Mock State',
      version: '1.0'
    };

    it('should register a template successfully', () => {
      registry.register('MK', MockTemplate, mockMetadata);

      expect(registry.templates.has('MK')).toBe(true);
      expect(registry.metadata.has('MK')).toBe(true);
    });

    it('should instantiate the template class', () => {
      registry.register('MK', MockTemplate, mockMetadata);

      // With new nested structure, get the template through getTemplate method
      const template = registry.getTemplate('MK');
      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should store metadata correctly', () => {
      registry.register('MK', MockTemplate, mockMetadata);

      // With new nested structure, get metadata through getMetadata method
      const storedMetadata = registry.getMetadata('MK');
      expect(storedMetadata).toEqual(mockMetadata);
    });

    it('should normalize state code to uppercase', () => {
      registry.register('mk', MockTemplate, mockMetadata);

      expect(registry.templates.has('MK')).toBe(true);
    });

    it('should allow registering multiple templates', () => {
      registry.register('M1', MockTemplate, { ...mockMetadata, stateCode: 'M1' });
      registry.register('M2', MockTemplate, { ...mockMetadata, stateCode: 'M2' });

      expect(registry.templates.size).toBe(2);
      expect(registry.metadata.size).toBe(2);
    });

    it('should allow registering multiple document types for same state', () => {
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, mockMetadata, 'divorce_petition');

      // State should have both document types
      const docTypes = registry.getDocumentTypes('MK');
      expect(docTypes).toContain('affidavit');
      expect(docTypes).toContain('divorce_petition');
    });

    it('should throw error for invalid document type', () => {
      expect(() => {
        registry.register('MK', MockTemplate, mockMetadata, 'invalid_type');
      }).toThrow(/Invalid document type/);
    });
  });

  describe('getTemplate', () => {
    beforeEach(() => {
      const mockMetadata = {
        stateCode: 'MK',
        stateName: 'Mock State',
        version: '1.0'
      };
      registry.register('MK', MockTemplate, mockMetadata);
      // Use TXMockTemplate so the instance has state='TX'
      registry.register('TX', TXMockTemplate, { ...mockMetadata, stateCode: 'TX', stateName: 'Texas' });
    });

    it('should return template for valid state code', () => {
      const template = registry.getTemplate('MK');
      expect(template).toBeInstanceOf(MockTemplate);
    });

    it('should handle lowercase state codes', () => {
      const template = registry.getTemplate('mk');
      expect(template).toBeInstanceOf(MockTemplate);
    });

    it('should return default template for invalid state', () => {
      const template = registry.getTemplate('XX');
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('TX'); // Default state template
    });

    it('should return default template when no state code provided', () => {
      const template = registry.getTemplate();
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('TX');
    });

    it('should return default template for null state code', () => {
      const template = registry.getTemplate(null);
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('TX');
    });

    it('should return correct template for specific document type', () => {
      const divorceMetadata = {
        stateCode: 'MK',
        stateName: 'Mock State'
      };
      registry.register('MK', MockDivorceTemplate, divorceMetadata, 'divorce_petition');

      const template = registry.getTemplate('MK', 'divorce_petition');
      expect(template).toBeInstanceOf(MockDivorceTemplate);
    });

    it('should fall back to affidavit if requested document type not found', () => {
      // MK only has affidavit registered
      const template = registry.getTemplate('MK', 'divorce_petition');
      expect(template).toBeInstanceOf(MockTemplate); // Falls back to affidavit
    });
  });

  describe('getSupportedStates', () => {
    it('should return empty array when no templates registered', () => {
      const states = registry.getSupportedStates();
      expect(states).toEqual([]);
    });

    it('should return all registered states', () => {
      const mockMetadata1 = { stateCode: 'M1', stateName: 'Mock State 1' };
      const mockMetadata2 = { stateCode: 'M2', stateName: 'Mock State 2' };

      registry.register('M1', MockTemplate, mockMetadata1);
      registry.register('M2', MockTemplate, mockMetadata2);

      const states = registry.getSupportedStates();
      expect(states).toHaveLength(2);
      expect(states.map(s => s.code)).toContain('MK'); // MockTemplate sets state to 'MK'
    });

    it('should include state name and requirements', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);

      const states = registry.getSupportedStates();
      const mockState = states[0];

      expect(mockState.code).toBe('MK');
      expect(mockState.name).toBe('Mock State');
      expect(mockState.requirements).toBeDefined();
      expect(mockState.requirements.venue).toBe(true);
      expect(mockState.requirements.notaryBlock).toBe(true);
    });
  });

  describe('getDocumentTypes', () => {
    it('should return empty array for unregistered state', () => {
      const types = registry.getDocumentTypes('XX');
      expect(types).toEqual([]);
    });

    it('should return all document types for a state', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, mockMetadata, 'divorce_petition');

      const types = registry.getDocumentTypes('MK');
      expect(types).toHaveLength(2);
      expect(types).toContain('affidavit');
      expect(types).toContain('divorce_petition');
    });
  });

  describe('hasDocumentType', () => {
    beforeEach(() => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
    });

    it('should return true for registered document type', () => {
      expect(registry.hasDocumentType('MK', 'affidavit')).toBe(true);
    });

    it('should return false for unregistered document type', () => {
      expect(registry.hasDocumentType('MK', 'divorce_petition')).toBe(false);
    });

    it('should return false for unregistered state', () => {
      expect(registry.hasDocumentType('XX', 'affidavit')).toBe(false);
    });
  });

  describe('getSupportedDocuments', () => {
    it('should return all state/document type combinations', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, mockMetadata, 'divorce_petition');
      registry.register('TX', MockTemplate, { ...mockMetadata, stateCode: 'TX' }, 'affidavit');

      const docs = registry.getSupportedDocuments();
      expect(docs).toHaveLength(3);

      const mkAffidavit = docs.find(d => d.stateCode === 'MK' && d.documentType === 'affidavit');
      const mkDivorce = docs.find(d => d.stateCode === 'MK' && d.documentType === 'divorce_petition');
      const txAffidavit = docs.find(d => d.stateCode === 'TX' && d.documentType === 'affidavit');

      expect(mkAffidavit).toBeDefined();
      expect(mkDivorce).toBeDefined();
      expect(txAffidavit).toBeDefined();
    });
  });

  describe('validateAffidavitData', () => {
    beforeEach(() => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
    });

    it('should delegate validation to template', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        facts: ['Fact 1']
      };

      const validation = registry.validateAffidavitData('MK', data);
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();
    });

    it('should return validation errors for invalid data', () => {
      const data = {
        state: 'MK'
        // Missing affiantName
      };

      const validation = registry.validateAffidavitData('MK', data);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should return valid for complete data', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        facts: ['Fact 1']
      };

      const validation = registry.validateAffidavitData('MK', data);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should support document type parameter', () => {
      const divorceMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockDivorceTemplate, divorceMetadata, 'divorce_petition');

      const data = { petitionerName: 'John Doe' };
      const validation = registry.validateAffidavitData('MK', data, 'divorce_petition');
      expect(validation).toBeDefined();
    });
  });

  describe('generateAffidavit', () => {
    beforeEach(() => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
    });

    it('should delegate generation to template', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        county: 'Test County',
        facts: ['Fact 1', 'Fact 2']
      };

      const document = registry.generateAffidavit('MK', data);
      expect(document).toBeDefined();
      expect(document.id).toBeDefined();
      expect(document.state).toBe('MK');
      expect(document.sections).toBeDefined();
    });

    it('should generate document with all sections', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        county: 'Test County',
        facts: ['Fact 1', 'Fact 2']
      };

      const document = registry.generateAffidavit('MK', data);
      expect(document.sections.header).toBeDefined();
      expect(document.sections.venue).toBeDefined();
      expect(document.sections.title).toBeDefined();
      expect(document.sections.facts).toBeDefined();
      expect(document.sections.signatureBlock).toBeDefined();
      expect(document.sections.notaryBlock).toBeDefined();
    });

    it('should include full text and HTML content', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        county: 'Test County',
        facts: ['Fact 1']
      };

      const document = registry.generateAffidavit('MK', data);
      expect(document.fullText).toBeDefined();
      expect(typeof document.fullText).toBe('string');
      expect(document.htmlContent).toBeDefined();
      expect(typeof document.htmlContent).toBe('string');
    });

    it('should support document type parameter', () => {
      const divorceMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockDivorceTemplate, divorceMetadata, 'divorce_petition');

      const data = { petitionerName: 'John Doe', respondentName: 'Jane Doe' };
      const document = registry.generateAffidavit('MK', data, 'divorce_petition');
      expect(document).toBeDefined();
      expect(document.documentType).toBe('petition');
    });
  });

  describe('generateDocument (alias)', () => {
    it('should work as alias for generateAffidavit', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);

      const data = {
        affiantName: 'John Doe',
        state: 'MK',
        county: 'Test County',
        facts: ['Fact 1']
      };

      const document = registry.generateDocument('MK', data);
      expect(document).toBeDefined();
      expect(document.id).toBeDefined();
    });
  });

  describe('getLegalCitations', () => {
    it('should return null for unregistered state', () => {
      const citations = registry.getLegalCitations('XX');
      expect(citations).toBeNull();
    });

    it('should return citations for registered state', () => {
      const mockMetadata = {
        stateCode: 'MK',
        stateName: 'Mock State',
        legalCitations: [
          { code: 'Mock Code § 1.1', description: 'Primary statute' },
          { code: 'Mock Code § 2.1', description: 'Secondary statute' }
        ]
      };
      registry.register('MK', MockTemplate, mockMetadata);

      const citations = registry.getLegalCitations('MK');
      expect(citations).toBeDefined();
      expect(citations.primary).toBe('Mock Code § 1.1');
      expect(citations.secondary).toContain('Mock Code § 2.1');
      expect(citations.notes).toBe('Primary statute');
    });

    it('should handle state without citations', () => {
      const mockMetadata = {
        stateCode: 'MK',
        stateName: 'Mock State'
      };
      registry.register('MK', MockTemplate, mockMetadata);

      const citations = registry.getLegalCitations('MK');
      expect(citations).toBeNull();
    });
  });

  describe('getMetadata', () => {
    it('should return null for unregistered state', () => {
      const metadata = registry.getMetadata('XX');
      expect(metadata).toBeNull();
    });

    it('should return metadata for registered state', () => {
      const mockMetadata = {
        stateCode: 'MK',
        stateName: 'Mock State',
        version: '1.0'
      };
      registry.register('MK', MockTemplate, mockMetadata);

      const metadata = registry.getMetadata('MK');
      expect(metadata).toEqual(mockMetadata);
    });

    it('should support document type parameter', () => {
      const affidavitMetadata = { stateCode: 'MK', stateName: 'Mock State', type: 'affidavit' };
      const divorceMetadata = { stateCode: 'MK', stateName: 'Mock State', type: 'divorce' };

      registry.register('MK', MockTemplate, affidavitMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, divorceMetadata, 'divorce_petition');

      const aff = registry.getMetadata('MK', 'affidavit');
      const div = registry.getMetadata('MK', 'divorce_petition');

      expect(aff.type).toBe('affidavit');
      expect(div.type).toBe('divorce');
    });
  });

  describe('getAllMetadataForState', () => {
    it('should return all metadata for a state', () => {
      const affidavitMetadata = { stateCode: 'MK', stateName: 'Mock State', type: 'affidavit' };
      const divorceMetadata = { stateCode: 'MK', stateName: 'Mock State', type: 'divorce' };

      registry.register('MK', MockTemplate, affidavitMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, divorceMetadata, 'divorce_petition');

      const allMetadata = registry.getAllMetadataForState('MK');
      expect(allMetadata.affidavit).toEqual(affidavitMetadata);
      expect(allMetadata.divorce_petition).toEqual(divorceMetadata);
    });

    it('should return empty object for unregistered state', () => {
      const metadata = registry.getAllMetadataForState('XX');
      expect(metadata).toEqual({});
    });
  });

  describe('hasState', () => {
    beforeEach(() => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
    });

    it('should return true for registered state', () => {
      expect(registry.hasState('MK')).toBe(true);
    });

    it('should return false for unregistered state', () => {
      expect(registry.hasState('XX')).toBe(false);
    });

    it('should handle lowercase state codes', () => {
      expect(registry.hasState('mk')).toBe(true);
    });
  });

  describe('getStateCodes', () => {
    it('should return empty array when no templates registered', () => {
      const codes = registry.getStateCodes();
      expect(codes).toEqual([]);
    });

    it('should return all registered state codes', () => {
      const mockMetadata1 = { stateCode: 'M1', stateName: 'Mock State 1' };
      const mockMetadata2 = { stateCode: 'M2', stateName: 'Mock State 2' };

      registry.register('M1', MockTemplate, mockMetadata1);
      registry.register('M2', MockTemplate, mockMetadata2);

      const codes = registry.getStateCodes();
      expect(codes).toHaveLength(2);
      expect(codes).toContain('M1');
      expect(codes).toContain('M2');
    });
  });

  describe('getTemplateCount', () => {
    it('should return 0 when no templates registered', () => {
      expect(registry.getTemplateCount()).toBe(0);
    });

    it('should return correct count for single document type per state', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
      registry.register('M2', MockTemplate, { ...mockMetadata, stateCode: 'M2' });

      expect(registry.getTemplateCount()).toBe(2);
    });

    it('should count multiple document types per state', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, mockMetadata, 'divorce_petition');

      expect(registry.getTemplateCount()).toBe(2); // 2 document types for 1 state
    });
  });

  describe('getStateCount', () => {
    it('should return 0 when no templates registered', () => {
      expect(registry.getStateCount()).toBe(0);
    });

    it('should return number of states (not document types)', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata, 'affidavit');
      registry.register('MK', MockDivorceTemplate, mockMetadata, 'divorce_petition');
      registry.register('TX', MockTemplate, { ...mockMetadata, stateCode: 'TX' });

      expect(registry.getStateCount()).toBe(2); // 2 states
    });
  });

  describe('clear', () => {
    it('should remove all templates and metadata', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
      registry.register('TX', MockTemplate, { ...mockMetadata, stateCode: 'TX' });

      registry.clear();

      expect(registry.getTemplateCount()).toBe(0);
      expect(registry.getStateCount()).toBe(0);
      expect(registry.getStateCodes()).toEqual([]);
    });
  });
});
