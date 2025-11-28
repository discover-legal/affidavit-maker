// __tests__/templates/core/TemplateRegistry.test.js
const TemplateRegistry = require('../../../templates/core/TemplateRegistry');
const BaseAffidavitTemplate = require('../../../templates/core/BaseAffidavitTemplate');

// Mock template for testing
class MockTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'MK';
    this.stateName = 'Mock State';
    this.requiredFields = ['affiantName', 'state'];
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

      const template = registry.templates.get('MK');
      expect(template).toBeInstanceOf(MockTemplate);
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should store metadata correctly', () => {
      registry.register('MK', MockTemplate, mockMetadata);

      const storedMetadata = registry.metadata.get('MK');
      expect(storedMetadata).toEqual(mockMetadata);
    });

    it('should normalize state code to uppercase', () => {
      registry.register('mk', MockTemplate, mockMetadata);

      expect(registry.templates.has('MK')).toBe(true);
    });

    it('should allow registering multiple templates', () => {
      registry.register('MK', MockTemplate, mockMetadata);
      registry.register('M2', MockTemplate, { ...mockMetadata, stateCode: 'M2' });

      expect(registry.templates.size).toBe(2);
      expect(registry.metadata.size).toBe(2);
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
      registry.register('TX', MockTemplate, { ...mockMetadata, stateCode: 'TX' });
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
      expect(template).toBeInstanceOf(MockTemplate);
      expect(template.state).toBe('TX'); // Default state
    });

    it('should return default template when no state code provided', () => {
      const template = registry.getTemplate();
      expect(template).toBeInstanceOf(MockTemplate);
      expect(template.state).toBe('TX');
    });

    it('should return default template for null state code', () => {
      const template = registry.getTemplate(null);
      expect(template).toBeInstanceOf(MockTemplate);
      expect(template.state).toBe('TX');
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
      expect(states.map(s => s.code)).toContain('MK');
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
      expect(codes).toContain('MK');
    });
  });

  describe('getTemplateCount', () => {
    it('should return 0 when no templates registered', () => {
      expect(registry.getTemplateCount()).toBe(0);
    });

    it('should return correct count', () => {
      const mockMetadata = { stateCode: 'MK', stateName: 'Mock State' };
      registry.register('MK', MockTemplate, mockMetadata);
      registry.register('M2', MockTemplate, { ...mockMetadata, stateCode: 'M2' });

      expect(registry.getTemplateCount()).toBe(2);
    });
  });
});
