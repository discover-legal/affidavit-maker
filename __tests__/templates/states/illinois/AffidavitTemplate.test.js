/** @jest-environment node */
// __tests__/templates/states/illinois/AffidavitTemplate.test.js
const IllinoisAffidavitTemplate = require('../../../../templates/states/illinois/AffidavitTemplate');
const BaseAffidavitTemplate = require('../../../../templates/core/BaseAffidavitTemplate');

describe('IllinoisAffidavitTemplate', () => {
  let template;

  beforeEach(() => {
    template = new IllinoisAffidavitTemplate();
  });

  describe('constructor', () => {
    it('should extend BaseAffidavitTemplate', () => {
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should set state code to IL', () => {
      expect(template.state).toBe('IL');
    });

    it('should set state name to Illinois', () => {
      expect(template.stateName).toBe('Illinois');
    });

    it('should load metadata', () => {
      expect(template.metadata).toBeDefined();
      expect(template.metadata.stateCode).toBe('IL');
    });

    it('should include perjury statement', () => {
      expect(template.sections.perjuryStatement).toBe(true);
    });

    it('should require county', () => {
      expect(template.requiredFields).toContain('county');
    });
  });

  describe('generateHeader', () => {
    it('should generate correct Illinois header', () => {
      const header = template.generateHeader();
      expect(header).toBe('STATE OF ILLINOIS');
    });
  });

  describe('generateVenue', () => {
    it('should generate uppercase venue', () => {
      const venue = template.generateVenue('Cook');
      expect(venue).toBe('STATE OF ILLINOIS\nCOUNTY OF COOK');
    });

    it('should handle lowercase county names', () => {
      const venue = template.generateVenue('cook');
      expect(venue).toBe('STATE OF ILLINOIS\nCOUNTY OF COOK');
    });

    it('should handle multi-word counties', () => {
      const venue = template.generateVenue('Du Page');
      expect(venue).toBe('STATE OF ILLINOIS\nCOUNTY OF DU PAGE');
    });

    it('should use placeholder when county not provided', () => {
      const venue = template.generateVenue('');
      expect(venue).toContain('[COUNTY NAME]');
    });
  });

  describe('generateCaseCaption', () => {
    it('should use CASE NO. terminology', () => {
      const data = { caseNumber: '2024-CH-12345' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('CASE NO.');
      expect(caption.formatted).toContain('2024-CH-12345');
    });

    it('should include court name', () => {
      const data = {
        court: 'Circuit Court of Cook County',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('CIRCUIT COURT OF COOK COUNTY');
    });

    it('should use v. format for parties', () => {
      const data = {
        plaintiff: 'John Doe',
        defendant: 'Jane Smith',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('JOHN DOE');
      expect(caption.formatted).toContain('Plaintiff');
      expect(caption.formatted).toContain('v.');
      expect(caption.formatted).toContain('JANE SMITH');
      expect(caption.formatted).toContain('Defendant');
    });

    it('should use placeholders when data missing', () => {
      const data = {};
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('[COURT NAME]');
      expect(caption.formatted).toContain('[CASE NUMBER]');
    });
  });

  describe('generateNotaryBlock', () => {
    it('should generate Illinois notary block', () => {
      const notaryBlock = template.generateNotaryBlock({});

      expect(notaryBlock).toContain('State of Illinois');
      expect(notaryBlock).toContain('Signed and sworn (or affirmed)');
      expect(notaryBlock).toContain('Notary Public');
    });

    it('should include commission expiration line', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('My commission expires');
    });

    it('should include notary seal placeholder', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('[Notary Seal]');
    });
  });

  describe('generatePerjuryStatement', () => {
    it('should return Illinois-specific perjury statement', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toBeDefined();
      expect(statement).toContain('penalties as provided by law');
      expect(statement).toContain('Section 1-109');
      expect(statement).toContain('Code of Civil Procedure');
    });
  });

  describe('performStateSpecificValidation', () => {
    it('should require county', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toContain('County is required for Illinois affidavits');
    });

    it('should pass with county provided', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL',
        county: 'Cook'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getExhibitRules', () => {
    it('should use letter labels', () => {
      const rules = template.getExhibitRules();
      expect(rules.labelStyle).toBe('letters');
    });

    it('should not require cover pages', () => {
      const rules = template.getExhibitRules();
      expect(rules.requireCoverPage).toBe(false);
    });

    it('should include instructions', () => {
      const rules = template.getExhibitRules();
      expect(rules.instructions).toBeDefined();
    });
  });

  describe('generateDocument', () => {
    it('should generate complete document', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL',
        county: 'Cook',
        facts: ['Fact 1', 'Fact 2']
      };

      const doc = template.generateDocument(data);

      expect(doc.id).toBeDefined();
      expect(doc.state).toBe('IL');
      expect(doc.sections).toBeDefined();
      expect(doc.fullText).toBeDefined();
      expect(doc.htmlContent).toBeDefined();
    });

    it('should include perjury statement section', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL',
        county: 'Cook',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.perjuryStatement).toBeDefined();
      expect(doc.sections.perjuryStatement).not.toBeNull();
    });

    it('should include Illinois header', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL',
        county: 'Cook',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.header).toBe('STATE OF ILLINOIS');
    });

    it('should include proper venue', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'IL',
        county: 'Cook',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.venue).toBe('STATE OF ILLINOIS\nCOUNTY OF COOK');
    });
  });

  describe('legal compliance', () => {
    it('should have legal citations in metadata', () => {
      expect(template.metadata.legalCitations).toBeDefined();
      expect(template.metadata.legalCitations.length).toBeGreaterThan(0);
    });

    it('should reference Illinois codes', () => {
      const citations = template.metadata.legalCitations;
      const hasILCode = citations.some(c => c.code.includes('ILCS'));
      expect(hasILCode).toBe(true);
    });

    it('should be marked as legally compliant', () => {
      expect(template.metadata.legallyCompliant).toBe(true);
    });

    it('should have version 2.0', () => {
      expect(template.metadata.version).toBe('2.0');
    });
  });
});
