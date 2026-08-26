/** @jest-environment node */
'use strict';

/**
 * canadianCaptions.test.js
 *
 * Canadian divorce petitions must not carry US caption furniture:
 * no "STATE OF X" header, no "COUNTY OF Y" venue line, no "X County"
 * body phrasing (Canadian jurisdictions have no venue counties), and the
 * body must use each jurisdiction's validated party labels
 * (Applicant / Claimant / Plaintiff / Petitioner) consistently with its
 * caption. A US control (Texas) locks the historical US wording in place.
 *
 * Mechanism under test: the `terminology` layer in
 * templates/core/terminology.js + BaseDivorcePetitionTemplate.
 */

const path = require('path');

const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates', 'states');

const DATA = {
  petitionerName: 'Sam Matrix',
  respondentName: 'Alex Matrix',
  county: 'Toronto',
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

// dir, filer label, labels that must NOT appear as party labels
const CANADIAN = [
  { dir: 'ontario', name: 'Ontario', filer: 'Applicant', banned: ['Petitioner'] },
  { dir: 'british_columbia', name: 'British Columbia', filer: 'Claimant', banned: ['Petitioner'] },
  { dir: 'alberta', name: 'Alberta', filer: 'Plaintiff', banned: ['Petitioner'] },
  { dir: 'quebec', name: 'Quebec', filer: 'Applicant', banned: ['Petitioner'] },
  { dir: 'manitoba', name: 'Manitoba', filer: 'Petitioner', banned: [] },
  { dir: 'new_brunswick', name: 'New Brunswick', filer: 'Petitioner', banned: [] },
  { dir: 'newfoundland', name: 'Newfoundland and Labrador', filer: 'Petitioner', banned: [] },
  { dir: 'nova_scotia', name: 'Nova Scotia', filer: 'Petitioner', banned: [] },
  { dir: 'prince_edward_island', name: 'Prince Edward Island', filer: 'Petitioner', banned: [] },
  { dir: 'saskatchewan', name: 'Saskatchewan', filer: 'Petitioner', banned: [] },
  { dir: 'northwest_territories', name: 'Northwest Territories', filer: 'Applicant', banned: ['Petitioner'] },
  { dir: 'yukon', name: 'Yukon', filer: 'Petitioner', banned: [] },
  { dir: 'nunavut', name: 'Nunavut', filer: 'Applicant', banned: ['Petitioner'] },
];

function generate(dir) {
  const Template = require(path.join(TEMPLATES_ROOT, dir, 'DivorcePetitionTemplate.js'));
  const instance = new Template();
  return instance.generateDocument({ ...DATA, state: instance.state });
}

describe.each(CANADIAN)('$name divorce petition caption', ({ dir, filer, banned }) => {
  let doc;
  beforeAll(() => {
    doc = generate(dir);
  });

  it('contains no "STATE OF" header', () => {
    expect(doc.fullText).not.toMatch(/STATE OF/i);
  });

  it('contains no "COUNTY OF" venue line', () => {
    expect(doc.fullText).not.toMatch(/COUNTY OF/i);
  });

  it('never phrases the body as "X County"', () => {
    expect(doc.fullText).not.toMatch(/\bcounty\b/i);
  });

  it(`uses the ${filer} party label in the body`, () => {
    expect(doc.fullText).toContain(filer);
    // Residency line agrees with the caption's party label
    expect(doc.fullText).toContain(`${filer}, Sam Matrix, is a resident of`);
  });

  it('does not leak US party labels foreign to this jurisdiction', () => {
    for (const label of banned) {
      expect(doc.fullText).not.toMatch(new RegExp(`\\b${label}\\b`));
    }
  });

  it('does not use the US "Pro Se" designation', () => {
    expect(doc.fullText).not.toMatch(/Pro Se/);
  });
});

describe('specific Canadian caption conventions', () => {
  it('Ontario: Superior Court of Justice + Court File No. + court location, no county', () => {
    const doc = generate('ontario');
    expect(doc.fullText).toContain('SUPERIOR COURT OF JUSTICE');
    expect(doc.fullText).toContain('Court File No.');
    expect(doc.fullText).toContain('Applicant, Sam Matrix, is a resident of Toronto, Ontario.');
    expect(doc.sections.header).toBeNull();
    expect(doc.sections.venue).toBeNull();
  });

  it('British Columbia: Supreme Court registry model with Claimant', () => {
    const doc = generate('british_columbia');
    expect(doc.fullText).toContain('SUPREME COURT OF BRITISH COLUMBIA');
    expect(doc.fullText).toContain('Claimant');
    expect(doc.sections.header).toBeNull();
    expect(doc.sections.venue).toBeNull();
  });

  it("Alberta: Court of King's Bench judicial-centre model with Plaintiff/Defendant", () => {
    const doc = generate('alberta');
    expect(doc.fullText).toMatch(/KING'S BENCH/);
    expect(doc.fullText).toContain('Plaintiff');
    expect(doc.fullText).toContain('Defendant');
    expect(doc.sections.header).toBeNull();
    expect(doc.sections.venue).toBeNull();
  });

  it('Quebec: Superior Court judicial-district model with Applicant/Defendant', () => {
    const doc = generate('quebec');
    expect(doc.fullText).toContain('SUPERIOR COURT');
    expect(doc.fullText).toContain('Applicant');
    expect(doc.fullText).toContain('Defendant');
    expect(doc.sections.header).toBeNull();
    expect(doc.sections.venue).toBeNull();
  });
});

describe('US control — terminology defaults leave US petitions untouched', () => {
  let doc;
  beforeAll(() => {
    doc = generate('texas');
  });

  it('keeps the Texas venue opener and county phrasing', () => {
    expect(doc.sections.header).toBe('THE STATE OF TEXAS');
    expect(doc.sections.venue).toMatch(/^COUNTY OF /);
    expect(doc.fullText).toContain('Petitioner, Sam Matrix, is a resident of Toronto County, Texas.');
  });

  it('keeps Petitioner / Pro Se labels', () => {
    expect(doc.fullText).toContain('Petitioner');
    expect(doc.sections.signatureBlock.title).toBe('Petitioner, Pro Se');
  });
});
