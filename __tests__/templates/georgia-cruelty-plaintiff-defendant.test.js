/**
 * Round-6 (Amara GA, 2026-08-30 v29): the cruelty substrate spliced after
 * "Specifically," must use Plaintiff/Defendant (Georgia convention),
 * never Petitioner/Respondent — even when the LLM-extracted fact used
 * the latter terminology.
 */
'use strict';

const GeorgiaDivorcePetitionTemplate =
  require('../../templates/states/georgia/DivorcePetitionTemplate');

describe('Georgia cruelty substrate normalizes to Plaintiff / Defendant', () => {
  const tpl = new GeorgiaDivorcePetitionTemplate();

  const payload = {
    petitionerName: 'Amara Okafor',
    respondentName: 'Malachi Okafor',
    plaintiffName: 'Amara Okafor',
    defendantName: 'Malachi Okafor',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-04-01',
    separationDate: '2026-04-29',
    groundsForDivorce: 'cruelty',
    facts: [
      {
        category: 'grounds',
        subcategory: 'cruel_treatment',
        content:
          'Respondent subjected Petitioner to physical abuse, supporting a fault-based ' +
          'divorce claim for cruel treatment under Georgia law.',
      },
    ],
  };

  test('substrate uses Defendant/Plaintiff, not Respondent/Petitioner', () => {
    const doc = tpl.generateDocument(payload);
    const fullText = String(doc.fullText || '');
    // The "Specifically," clause must be present.
    expect(fullText).toMatch(/Specifically,\s+Defendant/);
    // AND must NOT contain the un-normalized terms in that clause.
    const specificallyIdx = fullText.indexOf('Specifically,');
    const nextPara = fullText.slice(specificallyIdx, specificallyIdx + 300);
    expect(nextPara).not.toMatch(/\bRespondent\b/);
    expect(nextPara).not.toMatch(/\bPetitioner\b/);
    expect(nextPara).toMatch(/Plaintiff/);
  });
});
