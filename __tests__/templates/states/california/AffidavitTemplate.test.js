/** @jest-environment node */
// __tests__/templates/states/california/AffidavitTemplate.test.js
const CaliforniaAffidavitTemplate = require('../../../../templates/states/california/AffidavitTemplate');
const BaseAffidavitTemplate = require('../../../../templates/core/BaseAffidavitTemplate');

describe('CaliforniaAffidavitTemplate', () => {
  let template;

  beforeEach(() => {
    template = new CaliforniaAffidavitTemplate();
  });

  describe('constructor', () => {
    it('should extend BaseAffidavitTemplate', () => {
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should set state code to CA', () => {
      expect(template.state).toBe('CA');
    });

    it('should set state name to California', () => {
      expect(template.stateName).toBe('California');
    });

    it('should load metadata', () => {
      expect(template.metadata).toBeDefined();
      expect(template.metadata.stateCode).toBe('CA');
    });

    it('should include perjury statement', () => {
      expect(template.sections.perjuryStatement).toBe(true);
    });

    it('should require county', () => {
      expect(template.requiredFields).toContain('county');
    });
  });

  describe('generateHeader', () => {
    it('should generate correct California header', () => {
      const header = template.generateHeader();
      expect(header).toBe('STATE OF CALIFORNIA');
    });
  });

  describe('generateVenue', () => {
    it('should generate sentence case venue', () => {
      const venue = template.generateVenue('Orange');
      expect(venue).toBe('State of California\nCounty of Orange');
    });

    it('should handle county names without altering case', () => {
      const venue = template.generateVenue('Los Angeles');
      expect(venue).toBe('State of California\nCounty of Los Angeles');
    });

    it('should use placeholder when county not provided', () => {
      const venue = template.generateVenue('');
      expect(venue).toContain('[COUNTY NAME]');
    });
  });

  describe('generateCaseCaption', () => {
    it('should use CASE NO. terminology', () => {
      const data = { caseNumber: '2024-12345' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('CASE NO.');
      expect(caption.formatted).toContain('2024-12345');
    });

    it('should include court name', () => {
      const data = {
        court: 'Superior Court of Orange County',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('SUPERIOR COURT OF ORANGE COUNTY');
    });

    it('should include party names', () => {
      const data = {
        plaintiff: 'John Doe',
        defendant: 'Jane Smith',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('JOHN DOE');
      expect(caption.formatted).toContain('JANE SMITH');
      expect(caption.formatted).toContain('V.');
    });

    it('should use placeholders when data missing', () => {
      const data = {};
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('[COURT NAME]');
      expect(caption.formatted).toContain('[CASE NUMBER]');
    });
  });

  describe('generateNotaryBlock', () => {
    it('should generate California statutory notary block', () => {
      const notaryBlock = template.generateNotaryBlock({});

      expect(notaryBlock).toContain('State of California');
      expect(notaryBlock).toContain('Subscribed and sworn to (or affirmed)');
      expect(notaryBlock).toContain('Notary Public Signature');
    });

    it('should include identity verification notice', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('verifies only the identity');
    });

    it('should have boxed notice per § 8202', () => {
      const notaryBlock = template.generateNotaryBlock({});
      // The notice is required by § 8202 - it will be boxed when rendered in PDF
      expect(notaryBlock).toContain('A notary public or other officer completing this certificate');
      expect(notaryBlock).toContain('verifies only the identity of the individual who signed');
    });
  });

  describe('generatePerjuryStatement', () => {
    it('should return California perjury statement', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toBeDefined();
      expect(statement).toContain('penalty of perjury');
      expect(statement).toContain('State of California');
    });
  });

  describe('performStateSpecificValidation', () => {
    it('should require county', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toContain('County is required for California affidavits');
    });

    it('should pass with county provided', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA',
        county: 'Orange'
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

    it('should require cover pages', () => {
      const rules = template.getExhibitRules();
      expect(rules.requireCoverPage).toBe(true);
    });

    it('should include instructions', () => {
      const rules = template.getExhibitRules();
      expect(rules.instructions).toBeDefined();
      expect(rules.instructions).toContain('exhibit');
    });
  });

  describe('generateDocument', () => {
    it('should generate complete document', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA',
        county: 'Orange',
        facts: ['Fact 1', 'Fact 2']
      };

      const doc = template.generateDocument(data);

      expect(doc.id).toBeDefined();
      expect(doc.state).toBe('CA');
      expect(doc.sections).toBeDefined();
      expect(doc.fullText).toBeDefined();
      expect(doc.htmlContent).toBeDefined();
    });

    it('should include perjury statement section', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA',
        county: 'Orange',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.perjuryStatement).toBeDefined();
      expect(doc.sections.perjuryStatement).not.toBeNull();
    });

    it('should include California header', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA',
        county: 'Orange',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.header).toBe('STATE OF CALIFORNIA');
    });

    it('should include proper venue', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'CA',
        county: 'Orange',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.venue).toContain('State of California');
      expect(doc.sections.venue).toContain('County of Orange');
    });
  });

  describe('legal compliance', () => {
    it('should have legal citations in metadata', () => {
      expect(template.metadata.legalCitations).toBeDefined();
      expect(template.metadata.legalCitations.length).toBeGreaterThan(0);
    });

    it('should reference California codes', () => {
      const citations = template.metadata.legalCitations;
      const hasCalCode = citations.some(c => c.code.includes('Cal.'));
      expect(hasCalCode).toBe(true);
    });

    it('should be marked as legally compliant', () => {
      expect(template.metadata.legallyCompliant).toBe(true);
    });

    it('should have version 2.0', () => {
      expect(template.metadata.version).toBe('2.0');
    });
  });
});
