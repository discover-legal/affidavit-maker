/**
 * Attorney round-4 (Tavita FL, 2026-08-30). The FL Answer must pre-admit
 * scaffold paragraphs whose facts the profile already carries — state,
 * residency, marriage, separation, no-fault ground, no children, prenup,
 * spousal-support waiver — instead of a page of blank ADMITS/DENIES/
 * WITHOUT KNOWLEDGE checkboxes. Mirrors the ON Form 10 pre-admit pattern,
 * now extended to the Base scaffold so every jurisdiction inherits it.
 */

'use strict';

const { answerToPetition } = require('../../../services/supportDocs/floridaAnswer');

function build(extra = {}) {
  return answerToPetition({
    state: 'FL',
    county: 'Miami-Dade',
    respondentName: 'Tavita Faletau',
    petitionerName: 'Marco Rossi',
    marriageDate: '2019',
    marriagePlace: 'Miami',
    hasMinorChildren: false,
    numberOfChildren: 0,
    prenupSigned: true,
    prenupSignedYear: 2018,
    spousalSupportWaived: true,
    groundsForDivorce: 'irretrievably_broken',
    ...extra,
  }, { signatureStyle: 'unsworn' });
}

function factsText(doc) {
  return doc.sections.facts.items.map((i) => i.content || '').join('\n');
}
function preAdmittedItems(doc) {
  return doc.sections.facts.items.filter((i) => i && i.preAdmitted === true);
}

describe('FL Answer pre-admits from profile facts', () => {
  test('structured fields drive pre-admissions on every matched scaffold key', () => {
    const doc = build();
    const preItems = preAdmittedItems(doc);
    expect(preItems.length).toBeGreaterThanOrEqual(5);

    const text = factsText(doc);
    // jurisdiction
    expect(text).toMatch(/Respondent ADMITS the jurisdiction of this Court/i);
    // marriage
    expect(text).toMatch(/ADMITS the marriage allegations: the parties were married on 2019/);
    // breakdown / no-fault
    expect(text).toMatch(/ADMITS the ground stated for the divorce \(irretrievable breakdown of the marriage/);
    // children (none)
    expect(text).toMatch(/ADMITS the allegations that there are no minor children of the marriage/);
    // prenup drives property admission
    expect(text).toMatch(/ADMITS that the parties executed a prenuptial agreement/);
    // spousal support waiver
    expect(text).toMatch(/ADMITS that neither party seeks spousal support or alimony/);

    // A pre-admitted scaffold key MUST NOT also render the blank
    // "ADMITS / DENIES / IS WITHOUT KNOWLEDGE" checkbox for the same key.
    const marriageBlank =
      /Regarding the date and place of the marriage: Respondent ADMITS \/ DENIES/;
    expect(text).not.toMatch(marriageBlank);
  });

  test('facts[] source (Tavita replay shape) also drives pre-admissions', () => {
    // A profile with only facts[] and no structured marriage/separation
    // dates still pre-admits when the LLM classified the categories.
    const doc = build({
      marriageDate: '',
      separationDate: '',
      facts: [
        {
          category: 'relational',
          subcategory: 'marriage',
          content: 'Marco Rossi and I married in 2019 in Miami, Florida.',
        },
        {
          category: 'temporal',
          subcategory: 'separation',
          content: 'Marco Rossi and I separated approximately three months ago.',
        },
        {
          category: 'evidence',
          subcategory: 'prenuptial_agreement',
          content: 'The parties executed a prenuptial agreement in 2018.',
        },
        {
          category: 'financial',
          subcategory: 'spousal_support_waiver',
          content: 'The prenup waives spousal support both ways.',
        },
      ],
    });
    const text = factsText(doc);
    expect(text).toMatch(/ADMITS the allegations concerning the date and place of the parties' marriage/);
    expect(text).toMatch(/ADMITS the allegations concerning the parties' separation/);
    expect(text).toMatch(/ADMITS that the parties executed a prenuptial agreement/);
    expect(text).toMatch(/ADMITS that neither party seeks spousal support or alimony/);
  });
});
