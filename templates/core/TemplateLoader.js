// templates/core/TemplateLoader.js
// Auto-discovery and loading system for state templates

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { validateMetadata } = require('./validateMetadata');
const BaseAffidavitTemplate = require('./BaseAffidavitTemplate');

/**
 * TemplateLoader
 *
 * Automatically discovers and loads state templates from the templates/states/ directory.
 * Each state directory should contain:
 * - metadata.json (template configuration)
 * - AffidavitTemplate.js (template implementation)
 *
 * @class TemplateLoader
 */
class TemplateLoader {
  constructor() {
    this.statesDir = path.join(__dirname, '..', 'states');
  }

  /**
   * Load all templates from the states directory
   *
   * @param {TemplateRegistry} registry - Registry to register templates with
   * @returns {Promise<Object>} Summary of loaded templates
   */
  async loadAllTemplates(registry) {
    logger.info('Starting template discovery...');

    const summary = {
      loaded: [],
      failed: [],
      total: 0
    };

    try {
      // Check if states directory exists
      const dirExists = await this.directoryExists(this.statesDir);
      if (!dirExists) {
        logger.error(`States directory not found: ${this.statesDir}`);
        throw new Error(`States directory not found: ${this.statesDir}`);
      }

      // Read all subdirectories in templates/states/
      const entries = await fs.readdir(this.statesDir, { withFileTypes: true });
      const stateDirs = entries.filter(entry => entry.isDirectory());

      logger.info(`Found ${stateDirs.length} potential state directories`);

      // Load each state template
      for (const stateDir of stateDirs) {
        const stateName = stateDir.name;

        // Skip template directory (boilerplate)
        if (stateName === '_template') {
          logger.debug('Skipping _template directory');
          continue;
        }

        summary.total++;

        try {
          await this.loadStateTemplate(stateName, registry);
          summary.loaded.push(stateName);
        } catch (error) {
          logger.error(`Failed to load template for ${stateName}:`, error.message);
          summary.failed.push({
            state: stateName,
            error: error.message
          });
        }
      }

      logger.info(`Template loading complete: ${summary.loaded.length} loaded, ${summary.failed.length} failed`);

      return summary;
    } catch (error) {
      logger.error('Template loading failed:', error);
      throw error;
    }
  }

  /**
   * Load a single state template
   *
   * @param {string} stateName - Name of state directory
   * @param {TemplateRegistry} registry - Registry to register template with
   * @private
   */
  async loadStateTemplate(stateName, registry) {
    const stateDir = path.join(this.statesDir, stateName);

    logger.debug(`Loading template for ${stateName}...`);

    // Check for required files
    const metadataPath = path.join(stateDir, 'metadata.json');
    const templatePath = path.join(stateDir, 'AffidavitTemplate.js');

    const metadataExists = await this.fileExists(metadataPath);
    const templateExists = await this.fileExists(templatePath);

    if (!metadataExists) {
      throw new Error(`Missing metadata.json in ${stateName}/`);
    }

    if (!templateExists) {
      throw new Error(`Missing AffidavitTemplate.js in ${stateName}/`);
    }

    // Load and validate metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    let metadata;
    try {
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      throw new Error(`Invalid JSON in metadata.json: ${error.message}`);
    }

    // Validate metadata against schema
    const validationResult = validateMetadata(metadata);
    if (!validationResult.valid) {
      throw new Error(`Invalid metadata: ${validationResult.errors.join(', ')}`);
    }

    // Load template class
    const TemplateClass = require(templatePath);

    // Validate that template extends BaseAffidavitTemplate
    const testInstance = new TemplateClass();
    if (!(testInstance instanceof BaseAffidavitTemplate)) {
      throw new Error(`Template class must extend BaseAffidavitTemplate`);
    }

    // Register the template
    registry.register(metadata.stateCode, TemplateClass, metadata);

    logger.info(`✓ Loaded template: ${metadata.stateName} (${metadata.stateCode})`);
  }

  /**
   * Check if a file exists
   *
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if file exists
   * @private
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   *
   * @param {string} dirPath - Path to directory
   * @returns {Promise<boolean>} True if directory exists
   * @private
   */
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

module.exports = TemplateLoader;
