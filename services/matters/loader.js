'use strict';

/**
 * Loads matter (claim / interview type) definitions from YAML.
 *
 * Directory: <cwd>/matters/*.yaml  (override with MATTERS_DIR)
 * Files whose name starts with "_" or "." are ignored, so authoring
 * scaffolds like matters/_example.yaml never register.
 *
 * Loading is synchronous so the catalog (lib/api/catalog-data.ts) can build
 * its constant tables at import time. It is fail-soft per file: a broken
 * YAML file is reported in `errors` and skipped, never taking the catalog
 * or chat route down. `scripts/validateMatters.js` and the Jest suite turn
 * those errors into a red build.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { validateMatterDefinition } = require('./schema');

const YAML_EXT = new Set(['.yaml', '.yml']);

function defaultMattersDir() {
  return process.env.MATTERS_DIR || path.join(process.cwd(), 'matters');
}

/**
 * @param {object} [opts]
 * @param {string} [opts.dir]             directory to scan
 * @param {Iterable<string>} [opts.reservedCodes]  codes owned by built-in JS matters
 * @returns {{ matters: object[], errors: {file: string, message: string}[], dir: string }}
 */
function loadMatterDefinitions(opts = {}) {
  const dir = opts.dir || defaultMattersDir();
  const reserved = new Set(opts.reservedCodes || []);
  const matters = [];
  const errors = [];

  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return { matters, errors, dir };
    errors.push({ file: dir, message: `cannot read matters directory: ${err.message}` });
    return { matters, errors, dir };
  }

  const files = entries
    .filter((e) => e.isFile() && YAML_EXT.has(path.extname(e.name).toLowerCase()))
    .filter((e) => !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();

  const seen = new Map(); // code → file
  for (const name of files) {
    const file = path.join(dir, name);
    let raw;
    try {
      // js-yaml v4 `load` uses the safe DEFAULT_SCHEMA: no functions, no
      // custom tags — a YAML file can only ever produce plain data.
      raw = yaml.load(fs.readFileSync(file, 'utf8'), { filename: file });
    } catch (err) {
      errors.push({ file, message: `YAML parse error: ${err.message}` });
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ file, message: 'top level must be a mapping' });
      continue;
    }
    const result = validateMatterDefinition(raw, file);
    if (!result.ok) {
      for (const message of result.errors) errors.push({ file, message });
      continue;
    }
    const { matter } = result;
    if (reserved.has(matter.code)) {
      errors.push({ file, message: `code "${matter.code}" is a built-in matter; rename or remove the JS orchestrator first` });
      continue;
    }
    if (seen.has(matter.code)) {
      errors.push({ file, message: `code "${matter.code}" already defined in ${seen.get(matter.code)}` });
      continue;
    }
    seen.set(matter.code, name);
    matters.push(matter);
  }

  matters.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  return { matters, errors, dir };
}

module.exports = { loadMatterDefinitions, defaultMattersDir };
