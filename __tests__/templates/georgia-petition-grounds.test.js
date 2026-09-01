/** @jest-environment node */
'use strict';

/**
 * georgia-petition-grounds.test.js
 *
 * Regression: Amara (Georgia cruelty) acceptance replay found the GA
 * petition template read `divorceData.groundsForDivorce` straight and,
 * when the extractor left the field null (chat narrated documented cruel
 * treatment but no structured value promoted), fell through the
 * `getGroundsText` switch default to the no-fault §19-5-3(13) clause. A
 * fault-based cruelty petition emerged as no-fault boilerplate.
 *
 * Fix: templates/states/georgia/groundsResolver.js (mirror of the TX / Utah
 * / NY pattern). This test exercises every O.C.G.A. §19-5-3 sub-ground
 * through the resolver + petition template.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');
const {
  resolveGroundsForDivorce,
  inferGroundFromText,
} = require('../../templates/states/georgia/groundsResolver');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    ...overrides,
  };
}

function factsGround(content) {
  return [{ category: 'grounds', content }];
}

describe('Georgia petition grounds resolution — O.C.G.A. §19-5-3 routing', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('structured cruel_treatment routes to §19-5-3(10) clause', () => {
    for (const key of ['cruel_treatment', 'cruelty']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/cruel treatment/i);
      expect(section.items[0].content).toMatch(/§\s*19-5-3\(10\)/);
    }
  });

  test('adultery routes to §19-5-3(6)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'adultery' }));
    expect(section.items[0].content).toMatch(/adultery/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(6\)/);
  });

  test('desertion / wilful_desertion / abandonment route to §19-5-3(7)', () => {
    for (const key of ['desertion', 'wilful_desertion', 'abandonment']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/deserted/i);
      expect(section.items[0].content).toMatch(/§\s*19-5-3\(7\)/);
    }
  });

  test('conviction of moral turpitude routes to §19-5-3(8)', () => {
    for (const key of ['conviction_of_crime', 'conviction', 'felony']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/moral turpitude/i);
      expect(section.items[0].content).toMatch(/§\s*19-5-3\(8\)/);
    }
  });

  test('habitual_intoxication routes to §19-5-3(9)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'habitual_intoxication' }));
    expect(section.items[0].content).toMatch(/habitual intoxication/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(9\)/);
  });

  test('habitual_drug_use routes to §19-5-3(12)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'habitual_drug_use' }));
    expect(section.items[0].content).toMatch(/controlled substances/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(12\)/);
  });

  test('incurable_mental_illness routes to §19-5-3(11)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'incurable_mental_illness' }));
    expect(section.items[0].content).toMatch(/incurable mental illness/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(11\)/);
  });

  test('impotency routes to §19-5-3(3)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'impotency' }));
    expect(section.items[0].content).toMatch(/impotent/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(3\)/);
  });

  test('mental_incapacity_at_marriage routes to §19-5-3(2)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'mental_incapacity_at_marriage' }));
    expect(section.items[0].content).toMatch(/mentally incapacitated/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(2\)/);
  });

  test('fraud_duress / force_menace_duress_fraud routes to §19-5-3(4)', () => {
    for (const key of ['fraud_duress', 'force_menace_duress_fraud']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/force, menace, duress, or fraud/i);
      expect(section.items[0].content).toMatch(/§\s*19-5-3\(4\)/);
    }
  });

  test('missing structured field defaults to §19-5-3(13) no-fault', () => {
    const section = petition.generateGroundsSection(baseData());
    expect(section.items[0].content).toMatch(/irretrievably broken/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(13\)/);
  });

  test('facts-only cruelty (Amara replay: structured field never promoted) routes to §19-5-3(10)', () => {
    const section = petition.generateGroundsSection(
      baseData({
        facts: factsGround(
          'I seek a divorce on the ground of documented cruel treatment; Ray physically harmed me.'
        ),
      })
    );
    expect(section.items[0].content).toMatch(/cruel treatment/i);
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(10\)/);
    expect(section.items[0].content).not.toMatch(/irretrievably broken/i);
  });

  test('facts-based inference for each GA §19-5-3 sub-ground', () => {
    const cases = {
      cruel_treatment: 'Ray was guilty of cruel treatment of me throughout 2024.',
      adultery: 'Ray committed adultery with a coworker.',
      conviction_of_crime: 'Ray was convicted of a felony involving moral turpitude and sentenced to five years.',
      wilful_desertion: 'Ray deserted me in March 2023 and has been gone over a year.',
      habitual_intoxication: 'Ray is a habitual drunkard and habitual intoxication has continued for years.',
      habitual_drug_use: 'Ray is addicted to controlled substances (habitual drug addiction).',
      impotency: 'Ray was impotent at the time of the marriage.',
      incurable_mental_illness: 'Ray has been adjudged incurably insane as provided by law.',
      irretrievably_broken: 'Our marriage has irretrievably broken down; there is no hope of reconciliation.',
    };
    for (const [expected, text] of Object.entries(cases)) {
      expect(inferGroundFromText(text)).toBe(expected);
      expect(
        resolveGroundsForDivorce({ facts: [{ category: 'grounds', content: text }] })
      ).toBe(expected);
    }
  });

  test('grounds alias overrides an unrecognised structured field', () => {
    expect(
      resolveGroundsForDivorce({
        groundsForDivorce: 'other',
        grounds: 'cruel_treatment',
      })
    ).toBe('cruel_treatment');
  });

  test('breakdown_of_marriage / irretrievable_breakdown / no_fault canonicalise to irretrievably_broken', () => {
    for (const key of ['breakdown_of_marriage', 'irretrievable_breakdown', 'no_fault', 'irreconcilable_differences']) {
      expect(resolveGroundsForDivorce({ groundsForDivorce: key })).toBe('irretrievably_broken');
    }
  });

  test('extractor-shape fact (category=evidence, subcategory carries cruelty) still routes to §19-5-3(10)', () => {
    // Mirrors the TX Mari-replay shape: a "grounds" fact tagged as
    // evidence, with the ground itself in the subcategory field.
    const section = petition.generateGroundsSection(
      baseData({
        facts: [{
          category: 'evidence',
          content: 'Ray physically harmed Amara on multiple occasions.',
          subcategory: 'cruelty and supporting documentation',
        }],
      })
    );
    expect(section.items[0].content).toMatch(/§\s*19-5-3\(10\)/);
  });
});
