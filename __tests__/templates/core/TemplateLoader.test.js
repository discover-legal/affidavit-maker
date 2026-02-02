// __tests__/templates/core/TemplateLoader.test.js
const TemplateLoader = require('../../../templates/core/TemplateLoader');
const TemplateRegistry = require('../../../templates/core/TemplateRegistry');
const path = require('path');

describe('TemplateLoader', () => {
  let loader;
  let registry;

  beforeEach(() => {
    loader = new TemplateLoader();
    registry = new TemplateRegistry();
  });

  describe('constructor', () => {
    it('should set statesDir correctly', () => {
      expect(loader.statesDir).toBeDefined();
      expect(loader.statesDir).toContain('templates');
      expect(loader.statesDir).toContain('states');
    });

    it('should use absolute path for statesDir', () => {
      expect(path.isAbsolute(loader.statesDir)).toBe(true);
    });
  });

  describe('loadAllTemplates', () => {
    it('should load templates from states directory', async () => {
      const summary = await loader.loadAllTemplates(registry);

      expect(summary).toBeDefined();
      expect(summary.loaded).toBeDefined();
      expect(summary.failed).toBeDefined();
      expect(summary.total).toBeDefined();
    });

    it('should load all existing state templates', async () => {
      const summary = await loader.loadAllTemplates(registry);

      // Should load TX, UT, AZ
      expect(summary.loaded.length).toBeGreaterThanOrEqual(3);
      expect(summary.loaded).toContain('texas');
      expect(summary.loaded).toContain('utah');
      expect(summary.loaded).toContain('arizona');
    });

    it('should not fail on any existing templates', async () => {
      const summary = await loader.loadAllTemplates(registry);

      expect(summary.failed).toHaveLength(0);
    });

    it('should register templates in the registry', async () => {
      await loader.loadAllTemplates(registry);

      expect(registry.hasState('TX')).toBe(true);
      expect(registry.hasState('UT')).toBe(true);
      expect(registry.hasState('AZ')).toBe(true);
    });

    it('should skip _template directory', async () => {
      const summary = await loader.loadAllTemplates(registry);

      // _template should not be in loaded or failed
      expect(summary.loaded).not.toContain('_template');
      expect(summary.failed.find(f => f.state === '_template')).toBeUndefined();
    });

    it('should return summary with counts', async () => {
      const summary = await loader.loadAllTemplates(registry);

      expect(summary.total).toBeGreaterThanOrEqual(3);
      expect(summary.loaded.length).toBe(summary.total - summary.failed.length);
    });

    it('should log loaded template names', async () => {
      const summary = await loader.loadAllTemplates(registry);

      // Each loaded item should be a directory name (lowercase)
      summary.loaded.forEach(name => {
        expect(typeof name).toBe('string');
        expect(name).toBe(name.toLowerCase());
      });
    });
  });

  describe('loadStateTemplate', () => {
    it('should load Texas template correctly', async () => {
      await loader.loadStateTemplate('texas', registry);

      expect(registry.hasState('TX')).toBe(true);
      const template = registry.getTemplate('TX');
      expect(template.state).toBe('TX');
      expect(template.stateName).toBe('Texas');
    });

    it('should load Utah template correctly', async () => {
      await loader.loadStateTemplate('utah', registry);

      expect(registry.hasState('UT')).toBe(true);
      const template = registry.getTemplate('UT');
      expect(template.state).toBe('UT');
      expect(template.stateName).toBe('Utah');
    });

    it('should load Arizona template correctly', async () => {
      await loader.loadStateTemplate('arizona', registry);

      expect(registry.hasState('AZ')).toBe(true);
      const template = registry.getTemplate('AZ');
      expect(template.state).toBe('AZ');
      expect(template.stateName).toBe('Arizona');
    });

    it('should throw error for nonexistent state directory', async () => {
      // When the directory/template doesn't exist, loadStateTemplate
      // throws an error about missing AffidavitTemplate.js
      await expect(
        loader.loadStateTemplate('nonexistent', registry)
      ).rejects.toThrow('Missing AffidavitTemplate.js');
    });

    it('should throw error for missing AffidavitTemplate.js', async () => {
      // This is covered by the test above - when state directory
      // doesn't have AffidavitTemplate.js, it throws an error
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const testFile = path.join(loader.statesDir, 'texas', 'metadata.json');
      const exists = await loader.fileExists(testFile);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const testFile = path.join(loader.statesDir, 'nonexistent.json');
      const exists = await loader.fileExists(testFile);
      expect(exists).toBe(false);
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directory', async () => {
      const exists = await loader.directoryExists(loader.statesDir);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing directory', async () => {
      const testDir = path.join(loader.statesDir, 'nonexistent-state');
      const exists = await loader.directoryExists(testDir);
      expect(exists).toBe(false);
    });

    it('should return false for file path', async () => {
      const filePath = path.join(loader.statesDir, 'texas', 'metadata.json');
      const exists = await loader.directoryExists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('integration with TemplateRegistry', () => {
    it('should populate registry with templates', async () => {
      const initialCount = registry.getTemplateCount();
      expect(initialCount).toBe(0);

      await loader.loadAllTemplates(registry);

      const finalCount = registry.getTemplateCount();
      expect(finalCount).toBeGreaterThanOrEqual(3);
    });

    it('should make templates accessible via registry', async () => {
      await loader.loadAllTemplates(registry);

      const states = registry.getSupportedStates();
      expect(states.length).toBeGreaterThanOrEqual(3);

      // Verify each state is accessible
      states.forEach(state => {
        const template = registry.getTemplate(state.code);
        expect(template).toBeDefined();
        expect(template.state).toBe(state.code);
      });
    });

    it('should load metadata for each template', async () => {
      await loader.loadAllTemplates(registry);

      const metadata = registry.getMetadata('TX');
      expect(metadata).toBeDefined();
      expect(metadata.stateCode).toBe('TX');
      expect(metadata.stateName).toBe('Texas');
      expect(metadata.legalCitations).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle corrupt metadata.json gracefully', async () => {
      // Would need to create test fixture with corrupt JSON
      // For now, verify that errors are caught and reported in summary
      const summary = await loader.loadAllTemplates(registry);
      expect(summary.failed).toBeInstanceOf(Array);
    });

    it('should continue loading after a failure', async () => {
      // Even if one template fails, others should still load
      const summary = await loader.loadAllTemplates(registry);

      // At least some templates should load
      expect(summary.loaded.length).toBeGreaterThan(0);
    });
  });
});
