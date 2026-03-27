'use strict';

/**
 * OrchestratorFactory
 *
 * Routes between the 134 built-in static orchestrators (divorce + matter-type)
 * and marketplace DynamicOrchestrator instances driven by JSONB template_config.
 *
 * Usage:
 *   const factory = new OrchestratorFactory(pool);
 *
 *   // Marketplace template — loads JSONB and creates DynamicOrchestrator
 *   const orch = await factory.getOrchestrator({ marketplaceTemplateId: 'uuid' });
 *
 *   // Built-in orchestrator — resolves from existing require() tree
 *   const orch = await factory.getOrchestrator({ matterTypeCode: 'custody', stateCode: 'TX' });
 *
 *   // Then use it exactly like any orchestrator
 *   const result = await orch.processMessage(msg, history, data, userId, sessionId);
 */

const logger = require('../utils/logger');
const DynamicOrchestrator = require('./DynamicOrchestrator');

// ─── Mapping from matterTypeCode to the module filename in services/agents/ ──
// Must stay in sync with the loading block in routes/chat.js (lines 59-74).
const MATTER_MODULE_MAP = {
  custody:            'CustodyOrchestrator',
  child_support:      'ChildSupportOrchestrator',
  dvro:               'DVROOrchestrator',
  paternity:          'PaternityOrchestrator',
  legal_separation:   'LegalSeparationOrchestrator',
  annulment:          'AnnulmentOrchestrator',
  guardianship_minor: 'GuardianshipOrchestrator',
  adoption:           'AdoptionOrchestrator',
  emancipation:       'EmancipationOrchestrator',
  small_claims:       'SmallClaimsOrchestrator',
  name_change:        'NameChangeOrchestrator',
  debt_defense:       'DebtDefenseOrchestrator',
  landlord_tenant:    'LandlordTenantOrchestrator',
  civil_harassment:   'CivilHarassmentOrchestrator',
  general_civil:      'GeneralCivilOrchestrator',
  probate:            'ProbateOrchestrator',
  document_response:  'DocumentIngestionOrchestrator',
};

class OrchestratorFactory {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   */
  constructor(pool) {
    if (!pool) {
      throw new Error('OrchestratorFactory: pool is required');
    }
    this.pool = pool;
    this._cache = new Map();        // templateId -> { orchestrator, cachedAt }
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Resolve an orchestrator for the given options.
   *
   * Priority:
   *   1. marketplaceTemplateId → DynamicOrchestrator from DB
   *   2. matterTypeCode + stateCode → built-in static orchestrator
   *
   * @param {Object} options
   * @param {string} [options.marketplaceTemplateId] - UUID of marketplace_templates row
   * @param {string} [options.matterTypeCode]        - e.g. 'custody', 'divorce'
   * @param {string} [options.stateCode]             - e.g. 'TX', 'CA', 'ON'
   * @returns {Promise<BaseMatterOrchestrator|null>}
   */
  async getOrchestrator(options) {
    const { marketplaceTemplateId, matterTypeCode, stateCode } = options;

    if (marketplaceTemplateId) {
      return this._getDynamicOrchestrator(marketplaceTemplateId);
    }

    return this._getStaticOrchestrator(matterTypeCode, stateCode);
  }

  /**
   * Invalidate cached orchestrator(s).
   * Call this when a marketplace template is updated or unpublished.
   *
   * @param {string} [templateId] - Specific template to invalidate, or omit to clear all
   */
  clearCache(templateId) {
    if (templateId) {
      this._cache.delete(templateId);
    } else {
      this._cache.clear();
    }
  }

  // ─── Dynamic orchestrators (marketplace) ────────────────────────────────────

  /**
   * Load a marketplace template's JSONB config and return a DynamicOrchestrator.
   * Results are cached for CACHE_TTL milliseconds.
   *
   * @param {string} templateId
   * @returns {Promise<DynamicOrchestrator>}
   */
  async _getDynamicOrchestrator(templateId) {
    // Check cache first
    const cached = this._cache.get(templateId);
    if (cached && (Date.now() - cached.cachedAt) < this.CACHE_TTL) {
      logger.debug('OrchestratorFactory: cache hit', { templateId });
      return cached.orchestrator;
    }

    // Load from DB
    const result = await this.pool.query(
      `SELECT id, template_config
         FROM marketplace_templates
        WHERE id = $1 AND status = $2`,
      [templateId, 'published']
    );

    if (result.rows.length === 0) {
      const err = new Error(`Marketplace template ${templateId} not found or not published`);
      err.statusCode = 404;
      throw err;
    }

    const { template_config, id } = result.rows[0];

    // Validate the config has the minimum required shape
    if (!template_config || !template_config.matterTypeCode || !template_config.phases) {
      const err = new Error(`Marketplace template ${templateId} has invalid template_config`);
      err.statusCode = 422;
      throw err;
    }

    const orchestrator = new DynamicOrchestrator(template_config, id);

    // Cache it
    this._cache.set(templateId, {
      orchestrator,
      cachedAt: Date.now(),
    });

    logger.info('OrchestratorFactory: loaded dynamic orchestrator', {
      templateId,
      matterTypeCode: template_config.matterTypeCode,
      stateCode:      template_config.stateCode || '*',
      version:        template_config.version,
    });

    return orchestrator;
  }

  // ─── Static orchestrators (built-in) ────────────────────────────────────────

  /**
   * Resolve a built-in orchestrator by matter type and state code.
   *
   * Lookup order (mirrors routes/chat.js):
   *   1. Divorce with state code → [XX]DivorceOrchestrator
   *   2. Matter type code → [MatterType]Orchestrator
   *   3. null (no match)
   *
   * @param {string} matterTypeCode
   * @param {string} stateCode
   * @returns {BaseMatterOrchestrator|null}
   */
  _getStaticOrchestrator(matterTypeCode, stateCode) {
    const paths = [];

    // Divorce has per-state orchestrators: TXDivorceOrchestrator, etc.
    if (stateCode && matterTypeCode === 'divorce') {
      paths.push(`./agents/${stateCode.toUpperCase()}DivorceOrchestrator`);
    }

    // Matter-type orchestrators: CustodyOrchestrator, etc.
    if (matterTypeCode && MATTER_MODULE_MAP[matterTypeCode]) {
      paths.push(`./agents/${MATTER_MODULE_MAP[matterTypeCode]}`);
    }

    for (const modulePath of paths) {
      try {
        const mod = require(modulePath);
        return mod;
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
          logger.error('OrchestratorFactory: error loading static orchestrator', {
            modulePath,
            error: e.message,
          });
        }
        // Not found — try next candidate
      }
    }

    logger.warn('OrchestratorFactory: no static orchestrator found', {
      matterTypeCode,
      stateCode,
    });
    return null;
  }
}

module.exports = OrchestratorFactory;
