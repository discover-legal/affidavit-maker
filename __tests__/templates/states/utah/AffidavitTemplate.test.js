// __tests__/templates/states/utah/AffidavitTemplate.test.js
const UtahAffidavitTemplate = require('../../../../templates/states/utah/AffidavitTemplate');
const BaseAffidavitTemplate = require('../../../../templates/core/BaseAffidavitTemplate');

describe('UtahAffidavitTemplate', () => {
  let template;

  beforeEach(() => {
    template = new UtahAffidavitTemplate();
  });

  describe('constructor', () => {
    it('should extend BaseAffidavitTemplate', () => {
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should set state code to UT', () => {
      expect(template.state).toBe('UT');
    });

    it('should set state name to Utah', () => {
      expect(template.stateName).toBe('Utah');
    });

    it('should load metadata', () => {
      expect(template.metadata).toBeDefined();
      expect(template.metadata.stateCode).toBe('UT');
    });

    it('should not include perjury statement', () => {
      expect(template.sections.perjuryStatement).toBe(false);
    });

    it('should require county', () => {
      expect(template.requiredFields).toContain('county');
    });
  });

  describe('generateHeader', () => {
    it('should generate sentence case header', () => {
      const header = template.generateHeader();
      expect(header).toBe('State of Utah');
    });

    it('should NOT use all caps', () => {
      const header = template.generateHeader();
      expect(header).not.toBe('STATE OF UTAH');
    });
  });

  describe('generateVenue', () => {
    it('should generate title case venue', () => {
      const venue = template.generateVenue('Salt Lake');
      expect(venue).toBe('County of Salt Lake');
    });

    it('should handle lowercase county names', () => {
      const venue = template.generateVenue('salt lake');
      expect(venue).toBe('County of Salt Lake');
    });

    it('should handle single word counties', () => {
      const venue = template.generateVenue('utah');
      expect(venue).toBe('County of Utah');
    });

    it('should properly capitalize each word', () => {
      const venue = template.generateVenue('SALT LAKE');
      expect(venue).toBe('County of Salt Lake');
    });
  });

  describe('generateCaseCaption', () => {
    it('should use CASE NO. terminology', () => {
      const data = { caseNumber: '2024-12345' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('CASE NO.');
      expect(caption.formatted).toContain('2024-12345');
    });

    it('should NOT use CAUSE NO.', () => {
      const data = { caseNumber: '2024-12345' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).not.toContain('CAUSE NO.');
    });
  });

  describe('generateNotaryBlock', () => {
    it('should generate Utah statutory notary block', () => {
      const notaryBlock = template.generateNotaryBlock({});

      expect(notaryBlock).toContain('Subscribed and sworn to before me');
      expect(notaryBlock).toContain('Notary Public, State of Utah');
      expect(notaryBlock).toContain('My commission expires');
    });

    it('should include notary name field', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('(notary public name)');
    });

    it('should include specific date format', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('(date)');
      expect(notaryBlock).toContain('(month)');
      expect(notaryBlock).toContain('(year)');
    });

    it('should include document signer name field', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('(name of document signer)');
    });

    it('should include SEAL marking', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('(SEAL)');
    });
  });

  describe('generateNotaryInstruction', () => {
    it('should generate mandatory oath instruction', () => {
      const instruction = template.generateNotaryInstruction();

      expect(instruction).toBeDefined();
      expect(instruction).toContain('INSTRUCTION FOR NOTARY PUBLIC');
    });

    it('should reference Utah Code § 46-1-6.5(2)(a)', () => {
      const instruction = template.generateNotaryInstruction();
      expect(instruction).toContain('Utah Code § 46-1-6.5(2)(a)');
    });

    it('should include the exact oath language', () => {
      const instruction = template.generateNotaryInstruction();
      expect(instruction).toContain('Do you swear or affirm under penalty of perjury');
    });
  });

  describe('generatePerjuryStatement', () => {
    it('should return null (oath provides perjury warning)', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toBeNull();
    });
  });

  describe('generateCompetencyStatement', () => {
    it('should include "competent to testify" language', () => {
      const statement = template.generateCompetencyStatement('John Doe');

      expect(statement.content).toContain('testify competently');
    });

    it('should be more detailed than base template', () => {
      const statement = template.generateCompetencyStatement('John Doe');

      expect(statement.content).toContain('If called as a witness');
      expect(statement.content).toContain('I could testify competently');
    });
  });

  describe('performStateSpecificValidation', () => {
    it('should require county', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toContain('County is required for Utah affidavits per Utah Code § 46-1-6.5');
    });

    it('should pass with county provided', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT',
        county: 'Salt Lake'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('generateDocument', () => {
    it('should generate complete document', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT',
        county: 'Salt Lake',
        facts: ['Fact 1', 'Fact 2']
      };

      const doc = template.generateDocument(data);

      expect(doc.id).toBeDefined();
      expect(doc.state).toBe('UT');
      expect(doc.sections).toBeDefined();
    });

    it('should include notary instruction section', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT',
        county: 'Salt Lake',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.notaryInstruction).toBeDefined();
      expect(doc.sections.notaryInstruction).toContain('INSTRUCTION FOR NOTARY PUBLIC');
    });

    it('should include instruction in full text', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT',
        county: 'Salt Lake',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.fullText).toContain('INSTRUCTION FOR NOTARY PUBLIC');
    });

    it('should use sentence case header', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'UT',
        county: 'Salt Lake',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.header).toBe('State of Utah');
    });
  });

  describe('legal compliance', () => {
    it('should have legal citations in metadata', () => {
      expect(template.metadata.legalCitations).toBeDefined();
      expect(template.metadata.legalCitations.length).toBeGreaterThan(0);
    });

    it('should reference Utah Code § 46-1-6.5', () => {
      const citations = template.metadata.legalCitations;
      const hasUtahCode = citations.some(c => c.code.includes('Utah Code § 46-1-6.5'));
      expect(hasUtahCode).toBe(true);
    });

    it('should be marked as legally compliant', () => {
      expect(template.metadata.legallyCompliant).toBe(true);
    });

    it('should note prescriptive statutory form', () => {
      const primaryCitation = template.metadata.legalCitations[0];
      expect(primaryCitation.description.toUpperCase()).toContain('PRESCRIPTIVE');
    });
  });

  describe('getExhibitRules', () => {
    it('should use letter labels', () => {
      const rules = template.getExhibitRules();
      expect(rules.labelStyle).toBe('letters');
    });

    it('should require cover pages', () => {
      const rules = template.getExhibitRules();
      expect(rules.requireCoverPage).toBe(true);
    });
  });
});
