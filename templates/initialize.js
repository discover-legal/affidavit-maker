// templates/initialize.js
// Template system initialization module

const TemplateRegistry = require('./core/TemplateRegistry');
const TemplateLoader = require('./core/TemplateLoader');
const logger = require('../utils/logger');

/**
 * Initialize the template system
 *
 * Creates a registry, loads all templates from templates/states/,
 * and returns the configured registry.
 *
 * @returns {Promise<TemplateRegistry>} Initialized template registry
 */
async function initializeTemplates() {
  logger.info('Initializing template system...');

  try {
    // Create registry
    const registry = new TemplateRegistry();

    // Create loader and load all templates
    const loader = new TemplateLoader();
    const summary = await loader.loadAllTemplates(registry);

    // Log results
    const states = registry.getSupportedStates();
    logger.info(`Template system initialized successfully`);
    logger.info(`Loaded templates for ${states.length} states: ${states.map(s => s.code).join(', ')}`);

    if (summary.failed.length > 0) {
      logger.warn(`Failed to load ${summary.failed.length} templates:`, summary.failed);
    }

    // Validate that at least one template loaded
    if (states.length === 0) {
      throw new Error('No templates loaded! Check templates/states/ directory.');
    }

    return registry;
  } catch (error) {
    logger.error('Failed to initialize template system:', error);
    throw error;
  }
}

module.exports = { initializeTemplates };
