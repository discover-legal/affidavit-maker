/**
 * Round-6 (Marcus ON, 2026-08-30 v29): the ON decree's parenting order
 * must reflect the transcript when the structured slot disagrees. Marcus's
 * profile stored primaryCustodian: "Marcus Thompson" while the extracted
 * fact clearly said the children live primarily with Priya. The template
 * must believe the fact.
 */
'use strict';

const OntarioDivorceDecreeTemplate =
  require('../../templates/states/ontario/DivorceDecreeTemplate');

describe('Ontario decree — primary residence follows the transcript fact', () => {
  const tpl = new OntarioDivorceDecreeTemplate();

  const payload = {
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    applicantName: 'Priya Thompson',
    state: 'ON',
    county: 'Toronto',
    marriageDate: '2013-08-03',
    separationDate: '2025-01-01',
    hasMinorChildren: true,
    children: [{ name: 'Ava', birthYear: 2016 }, { name: 'Ethan', birthYear: 2019 }],
    // Structured slot is WRONG (per real Marcus profile from v28b replay):
    primaryCustodian: 'Marcus Thompson',
    custodyType: 'undecided',
    facts: [
      {
        category: 'children',
        subcategory: 'primary_residence',
        content: 'Our children, Ava and Ethan, live primarily with Priya Thompson in Toronto, Ontario.',
      },
    ],
  };

  test('parenting order names Priya as the primary residential parent', () => {
    const doc = tpl.generateDocument(payload);
    const text = String(doc.fullText || '');
    expect(text).toMatch(/primarily reside with Priya Thompson/);
    expect(text).not.toMatch(/primarily reside with Marcus Thompson/);
  });
});
