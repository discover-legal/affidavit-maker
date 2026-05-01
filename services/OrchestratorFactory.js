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

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const DynamicOrchestrator = require('./DynamicOrchestrator');
const { isAllowedJurisdiction } = require('../config/jurisdictions');
const { FLAGS, isMarketplaceEnabled } = require('../config/features');

// Resolve once so dynamic require() is anchored to the agents directory and
// can never escape via traversal payloads in user-supplied identifiers.
const AGENTS_DIR = path.resolve(__dirname, 'agents');

// ─── Mapping from matterTypeCode to the module filename in services/agents/ ──
// Must stay in sync with the loading block in routes/chat.js (lines 59-74).
const MATTER_MODULE_MAP = Object.freeze({
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
});

// Strict pattern for state codes used in `${stateCode}DivorceOrchestrator`.
// Letters/digits only, length-bounded — defends against path-traversal
// payloads even if the upstream allowlist check is bypassed.
const STATE_CODE_RE = /^[A-Z0-9]{2,8}$/;

// Cache of `require()`d modules keyed by absolute path. Replaces the previous
// "try require, catch ENOENT" pattern so each disk hit only happens once and
// MODULE_NOT_FOUND errors aren't swallowed silently for unrelated bugs.
const STATIC_ORCH_CACHE = new Map();

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
    const { marketplaceTemplateId, matterTypeCode, stateCode } = options || {};

    if (marketplaceTemplateId) {
      // Marketplace templates require the feature flag. We could throw, but
      // returning null lets routes fall through to static orchestrators when
      // a stale client still sends a templateId on a disabled deployment.
      if (!isMarketplaceEnabled()) {
        logger.warn('OrchestratorFactory: marketplaceTemplateId requested but ENABLE_MARKETPLACE=false', {
          marketplaceTemplateId,
        });
        return null;
      }
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
    // Defence in depth: a public route should already have gated on the
    // feature flag, but never trust that.
    if (!isMarketplaceEnabled()) {
      const err = new Error('Marketplace is not enabled on this deployment');
      err.statusCode = 404;
      throw err;
    }

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
    const candidates = [];

    // Divorce has per-state orchestrators: TXDivorceOrchestrator, etc. The
    // stateCode goes into a filename so it must pass BOTH the jurisdiction
    // allowlist (config/jurisdictions.js) and the strict character regex.
    if (matterTypeCode === 'divorce' && stateCode) {
      const upper = String(stateCode).toUpperCase();
      if (STATE_CODE_RE.test(upper) && isAllowedJurisdiction(upper)) {
        candidates.push(`${upper}DivorceOrchestrator`);
      } else {
        logger.warn('OrchestratorFactory: rejected unsafe stateCode', { stateCode });
      }
    }

    // Matter-type orchestrators are looked up via the frozen
    // MATTER_MODULE_MAP — `Object.prototype.hasOwnProperty` defends against
    // payloads like `__proto__` or `constructor`.
    if (matterTypeCode && Object.prototype.hasOwnProperty.call(MATTER_MODULE_MAP, matterTypeCode)) {
      candidates.push(MATTER_MODULE_MAP[matterTypeCode]);
    }

    for (const moduleName of candidates) {
      const mod = OrchestratorFactory._loadStatic(moduleName);
      if (mod) return mod;
    }

    logger.warn('OrchestratorFactory: no static orchestrator found', {
      matterTypeCode,
      stateCode,
    });
    return null;
  }

  /**
   * Resolve `moduleName` to an absolute path inside AGENTS_DIR and require it.
   * Returns null if the file is missing. Any other error (syntax, missing
   * transitive dep) is logged and rethrown — silent fallthrough on real bugs
   * would make routing failures impossible to diagnose.
   */
  static _loadStatic(moduleName) {
    const fullPath = path.join(AGENTS_DIR, `${moduleName}.js`);
    // Defence in depth: the resolved path must still live under AGENTS_DIR.
    // path.join would happily flatten `../../etc/passwd` if a regex slip
    // ever let a traversal sequence through.
    if (!fullPath.startsWith(`${AGENTS_DIR}${path.sep}`)) {
      logger.error('OrchestratorFactory: rejected path-traversal attempt', { moduleName });
      return null;
    }
    if (STATIC_ORCH_CACHE.has(fullPath)) {
      return STATIC_ORCH_CACHE.get(fullPath);
    }
    if (!fs.existsSync(fullPath)) {
      // Expected for many (matterTypeCode, stateCode) combinations — cache
      // the miss so repeated lookups don't keep stat()ing the disk.
      STATIC_ORCH_CACHE.set(fullPath, null);
      return null;
    }
    try {
      // eslint-disable-next-line global-require
      const mod = require(fullPath);
      STATIC_ORCH_CACHE.set(fullPath, mod);
      return mod;
    } catch (e) {
      logger.error('OrchestratorFactory: error loading static orchestrator', {
        moduleName,
        error: e.message,
      });
      throw e;
    }
  }
}

// Exposed for tests so the cache can be cleared between cases.
OrchestratorFactory._clearStaticCache = () => STATIC_ORCH_CACHE.clear();
// Expose the flag constant so callers don't have to re-require features.js.
OrchestratorFactory.FLAGS = FLAGS;

module.exports = OrchestratorFactory;
