/**
 * Case number null/undefined/"null"-string handling (attorney round-5,
 * Tavita FL, 2026-08-30). Real profiles arrived with caseNumber
 * literally the string "null" (LLM extraction of a missing slot), and
 * both the FL petition and the FL answer rendered "Case No.: null" /
 * "Case No. null". A missing case number must always render as a blank
 * fill-in line (never the word "null" / "undefined" / "N/A"), and the
 * blank is the Draft-completion cue for the filer.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');
const { answerToPetition: flAnswer } =
  require('../../services/supportDocs/floridaAnswer');

function baseAnswer(overrides = {}) {
  return {
    firstName: 'Tavita',
    lastName: 'Faletau',
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    role: 'respondent',
    state: 'FL',
    county: 'Miami-Dade',
    ...overrides,
  };
}

describe('caseNumber never renders as literal "null" / "undefined"', () => {
  describe.each([
    ['literal null', null],
    ['literal undefined', undefined],
    ['string "null"', 'null'],
    ['string "undefined"', 'undefined'],
    ['string "N/A"', 'N/A'],
    ['empty string', ''],
    ['whitespace', '   '],
  ])('caseNumber = %s', (label, caseNumber) => {
    test(`FL petition renders a blank line, never "${label}"`, () => {
      const tpl = new FloridaDivorcePetitionTemplate();
      const doc = tpl.generateDocument({
        petitionerName: 'Marco Rossi',
        respondentName: 'Tavita Faletau',
        state: 'FL',
        county: 'Miami-Dade',
        caseNumber,
        marriageDate: '2019-06-15',
        groundsForDivorce: 'irretrievable_breakdown',
      });
      // fullText and the caption's `formatted` string must both be
      // free of literal "null"/"undefined" beside Case No.
      const text = doc.fullText || '';
      expect(text).not.toMatch(/Case No\.:?\s*null\b/i);
      expect(text).not.toMatch(/Case No\.:?\s*undefined\b/i);
      // The caption still carries a visible fill-in line.
      expect(text).toMatch(/Case No\.:?\s*_+/);
    });

    test(`FL answer caption renders BLANK_SHORT, never "${label}"`, () => {
      const structure = flAnswer(baseAnswer({ caseNumber }));
      const formatted = structure.sections.caseCaption.formatted;
      const rightCol = structure.sections.caseCaption.structured.right.join('\n');
      expect(formatted).not.toMatch(/Case No\.\s*null\b/i);
      expect(formatted).not.toMatch(/Case No\.\s*undefined\b/i);
      expect(rightCol).not.toMatch(/Case No\.\s*null\b/i);
      expect(rightCol).not.toMatch(/Case No\.\s*undefined\b/i);
      // A visible underscore fill-in must be present.
      expect(rightCol).toMatch(/Case No\.\s*_+/);
    });
  });
});
