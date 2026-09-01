/** @jest-environment node */
/**
 * BUG 2 — TX Mari acceptance v6.
 *
 * The Original Petition rendered:
 *   Respondent, [RESPONDENT NAME], is a resident of No current address known;
 *   possibly in Louisiana with his brother.
 *
 * Mari specifically said she "won't swear to" the Louisiana guess. The Texas
 * override for getRespondentResidenceClause must:
 *   1. Honor the sworn-truth flag `respondentAddressUnknown === true` and
 *      render the alternative-service clause instead of a "resident of ..."
 *      sentence.
 *   2. Refuse to concatenate any respondentAddress free text that carries a
 *      hedge ("possibly", "maybe", "no current address", "unknown", "I think",
 *      "not sure", "somewhere", "could be") into a sworn "resident of ..."
 *      sentence, even for pre-fix saved documents.
 *   3. Preserve a NON-sworn suspected location as a bracketed follow-up note
 *      that reads "may be in <place>" — never as an assertion of residence.
 */

const TexasDivorcePetitionTemplate = require('../../../../templates/states/texas/DivorcePetitionTemplate');

function clauseFor(divorceData) {
  const tpl = new TexasDivorcePetitionTemplate();
  return tpl.getRespondentResidenceClause(divorceData);
}

function sentenceFor(divorceData) {
  return `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${clauseFor(divorceData)}.`;
}

const NEVER_IN_RESIDENT_OF = /is a resident of[^.]*\b(possibly|maybe|perhaps|unknown|no current address|i think|not sure|somewhere|could be|might be)\b/i;

describe('TX petition — respondent residence clause (Bug 2)', () => {
  test('respondentAddressUnknown:true renders alternative-service clause (Mari acceptance shape)', () => {
    const sentence = sentenceFor({
      respondentName: 'Rafael Delgado',
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Louisiana',
    });
    expect(sentence).toMatch(/resides at an address unknown/i);
    expect(sentence).toMatch(/alternative service/i);
    // Suspected location is a NON-sworn follow-up note, not a "resident of"
    // assertion. It's included so the record still reflects what is known.
    expect(sentence).toMatch(/may be in Louisiana/i);
    // Never a "resident of" clause built out of the guess.
    expect(sentence).not.toMatch(NEVER_IN_RESIDENT_OF);
    expect(sentence).not.toMatch(/is a resident of Louisiana/i);
  });

  test('empty respondentAddress renders the alternative-service clause without any hedges', () => {
    const sentence = sentenceFor({
      respondentName: 'Rafael Delgado',
    });
    expect(sentence).toMatch(/resides at an address unknown/i);
    expect(sentence).not.toMatch(NEVER_IN_RESIDENT_OF);
  });

  test('legacy hedged respondentAddress free text NEVER slips into "resident of" (belt-and-suspenders)', () => {
    // Pre-fix saved document: the extraction layer stored the whole hedged
    // sentence in respondentAddress. Even without the sworn-truth flag, the
    // template must refuse to swear to it.
    const cases = [
      'No current address known; possibly in Louisiana with his brother',
      'Unknown — maybe still at the Bakersfield apartment',
      'I think somewhere in Nevada',
      'Not sure, could be back home in Ohio',
      'Whereabouts unknown',
      'Address unknown',
    ];
    for (const raw of cases) {
      const sentence = sentenceFor({
        respondentName: 'Rafael Delgado',
        respondentAddress: raw,
      });
      expect(sentence).not.toMatch(NEVER_IN_RESIDENT_OF);
      // Every hedged input pleads alt-service rather than swearing residency.
      expect(sentence).toMatch(/resides at an address unknown/i);
    }
  });

  test('a firm respondentAddress still renders the classic "is a resident of ..." clause', () => {
    const sentence = sentenceFor({
      respondentName: 'Rafael Delgado',
      respondentAddress: '4321 Elm Street, Baton Rouge, Louisiana',
    });
    expect(sentence).toMatch(/is a resident of 4321 Elm Street, Baton Rouge, Louisiana/);
    expect(sentence).not.toMatch(/alternative service/i);
  });

  test('respondentAddressUnknown without a suspected location omits the note entirely', () => {
    const sentence = sentenceFor({
      respondentName: 'Rafael Delgado',
      respondentAddressUnknown: true,
    });
    expect(sentence).toMatch(/resides at an address unknown/i);
    expect(sentence).not.toMatch(/may be in/i);
  });
});
