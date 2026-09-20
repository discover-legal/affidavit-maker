'use strict';

/**
 * Matter registry — the one place the app asks "which YAML-defined matters
 * exist?". Loaded once per process (cached), reset-able for tests.
 *
 *   const { getMatterRegistry } = require('@/services/matters');
 *   getMatterRegistry().list()            // normalized definitions, sorted
 *   getMatterRegistry().get('name_change')
 *   getMatterRegistry().familyProfileCodes()
 *   getMatterRegistry().errors            // [{ file, message }] — empty when healthy
 */

const { loadMatterDefinitions, defaultMattersDir } = require('./loader');
const { createOrchestrator, registerDocumentSelection } = require('./createOrchestrator');
const { validateMatterDefinition } = require('./schema');

// Matter codes still implemented as hand-written JS orchestrators. A YAML
// file may not reuse one of these until the JS module is removed.
const BUILTIN_MATTER_CODES = Object.freeze([
  'divorce', 'custody', 'child_support', 'paternity', 'dvro', 'legal_separation',
  'annulment', 'guardianship_minor', 'adoption', 'emancipation',
  'small_claims', 'civil_harassment', 'debt_defense', 'landlord_tenant',
  'general_civil', 'probate', 'general_affidavit',
]);

let cached = null;

function buildRegistry(opts = {}) {
  const { matters, errors, dir } = loadMatterDefinitions({
    dir: opts.dir,
    reservedCodes: BUILTIN_MATTER_CODES,
  });
  const byCode = new Map(matters.map((m) => [m.code, m]));
  return {
    dir,
    errors,
    list: () => [...matters],
    get: (code) => byCode.get(String(code || '').toLowerCase()) || null,
    has: (code) => byCode.has(String(code || '').toLowerCase()),
    codes: () => matters.map((m) => m.code),
    familyProfileCodes: () => matters.filter((m) => m.familyProfile).map((m) => m.code),
  };
}

/** Cached registry for the process (reads MATTERS_DIR or <cwd>/matters). */
function getMatterRegistry() {
  if (!cached) cached = buildRegistry();
  return cached;
}

/** Drop the cache (tests, or after editing YAML in a long-lived dev server). */
function resetMatterRegistry() {
  cached = null;
}

/** Build an uncached registry from an explicit directory (validation CLI, tests). */
function loadMatterRegistry(dir) {
  return buildRegistry({ dir });
}

module.exports = {
  BUILTIN_MATTER_CODES,
  getMatterRegistry,
  resetMatterRegistry,
  loadMatterRegistry,
  loadMatterDefinitions,
  defaultMattersDir,
  validateMatterDefinition,
  createOrchestrator,
  registerDocumentSelection,
};
