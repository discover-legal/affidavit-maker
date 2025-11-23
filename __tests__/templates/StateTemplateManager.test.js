// __tests__/templates/StateTemplateManager.test.js
const { 
  StateTemplateManager, 
  TexasTemplate, 
  UtahTemplate, 
  ArizonaTemplate 
} = require('../../templates/StateTemplateManager');

describe('StateTemplateManager', () => {
  let templateManager;

  beforeEach(() => {
    templateManager = new StateTemplateManager();
  });

  describe('getTemplate', () => {
    it('should return Texas template for TX', () => {
      const template = templateManager.getTemplate('TX');
      expect(template).toBeInstanceOf(TexasTemplate);
    });

    it('should return Utah template for UT', () => {
      const template = templateManager.getTemplate('UT');
      expect(template).toBeInstanceOf(UtahTemplate);
    });

    it('should return Arizona template for AZ', () => {
      const template = templateManager.getTemplate('AZ');
      expect(template).toBeInstanceOf(ArizonaTemplate);
    });

    it('should handle lowercase state codes', () => {
      const template = templateManager.getTemplate('tx');
      expect(template).toBeInstanceOf(TexasTemplate);
    });

    it('should default to Texas for invalid state', () => {
      const template = templateManager.getTemplate('XX');
      expect(template).toBeInstanceOf(TexasTemplate);
    });
  });

  describe('getSupportedStates', () => {
    it('should return all supported states', () => {
      const states = templateManager.getSupportedStates();
      expect(states).toHaveLength(3);
      expect(states.map(s => s.code)).toEqual(['TX', 'UT', 'AZ']);
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
      const data = {
        county: 'Travis',
        facts: ['Fact 1'],
        state: 'TX',
      };

      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Affiant name is required and must be at least 2 characters');
    });

    it('should detect missing county for Texas', () => {
      const data = {
        affiantName: 'John Doe',
        facts: ['Fact 1'],
        state: 'TX',
      };

      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('County is required for Texas affidavits');
    });

    it('should warn about missing facts', () => {
      const data = {
        affiantName: 'John Doe',
        county: 'Travis',
        facts: [],
        state: 'TX',
      };
      
      const validation = templateManager.validateAffidavitData('TX', data);
      expect(validation.warnings).toContain('No facts provided - affidavit will be incomplete');
    });
  });
});

describe('TexasTemplate', () => {
  let template;
  const validData = {
    affiantName: 'John Doe',
    county: 'Travis',
    facts: ['I am competent to make this affidavit', 'The facts stated herein are true'],
    caseNumber: '2023-12345',
    documentType: 'general',
  };

  beforeEach(() => {
    template = new TexasTemplate();
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
      
      expect(facts).toHaveLength(3); // Competency statement + 2 user facts
      expect(facts[0].number).toBe(1);
      expect(facts[0].type).toBe('competency');
      expect(facts[1].number).toBe(2);
      expect(facts[2].number).toBe(3);
    });

    it('should generate proper notary block', () => {
      const document = template.generateDocument(validData);
      const notaryBlock = document.sections.notaryBlock;
      
      expect(notaryBlock).toContain('SWORN TO AND SUBSCRIBED');
      expect(notaryBlock).toContain('Notary Public, State of Texas');
      expect(notaryBlock).toContain('My commission expires:');
    });

    it('should throw error for invalid data', () => {
      const invalidData = { ...validData, affiantName: '' };
      
      expect(() => template.generateDocument(invalidData))
        .toThrow('Invalid data for Texas');
    });
  });

  describe('generateDocumentTypeSpecificFacts', () => {
    it('should generate divorce-specific facts', () => {
      const divorceData = {
        ...validData,
        documentType: 'divorce',
        marriageDate: '01/15/2010',
        separationDate: '06/01/2023',
        spouseName: 'Jane Doe',
        grounds: 'irreconcilable differences',
      };
      
      const document = template.generateDocument(divorceData);
      const facts = document.sections.facts;
      
      const marriageFact = facts.find(f => f.content.includes('married'));
      expect(marriageFact).toBeDefined();
      expect(marriageFact.content).toContain('01/15/2010');
    });

    it('should generate custody-specific facts', () => {
      const custodyData = {
        ...validData,
        documentType: 'custody',
        children: ['Child One', 'Child Two'],
        currentCustody: 'Joint custody with primary residence with mother',
      };
      
      const document = template.generateDocument(custodyData);
      const facts = document.sections.facts;
      
      const childrenFact = facts.find(f => f.content.includes('parent'));
      expect(childrenFact).toBeDefined();
      expect(childrenFact.content).toContain('Child One, Child Two');
    });

    it('should generate financial-specific facts', () => {
      const financialData = {
        ...validData,
        documentType: 'financial',
        monthlyIncome: '5000',
        monthlyExpenses: '3500',
      };
      
      const document = template.generateDocument(financialData);
      const facts = document.sections.facts;
      
      const incomeFact = facts.find(f => f.content.includes('income'));
      expect(incomeFact).toBeDefined();
      expect(incomeFact.content).toContain('$5000');
    });
  });

  describe('HTML generation', () => {
    it('should generate valid HTML', () => {
      const document = template.generateDocument(validData);
      const html = document.htmlContent;
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Affidavit - John Doe</title>');
      expect(html).toContain('<div class="header">THE STATE OF TEXAS</div>');
      expect(html).toContain('<div class="venue">COUNTY OF TRAVIS</div>');
    });

    it('should include CSS styles', () => {
      const document = template.generateDocument(validData);
      const html = document.htmlContent;
      
      expect(html).toContain('<style>');
      expect(html).toContain('font-family: \'Times New Roman\'');
      expect(html).toContain('@media print');
    });
  });
});

describe('State-specific differences', () => {
  const testData = {
    affiantName: 'Test User',
    county: 'Test County',
    facts: ['Test fact'],
  };

  it('should handle Utah formatting differences', () => {
    const utahTemplate = new UtahTemplate();
    const document = utahTemplate.generateDocument(testData);
    
    expect(document.sections.header).toBe('STATE OF UTAH');
    expect(document.sections.venue).toBe('County of TEST COUNTY');
    expect(document.sections.notaryBlock).toContain('Residing at:');
  });

  it('should handle Arizona no-venue requirement', () => {
    const arizonaTemplate = new ArizonaTemplate();
    const document = arizonaTemplate.generateDocument({
      ...testData,
      county: undefined, // Arizona doesn't require county
    });
    
    expect(document.sections.header).toBe('STATE OF ARIZONA');
    expect(document.sections.venue).toBeNull();
    expect(document.validation.isValid).toBe(true);
  });

  it('should validate county requirement by state', () => {
    const texasTemplate = new TexasTemplate();
    const arizonaTemplate = new ArizonaTemplate();
    
    const dataWithoutCounty = { ...testData, county: undefined };
    
    const texasValidation = texasTemplate.validateData(dataWithoutCounty);
    expect(texasValidation.isValid).toBe(false);
    
    const arizonaValidation = arizonaTemplate.validateData(dataWithoutCounty);
    expect(arizonaValidation.isValid).toBe(true);
  });
});