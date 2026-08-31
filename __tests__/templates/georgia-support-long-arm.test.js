/** @jest-environment node */
'use strict';

/**
 * Georgia alt-service note — child-support long-arm statute cite.
 *
 * Attorney round-5 (Amara GA, 2026-08-30): O.C.G.A. § 19-9-64 is the
 * UCCJEA long-arm (custody). Personal jurisdiction over an absent
 * nonresident spouse for a child-support order requires either the
 * Georgia general long-arm statute (O.C.G.A. § 9-10-91) or the personal-
 * jurisdiction bases in the Uniform Interstate Family Support Act
 * (O.C.G.A. § 19-11-40 et seq.). The alt-service note must NOT cite
 * § 19-9-64 as the long-arm basis for support.
 *
 * Also — ¶7 (Plaintiff label). The v25-B remediation installed
 * PLAINTIFF/DEFENDANT throughout the GA petition. Confirm the label
 * still holds in the body paragraphs (no "Petitioner" leaks).
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Johnson',
    respondentName: 'Ray Johnson',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    groundsForDivorce: 'irretrievably_broken',
    ...overrides,
  };
}

describe('Georgia — child-support long-arm citation', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('alt-service note cites § 9-10-91 (general long-arm) or UIFSA § 19-11-40 et seq. for support', () => {
    const note = petition.getAltServiceNote(baseData());
    // Must cite the CORRECT support long-arm bases.
    expect(note).toMatch(/§\s*9-10-91/);
    expect(note).toMatch(/§\s*19-11-40/);
    // Should either omit § 19-9-64 entirely OR explicitly disclaim it as
    // the support long-arm (it is the UCCJEA / custody long-arm).
    if (/§\s*19-9-64/.test(note)) {
      expect(note).toMatch(/UCCJEA|custody/i);
    }
  });

  test('alt-service note does NOT rely on § 19-9-64 for support jurisdiction', () => {
    const note = petition.getAltServiceNote(baseData());
    // The bad pattern: "long-arm requirements of O.C.G.A. § 19-9-64" as
    // the support jurisdiction basis. Must not appear.
    expect(note).not.toMatch(/long-arm requirements of O\.C\.G\.A\.\s*§\s*19-9-64/);
    expect(note).not.toMatch(/support.{0,80}§\s*19-9-64[^:]*(?:satisfied|met)/);
  });
});

describe('Georgia petition — Plaintiff/Defendant labels hold in body', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('rendered petition uses PLAINTIFF/DEFENDANT, not PETITIONER/RESPONDENT', () => {
    const doc = petition.generateDocument(
      baseData({
        respondentAddress: '123 Peachtree St, Atlanta, GA 30303',
        hasMinorChildren: false,
      })
    );
    const text = doc.fullText || JSON.stringify(doc);
    // Positive: Plaintiff and Defendant labels present.
    expect(text).toMatch(/\bPlaintiff\b/);
    expect(text).toMatch(/\bDefendant\b/);
    // Negative: no stray Petitioner/Respondent role labels.
    // "[PETITIONER NAME]" placeholder is a separate concern (only fires
    // when name is absent) — with a name supplied it must not appear.
    expect(text).not.toMatch(/\bPetitioner\b/);
    expect(text).not.toMatch(/\bRespondent\b/);
    expect(text).not.toMatch(/\[PETITIONER NAME\]/);
  });

  test('¶7 region (grounds / early body) speaks Plaintiff, not Petitioner', () => {
    const doc = petition.generateDocument(
      baseData({
        respondentAddress: '123 Peachtree St, Atlanta, GA 30303',
        hasMinorChildren: false,
      })
    );
    const text = doc.fullText || JSON.stringify(doc);
    // Take the first ~20 numbered items and check no Petitioner label.
    const paraLines = text.split('\n').filter((l) => /^\s*\d+\./.test(l)).slice(0, 20);
    for (const line of paraLines) {
      expect(line).not.toMatch(/\bPetitioner\b/);
    }
  });
});
