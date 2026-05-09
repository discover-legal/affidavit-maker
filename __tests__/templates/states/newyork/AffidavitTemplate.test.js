/** @jest-environment node */
// __tests__/templates/states/newyork/AffidavitTemplate.test.js
const NewYorkAffidavitTemplate = require('../../../../templates/states/newyork/AffidavitTemplate');
const BaseAffidavitTemplate = require('../../../../templates/core/BaseAffidavitTemplate');

describe('NewYorkAffidavitTemplate', () => {
  let template;

  beforeEach(() => {
    template = new NewYorkAffidavitTemplate();
  });

  describe('constructor', () => {
    it('should extend BaseAffidavitTemplate', () => {
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should set state code to NY', () => {
      expect(template.state).toBe('NY');
    });

    it('should set state name to New York', () => {
      expect(template.stateName).toBe('New York');
    });

    it('should load metadata', () => {
      expect(template.metadata).toBeDefined();
      expect(template.metadata.stateCode).toBe('NY');
    });

    it('should include perjury statement', () => {
      expect(template.sections.perjuryStatement).toBe(true);
    });

    it('should require county', () => {
      expect(template.requiredFields).toContain('county');
    });
  });

  describe('generateHeader', () => {
    it('should generate correct New York header', () => {
      const header = template.generateHeader();
      expect(header).toBe('STATE OF NEW YORK');
    });
  });

  describe('generateVenue', () => {
    it('should generate uppercase venue with ss.: notation', () => {
      const venue = template.generateVenue('Kings');
      expect(venue).toContain('STATE OF NEW YORK');
      expect(venue).toContain('ss.:');
      expect(venue).toContain('COUNTY OF KINGS');
    });

    it('should handle lowercase county names', () => {
      const venue = template.generateVenue('new york');
      expect(venue).toContain('COUNTY OF NEW YORK');
    });

    it('should use placeholder when county not provided', () => {
      const venue = template.generateVenue('');
      expect(venue).toContain('[COUNTY NAME]');
    });
  });

  describe('generateCaseCaption', () => {
    it('should use INDEX NO. terminology', () => {
      const data = { caseNumber: '2024-12345' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('INDEX NO.');
      expect(caption.formatted).toContain('2024-12345');
    });

    it('should accept indexNumber field', () => {
      const data = { indexNumber: '2024-99999' };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('INDEX NO.');
      expect(caption.formatted).toContain('2024-99999');
    });

    it('should include court name', () => {
      const data = {
        court: 'Supreme Court, Kings County',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('SUPREME COURT, KINGS COUNTY');
    });

    it('should use -against- format for parties', () => {
      const data = {
        plaintiff: 'John Doe',
        defendant: 'Jane Smith',
        caseNumber: '2024-12345'
      };
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('JOHN DOE');
      expect(caption.formatted).toContain('Plaintiff');
      expect(caption.formatted).toContain('-against-');
      expect(caption.formatted).toContain('JANE SMITH');
      expect(caption.formatted).toContain('Defendant');
    });

    it('should use placeholders when data missing', () => {
      const data = {};
      const caption = template.generateCaseCaption(data);

      expect(caption.formatted).toContain('[COURT NAME]');
      expect(caption.formatted).toContain('[INDEX NUMBER]');
    });
  });

  describe('generateNotaryBlock', () => {
    it('should generate New York notary block', () => {
      const notaryBlock = template.generateNotaryBlock({});

      expect(notaryBlock).toContain('State of New York');
      expect(notaryBlock).toContain('ss.:');
      expect(notaryBlock).toContain('Subscribed and sworn to before me');
      expect(notaryBlock).toContain('Notary Public');
    });

    it('should include commission expiration line', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('My commission expires');
    });
  });

  describe('generatePerjuryStatement', () => {
    it('should return New York perjury statement', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toBeDefined();
      expect(statement).toContain('penalty of perjury');
      expect(statement).toContain('State of New York');
    });
  });

  describe('performStateSpecificValidation', () => {
    it('should require county', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'NY'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors).toContain('County is required for New York affidavits');
    });

    it('should pass with county provided', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'NY',
        county: 'Kings'
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
        state: 'NY',
        county: 'Kings',
        facts: ['Fact 1', 'Fact 2']
      };

      const doc = template.generateDocument(data);

      expect(doc.id).toBeDefined();
      expect(doc.state).toBe('NY');
      expect(doc.sections).toBeDefined();
      expect(doc.fullText).toBeDefined();
      expect(doc.htmlContent).toBeDefined();
    });

    it('should include perjury statement section', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'NY',
        county: 'Kings',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.perjuryStatement).toBeDefined();
      expect(doc.sections.perjuryStatement).not.toBeNull();
    });

    it('should include New York header', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'NY',
        county: 'Kings',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.header).toBe('STATE OF NEW YORK');
    });

    it('should include proper venue with ss.: notation', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'NY',
        county: 'Kings',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.venue).toContain('STATE OF NEW YORK');
      expect(doc.sections.venue).toContain('ss.:');
      expect(doc.sections.venue).toContain('COUNTY OF KINGS');
    });
  });

  describe('legal compliance', () => {
    it('should have legal citations in metadata', () => {
      expect(template.metadata.legalCitations).toBeDefined();
      expect(template.metadata.legalCitations.length).toBeGreaterThan(0);
    });

    it('should reference New York codes', () => {
      const citations = template.metadata.legalCitations;
      const hasNYCode = citations.some(c => c.code.includes('N.Y.'));
      expect(hasNYCode).toBe(true);
    });

    it('should be marked as legally compliant', () => {
      expect(template.metadata.legallyCompliant).toBe(true);
    });

    it('should have version 2.0', () => {
      expect(template.metadata.version).toBe('2.0');
    });
  });
});
