'use strict';

/**
 * DynamicOrchestrator
 *
 * Bridge between marketplace JSONB templates (from the marketplace_templates
 * table) and the existing BaseMatterOrchestrator interview engine.
 *
 * A marketplace template author defines phases, prompts, field mappings, and
 * tool definitions in a JSON config.  This class converts that declarative
 * config into a live orchestrator instance that inherits processMessage(),
 * _initState(), _getNextPhase(), _applyFieldUpdates(), and every other method
 * from BaseMatterOrchestrator.
 *
 * Usage:
 *   const config  = row.template_config;   // JSONB from marketplace_templates
 *   const orch    = new DynamicOrchestrator(config, row.id);
 *   const result  = await orch.processMessage(msg, history, data, userId, sid);
 */

const BaseMatterOrchestrator = require('./agents/BaseMatterOrchestrator');
const logger = require('../utils/logger');
const { FLAGS, assertEnabled } = require('../config/features');

// Hard caps to prevent ReDoS / DoS via author-supplied template_config:
//   - regex pattern length (matches operator)
//   - input string length tested against any regex
const MAX_REGEX_PATTERN = 256;
const MAX_REGEX_INPUT = 1024;
const MAX_PROMPT_PASS = 50_000;        // any prompt must fit this after replace
const MAX_TOKEN_REPLACEMENTS = 1_000;  // total {{key}} replacements per prompt

// Run a regex test with a hard-coded input length cap so a malicious template
// can't pin a CPU on 'a'.repeat(1e6) with /(a+)+b/. We can't time-limit a
// regex inside V8, so the only safe defence is bounded input + bounded pattern.
function safeRegexTest(pattern, input) {
  if (typeof pattern !== 'string' || typeof input !== 'string') return false;
  if (pattern.length > MAX_REGEX_PATTERN) return false;
  if (input.length > MAX_REGEX_INPUT) return false;
  let re;
  try {
    re = new RegExp(pattern);
  } catch {
    return false;
  }
  return re.test(input);
}

// ─── Allowed condition operators (safe declarative set — NO eval) ────────────
const CONDITION_EVALUATORS = {
  eq:         (fieldVal, val) => fieldVal === val,
  neq:        (fieldVal, val) => fieldVal !== val,
  gt:         (fieldVal, val) => fieldVal > val,
  gte:        (fieldVal, val) => fieldVal >= val,
  lt:         (fieldVal, val) => fieldVal < val,
  lte:        (fieldVal, val) => fieldVal <= val,
  exists:     (fieldVal)      => fieldVal !== undefined && fieldVal !== null,
  not_exists: (fieldVal)      => fieldVal === undefined || fieldVal === null,
  in:         (fieldVal, val) => Array.isArray(val) && val.includes(fieldVal),
  not_in:     (fieldVal, val) => Array.isArray(val) && !val.includes(fieldVal),
  contains:   (fieldVal, val) => Array.isArray(fieldVal) && fieldVal.includes(val),
  matches:    (fieldVal, val) => safeRegexTest(val, fieldVal),
};

// Reserved built-in placeholder keys. Author-supplied keys can never override
// these — if an author defines a key called `stateName` in template_config we
// silently ignore it.
const RESERVED_PLACEHOLDERS = new Set([
  'stateName', 'stateCode', 'jurisdiction', 'matterType',
  'practiceArea', 'templateVersion',
]);

