#!/usr/bin/env node
'use strict';

/**
 * Validate every YAML matter definition (matters/*.yaml or MATTERS_DIR).
 *
 *   npm run matters:validate
 *   node scripts/validateMatters.js path/to/dir
 *
 * Exit code 1 when any file fails, so it can gate CI. Prints one line per
 * problem: <file>: <path>: <message>.
 */

const path = require('path');
const { loadMatterRegistry, defaultMattersDir, createOrchestrator } = require('../services/matters');

const dir = process.argv[2] ? path.resolve(process.argv[2]) : defaultMattersDir();
const registry = loadMatterRegistry(dir);

let failures = registry.errors.length;
for (const { file, message } of registry.errors) {
  console.error(`✗ ${path.relative(process.cwd(), file)}: ${message}`);
}

for (const def of registry.list()) {
  try {
    const orch = createOrchestrator(def);
    const fieldCount = def.fields.length;
    console.log(
      `✓ ${def.code.padEnd(24)} ${path.relative(process.cwd(), def.sourceFile)}  ` +
        `${orch.phaseOrder.length} phases, ${fieldCount} fields, ${def.documents.length} documents`,
    );
  } catch (err) {
    failures += 1;
    console.error(`✗ ${path.relative(process.cwd(), def.sourceFile)}: orchestrator build failed: ${err.message}`);
  }
}

if (registry.list().length === 0 && failures === 0) {
  console.log(`(no matter definitions found in ${path.relative(process.cwd(), dir) || '.'})`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) in ${path.relative(process.cwd(), dir) || '.'}`);
  process.exit(1);
}
console.log(`\nAll ${registry.list().length} matter definition(s) valid.`);
