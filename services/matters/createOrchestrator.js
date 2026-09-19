'use strict';

/**
 * Turns a validated matter definition into the same three artefacts a
 * hand-written prompt pack exports — PHASES, FIELD_MAP, buildTool — and
 * instantiates BaseMatterOrchestrator with them. YAML matters therefore
 * run on exactly the interview engine the JS matters do.
 */

const BaseMatterOrchestrator = require('../agents/BaseMatterOrchestrator');
const { FACT_CONTENT_DESCRIPTION } = require('../agents/extractionQuality');

function truthy(v) {
  return v !== undefined && v !== null && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0);
}

/** Declarative skip rules → the `skipIf(data)` predicate the engine expects. */
function buildSkipIf(phase) {
  const { skipUnlessAny, skipIfAny } = phase;
  if (!skipUnlessAny.length && !skipIfAny.length) return null;
  return (data) => {
    const d = data || {};
    if (skipIfAny.some((f) => truthy(d[f]))) return true;
    if (skipUnlessAny.length && !skipUnlessAny.some((f) => truthy(d[f]))) return true;
    return false;
  };
}

function buildPhases(def) {
  const phases = {};
  def.phases.forEach((p, idx) => {
    const skipIf = buildSkipIf(p);
    phases[p.id] = {
      name: p.id,
      displayName: p.displayName,
      order: idx + 1,
      prompt: p.prompt,
      requiredFields: p.requiredFields,
      optional: p.optional,
      ...(skipIf ? { skipIf } : {}),
      ...(p.factCategory ? { factCategory: p.factCategory } : {}),
    };
  });
  return phases;
}

function buildFieldMap(def) {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.target]));
}

function buildToolFactory(def) {
  return function buildTool() {
    const properties = {
      response: { type: 'string' },
      phase_complete: { type: 'boolean' },
    };
    for (const f of def.fields) properties[f.key] = JSON.parse(JSON.stringify(f.schema));
    properties.extracted_facts = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', description: FACT_CONTENT_DESCRIPTION },
          category: { type: 'string' },
          subcategory: { type: 'string' },
        },
        required: ['content', 'category'],
      },
    };
    return {
      type: 'function',
      function: {
        name: 'process_matter_data',
        description: `Extract ${def.displayName} interview information and provide a conversational response.`,
        parameters: {
          type: 'object',
          required: ['response', 'phase_complete'],
          properties,
        },
      },
    };
  };
}

/**
 * @param {object} def  normalized matter definition (from schema.js)
 * @returns {BaseMatterOrchestrator}
 */
function createOrchestrator(def) {
  return new BaseMatterOrchestrator({
    stateCode: '*',
    stateName: null,
    matterTypeCode: def.code,
    practiceArea: def.practiceArea,
    phases: buildPhases(def),
    phaseOrder: def.phases.map((p) => p.id),
    fieldMap: buildFieldMap(def),
    buildTool: buildToolFactory(def),
  });
}

/**
 * Register the matter's document selection (if declared) with the
 * DocumentSelectionAgent so the review screen lists the right drafts.
 * Matters without `document_selection` fall back to the agent's default
 * (a single general affidavit), like most built-in matters.
 */
function registerDocumentSelection(def, agent) {
  if (!def.documentSelection) return false;
  const { documents, reasons } = def.documentSelection;
  agent.registerHandler('*', def.code, () => ({
    documents: [...documents],
    reasons: { ...reasons },
  }));
  return true;
}

module.exports = { createOrchestrator, registerDocumentSelection, buildPhases, buildFieldMap, buildToolFactory, buildSkipIf };