class DynamicOrchestrator extends BaseMatterOrchestrator {
  /**
   * @param {Object} templateConfig - JSONB template_config from marketplace_templates
   * @param {string|number} templateId - Primary key of the marketplace_templates row
   */
  constructor(templateConfig, templateId) {
    // Defensive feature gate. The factory checks this too, but constructing a
    // DynamicOrchestrator on a marketplace-disabled deployment is always a
    // bug, so fail loud here as well.
    assertEnabled(FLAGS.ENABLE_MARKETPLACE);

    if (!templateConfig || typeof templateConfig !== 'object') {
      throw new Error('DynamicOrchestrator: templateConfig is required and must be an object');
    }
    if (!templateConfig.matterTypeCode) {
      throw new Error('DynamicOrchestrator: templateConfig.matterTypeCode is required');
    }
    if (!templateConfig.phases || typeof templateConfig.phases !== 'object') {
      throw new Error('DynamicOrchestrator: templateConfig.phases is required');
    }

    const phaseOrder = templateConfig.phaseOrder || Object.keys(templateConfig.phases);
    if (phaseOrder.length === 0) {
      throw new Error('DynamicOrchestrator: phaseOrder must contain at least one phase');
    }

    // Convert JSONB phase definitions to the format BaseMatterOrchestrator expects.
    const phases = DynamicOrchestrator._buildPhases(templateConfig.phases);

    // Cache the raw config for placeholder resolution later.
    const rawConfig = templateConfig;

    // If a custom toolDefinition is provided, use it directly.
    // Otherwise pass buildTool as null so the base class falls back to
    // _defaultTool() which builds a generic tool from the matterTypeCode.
    const hasTool = !!rawConfig.toolDefinition;

    super({
      stateCode:      templateConfig.stateCode || '*',
      stateName:      templateConfig.stateName || null,
      matterTypeCode: templateConfig.matterTypeCode,
      practiceArea:   templateConfig.practiceArea || 'civil',
      phases,
      phaseOrder,
      fieldMap:        templateConfig.fieldMap || {},
      buildTool:       hasTool ? () => rawConfig.toolDefinition : null,
    });

    this.templateId      = templateId;
    this.templateVersion = templateConfig.version || '1.0';
    this._rawConfig      = rawConfig;
  }

  // ─── Phase builder ──────────────────────────────────────────────────────────

  /**
   * Convert the JSONB phases map into the shape BaseMatterOrchestrator expects:
   *   { PHASE_NAME: { prompt, displayName, requiredFields, optional, skipIf } }
   *
   * The key transformation: declarative `skipCondition` objects become
   * `skipIf(data)` functions.  When a skipCondition is present the phase is
   * automatically marked `optional: true` so _getNextPhase() will evaluate it.
   */
  static _buildPhases(phaseDefs) {
    const phases = {};

    for (const [phaseCode, def] of Object.entries(phaseDefs)) {
      const phase = {
        prompt:         def.prompt || '',
        displayName:    def.displayName || phaseCode,
        requiredFields: def.requiredFields || [],
      };

      // If a skipCondition is defined, wire up the optional + skipIf pair
      // so BaseMatterOrchestrator._getNextPhase() will evaluate it.
      if (def.skipCondition) {
        phase.optional = true;
        phase.skipIf = (data) => DynamicOrchestrator.evaluateCondition(def.skipCondition, data);
      } else {
        phase.optional = def.optional || false;
      }

      phases[phaseCode] = phase;
    }

    return phases;
  }

  // ─── Condition evaluator ────────────────────────────────────────────────────

  /**
   * Evaluate a declarative skip condition against the current matter data.
   *
   * Supports simple conditions:
   *   { field: 'has_children', operator: 'eq', value: false }
   *
   * And compound conditions (AND / OR):
   *   { and: [ { field: 'x', operator: 'eq', value: 1 }, { field: 'y', operator: 'exists' } ] }
   *   { or:  [ ... ] }
   *
   * @param {Object} condition - Declarative condition from JSONB
   * @param {Object} data      - Current matter data
   * @returns {boolean}
   */
  static evaluateCondition(condition, data) {
    if (!condition || typeof condition !== 'object') return false;

    // Compound AND
    if (Array.isArray(condition.and)) {
      return condition.and.every(sub => DynamicOrchestrator.evaluateCondition(sub, data));
    }

    // Compound OR
    if (Array.isArray(condition.or)) {
      return condition.or.some(sub => DynamicOrchestrator.evaluateCondition(sub, data));
    }

    // Simple condition: { field, operator, value }
    const { field, operator, value } = condition;
    if (!field || !operator) {
      logger.warn('DynamicOrchestrator: invalid condition — missing field or operator', { condition });
      return false;
    }

    const evaluator = CONDITION_EVALUATORS[operator];
    if (!evaluator) {
      logger.warn('DynamicOrchestrator: unknown condition operator', { operator, field });
      return false;
    }

    const fieldValue = data[field];
    return evaluator(fieldValue, value);
  }

