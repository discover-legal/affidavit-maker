// __tests__/templates/compatibility.test.js
// Compatibility tests to ensure new system produces identical output to old system

const { StateTemplateManager } = require('../../templates/StateTemplateManager');
const { initializeTemplates } = require('../../templates/initialize');

describe('Template System Compatibility', () => {
  let oldManager;
  let newManager;

  beforeAll(async () => {
    // Initialize old system
    oldManager = new StateTemplateManager();

    // Initialize new system
    newManager = await initializeTemplates();
  });

  describe('getSupportedStates', () => {
    it('should return same states in both systems', () => {
      const oldStates = oldManager.getSupportedStates();
      const newStates = newManager.getSupportedStates();

      expect(newStates.length).toBe(oldStates.length);

      const oldCodes = oldStates.map(s => s.code).sort();
      const newCodes = newStates.map(s => s.code).sort();
      expect(newCodes).toEqual(oldCodes);
    });

    it('should return same state names', () => {
      const oldStates = oldManager.getSupportedStates();
      const newStates = newManager.getSupportedStates();

      oldStates.forEach(oldState => {
        const newState = newStates.find(s => s.code === oldState.code);
        expect(newState).toBeDefined();
        expect(newState.name).toBe(oldState.name);
      });
    });

    it('should return same requirements', () => {
      const oldStates = oldManager.getSupportedStates();
      const newStates = newManager.getSupportedStates();

      oldStates.forEach(oldState => {
        const newState = newStates.find(s => s.code === oldState.code);
        expect(newState.requirements).toEqual(oldState.requirements);
      });
    });
  });

  describe('getTemplate', () => {
    const stateCodes = ['TX', 'UT', 'AZ'];

    stateCodes.forEach(stateCode => {
      it(`should return same template type for ${stateCode}`, () => {
        const oldTemplate = oldManager.getTemplate(stateCode);
        const newTemplate = newManager.getTemplate(stateCode);

        expect(newTemplate.state).toBe(oldTemplate.state);
        expect(newTemplate.stateName).toBe(oldTemplate.stateName);
      });
    });

    it('should handle lowercase state codes identically', () => {
      const oldTemplate = oldManager.getTemplate('tx');
      const newTemplate = newManager.getTemplate('tx');

      expect(newTemplate.state).toBe(oldTemplate.state);
    });

    it('should handle invalid state codes identically', () => {
      const oldTemplate = oldManager.getTemplate('XX');
      const newTemplate = newManager.getTemplate('XX');

      expect(newTemplate.state).toBe(oldTemplate.state);
    });
  });

  describe('validateAffidavitData', () => {
    const testData = {
      affiantName: 'John Doe',
      state: 'TX',
      county: 'Travis',
      facts: ['Fact 1', 'Fact 2']
    };

    it('should validate identically for valid data', () => {
      const oldValidation = oldManager.validateAffidavitData('TX', testData);
      const newValidation = newManager.validateAffidavitData('TX', testData);

      expect(newValidation.isValid).toBe(oldValidation.isValid);
      expect(newValidation.errors).toEqual(oldValidation.errors);
      expect(newValidation.warnings).toEqual(oldValidation.warnings);
    });

    it('should detect missing affiant name identically', () => {
      const invalidData = { state: 'TX', county: 'Travis' };

      const oldValidation = oldManager.validateAffidavitData('TX', invalidData);
      const newValidation = newManager.validateAffidavitData('TX', invalidData);

      expect(newValidation.isValid).toBe(oldValidation.isValid);
      expect(newValidation.errors.length).toBe(oldValidation.errors.length);
    });

    it('should detect missing county identically for Texas', () => {
      const invalidData = { affiantName: 'John Doe', state: 'TX' };

      const oldValidation = oldManager.validateAffidavitData('TX', invalidData);
      const newValidation = newManager.validateAffidavitData('TX', invalidData);

      expect(newValidation.isValid).toBe(oldValidation.isValid);
      expect(newValidation.errors).toContain('County is required for Texas affidavits');
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
      facts: ['Fact 1', 'Fact 2', 'Fact 3']
    };

    ['TX', 'UT', 'AZ'].forEach(stateCode => {
      describe(`${stateCode} affidavits`, () => {
        it('should generate same document structure', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.state).toBe(oldDoc.state);
          expect(Object.keys(newDoc.sections)).toEqual(Object.keys(oldDoc.sections));
        });

        it('should generate identical header', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.header).toBe(oldDoc.sections.header);
        });

        it('should generate identical venue', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.venue).toBe(oldDoc.sections.venue);
        });

        it('should generate identical title', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.title).toBe(oldDoc.sections.title);
        });

        it('should generate identical case caption', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.caseCaption.formatted).toBe(oldDoc.sections.caseCaption.formatted);
        });

        it('should generate identical introduction', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.introduction).toBe(oldDoc.sections.introduction);
        });

        it('should generate same number of facts', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.facts.items.length).toBe(oldDoc.sections.facts.items.length);
        });

        it('should generate identical conclusion', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.conclusion).toBe(oldDoc.sections.conclusion);
        });

        it('should generate identical signature block', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.signatureBlock.formatted).toBe(oldDoc.sections.signatureBlock.formatted);
        });

        it('should generate identical notary block', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.notaryBlock).toBe(oldDoc.sections.notaryBlock);
        });

        it('should handle perjury statement identically', () => {
          const stateData = { ...testData, state: stateCode };

          const oldDoc = oldManager.generateAffidavit(stateCode, stateData);
          const newDoc = newManager.generateAffidavit(stateCode, stateData);

          expect(newDoc.sections.perjuryStatement).toBe(oldDoc.sections.perjuryStatement);
        });
      });
    });
  });

  describe('generateAffidavit - Content Comparison', () => {
    const testData = {
      affiantName: 'John Doe',
      state: 'TX',
      county: 'Travis',
      facts: ['Fact 1', 'Fact 2']
    };

    it('should generate identical full text for Texas', () => {
      const oldDoc = oldManager.generateAffidavit('TX', { ...testData, state: 'TX' });
      const newDoc = newManager.generateAffidavit('TX', { ...testData, state: 'TX' });

      // Normalize whitespace for comparison
      const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();
      expect(normalizeText(newDoc.fullText)).toBe(normalizeText(oldDoc.fullText));
    });

    it('should generate similar HTML content structure', () => {
      const oldDoc = oldManager.generateAffidavit('TX', { ...testData, state: 'TX' });
      const newDoc = newManager.generateAffidavit('TX', { ...testData, state: 'TX' });

      expect(newDoc.htmlContent).toContain('<html>');
      expect(newDoc.htmlContent).toContain('</html>');
      expect(newDoc.htmlContent).toContain(testData.affiantName);
    });
  });

  describe('State-Specific Behavior', () => {
    describe('Texas specifics', () => {
      it('should not include perjury statement', () => {
        const testData = {
          affiantName: 'John Doe',
          state: 'TX',
          county: 'Travis',
          facts: ['Fact 1']
        };

        const oldDoc = oldManager.generateAffidavit('TX', testData);
        const newDoc = newManager.generateAffidavit('TX', testData);

        expect(newDoc.sections.perjuryStatement).toBeNull();
        expect(newDoc.sections.perjuryStatement).toBe(oldDoc.sections.perjuryStatement);
      });

      it('should use CAUSE NO. terminology', () => {
        const testData = {
          affiantName: 'John Doe',
          state: 'TX',
          county: 'Travis',
          caseNumber: '2024-12345',
          facts: ['Fact 1']
        };

        const oldDoc = oldManager.generateAffidavit('TX', testData);
        const newDoc = newManager.generateAffidavit('TX', testData);

        expect(newDoc.sections.caseCaption.formatted).toContain('CAUSE NO.');
        expect(newDoc.sections.caseCaption.formatted).toBe(oldDoc.sections.caseCaption.formatted);
      });
    });

    describe('Utah specifics', () => {
      it('should include notary instruction', () => {
        const testData = {
          affiantName: 'John Doe',
          state: 'UT',
          county: 'Salt Lake',
          facts: ['Fact 1']
        };

        const oldDoc = oldManager.generateAffidavit('UT', testData);
        const newDoc = newManager.generateAffidavit('UT', testData);

        expect(newDoc.sections.notaryInstruction).toBeDefined();
        expect(newDoc.sections.notaryInstruction).toBe(oldDoc.sections.notaryInstruction);
      });

      it('should use sentence case header', () => {
        const testData = {
          affiantName: 'John Doe',
          state: 'UT',
          county: 'Salt Lake',
          facts: ['Fact 1']
        };

        const oldDoc = oldManager.generateAffidavit('UT', testData);
        const newDoc = newManager.generateAffidavit('UT', testData);

        expect(newDoc.sections.header).toBe('State of Utah');
        expect(newDoc.sections.header).toBe(oldDoc.sections.header);
      });
    });

    describe('Arizona specifics', () => {
      it('should include perjury statement', () => {
        const testData = {
          affiantName: 'John Doe',
          state: 'AZ',
          county: 'Maricopa',
          facts: ['Fact 1']
        };

        const oldDoc = oldManager.generateAffidavit('AZ', testData);
        const newDoc = newManager.generateAffidavit('AZ', testData);

        expect(newDoc.sections.perjuryStatement).toBeDefined();
        expect(newDoc.sections.perjuryStatement).not.toBeNull();
        expect(newDoc.sections.perjuryStatement).toBe(oldDoc.sections.perjuryStatement);
      });
    });
  });

  describe('getLegalCitations', () => {
    it('should return same citations for Texas', () => {
      const oldCitations = oldManager.getLegalCitations('TX');
      const newCitations = newManager.getLegalCitations('TX');

      expect(newCitations.primary).toBe(oldCitations.primary);
      expect(newCitations.secondary).toEqual(oldCitations.secondary);
    });

    it('should return same citations for Utah', () => {
      const oldCitations = oldManager.getLegalCitations('UT');
      const newCitations = newManager.getLegalCitations('UT');

      expect(newCitations.primary).toBe(oldCitations.primary);
      expect(newCitations.secondary).toEqual(oldCitations.secondary);
    });

    it('should return same citations for Arizona', () => {
      const oldCitations = oldManager.getLegalCitations('AZ');
      const newCitations = newManager.getLegalCitations('AZ');

      expect(newCitations.primary).toBe(oldCitations.primary);
      expect(newCitations.secondary).toEqual(oldCitations.secondary);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty facts array identically', () => {
      const testData = {
        affiantName: 'John Doe',
        state: 'TX',
        county: 'Travis',
        facts: []
      };

      const oldDoc = oldManager.generateAffidavit('TX', testData);
      const newDoc = newManager.generateAffidavit('TX', testData);

      expect(newDoc.sections.facts.items.length).toBe(oldDoc.sections.facts.items.length);
    });

    it('should handle missing optional fields identically', () => {
      const testData = {
        affiantName: 'John Doe',
        state: 'TX',
        county: 'Travis',
        facts: ['Fact 1']
      };

      const oldDoc = oldManager.generateAffidavit('TX', testData);
      const newDoc = newManager.generateAffidavit('TX', testData);

      expect(newDoc.sections.caseCaption.formatted).toContain('[CASE NUMBER]');
      expect(newDoc.sections.caseCaption.formatted).toBe(oldDoc.sections.caseCaption.formatted);
    });
  });

  describe('Performance', () => {
    it('should generate documents in reasonable time', () => {
      const testData = {
        affiantName: 'John Doe',
        state: 'TX',
        county: 'Travis',
        facts: Array(50).fill('Test fact')
      };

      const start = Date.now();
      newManager.generateAffidavit('TX', testData);
      const duration = Date.now() - start;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
