// templates/core/TemplateLoader.js
// Auto-discovery and loading system for state templates with multi-document type support

const fs = require('fs').promises;
const path = require('path');
const Module = require('node:module');
const logger = require('../../utils/logger');
const { validateMetadata } = require('./validateMetadata');
const { isAllowedJurisdiction } = require('../../config/jurisdictions');

/**
 * Node's real `require`, obtained without `eval`. When this file is
 * bundled into .next/server/chunks/ by Next.js, the in-scope `require`
 * is Webpack's own module resolver — which only knows about modules
 * Webpack bundled, not the filesystem-included templates copied in via
 * `outputFileTracingIncludes`. `Module.createRequire(__filename)`
 * synthesises a real Node require anchored at this file's location, so
 * absolute filesystem paths (and Base*Template peers) resolve normally.
 *
 * The previous implementation used `eval('require')` to dodge Webpack;
 * `createRequire` is the documented, non-eval equivalent. Same correctness
 * properties:
 *   - paths come from `fs.readdir(templates/states/)`, never user input;
 *   - Base*Template peers load through the same require so `instanceof`
 *     matches the dynamically loaded subclasses.
 *
 * Defense in depth: every dynamic path passes through `safeTemplatePath`
 * below, which `path.relative`-checks the resolved file against the
 * trusted templates root and refuses anything that escapes the sandbox.
 *
 * TODO(arch): replace with a build-time codegen step that emits a static
 * module map (`templates/_generated/registry.js` with explicit imports)
 * so Webpack can statically resolve every template and this escape
 * hatch goes away.
 */
const nodeRequire = Module.createRequire(__filename);

const TEMPLATES_ROOT = path.resolve(path.join(process.cwd(), 'templates'));

/**
 * Resolve a template path and require it ONLY if it lives under the
 * trusted `<cwd>/templates/` root. Throws otherwise. Belt-and-braces on
 * top of the fact that all callers compose paths from `fs.readdir` results.
 */
function safeTemplateRequire(candidate) {
  const resolved = path.resolve(candidate);
  const rel = path.relative(TEMPLATES_ROOT, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes('\0')) {
    throw new Error(`Template path escapes the templates root: ${candidate}`);
  }
  return nodeRequire(resolved);
}

const TEMPLATES_CORE_DIR = path.join(process.cwd(), 'templates', 'core');
const BaseAffidavitTemplate = safeTemplateRequire(path.join(TEMPLATES_CORE_DIR, 'BaseAffidavitTemplate.js'));

// Lazy load divorce templates to avoid circular dependencies
let BaseDivorcePetitionTemplate = null;
let BaseDivorceDecreeTemplate = null;

/**
 * Document type configurations for template loading
 * Each entry defines how to discover and validate a document type
 */
const DOCUMENT_TYPE_CONFIGS = [
  {
    documentType: 'affidavit',
    templateFile: 'AffidavitTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: true // At least one state must have this
  },
  {
    documentType: 'divorce_petition',
    templateFile: 'DivorcePetitionTemplate.js',
    metadataFile: 'divorce-metadata.json',
    baseClass: 'BaseDivorcePetitionTemplate',
    required: false
  },
  {
    documentType: 'divorce_decree',
    templateFile: 'DivorceDecreeTemplate.js',
    metadataFile: 'divorce-metadata.json', // Shares metadata with petition
    baseClass: 'BaseDivorceDecreeTemplate',
    required: false
  },
  // TX divorce supporting documents — use main metadata.json (no separate metadata needed)
  {
    documentType: 'indigency_affidavit',
    templateFile: 'IndigencyAffidavitTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: false
  },
  {
    documentType: 'waiver_of_service',
    templateFile: 'WaiverOfServiceTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: false
  },
  {
    documentType: 'cert_last_known_address',
    templateFile: 'CertLastKnownAddressTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: false
  },
  {
    documentType: 'military_status_affidavit',
    templateFile: 'MilitaryStatusAffidavitTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: false
  },
  {
    documentType: 'prove_up_affidavit',
    templateFile: 'ProveUpAffidavitTemplate.js',
    metadataFile: 'metadata.json',
    baseClass: 'BaseAffidavitTemplate',
    required: false
  }
];

/**
 * TemplateLoader
 *
 * Automatically discovers and loads state templates from the templates/states/ directory.
 * Supports multiple document types per state (affidavits, divorce petitions, etc.)
 *
 * Each state directory can contain:
 * - metadata.json + AffidavitTemplate.js (affidavit)
 * - divorce-metadata.json + DivorcePetitionTemplate.js (divorce petition)
 * - divorce-metadata.json + DivorceDecreeTemplate.js (divorce decree)
 *
 * @class TemplateLoader
 */