  // ─── Prompt placeholder resolution ──────────────────────────────────────────

  /**
   * Override the base class _buildSystemPrompt to resolve {{placeholder}}
   * tokens in JSONB-authored prompts.
   *
   * Supported placeholders:
   *   {{stateName}}, {{stateCode}}, {{jurisdiction}}, {{matterType}},
   *   {{practiceArea}}, {{templateVersion}}
   *
   * Also resolves any custom key from the top-level template config:
   *   {{filingFee}}, {{courtName}}, etc.
   */
  _buildSystemPrompt(state, matterData) {
    const prompt = super._buildSystemPrompt(state, matterData);

    // Built-in placeholders. Reserved keys cannot be overridden by template
    // author config (defence against placeholder-shadowing attacks).
    const replacements = {
      stateName:       this.stateName || 'your state',
      stateCode:       this.stateCode || '',
      jurisdiction:    matterData?.jurisdiction || this.stateName || '',
      matterType:      this.matterTypeCode || '',
      practiceArea:    this.practiceArea || '',
      templateVersion: this.templateVersion || '1.0',
    };

    // Merge custom string keys from the raw config (e.g. filingFee, courtName).
    // Reserved keys are filtered out; values are coerced to strings.
    if (this._rawConfig) {
      for (const [key, val] of Object.entries(this._rawConfig)) {
        if (RESERVED_PLACEHOLDERS.has(key)) continue;
        if (typeof val !== 'string') continue;
        if (replacements[key] !== undefined) continue;
        replacements[key] = val;
      }
    }

    return DynamicOrchestrator._resolvePlaceholders(prompt, replacements);
  }

  /**
   * Single-pass tokeniser: replaces every `{{identifier}}` substring with the
   * corresponding entry from `replacements`. Unknown tokens are left intact.
   *
   * Why a single regex over the prompt instead of `new RegExp(key)` per key:
   *   - O(prompt) instead of O(prompt * keys)
   *   - The pattern is a constant — never built from user input — so there
   *     is no ReDoS surface from author-supplied placeholder names.
   *   - The identifier class `[a-zA-Z0-9_]` rejects pathological keys.
   */
  static _resolvePlaceholders(prompt, replacements) {
    if (!prompt || typeof prompt !== 'string') return prompt;
    const PLACEHOLDER_RE = /\{\{([a-zA-Z][a-zA-Z0-9_]{0,63})\}\}/g;
    let count = 0;
    const out = prompt.replace(PLACEHOLDER_RE, (match, key) => {
      if (++count > MAX_TOKEN_REPLACEMENTS) return match;
      // Own-property check defeats prototype lookups: without this, a token
      // like `{{toString}}` would resolve to `Object.prototype.toString`
      // and stamp "function toString() { [native code] }" into the prompt.
      if (!Object.prototype.hasOwnProperty.call(replacements, key)) return match;
      const val = replacements[key];
      return val == null ? match : String(val);
    });
    if (out.length > MAX_PROMPT_PASS) {
      logger.warn('DynamicOrchestrator: prompt exceeded MAX_PROMPT_PASS after replacement; truncating');
      return out.slice(0, MAX_PROMPT_PASS);
    }
    return out;
  }

  // ─── Override _initState for template-aware state ───────────────────────────

  _initState(matterData) {
    const state = super._initState(matterData);

    // Stamp template metadata onto the state so downstream consumers
    // (e.g. document generation, audit trail) know which marketplace
    // template drove this interview.
    if (!state.templateId) {
      state.templateId      = this.templateId;
      state.templateVersion = this.templateVersion;
    }

    return state;
  }
}

module.exports = DynamicOrchestrator;
