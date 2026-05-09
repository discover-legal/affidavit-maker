/** @jest-environment node */
// __tests__/templates/StateTemplateManager.test.js
// Tests for StateTemplateManager using the registry-based approach.
// All templates are loaded via auto-discovery from templates/states/.

const { StateTemplateManager } = require('../../templates/StateTemplateManager');
const { initializeTemplates } = require('../../templates/initialize');
const BaseAffidavitTemplate = require('../../templates/core/BaseAffidavitTemplate');

let registry;
let templateManager;

beforeAll(async () => {
  registry = await initializeTemplates();
  templateManager = new StateTemplateManager({ registry });
});

describe('StateTemplateManager', () => {
  it('should throw if constructed without a registry', () => {
    expect(() => new StateTemplateManager()).toThrow('requires a registry');
  });

  describe('getTemplate', () => {
    it('should return Texas template for TX', () => {
      const template = templateManager.getTemplate('TX');
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('TX');
    });

    it('should return Utah template for UT', () => {
      const template = templateManager.getTemplate('UT');
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('UT');
    });

    it('should return Arizona template for AZ', () => {
      const template = templateManager.getTemplate('AZ');
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
      expect(template.state).toBe('AZ');
    });

    it('should handle lowercase state codes', () => {
      const template = templateManager.getTemplate('tx');
      expect(template.state).toBe('TX');
    });

    it('should default to Texas for invalid state', () => {
      const template = templateManager.getTemplate('XX');
      expect(template.state).toBe('TX');
    });
  });

  describe('getSupportedStates', () => {
    it('should return all supported states', () => {
      const states = templateManager.getSupportedStates();
      // Registry has 64 jurisdictions
      expect(states.length).toBeGreaterThanOrEqual(4);
      const codes = states.map(s => s.code);
      expect(codes).toContain('TX');
      expect(codes).toContain('UT');
      expect(codes).toContain('AZ');
      expect(codes).toContain('CA');
    });

    it('should include state names and requirements', () => {
      const states = templateManager.getSupportedStates();
      const texas = states.find(s => s.code === 'TX');
      expect(texas.name).toBe('Texas');
      expect(texas.requirements).toBeDefined();
      expect(texas.requirements.venue).toBe(true);
    });
  });

  describe('validateAffidavitData', () => {
    it('should validate complete data', () => {
      const data = {
        affiantName: 'John Doe',
        county: 'Travis',
        facts: ['Fact 1', 'Fact 2'],
        state: 'TX',
      };
      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing affiant name', () => {
      const data = { county: 'Travis', facts: ['Fact 1'], state: 'TX' };
      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Affiant name is required and must be at least 2 characters');
    });

    it('should detect missing county for Texas', () => {
      const data = { affiantName: 'John Doe', facts: ['Fact 1'], state: 'TX' };
      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('County is required for Texas affidavits');
    });

    it('should warn about missing facts', () => {
      const data = { affiantName: 'John Doe', county: 'Travis', facts: [], state: 'TX' };
      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.warnings).toContain('No facts provided - affidavit will be incomplete');
    });
  });

  describe('getLegalCitations', () => {
    it('should return citations for Texas from metadata', () => {
      const citations = templateManager.getLegalCitations('TX');
      expect(citations).not.toBeNull();
      expect(citations.primary).toBeDefined();
      expect(Array.isArray(citations.secondary)).toBe(true);
    });

    it('should return null for unknown state', () => {
      const citations = templateManager.getLegalCitations('XX');
      // XX falls through to null since no metadata exists
      expect(citations).toBeNull();
    });
  });
});

