/**
 * FL petition — Roman-numeral section sequence must be I-VII with no
 * skips (attorney round-5, Tavita, 2026-08-30). The Tavita FL replay
 * jumped straight from "IV. GROUNDS FOR DIVORCE" to "VI. PROPERTY AND
 * DEBTS" because the FL override of generateChildrenSection dropped
 * the "V." prefix from its title. A visible V-skip in a filed
 * pleading looks like a missing section.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

describe('FL petition — Roman-numeral section sequence', () => {
  test('all seven section titles I. through VII. are present, in order', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const doc = tpl.generateDocument({
      petitionerName: 'Marco Rossi',
      respondentName: 'Tavita Faletau',
      state: 'FL',
      county: 'Miami-Dade',
      marriageDate: '2019-06-15',
      hasMinorChildren: false,
      groundsForDivorce: 'irretrievable_breakdown',
    });

    const titles = [
      doc.sections.parties.title,
      doc.sections.jurisdiction.title,
      doc.sections.marriageInfo.title,
      doc.sections.grounds.title,
      doc.sections.childrenInfo.title,
      doc.sections.propertyInfo.title,
      doc.sections.reliefRequested.title,
    ];

    expect(titles).toEqual([
      'I. PARTIES',
      'II. JURISDICTION AND VENUE',
      'III. MARRIAGE INFORMATION',
      'IV. GROUNDS FOR DIVORCE',
      'V. CHILDREN',
      'VI. PROPERTY AND DEBTS',
      'VII. PRAYER FOR RELIEF',
    ]);

    // Full text also carries them in order with no skips.
    const text = doc.fullText;
    for (const t of titles) {
      expect(text).toContain(t);
    }
    // Explicit anti-regression: "V. CHILDREN" appears BETWEEN
    // "IV. GROUNDS FOR DIVORCE" and "VI. PROPERTY AND DEBTS".
    const idxIV = text.indexOf('IV. GROUNDS FOR DIVORCE');
    const idxV  = text.indexOf('V. CHILDREN');
    const idxVI = text.indexOf('VI. PROPERTY AND DEBTS');
    expect(idxIV).toBeGreaterThan(-1);
    expect(idxV).toBeGreaterThan(idxIV);
    expect(idxVI).toBeGreaterThan(idxV);
  });

  test('CHILDREN title carries the V. prefix (regression guard for the drop)', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection({
      hasMinorChildren: false,
    });
    expect(section.title).toBe('V. CHILDREN');
  });
});
