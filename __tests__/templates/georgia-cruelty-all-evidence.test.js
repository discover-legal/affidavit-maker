/** @jest-environment node */
'use strict';

/**
 * Amara GA round-7 (2026-08-30): the cruelty substrate builder was
 * returning only the first matching evidence description, so a
 * profile carrying BOTH hospital records AND police reports for the
 * same allegation surfaced only the hospital records in the
 * pleading — silently understating the corroborating record. All
 * distinct sanitized substrates must appear together in the cruelty
 * grounds paragraph.
 */

const GeorgiaDivorcePetitionTemplate =
  require('../../templates/states/georgia/DivorcePetitionTemplate');

describe('Georgia cruelty grounds surfaces every evidence type', () => {
  test('hospital records and police reports both appear', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const section = tpl.generateGroundsSection({
      petitionerName: 'Amara Okafor',
      respondentName: 'Malachi Okafor',
      state: 'GA',
      county: 'Fulton',
      grounds: 'cruel_treatment',
      facts: [
        {
          category: 'evidence',
          subcategory: 'supporting_documentation',
          content:
            'Hospital records from 2024 document matters relevant to the alleged physical abuse.',
        },
        {
          category: 'evidence',
          subcategory: 'supporting_documentation',
          content:
            'Police reports from 2024 document matters relevant to the alleged physical abuse.',
        },
      ],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).toMatch(/hospital records/i);
    expect(grounds.content).toMatch(/police reports/i);
  });
});
