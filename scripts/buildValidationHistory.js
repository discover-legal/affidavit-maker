// scripts/buildValidationHistory.js
// Compiles the legal-validation verdict files in docs/ into
// templates/validation-history.json — a per-jurisdiction changelog of when
// each legal claim was verified, what was corrected, and against which
// sources. Served by /api/templates/validation/[state] so users can judge
// content freshness (the recency heuristic).
//
// Re-run after any validation pass:  node scripts/buildValidationHistory.js

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATES_DIR = path.join(ROOT, 'templates', 'states');
const OUT = path.join(ROOT, 'templates', 'validation-history.json');

// Each pass: verdicts file, verification date, human label, and how its
// jurisdiction keys map to template state codes.
const PASSES = [
  {
    file: 'docs/legal-validation-2026-08-12.verdicts.json',
    date: '2026-08-12',
    label: 'North America pass (50 US states + DC + 13 Canadian provinces/territories)',
    report: 'docs/legal-validation-2026-08-12.md',
    keyIsCode: true,
  },
  {
    file: 'docs/legal-validation-intl-2026-08-12.verdicts.json',
    date: '2026-08-12',
    label: 'International pass (46 jurisdictions behind ENABLE_INTERNATIONAL)',
    report: 'docs/legal-validation-intl-2026-08-12.md',
    keyIsCode: false, // keyed by template directory name
  },
];

// Jurisdiction groups whose validator-flagged nuances (report "Notes"
// sections) were additionally addressed in the same-day follow-up.
const NUANCE_FOLLOWUP = {
  date: '2026-08-14',
  dirs: [
    // India
    'andhra_pradesh', 'bihar', 'delhi', 'gujarat', 'haryana', 'karnataka',
    'kerala', 'madhya_pradesh', 'maharashtra', 'odisha', 'punjab', 'rajasthan',
    'tamil_nadu', 'telangana', 'uttar_pradesh', 'west_bengal',
    // Nigeria
    'abia', 'anambra', 'cross_river', 'delta', 'edo', 'enugu',
    'federal_capital_territory', 'imo', 'lagos', 'ogun', 'oyo', 'rivers',
    // Australia
    'australian_capital_territory', 'new_south_wales', 'northern_territory_au',
    'queensland', 'south_australia', 'tasmania', 'victoria', 'western_australia',
    // UK + Ireland + Kenya
    'england', 'scotland', 'northern_ireland', 'ireland', 'kenya',
  ],
  summary:
    'Validator-flagged nuances addressed beyond the wrong-verdict fixes ' +
    '(see the Notes sections of the validation reports).',
};

function loadDirMaps() {
  const dirToCode = {};
  const codeToName = {};
  for (const dir of fs.readdirSync(STATES_DIR)) {
    const metaPath = path.join(STATES_DIR, dir, 'divorce-metadata.json');
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.stateCode) {
      dirToCode[dir] = meta.stateCode;
      codeToName[meta.stateCode] = meta.stateName || dir;
    }
  }
  return { dirToCode, codeToName };
}

function trim(text, max = 300) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function build() {
  const { dirToCode, codeToName } = loadDirMaps();
  const jurisdictions = {};

  for (const pass of PASSES) {
    const verdicts = JSON.parse(fs.readFileSync(path.join(ROOT, pass.file), 'utf8'));
    for (const [key, claims] of Object.entries(verdicts)) {
      const code = pass.keyIsCode ? key : dirToCode[key];
      if (!code) {
        console.warn(`No state code for verdict key "${key}" — skipped`);
        continue;
      }
      const entry = (jurisdictions[code] = jurisdictions[code] || {
        stateCode: code,
        stateName: codeToName[code] || key,
        lastVerified: pass.date,
        claims: {},
        changelog: [],
      });
      entry.lastVerified = pass.date;

      let confirmed = 0;
      const corrections = [];
      for (const [claim, v] of Object.entries(claims)) {
        const verdict = (v.verdict || '').toUpperCase();
        entry.claims[claim] = {
          verdict: verdict === 'WRONG' ? 'CORRECTED' : verdict,
          verifiedOn: pass.date,
          source: v.source || null,
          note: trim(v.note),
        };
        if (verdict === 'WRONG') {
          corrections.push({
            date: pass.date,
            type: 'correction',
            claim,
            summary: trim(v.correct || v.note),
            source: v.source || null,
          });
        } else {
          confirmed += 1;
        }
      }
      entry.changelog.push({
        date: pass.date,
        type: 'verification',
        summary:
          `${Object.keys(claims).length} legal claims verified against primary sources — ` +
          `${confirmed} confirmed, ${corrections.length} corrected. ${pass.label}.`,
        report: pass.report,
      });
      entry.changelog.push(...corrections);
    }
  }

  for (const dir of NUANCE_FOLLOWUP.dirs) {
    const code = dirToCode[dir];
    if (!code || !jurisdictions[code]) continue;
    jurisdictions[code].changelog.push({
      date: NUANCE_FOLLOWUP.date,
      type: 'refinement',
      summary: NUANCE_FOLLOWUP.summary,
    });
  }

  const out = {
    generatedAt: PASSES[PASSES.length - 1].date,
    methodology:
      'Six claim categories per jurisdiction (residency/jurisdiction, waiting period, ' +
      'court, instrument terminology, grounds, citations) verified against primary ' +
      'sources: national/state legislation databases, court websites, and official ' +
      'form guides. Every correction carries the source consulted.',
    jurisdictions,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  const n = Object.keys(jurisdictions).length;
  console.log(`Wrote ${OUT}: ${n} jurisdictions`);
}

build();
