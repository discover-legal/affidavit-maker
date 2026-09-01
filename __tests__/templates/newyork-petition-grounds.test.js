// __tests__/templates/newyork-petition-grounds.test.js
//
// Regression tests for the NY divorce petition + decree grounds
// resolution and DRL §170 sub-ground routing. Bug context (2026-08
// coverage sweep): both templates read `divorceData.groundsForDivorce`
// straight and silently fell back to the no-fault §170(7) clause, so
// every fault-based petition emerged as no-fault boilerplate with no
// pinpoint citation for the sub-ground the user actually pleaded.

const NewYorkDivorcePetitionTemplate = require('../../templates/states/newyork/DivorcePetitionTemplate');
const NewYorkDivorceDecreeTemplate = require('../../templates/states/newyork/DivorceDecreeTemplate');
const {
  resolveGroundsForDivorce,
  inferGroundFromText,
} = require('../../templates/states/newyork/groundsResolver');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Alex Chen',
    respondentName: 'Robin Chen',
    state: 'NY',
    county: 'New York',
    marriageDate: '2015-06-01',
    ...overrides,
  };
}

function factsGround(content) {
  return [{ category: 'grounds', content }];
}

describe('New York petition grounds resolution — DRL §170 routing', () => {
  const petition = new NewYorkDivorcePetitionTemplate();

  test('structured irretrievable_breakdown renders §170(7) with "within the meaning of" phrasing', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'irretrievable_breakdown' })
    );
    expect(section.items[0].content).toMatch(/broken down irretrievably/i);
    expect(section.items[0].content).toMatch(/within the meaning of Domestic Relations Law\s*§\s*170\(7\)/);
  });

  test('cruelty/cruel_treatment routes to §170(1) clause', () => {
    for (const key of ['cruel_treatment', 'cruel_inhuman_treatment', 'cruelty']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/cruel and inhuman treatment/i);
      expect(section.items[0].content).toMatch(/§\s*170\(1\)/);
    }
  });

  test('abandonment routes to §170(2)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'abandonment' }));
    expect(section.items[0].content).toMatch(/abandoned/i);
    expect(section.items[0].content).toMatch(/§\s*170\(2\)/);
  });

  test('imprisonment/confinement routes to §170(3)', () => {
    for (const key of ['imprisonment', 'confinement']) {
      const section = petition.generateGroundsSection(baseData({ groundsForDivorce: key }));
      expect(section.items[0].content).toMatch(/confined in prison/i);
      expect(section.items[0].content).toMatch(/§\s*170\(3\)/);
    }
  });

  test('adultery routes to §170(4)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'adultery' }));
    expect(section.items[0].content).toMatch(/adultery/i);
    expect(section.items[0].content).toMatch(/§\s*170\(4\)/);
  });

  test('separation_judgment routes to §170(5)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'separation_judgment' }));
    expect(section.items[0].content).toMatch(/decree or judgment of separation/i);
    expect(section.items[0].content).toMatch(/§\s*170\(5\)/);
  });

  test('separation_agreement routes to §170(6)', () => {
    const section = petition.generateGroundsSection(baseData({ groundsForDivorce: 'separation_agreement' }));
    expect(section.items[0].content).toMatch(/written agreement of separation/i);
    expect(section.items[0].content).toMatch(/§\s*170\(6\)/);
  });

  test('missing structured field defaults to §170(7) no-fault', () => {
    const section = petition.generateGroundsSection(baseData());
    expect(section.items[0].content).toMatch(/§\s*170\(7\)/);
  });

  test('facts-only cruelty (extractor never promoted the structured field) still routes to §170(1)', () => {
    const section = petition.generateGroundsSection(
      baseData({
        facts: factsGround(
          'I seek a divorce on the ground of cruel and inhuman treatment; his conduct made cohabitation unsafe.'
        ),
      })
    );
    expect(section.items[0].content).toMatch(/§\s*170\(1\)/);
    expect(section.items[0].content).not.toMatch(/broken down irretrievably/i);
  });

  test('facts-based inference for each DRL §170 sub-ground', () => {
    const cases = {
      cruel_treatment: 'Robin was guilty of cruel treatment of me throughout 2024.',
      adultery: 'Robin committed adultery with a coworker.',
      imprisonment: 'Robin has been imprisoned in the state penitentiary for over three years.',
      abandonment: 'Robin abandoned me in March 2023 and has been gone over a year.',
      separation_agreement: 'The parties have lived separate and apart pursuant to a written agreement of separation for more than one year.',
      separation_judgment: 'The parties have lived apart pursuant to a judgment of separation for more than one year.',
      irretrievable_breakdown: 'Our marriage has been irretrievably broken for more than six months.',
    };
    for (const [expected, text] of Object.entries(cases)) {
      expect(inferGroundFromText(text)).toBe(expected);
      expect(resolveGroundsForDivorce({ facts: [{ category: 'grounds', content: text }] })).toBe(expected);
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

  test('breakdown_of_marriage (Canadian slug) canonicalises to irretrievable_breakdown for NY', () => {
    expect(resolveGroundsForDivorce({ groundsForDivorce: 'breakdown_of_marriage' })).toBe('irretrievable_breakdown');
  });
});

describe('New York decree grounds resolution', () => {
  const decree = new NewYorkDivorceDecreeTemplate();

  test('facts-only cruelty routes to §170(1) in decree findings', () => {
    const clause = decree.getDecreeGroundClause(
      baseData({ facts: factsGround('divorce on the ground of cruel treatment') })
    );
    expect(clause).toMatch(/§\s*170\(1\)/);
    expect(clause).not.toMatch(/broken down irretrievably/i);
  });

  test('adultery routes to §170(4) in decree findings', () => {
    const clause = decree.getDecreeGroundClause(baseData({ groundsForDivorce: 'adultery' }));
    expect(clause).toMatch(/adultery/i);
    expect(clause).toMatch(/§\s*170\(4\)/);
  });

  test('missing grounds defaults to §170(7) no-fault', () => {
    const clause = decree.getDecreeGroundClause(baseData());
    expect(clause).toMatch(/§\s*170\(7\)/);
  });

  test('decree FINDINGS block interpolates the resolved ground clause', () => {
    const jur = decree.generateJurisdictionSection(baseData({ groundsForDivorce: 'adultery' }));
    expect(jur.text).toMatch(/§\s*170\(4\)/);
    expect(jur.text).not.toMatch(/§\s*170\(7\)/);
  });
});