describe('Texas template (registry-loaded)', () => {
  let template;
  const validData = {
    affiantName: 'John Doe',
    county: 'Travis',
    facts: ['I am competent to make this affidavit', 'The facts stated herein are true'],
    caseNumber: '2023-12345',
    documentType: 'general',
  };

  beforeAll(() => {
    template = registry.getTemplate('TX');
  });

  describe('generateDocument', () => {
    it('should generate complete document with all sections', () => {
      const document = template.generateDocument(validData);
      expect(document.id).toBeDefined();
      expect(document.state).toBe('TX');
      expect(document.sections.header).toBe('THE STATE OF TEXAS');
      expect(document.sections.venue).toBe('COUNTY OF TRAVIS');
      expect(document.sections.title).toBe('AFFIDAVIT OF JOHN DOE');
    });

    it('should include all facts with proper numbering', () => {
      const document = template.generateDocument(validData);
      const facts = document.sections.facts;
      expect(facts).toBeDefined();
      expect(facts.items).toBeDefined();
      expect(facts.items.length).toBeGreaterThanOrEqual(2);
      expect(facts.items[0].number).toBe(1);
      expect(facts.items[0].type).toBe('competency');
    });

    it('should generate proper notary block per Tex. Civ. Prac. & Rem. Code 18.002', () => {
      const document = template.generateDocument(validData);
      const notaryBlock = document.sections.notaryBlock;
      expect(notaryBlock).toContain('SWORN TO AND SUBSCRIBED');
      expect(notaryBlock).toContain('Notary Public, State of Texas');
      expect(notaryBlock).toContain('My commission expires:');
    });

    it('should NOT include perjury statement (oath provides warning per 312.011)', () => {
      const document = template.generateDocument(validData);
      expect(document.sections.perjuryStatement).toBeNull();
    });

    it('should generate document even with missing data', () => {
      const invalidData = { ...validData, affiantName: '' };
      const document = template.generateDocument(invalidData);
      expect(document).toBeDefined();
      expect(document.sections).toBeDefined();
    });
  });

  describe('HTML generation', () => {
    it('should generate valid HTML', () => {
      const document = template.generateDocument(validData);
      const html = document.htmlContent;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>');
      expect(html).toContain('THE STATE OF TEXAS');
      expect(html).toContain('COUNTY OF TRAVIS');
    });

    it('should include CSS styles', () => {
      const document = template.generateDocument(validData);
      const html = document.htmlContent;
      expect(html).toContain('<style>');
      expect(html).toContain('Times New Roman');
      expect(html).toContain('@media print');
    });
  });
});

describe('State-specific differences (registry-loaded)', () => {
  const testData = {
    affiantName: 'Test User',
    county: 'Test County',
    facts: ['Test fact'],
    state: 'TX',
  };

  it('should handle Utah formatting per Utah Code 46-1-6.5', () => {
    const utahTemplate = registry.getTemplate('UT');
    const document = utahTemplate.generateDocument(testData);
    // Utah uses sentence case for header per statute
    expect(document.sections.header).toBe('State of Utah');
    expect(document.sections.venue).toBeDefined();
    expect(document.sections.notaryBlock).toBeDefined();
  });

  it('should handle Arizona perjury statement per A.R.S. 13-2702', () => {
    const arizonaTemplate = registry.getTemplate('AZ');
    const document = arizonaTemplate.generateDocument({
      ...testData,
      county: 'Maricopa',
    });
    expect(document.sections.header).toBe('STATE OF ARIZONA');
    expect(document.sections.perjuryStatement).toBeDefined();
    expect(document.sections.perjuryStatement).not.toBeNull();
  });

  it('should validate county requirement by state', () => {
    const texasTemplate = registry.getTemplate('TX');
    const arizonaTemplate = registry.getTemplate('AZ');

    // Texas requires county
    const texasValidation = texasTemplate.validateData({
      ...testData, county: undefined, state: 'TX',
    });
    expect(texasValidation.isValid).toBe(false);

    // Arizona also requires county
    const arizonaValidation = arizonaTemplate.validateData({
      ...testData, county: undefined, state: 'AZ',
    });
    expect(arizonaValidation.isValid).toBe(false);

    // Both pass with county
    const arizonaWithCounty = arizonaTemplate.validateData({
      ...testData, county: 'Maricopa', state: 'AZ',
    });
    expect(arizonaWithCounty.isValid).toBe(true);
  });
});
