/** @jest-environment node */
'use strict';

/**
 * cruelty-substrate-grammar.test.js
 *
 * Attorney round-3 (2026-08-30): the TX/GA cruelty grounds paragraphs
 * were rendering ungrammatical splices like "…the cruel treatment
 * includes Petitioner Mari Vasquez-McPherson alleges that Respondent
 * Ray Delacroix physically harmed Petitioner Mari Vasquez-McPherson…"
 * The substrate splice must:
 *   1. Read as an independent sentence introduced by "Specifically,".
 *   2. Collapse duplicated role+name pairs (drop the second name).
 *   3. Not carry "includes X" grammar around a full independent clause.
 */

const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');
const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

describe('Cruelty substrate splice grammar', () => {
  test('TX splice reads "Specifically, ..." and does NOT read "cruel treatment includes ..."', () => {
    const petition = new TexasDivorcePetitionTemplate();
    const section = petition.generateGroundsSection({
      petitionerName: 'Mari Vasquez-McPherson',
      respondentName: 'Ray Delacroix',
      state: 'TX',
      county: 'Harris',
      grounds: 'cruelty',
      facts: [{
        category: 'grounds',
        subcategory: 'cruel_treatment',
        content:
          'Petitioner Mari Vasquez-McPherson alleges that Respondent Ray Delacroix physically harmed Petitioner Mari Vasquez-McPherson before the parties separated, resulting in emergency-room treatment.',
      }],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).toMatch(/Specifically,/);
    expect(grounds.content).not.toMatch(/cruel treatment includes/i);
    // Petitioner's full name must appear at most twice (formal parties
    // block references outside this splice); it must NOT be repeated
    // inside the substrate segment itself.
    const substrateSegment = grounds.content.split('Specifically,')[1] || '';
    expect(substrateSegment).not.toMatch(/Mari Vasquez-McPherson/);
    expect(substrateSegment).not.toMatch(/Ray Delacroix/);
    // Must still identify the roles by their label.
    expect(substrateSegment).toMatch(/Respondent/);
    expect(substrateSegment).toMatch(/Petitioner will produce documentation/i);
  });

  test('GA splice reads "Specifically, ..." and does NOT read "cruel treatment includes ..."', () => {
    const petition = new GeorgiaDivorcePetitionTemplate();
    const section = petition.generateGroundsSection({
      petitionerName: 'Amara Plaintiff',
      respondentName: 'Ray Defendant',
      state: 'GA',
      county: 'Fulton',
      grounds: 'cruel_treatment',
      facts: [{
        category: 'grounds',
        subcategory: 'cruel_treatment',
        content:
          'Plaintiff Amara Plaintiff alleges that Defendant Ray Defendant physically harmed Plaintiff Amara Plaintiff, with hospital records and police reports from 2024.',
      }],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).toMatch(/Specifically,/);
    expect(grounds.content).not.toMatch(/cruel treatment includes/i);
    const substrateSegment = grounds.content.split('Specifically,')[1] || '';
    // Names must not repeat inside the substrate segment.
    expect(substrateSegment).not.toMatch(/Amara Plaintiff/);
    expect(substrateSegment).not.toMatch(/Ray Defendant/);
    expect(substrateSegment).toMatch(/Defendant/);
    expect(substrateSegment).toMatch(/Plaintiff will produce documentation/i);
  });
});
