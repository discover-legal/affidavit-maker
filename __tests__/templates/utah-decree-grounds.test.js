// __tests__/templates/utah-decree-grounds.test.js
//
// Regression tests for the Utah decree grounds clause — v9-A follow-up.
//
// Bug: the Utah decree hardcoded "irreconcilable differences" in both
// its FINDINGS OF FACT clause and its DECREE OF DIVORCE clause,
// regardless of what ground the petitioner actually pled. A cruelty
// petition emerged as a no-fault decree.
//
// Fix: `templates/states/utah/groundsResolver.js` mirrors the Texas
// resolver pattern — read the structured field (`grounds` alias first,
// then `groundsForDivorce`), fall back to facts[], and default to the
// statutory no-fault ground when nothing identifies one.

const UtahDivorceDecreeTemplate = require('../../templates/states/utah/DivorceDecreeTemplate');
const {
  resolveGroundsForDivorce,
  inferGroundFromText,
  decreeGroundPhrase,
  findingGroundClause,
} = require('../../templates/states/utah/groundsResolver');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Mari Pilcher',
    respondentName: 'Ray Pilcher',
    state: 'UT',
    county: 'Salt Lake',
    marriageDate: '2015-06-01',
    caseNumber: '2026-12345',
    ...overrides,
  };
}

function factsGround(content) {
  return [{ category: 'grounds', content }];
}

describe('Utah grounds resolution — statutory grounds', () => {
  const cases = {
    cruel_treatment: {
      structuredKey: 'cruel_treatment',
      alias: 'cruelty',
      factText: 'Respondent was guilty of cruel treatment causing bodily injury.',
      phraseRe: /cruel treatment/i,
      statuteRe: /30-3-1\(3\)\(g\)/,
    },
    adultery: {
      structuredKey: 'adultery',
      factText: 'Respondent committed adultery with a coworker.',
      phraseRe: /adultery/i,
      statuteRe: /30-3-1\(3\)\(b\)/,
    },
    desertion: {
      structuredKey: 'desertion',
      alias: 'abandonment',
      factText: 'Respondent willfully deserted Petitioner for more than a year.',
      phraseRe: /desertion/i,
      statuteRe: /30-3-1\(3\)\(c\)/,
    },
    neglect: {
      structuredKey: 'neglect',
      factText: 'Respondent willfully neglected to provide the common necessaries of life.',
      phraseRe: /common necessaries/i,
      statuteRe: /30-3-1\(3\)\(d\)/,
    },
    habitual_drunkenness: {
      structuredKey: 'habitual_drunkenness',
      factText: 'Respondent is a habitual drunkard.',
      phraseRe: /habitual drunkenness/i,
      statuteRe: /30-3-1\(3\)\(e\)/,
    },
    conviction: {
      structuredKey: 'conviction',
      alias: 'felony',
      factText: 'Respondent was convicted of a felony and imprisoned.',
      phraseRe: /felony/i,
      statuteRe: /30-3-1\(3\)\(f\)/,
    },
    incurable_insanity: {
      structuredKey: 'incurable_insanity',
      factText: 'Respondent has been adjudged incurably insane by court order.',
      phraseRe: /incurable insanity/i,
      statuteRe: /30-3-1\(3\)\(i\)/,
    },
    impotency: {
      structuredKey: 'impotency',
      factText: 'Respondent was impotent at the time of marriage.',
      phraseRe: /impotency/i,
      statuteRe: /30-3-1\(3\)\(a\)/,
    },
    living_apart: {
      structuredKey: 'living_apart',
      factText: 'The parties have lived separate and apart under a decree of separate maintenance for three consecutive years.',
      phraseRe: /separate and apart/i,
      statuteRe: /30-3-1\(2\)/,
    },
    irreconcilable_differences: {
      structuredKey: 'irreconcilable_differences',
      alias: 'no_fault',
      factText: 'The marriage is irretrievably broken due to irreconcilable differences.',
      phraseRe: /irreconcilable differences/i,
      statuteRe: /30-3-1\(3\)\(h\)/,
    },
  };

  for (const [key, spec] of Object.entries(cases)) {
    test(`${key}: structured groundsForDivorce → canonical key`, () => {
      expect(
        resolveGroundsForDivorce(baseData({ groundsForDivorce: spec.structuredKey }))
      ).toBe(key);
    });

    if (spec.alias) {
      test(`${key}: alias "${spec.alias}" via grounds field → canonical key`, () => {
        expect(
          resolveGroundsForDivorce(baseData({ grounds: spec.alias }))
        ).toBe(key);
      });
    }

    test(`${key}: facts-only inference → canonical key`, () => {
      // The irreconcilable_differences broad-scan is intentionally
      // suppressed unless the fact is category:'grounds'; assert that
      // path explicitly for the no-fault case.
      expect(inferGroundFromText(spec.factText)).toBe(key);
      expect(
        resolveGroundsForDivorce(baseData({ facts: factsGround(spec.factText) }))
      ).toBe(key);
    });

    test(`${key}: decreeGroundPhrase & findingGroundClause carry the right statute`, () => {
      expect(decreeGroundPhrase(key)).toMatch(spec.phraseRe);
      expect(decreeGroundPhrase(key)).toMatch(spec.statuteRe);
      expect(findingGroundClause(key)).toMatch(spec.statuteRe);
    });
  }
});

describe('Utah decree template integration', () => {
  const decree = new UtahDivorceDecreeTemplate();

  test('DECREE OF DIVORCE reflects cruelty when pled (was hardcoded to irreconcilable differences)', () => {
    const section = decree.generateDissolutionSection(
      baseData({ groundsForDivorce: 'cruel_treatment' })
    );
    expect(section.text).toMatch(/cruel treatment/i);
    expect(section.text).toMatch(/30-3-1\(3\)\(g\)/);
    expect(section.text).not.toMatch(/on the grounds of irreconcilable differences\b/i);
  });

  test('FINDINGS OF FACT clause reflects the pled ground rather than hardcoded no-fault', () => {
    const section = decree.generateJurisdictionSection(
      baseData({ groundsForDivorce: 'adultery' })
    );
    expect(section.text).toMatch(/adultery/i);
    expect(section.text).toMatch(/30-3-1\(3\)\(b\)/);
  });

  test('missing grounds defaults to irreconcilable differences (§ 30-3-1(3)(h))', () => {
    const section = decree.generateDissolutionSection(baseData());
    expect(section.text).toMatch(/irreconcilable differences/i);
    expect(section.text).toMatch(/30-3-1\(3\)\(h\)/);
  });

  test('unrecognised structured value + no facts falls back gracefully', () => {
    const section = decree.generateDissolutionSection(
      baseData({ groundsForDivorce: 'other' })
    );
    expect(section.text).toMatch(/irreconcilable differences/i);
  });

  test('facts-only cruelty (Mari-style shape) promotes to cruel treatment in the decree', () => {
    const facts = [
      {
        category: 'evidence',
        content: 'Ray physically harmed Mari before separation.',
        subcategory: 'cruelty and supporting documentation',
      },
    ];
    const section = decree.generateDissolutionSection(baseData({ facts }));
    expect(section.text).toMatch(/cruel treatment/i);
    expect(section.text).not.toMatch(/on the grounds of irreconcilable differences\b/i);
  });

  test('alias "grounds: cruelty" wins over unrecognised groundsForDivorce', () => {
    const section = decree.generateDissolutionSection(
      baseData({ groundsForDivorce: 'other', grounds: 'cruelty' })
    );
    expect(section.text).toMatch(/cruel treatment/i);
  });
});