class TemplateLoader {
  constructor() {
    // Canonical location: `<project-root>/templates/states/`. process.cwd()
    // is the project root in every environment we run in:
    //   - `next dev` / `next build` / `next start`           cwd = project root
    //   - Next.js standalone runtime (Dockerfile WORKDIR)    cwd = /app
    //   - Jest                                               cwd = project root
    //   - npm scripts (`node scripts/*.js` via npm)          cwd = project root
    // No __dirname fallback: after Next.js bundles this module into
    // .next/server/chunks/<hash>.js, __dirname points into the build
    // output, and silently loading templates from the wrong location
    // is a worse failure mode than a loud "directory not found" error.
    this.statesDir = path.join(process.cwd(), 'templates', 'states');
  }

  /**
   * Get the base class for a document type (lazy loading to avoid circular deps)
   * @param {string} baseClassName - Name of the base class
   * @returns {class} Base class
   * @private
   */
  _getBaseClass(baseClassName) {
    switch (baseClassName) {
      case 'BaseAffidavitTemplate':
        return BaseAffidavitTemplate;
      case 'BaseDivorcePetitionTemplate':
        if (!BaseDivorcePetitionTemplate) {
          // Same module-identity reasoning as BaseAffidavitTemplate above:
          // load via Node's require so instanceof matches the dynamically
          // loaded subclasses.
          BaseDivorcePetitionTemplate = safeTemplateRequire(
            path.join(TEMPLATES_CORE_DIR, 'BaseDivorcePetitionTemplate.js'),
          );
        }
        return BaseDivorcePetitionTemplate;
      case 'BaseDivorceDecreeTemplate':
        if (!BaseDivorceDecreeTemplate) {
          BaseDivorceDecreeTemplate = safeTemplateRequire(
            path.join(TEMPLATES_CORE_DIR, 'BaseDivorceDecreeTemplate.js'),
          );
        }
        return BaseDivorceDecreeTemplate;
      default:
        return BaseAffidavitTemplate;
    }
  }

  /**
   * Load all templates from the states directory
   *
   * @param {TemplateRegistry} registry - Registry to register templates with
   * @returns {Promise<Object>} Summary of loaded templates
   */
  async loadAllTemplates(registry) {
    logger.info('Starting template discovery (multi-document type support)...');

    // Build byDocumentType map dynamically from DOCUMENT_TYPE_CONFIGS
    const byDocumentType = {};
    for (const config of DOCUMENT_TYPE_CONFIGS) {
      byDocumentType[config.documentType] = { loaded: [], failed: [] };
    }

    const summary = {
      loaded: [],
      failed: [],
      total: 0,
      byDocumentType
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

      // Load each state's templates
      for (const stateDir of stateDirs) {
        const stateName = stateDir.name;

        // Skip template directory (boilerplate)
        if (stateName === '_template') {
          logger.debug('Skipping _template directory');
          continue;
        }

        // Pre-check: read any metadata file to get stateCode and skip early
        // if this jurisdiction is gated by the international feature flag
        const preCheckMeta = path.join(this.statesDir, stateName, 'metadata.json');
        const preCheckDivorce = path.join(this.statesDir, stateName, 'divorce-metadata.json');
        let stateCodeFromMeta = null;
        for (const metaPath of [preCheckMeta, preCheckDivorce]) {
          if (await this.fileExists(metaPath)) {
            try {
              const raw = await fs.readFile(metaPath, 'utf8');
              const parsed = JSON.parse(raw);
              if (parsed.stateCode) { stateCodeFromMeta = parsed.stateCode; break; }
            } catch { /* ignore parse errors here — caught later */ }
          }
        }
        if (stateCodeFromMeta && !isAllowedJurisdiction(stateCodeFromMeta)) {
          logger.debug(`Skipping ${stateName} (${stateCodeFromMeta}) — international jurisdictions disabled`);
          continue;
        }

        summary.total++;

        // Track if any template loaded successfully for this state
        let anyLoaded = false;

        // Try to load each document type for this state
        for (const config of DOCUMENT_TYPE_CONFIGS) {
          try {
            const loaded = await this.loadStateDocumentType(stateName, registry, config);
            if (loaded) {
              anyLoaded = true;
              summary.byDocumentType[config.documentType].loaded.push(stateName);
              logger.debug(`Loaded ${config.documentType} template for ${stateName}`);
            }
          } catch (error) {
            // Only log as error if it's a required document type or the file exists but failed
            if (config.required) {
              logger.error(`Failed to load ${config.documentType} for ${stateName}:`, error.message);
              summary.byDocumentType[config.documentType].failed.push({
                state: stateName,
                error: error.message
              });
            } else {
              // Non-required document type threw while loading. The
              // template file exists (otherwise loadStateDocumentType
              // returns false silently), so a throw here is a real
              // failure — log at warn so silent-skip regressions show
              // up in production rather than disappearing into debug.
              logger.warn(`${config.documentType} failed to load for ${stateName}: ${error.message}`);
            }
          }
        }

        if (anyLoaded) {
          summary.loaded.push(stateName);
        } else {
          summary.failed.push({
            state: stateName,
            error: 'No valid templates found'
          });
        }
      }

      // Log summary
      logger.info(`Template loading complete: ${summary.loaded.length} states loaded`);
      for (const config of DOCUMENT_TYPE_CONFIGS) {
        const count = summary.byDocumentType[config.documentType].loaded.length;
        if (count > 0) {
          logger.info(`  - ${config.documentType}: ${count}`);
        }
      }

      if (summary.failed.length > 0) {
        logger.warn(`  - Failed: ${summary.failed.length}`);
      }

      return summary;
    } catch (error) {
      logger.error('Template loading failed:', error);
      throw error;
    }
  }

