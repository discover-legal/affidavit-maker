/** @jest-environment node */
'use strict';

/**
 * Amara GA round-7 (2026-08-30): the cruelty substrate was rendering
 * every mention of the parties by proper name — "…Amara Okafor's
 * allegation that Malachi Okafor physically abused Amara Okafor" —
 * which reads as evasive third-person narration in a fault
 * pleading. The parties are already identified in the caption and
 * §I, so subsequent references in the substrate must use the role
 * labels (Plaintiff / Defendant).
 */

const GeorgiaDivorcePetitionTemplate =
  require('../../templates/states/georgia/DivorcePetitionTemplate');

describe('Georgia cruelty substrate uses role labels, not proper names', () => {
  const tpl = new GeorgiaDivorcePetitionTemplate();

  test('subsequent references to Respondent use "Defendant", not the name', () => {
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
            "Hospital records from 2024 document matters relevant to Amara Okafor's allegation that Malachi Okafor physically abused Amara Okafor.",
        },
      ],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    // The substrate section (after "Specifically,") must reference the
    // parties by role, not by proper name.
    const substrate = grounds.content.split('Specifically,')[1] || '';
    expect(substrate).toMatch(/Defendant/);
    expect(substrate).toMatch(/Plaintiff/);
    expect(substrate).not.toMatch(/Malachi Okafor/);
    expect(substrate).not.toMatch(/Amara Okafor/);
  });
});
