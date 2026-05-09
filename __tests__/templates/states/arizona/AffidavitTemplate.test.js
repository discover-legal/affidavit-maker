/** @jest-environment node */
// __tests__/templates/states/arizona/AffidavitTemplate.test.js
const ArizonaAffidavitTemplate = require('../../../../templates/states/arizona/AffidavitTemplate');
const BaseAffidavitTemplate = require('../../../../templates/core/BaseAffidavitTemplate');

describe('ArizonaAffidavitTemplate', () => {
  let template;

  beforeEach(() => {
    template = new ArizonaAffidavitTemplate();
  });

  describe('constructor', () => {
    it('should extend BaseAffidavitTemplate', () => {
      expect(template).toBeInstanceOf(BaseAffidavitTemplate);
    });

    it('should set state code to AZ', () => {
      expect(template.state).toBe('AZ');
    });

    it('should set state name to Arizona', () => {
      expect(template.stateName).toBe('Arizona');
    });

    it('should load metadata', () => {
      expect(template.metadata).toBeDefined();
      expect(template.metadata.stateCode).toBe('AZ');
    });

    it('should include perjury statement', () => {
      expect(template.sections.perjuryStatement).toBe(true);
    });

    it('should require county', () => {
      expect(template.requiredFields).toContain('county');
    });
  });

  describe('generateHeader', () => {
    it('should generate uppercase header', () => {
      const header = template.generateHeader();
      expect(header).toBe('STATE OF ARIZONA');
    });
  });

  describe('generateVenue', () => {
    it('should generate title case venue', () => {
      const venue = template.generateVenue('Maricopa');
      expect(venue).toBe('County of Maricopa');
    });

    it('should handle lowercase county names', () => {
      const venue = template.generateVenue('maricopa');
      expect(venue).toBe('County of Maricopa');
    });

    it('should handle multi-word counties', () => {
      const venue = template.generateVenue('santa cruz');
      expect(venue).toBe('County of Santa Cruz');
    });

    it('should NOT use all caps', () => {
      const venue = template.generateVenue('Maricopa');
      expect(venue).not.toBe('COUNTY OF MARICOPA');
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
    it('should generate Arizona notary block', () => {
      const notaryBlock = template.generateNotaryBlock({});

      expect(notaryBlock).toContain('Subscribed and sworn to');
      expect(notaryBlock).toContain('Notary Public');
      expect(notaryBlock).toContain('My commission expires');
    });

    it('should include "or affirmed" option', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('or affirmed');
    });

    it('should include SEAL marking', () => {
      const notaryBlock = template.generateNotaryBlock({});
      expect(notaryBlock).toContain('(SEAL)');
    });
  });

  describe('generatePerjuryStatement', () => {
    it('should generate Arizona-specific perjury statement', () => {
      const statement = template.generatePerjuryStatement();

      expect(statement).toBeDefined();
      expect(statement).not.toBeNull();
    });

    it('should reference State of Arizona', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toContain('State of Arizona');
    });

    it('should include penalty of perjury language', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toContain('penalty of perjury');
    });

    it('should include declaration language', () => {
      const statement = template.generatePerjuryStatement();
      expect(statement).toContain('I declare');
    });
  });

  describe('generateCompetencyStatement', () => {
    it('should include "competent to testify" language', () => {
      const statement = template.generateCompetencyStatement('John Doe');

      expect(statement.content).toContain('competent to testify');
    });

    it('should explicitly state competency', () => {
      const statement = template.generateCompetencyStatement('John Doe');

      expect(statement.content).toContain('I am competent to testify to the matters stated');
    });
  });

  describe('performStateSpecificValidation', () => {
    it('should require county', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ'
      };

      const result = template.performStateSpecificValidation(data);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('County is required for Arizona');
    });

    it('should pass with county provided', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa'
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

    it('should have specific format requirements', () => {
      const rules = template.getExhibitRules();
      expect(rules.coverPageFormat).toBeDefined();
      expect(rules.coverPageFormat.specificFormat).toBeDefined();
    });
  });

  describe('generateDocument', () => {
    it('should generate complete document', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa',
        facts: ['Fact 1', 'Fact 2']
      };

      const doc = template.generateDocument(data);

      expect(doc.id).toBeDefined();
      expect(doc.state).toBe('AZ');
      expect(doc.sections).toBeDefined();
      expect(doc.fullText).toBeDefined();
      expect(doc.htmlContent).toBeDefined();
    });

    it('should include perjury statement section', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.perjuryStatement).toBeDefined();
      expect(doc.sections.perjuryStatement).not.toBeNull();
      expect(doc.sections.perjuryStatement).toContain('penalty of perjury');
    });

    it('should include Arizona header', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.header).toBe('STATE OF ARIZONA');
    });

    it('should include proper venue', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.sections.venue).toBe('County of Maricopa');
    });

    it('should include perjury statement in full text', () => {
      const data = {
        affiantName: 'John Doe',
        state: 'AZ',
        county: 'Maricopa',
        facts: ['Fact 1']
      };

      const doc = template.generateDocument(data);
      expect(doc.fullText).toContain('penalty of perjury');
    });
  });

  describe('legal compliance', () => {
    it('should have legal citations in metadata', () => {
      expect(template.metadata.legalCitations).toBeDefined();
      expect(template.metadata.legalCitations.length).toBeGreaterThan(0);
    });

    it('should reference Arizona Revised Statutes', () => {
      const citations = template.metadata.legalCitations;
      const hasARS = citations.some(c => c.code.includes('A.R.S.'));
      expect(hasARS).toBe(true);
    });

    it('should reference perjury statute', () => {
      const citations = template.metadata.legalCitations;
      const hasPerjury = citations.some(c => c.code.includes('13-2702'));
      expect(hasPerjury).toBe(true);
    });

    it('should be marked as legally compliant', () => {
      expect(template.metadata.legallyCompliant).toBe(true);
    });

    it('should have version 2.0', () => {
      expect(template.metadata.version).toBe('2.0');
    });
  });
});
