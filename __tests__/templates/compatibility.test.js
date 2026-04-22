// __tests__/templates/compatibility.test.js
// Validates that the template system (registry-based) produces correct output
// for all original states (TX, UT, AZ, CA).

const { initializeTemplates } = require('../../templates/initialize');
const BaseAffidavitTemplate = require('../../templates/core/BaseAffidavitTemplate');

describe('Template System', () => {
  let registry;

  beforeAll(async () => {
    registry = await initializeTemplates();
  });

  describe('getSupportedStates', () => {
    it('should include all original states', () => {
      const states = registry.getSupportedStates();
      const codes = states.map(s => s.code);
      expect(codes).toContain('TX');
      expect(codes).toContain('UT');
      expect(codes).toContain('AZ');
      expect(codes).toContain('CA');
    });

    it('should return state names and requirements', () => {
      const states = registry.getSupportedStates();
      const texas = states.find(s => s.code === 'TX');
      expect(texas.name).toBe('Texas');
      expect(texas.requirements).toBeDefined();
      expect(texas.requirements.venue).toBe(true);
      expect(texas.requirements.countyRequired).toBe(true);
    });
  });

  describe('getTemplate', () => {
    const stateCodes = ['TX', 'UT', 'AZ', 'CA'];

    stateCodes.forEach(stateCode => {
      it(`should return a valid template for ${stateCode}`, () => {
        const template = registry.getTemplate(stateCode);
        expect(template).toBeInstanceOf(BaseAffidavitTemplate);
        expect(template.state).toBe(stateCode);
      });
    });

    it('should handle lowercase state codes', () => {
      const template = registry.getTemplate('tx');
      expect(template.state).toBe('TX');
    });

    it('should fall back to default for invalid state codes', () => {
      const template = registry.getTemplate('XX');
      expect(template.state).toBe('TX');
    });
  });

  describe('validateAffidavitData', () => {
    const testData = {
      affiantName: 'John Doe',
      state: 'TX',
      county: 'Travis',
      facts: ['Fact 1', 'Fact 2'],
    };

    it('should validate valid data', () => {
      const validation = registry.validateAffidavitData('TX', testData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing affiant name', () => {
      const invalidData = { state: 'TX', county: 'Travis' };
      const validation = registry.validateAffidavitData('TX', invalidData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing county for Texas', () => {
      const invalidData = { affiantName: 'John Doe', state: 'TX' };
      const validation = registry.validateAffidavitData('TX', invalidData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('County is required for Texas affidavits');
    });
  });

  describe('generateAffidavit - Document Structure', () => {
    const testData = {
      affiantName: 'John Doe',
      state: 'TX',
      county: 'Travis',
      caseNumber: '2024-12345',
      court: 'District Court',
      plaintiff: 'Plaintiff Name',
      defendant: 'Defendant Name',
      facts: ['Fact 1', 'Fact 2', 'Fact 3'],
    };

    ['TX', 'UT', 'AZ', 'CA'].forEach(stateCode => {
      describe(`${stateCode} affidavits`, () => {
        let doc;

        beforeAll(() => {
          doc = registry.generateAffidavit(stateCode, { ...testData, state: stateCode });
        });

        it('should have correct state', () => {
          expect(doc.state).toBe(stateCode);
        });

        it('should have all required sections', () => {
          expect(doc.sections.header).toBeDefined();
          expect(doc.sections.title).toBeDefined();
          expect(doc.sections.introduction).toBeDefined();
          expect(doc.sections.facts).toBeDefined();
          expect(doc.sections.conclusion).toBeDefined();
          expect(doc.sections.signatureBlock).toBeDefined();
          expect(doc.sections.notaryBlock).toBeDefined();
        });

        it('should generate case caption with CAUSE NO. or CASE NO.', () => {
          const caption = doc.sections.caseCaption?.formatted || '';
          expect(caption).toMatch(/CAUSE NO\.|CASE NO\./);
        });

        it('should include facts', () => {
          expect(doc.sections.facts.items.length).toBeGreaterThanOrEqual(3);
        });

        it('should generate conclusion', () => {
          expect(doc.sections.conclusion).toContain('Further');
        });

        it('should generate signature block', () => {
          expect(doc.sections.signatureBlock.formatted).toContain('John Doe');
        });

        it('should generate notary block with jurat', () => {
          const normalize = (text) => text ? text.replace(/[ \t]+$/gm, '').trim() : '';
          const notary = normalize(doc.sections.notaryBlock);
          expect(notary.length).toBeGreaterThan(20);
          // All states should have some form of notary/jurat
          expect(notary).toMatch(/SWORN|Subscribed|sworn|affirm/i);
        });
      });
    });
  });

  describe('generateAffidavit - Content', () => {
    const testData = {
      affiantName: 'John Doe',
      state: 'TX',
      county: 'Travis',
      facts: ['Fact 1', 'Fact 2'],
    };

    it('should generate full text containing all content for Texas', () => {
      const doc = registry.generateAffidavit('TX', testData);
      const text = doc.fullText;
      expect(text).toContain('THE STATE OF TEXAS');
      expect(text).toContain('COUNTY OF TRAVIS');
      expect(text).toContain('SWORN TO AND SUBSCRIBED');
      expect(text).toContain('John Doe');
    });

    it('should generate valid HTML content', () => {
      const doc = registry.generateAffidavit('TX', testData);
      expect(doc.htmlContent).toContain('<html>');
      expect(doc.htmlContent).toContain('</html>');
      expect(doc.htmlContent).toContain(testData.affiantName);
    });
  });

  describe('State-Specific Behavior', () => {
    describe('Texas', () => {
      it('should not include perjury statement (per Tex. Govt Code 312.011)', () => {
        const doc = registry.generateAffidavit('TX', {
          affiantName: 'John Doe', state: 'TX', county: 'Travis', facts: ['Fact 1'],
        });
        expect(doc.sections.perjuryStatement).toBeNull();
      });

      it('should use CAUSE NO. terminology', () => {
        const doc = registry.generateAffidavit('TX', {
          affiantName: 'John Doe', state: 'TX', county: 'Travis',
          caseNumber: '2024-12345', facts: ['Fact 1'],
        });
        expect(doc.sections.caseCaption.formatted).toContain('CAUSE NO.');
      });
    });

    describe('Utah', () => {
      it('should use sentence case header per Utah Code 46-1-6.5', () => {
        const doc = registry.generateAffidavit('UT', {
          affiantName: 'John Doe', state: 'UT', county: 'Salt Lake', facts: ['Fact 1'],
        });
        expect(doc.sections.header).toBe('State of Utah');
      });

      it('should include notary instruction for oath requirement', () => {
        const doc = registry.generateAffidavit('UT', {
          affiantName: 'John Doe', state: 'UT', county: 'Salt Lake', facts: ['Fact 1'],
        });
        expect(doc.sections.notaryInstruction).toBeDefined();
        expect(doc.sections.notaryInstruction).toContain('oath');
      });
    });

    describe('Arizona', () => {
      it('should include perjury statement per A.R.S. 13-2702', () => {
        const doc = registry.generateAffidavit('AZ', {
          affiantName: 'John Doe', state: 'AZ', county: 'Maricopa', facts: ['Fact 1'],
        });
        expect(doc.sections.perjuryStatement).toBeDefined();
        expect(doc.sections.perjuryStatement).not.toBeNull();
        expect(doc.sections.perjuryStatement).toContain('perjury');
      });
    });

    describe('California', () => {
      it('should support declaration under penalty of perjury per CCP 2015.5', () => {
        const doc = registry.generateAffidavit('CA', {
          affiantName: 'John Doe', state: 'CA', county: 'Los Angeles', facts: ['Fact 1'],
        });
        // California uses declarations under penalty of perjury
        expect(doc.sections.perjuryStatement).toBeDefined();
      });
    });
  });

  describe('getLegalCitations', () => {
    it('should return citations for Texas', () => {
      const citations = registry.getLegalCitations('TX');
      expect(citations).not.toBeNull();
      expect(citations.primary).toBeDefined();
      expect(citations.secondary.length).toBeGreaterThan(0);
    });

    it('should return citations for Utah', () => {
      const citations = registry.getLegalCitations('UT');
      expect(citations).not.toBeNull();
      expect(citations.primary).toBeDefined();
    });

    it('should return citations for Arizona', () => {
      const citations = registry.getLegalCitations('AZ');
      expect(citations).not.toBeNull();
      expect(citations.primary).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty facts array', () => {
      const doc = registry.generateAffidavit('TX', {
        affiantName: 'John Doe', state: 'TX', county: 'Travis', facts: [],
      });
      // Should still have competency statement as first fact
      expect(doc.sections.facts.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle missing optional fields', () => {
      const doc = registry.generateAffidavit('TX', {
        affiantName: 'John Doe', state: 'TX', county: 'Travis', facts: ['Fact 1'],
      });
      expect(doc.sections.caseCaption.formatted).toContain('[CASE NUMBER]');
    });
  });

  describe('Performance', () => {
    it('should generate documents in reasonable time', () => {
      const start = Date.now();
      registry.generateAffidavit('TX', {
        affiantName: 'John Doe', state: 'TX', county: 'Travis',
        facts: Array(50).fill('Test fact'),
      });
      expect(Date.now() - start).toBeLessThan(100);
    });
  });
});