  /**
   * Load a specific document type for a state
   *
   * @param {string} stateName - Name of state directory
   * @param {TemplateRegistry} registry - Registry to register template with
   * @param {Object} config - Document type configuration
   * @returns {Promise<boolean>} True if template was loaded, false if not available
   * @private
   */
  async loadStateDocumentType(stateName, registry, config) {
    const stateDir = path.join(this.statesDir, stateName);
    const { documentType, templateFile, metadataFile } = config;

    const metadataPath = path.join(stateDir, metadataFile);
    const templatePath = path.join(stateDir, templateFile);

    // Check if both files exist
    const metadataExists = await this.fileExists(metadataPath);
    const templateExists = await this.fileExists(templatePath);

    // If template file doesn't exist, this document type isn't available for this state
    if (!templateExists) {
      return false;
    }

    // If template exists but metadata doesn't, that's an error
    if (!metadataExists) {
      throw new Error(`Missing ${metadataFile} for ${documentType} in ${stateName}/`);
    }

    // Load and validate metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    let metadata;
    try {
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      throw new Error(`Invalid JSON in ${metadataFile}: ${error.message}`);
    }

    // Feature flag: skip international jurisdictions when ENABLE_INTERNATIONAL !== 'true'
    if (!isAllowedJurisdiction(metadata.stateCode)) {
      logger.debug(`Skipping international jurisdiction ${metadata.stateCode} (ENABLE_INTERNATIONAL is off)`);
      return false;
    }

    // Validate metadata against schema (use relaxed validation for divorce templates)
    if (documentType === 'affidavit') {
      const validationResult = validateMetadata(metadata);
      if (!validationResult.valid) {
        throw new Error(`Invalid metadata: ${validationResult.errors.join(', ')}`);
      }
    } else {
      // For divorce templates, just check required fields
      if (!metadata.stateCode || !metadata.stateName) {
        throw new Error(`Divorce metadata must include stateCode and stateName`);
      }
    }

    // Load template class. See nodeRequire definition at the top of this
    // file for why this can't be a regular `require()` under Next.js.
    // `safeTemplateRequire` rejects anything that resolves outside the
    // templates/ tree.
    const TemplateClass = safeTemplateRequire(templatePath);

    // Validate that template extends the correct base class
    const BaseClass = this._getBaseClass(config.baseClass);
    const testInstance = new TemplateClass();

    // Check inheritance - allow any base class that has generateDocument method
    if (typeof testInstance.generateDocument !== 'function') {
      throw new Error(`Template class must have generateDocument method`);
    }

    // For affidavit templates, enforce strict inheritance
    if (documentType === 'affidavit' && !(testInstance instanceof BaseAffidavitTemplate)) {
      throw new Error(`Affidavit template class must extend BaseAffidavitTemplate`);
    }

    // Register the template with the registry
    registry.register(metadata.stateCode, TemplateClass, metadata, documentType);

    logger.info(`✓ Loaded template: ${metadata.stateName} (${metadata.stateCode}) - ${documentType}`);

    return true;
  }

  /**
   * Load a single state template (backwards compatible method)
   * Loads only the affidavit template for a state
   *
   * @param {string} stateName - Name of state directory
   * @param {TemplateRegistry} registry - Registry to register template with
   * @private
   */
  async loadStateTemplate(stateName, registry) {
    const config = DOCUMENT_TYPE_CONFIGS.find(c => c.documentType === 'affidavit');
    const loaded = await this.loadStateDocumentType(stateName, registry, config);

    if (!loaded) {
      throw new Error(`Missing AffidavitTemplate.js in ${stateName}/`);
    }
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

  /**
   * Get list of supported document types
   * @returns {Array<string>} List of document type identifiers
   */
  static getSupportedDocumentTypes() {
    return DOCUMENT_TYPE_CONFIGS.map(c => c.documentType);
  }
}

module.exports = TemplateLoader;
