/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): the Florida petition
 * used to append "${this.documentTitle}\n Florida Supreme Court Approved
 * Family Law Form <n>" at the end of the caption's formatted text, AND
 * the base template renders the title as its own section immediately
 * after the caption. The heading "PETITION FOR DISSOLUTION OF MARRIAGE"
 * therefore appeared twice at Lxx and Lxx+few. Guard the fix.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    state: 'FL',
    county: 'Miami-Dade',
    marriageDate: '2018-06-15',
    hasMinorChildren: false,
    hasProperty: false,
    noPropertyConfirmed: true,
    ...overrides,
  };
}

describe('Florida petition — no duplicated title (Round-7, Tavita)', () => {
  test('caption does NOT contain the document title', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).not.toMatch(/PETITION FOR DISSOLUTION OF MARRIAGE/);
  });

  test('rendered fullText contains title exactly ONCE', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseData());
    const text = doc.fullText;
    const count = (text.match(/PETITION FOR DISSOLUTION OF MARRIAGE/g) || []).length;
    expect(count).toBe(1);
  });
});
