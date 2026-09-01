/** @jest-environment node */
'use strict';

/**
 * cruelty-substrate-no-meta.test.js
 *
 * Attorney round-3 (2026-08-30): Amara ¶7 was picking up "seeks
 * dissolution on the Georgia ground of cruel treatment rather than
 * irreconcilable differences" as a factual substrate. That phrasing
 * is LLM routing/planning meta-commentary — not a pleadable
 * allegation. The substrate selector must exclude any fact whose
 * content contains routing phrases ("rather than", "instead of",
 * "seeks dissolution", "the appropriate ground", …).
 */

const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');
const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

const META_FACT_GA = {
  category: 'grounds',
  subcategory: 'cruel_treatment',
  content:
    'Plaintiff seeks dissolution on the Georgia ground of cruel treatment rather than irreconcilable differences.',
  sourceQuote:
    'the appropriate ground here is cruel treatment rather than irreconcilable differences.',
};

const META_FACT_TX = {
  category: 'grounds',
  subcategory: 'cruel_treatment',
  content:
    'Petitioner seeks dissolution on the Texas ground of cruelty rather than insupportability.',
  sourceQuote:
    'the appropriate ground here is cruelty rather than insupportability.',
};

describe('Cruelty substrate rejects LLM routing meta-commentary', () => {
  test('GA: routing phrasing does NOT reach the pleaded paragraph', () => {
    const petition = new GeorgiaDivorcePetitionTemplate();
    const section = petition.generateGroundsSection({
      petitionerName: 'Amara Plaintiff',
      respondentName: 'Ray Defendant',
      state: 'GA',
      county: 'Fulton',
      grounds: 'cruel_treatment',
      facts: [META_FACT_GA],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).not.toMatch(/rather than/i);
    expect(grounds.content).not.toMatch(/instead of/i);
    expect(grounds.content).not.toMatch(/seeks dissolution/i);
    expect(grounds.content).not.toMatch(/appropriate ground/i);
    // No substrate splice at all when the only candidate was meta.
    expect(grounds.content).not.toMatch(/Specifically,/);
  });

  test('TX: routing phrasing does NOT reach the pleaded paragraph', () => {
    const petition = new TexasDivorcePetitionTemplate();
    const section = petition.generateGroundsSection({
      petitionerName: 'Mari Delacroix',
      respondentName: 'Ray Delacroix',
      state: 'TX',
      county: 'Harris',
      grounds: 'cruelty',
      facts: [META_FACT_TX],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).not.toMatch(/rather than/i);
    expect(grounds.content).not.toMatch(/instead of/i);
    expect(grounds.content).not.toMatch(/seeks dissolution/i);
    expect(grounds.content).not.toMatch(/Specifically,/);
  });

  test('GA: meta-only fact is filtered but a valid substrate fact after it still wins', () => {
    const petition = new GeorgiaDivorcePetitionTemplate();
    const section = petition.generateGroundsSection({
      petitionerName: 'Amara Plaintiff',
      respondentName: 'Ray Defendant',
      state: 'GA',
      county: 'Fulton',
      grounds: 'cruel_treatment',
      facts: [
        META_FACT_GA,
        {
          category: 'grounds',
          subcategory: 'cruel_treatment',
          content:
            'Defendant physically abused Plaintiff during the marriage; hospital records and police reports document the assaults.',
        },
      ],
    });
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds.content).toMatch(/Specifically,/);
    expect(grounds.content).toMatch(/hospital records/i);
    expect(grounds.content).not.toMatch(/rather than/i);
  });
});
