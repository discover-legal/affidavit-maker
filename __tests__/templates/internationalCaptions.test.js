/** @jest-environment node */
'use strict';

/**
 * internationalCaptions.test.js
 *
 * The 46 international (non-US, non-Canadian) jurisdictions must not carry
 * US caption furniture in their divorce petitions or decrees: no
 * "STATE OF X" header, no "COUNTY OF Y" venue line, no "X County" body
 * phrasing, no "Pro Se" designation, and the body must use each
 * jurisdiction's validated party labels (Petitioner / Applicant /
 * Plaintiff / Pursuer) consistently with its caption. This is the offline
 * replica of e2e/sweep-jurisdictions.mjs's caption lint, extended to
 * decrees. A US control (California) locks the historical US wording.
 *
 * Mechanism under test: the `terminology` layer in
 * templates/core/terminology.js + the per-jurisdiction constructor
 * overrides added in each international template.
 */

const path = require('path');

const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates', 'states');

const DATA = {
  petitionerName: 'Sam Matrix',
  respondentName: 'Alex Matrix',
  affiantName: 'Sam Matrix',
  county: 'Testville',
  marriageDate: '2012-06-15',
  separationDate: '2024-11-01',
  groundsForDivorce: 'separation',
  hasMinorChildren: true,
  children: [{ name: 'Jo Matrix', dob: '2015-04-02' }],
  requestSpousalSupport: true,
  requestNameChange: true,
  previousName: 'Sam Prior',
  caseNumber: 'FC-1234',
  petitionerAddress: '1 Main St',
  email: 's@example.com',
};

// dir, display name, filer label, party labels that must NOT appear,
// residencyLine: false where the petition overrides the base parties
// section and the "<filer>, Sam Matrix, is a resident of" line is absent.
const NIGERIA = ['abia', 'anambra', 'cross_river', 'delta', 'edo', 'enugu', 'federal_capital_territory', 'imo', 'lagos', 'ogun', 'oyo', 'rivers'];
const INDIA = ['andhra_pradesh', 'bihar', 'delhi', 'gujarat', 'haryana', 'karnataka', 'kerala', 'madhya_pradesh', 'maharashtra', 'odisha', 'punjab', 'rajasthan', 'tamil_nadu', 'telangana', 'uttar_pradesh', 'west_bengal'];
const AUSTRALIA = ['australian_capital_territory', 'new_south_wales', 'northern_territory_au', 'queensland', 'south_australia', 'tasmania', 'victoria', 'western_australia'];

const INTERNATIONAL = [
  // Nigeria — Matrimonial Causes Act 1970: Petitioner/Respondent
  ...NIGERIA.map((dir) => ({ dir, name: `Nigeria: ${dir}`, filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] })),
  // India — HMA 1955 / SMA 1954: Petitioner/Respondent
  ...INDIA.map((dir) => ({ dir, name: `India: ${dir}`, filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] })),
  // Australia — Family Law Act 1975 (Cth), FCFCOA: Applicant/Respondent
  ...AUSTRALIA.map((dir) => ({ dir, name: `Australia: ${dir}`, filer: 'Applicant', banned: ['Petitioner', 'Plaintiff'] })),
  // UK and the rest
  { dir: 'england', name: 'England & Wales', filer: 'Applicant', banned: ['Petitioner', 'Plaintiff'] },
  { dir: 'northern_ireland', name: 'Northern Ireland', filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] },
  { dir: 'scotland', name: 'Scotland', filer: 'Pursuer', banned: ['Petitioner', 'Applicant', 'Plaintiff', 'Respondent'] },
  { dir: 'ireland', name: 'Ireland', filer: 'Applicant', banned: ['Petitioner', 'Plaintiff'] },
  { dir: 'ghana', name: 'Ghana', filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] },
  { dir: 'hong_kong', name: 'Hong Kong', filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] },
  { dir: 'kenya', name: 'Kenya', filer: 'Petitioner', banned: ['Applicant', 'Plaintiff'] },
  { dir: 'new_zealand', name: 'New Zealand', filer: 'Applicant', banned: ['Petitioner', 'Plaintiff'] },
  // Singapore's petition overrides the base parties section (Applicant
  // domicile statement instead of the residency line).
  { dir: 'singapore', name: 'Singapore', filer: 'Applicant', banned: ['Petitioner', 'Plaintiff'], residencyLine: false },
  { dir: 'south_africa', name: 'South Africa', filer: 'Plaintiff', banned: ['Petitioner', 'Applicant', 'Respondent'] },
];

function generate(dir, file) {
  const Template = require(path.join(TEMPLATES_ROOT, dir, file));
  const instance = new Template();
  return instance.generateDocument({ ...DATA, state: instance.state });
}

const { normalizeCourtText } = require(path.join(
  __dirname, '..', '..', 'templates', 'core', 'captionDedupe.js'
));

// The caption's court line must appear exactly once above the document
// title (the 2026-08 doubled-caption fix, templates/core/captionDedupe.js).
function expectSingleCourtLine(doc) {
  const caption = doc.sections.caseCaption || {};
  const captionCourtLine =
    String(caption.formatted || '')
      .split('\n')
      .find((line) => /\b(COURT|TRIBUNAL)\b/i.test(line)) ||
    caption.courtName ||
    caption.courtHeaderLine;
  const needle = normalizeCourtText(captionCourtLine);
  expect(needle).toBeTruthy();
  const titleIdx = doc.sections.title ? doc.fullText.indexOf(doc.sections.title) : -1;
  const head = normalizeCourtText(titleIdx >= 0 ? doc.fullText.slice(0, titleIdx) : doc.fullText);
  expect(head.split(needle).length - 1).toBe(1);
}

function lintUSisms(text) {
  const problems = [];
  if (/\bSTATE OF\b/i.test(text)) problems.push('"STATE OF"');
  if (/\bCOUNTY OF\b/i.test(text)) problems.push('"COUNTY OF"');
  // Same regex as e2e/sweep-jurisdictions.mjs: the US "<Propernoun> County"
  // suffix form. Ireland's prefix form ("in the County/City of Cork") is
  // legitimate Irish usage and must not be flagged.
  const county = text.match(/\b[A-Z][a-z]+ County\b/);
  if (county) problems.push(`"${county[0]}"`);
  if (/\bPro Se\b/.test(text)) problems.push('"Pro Se"');
  return problems;
}

describe.each(INTERNATIONAL)('$name divorce petition caption', ({ dir, filer, banned, residencyLine }) => {
  let doc;
  beforeAll(() => {
    doc = generate(dir, 'DivorcePetitionTemplate.js');
  });

  it('contains no US-isms (STATE OF / COUNTY OF / "X County" / Pro Se)', () => {
    expect(lintUSisms(doc.fullText)).toEqual([]);
  });

  it(`uses the ${filer} party label consistently between caption and body`, () => {
    expect(doc.fullText).toContain(filer);
    if (residencyLine !== false) {
      expect(doc.fullText).toContain(`${filer}, Sam Matrix, is a resident of`);
    }
  });

  it('does not leak party labels foreign to this jurisdiction', () => {
    for (const label of banned) {
      expect(doc.fullText).not.toMatch(new RegExp(`\\b${label}\\b`));
    }
  });

  it('renders exactly one court identification', () => {
    expectSingleCourtLine(doc);
  });
});

describe.each(INTERNATIONAL)('$name divorce decree caption', ({ dir, filer, banned }) => {
  let doc;
  beforeAll(() => {
    doc = generate(dir, 'DivorceDecreeTemplate.js');
  });

  it('contains no US-isms (STATE OF / COUNTY OF / "X County" / Pro Se)', () => {
    expect(lintUSisms(doc.fullText)).toEqual([]);
  });

  it(`uses the ${filer} party label`, () => {
    expect(doc.fullText).toContain(filer);
  });

  it('does not leak party labels foreign to this jurisdiction', () => {
    for (const label of banned) {
      expect(doc.fullText).not.toMatch(new RegExp(`\\b${label}\\b`));
    }
  });

  it('renders exactly one court identification', () => {
    expectSingleCourtLine(doc);
  });
});

describe.each(INTERNATIONAL)('$name affidavit', ({ dir }) => {
  it('contains no US-isms (STATE OF / COUNTY OF / "X County" / Pro Se)', () => {
    const doc = generate(dir, 'AffidavitTemplate.js');
    expect(lintUSisms(doc.fullText)).toEqual([]);
  });
});

describe('specific international caption conventions', () => {
  it('New South Wales: FCFCOA caption, registry venue, Applicant/Respondent', () => {
    const doc = generate('new_south_wales', 'DivorcePetitionTemplate.js');
    expect(doc.fullText).toContain('FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA');
    expect(doc.fullText).toContain('Applicant, Sam Matrix, is a resident of Testville, New South Wales.');
    expect(doc.sections.header).toBeNull();
    expect(doc.sections.venue).toBeNull();
  });

  it('Scotland: Pursuer/Defender with sheriffdom venue', () => {
    const doc = generate('scotland', 'DivorcePetitionTemplate.js');
    expect(doc.fullText).toContain('Pursuer, Sam Matrix, is a resident of Testville, Scotland.');
    expect(doc.fullText).toContain('sheriffdom');
  });

  it('South Africa: Plaintiff/Defendant per the Divorce Act 70 of 1979', () => {
    const doc = generate('south_africa', 'DivorcePetitionTemplate.js');
    expect(doc.fullText).toContain('Plaintiff');
    expect(doc.fullText).toContain('Defendant');
  });

  it('Australian state affidavits use the bare state name, never "State of"', () => {
    const doc = generate('victoria', 'AffidavitTemplate.js');
    expect(doc.fullText).toContain('VICTORIA');
    expect(doc.fullText).not.toMatch(/State of Victoria/i);
  });
});

describe('US control — terminology defaults leave US documents untouched', () => {
  it('California petition keeps the US venue opener and county phrasing', () => {
    const doc = generate('california', 'DivorcePetitionTemplate.js');
    expect(doc.sections.header).toContain('COUNTY OF TESTVILLE');
    expect(doc.fullText).toContain('Testville County');
    expect(doc.fullText).toContain('Petitioner');
  });
});
