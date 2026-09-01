// __tests__/templates/texas-petition-grounds.test.js
//
// Regression tests for the Texas divorce petition template's grounds
// clause and suspected-location hedge stripping. Bug context: a Mari
// acceptance replay produced a §6.002 cruelty petition that emerged
// with §6.001 insupportability boilerplate, because the extractor
// captured the ground only in facts[] (category:'grounds') and never
// promoted it to the structured `groundsForDivorce` field.

const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');
const TexasDivorceDecreeTemplate = require('../../templates/states/texas/DivorceDecreeTemplate');
const {
  resolveGroundsForDivorce,
  inferGroundFromText,
} = require('../../templates/states/texas/groundsResolver');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Mari Delacroix',
    respondentName: 'Ray Delacroix',
    state: 'TX',
    county: 'Travis',
    marriageDate: '2015-06-01',
    ...overrides,
  };
}

function factsGround(content) {
  return [{ category: 'grounds', content }];
}

describe('Texas petition grounds resolution', () => {
  const petition = new TexasDivorcePetitionTemplate();

  test('structured cruelty renders §6.002 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'cruelty' })
    );
    expect(section.items[0].content).toMatch(/cruel treatment/i);
    expect(section.items[0].content).not.toMatch(/discord or conflict/i);
  });

  test('facts-only cruelty (Mari replay) promotes to §6.002 language', () => {
    const section = petition.generateGroundsSection(
      baseData({
        facts: factsGround(
          'I seek a divorce from Ray Delacroix on the ground of cruelty; his conduct made cohabitation insupportable.'
        ),
      })
    );
    expect(section.items[0].content).toMatch(/cruel treatment/i);
    expect(section.items[0].content).not.toMatch(/discord or conflict/i);
  });

  test('adultery renders §6.003 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'adultery' })
    );
    expect(section.items[0].content).toMatch(/adultery/i);
  });

  test('conviction / felony aliases render §6.004 language', () => {
    for (const key of ['conviction', 'felony', 'felony_conviction']) {
      const section = petition.generateGroundsSection(
        baseData({ groundsForDivorce: key })
      );
      expect(section.items[0].content).toMatch(/convicted of a felony/i);
    }
  });

  test('abandonment renders §6.005 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'abandonment' })
    );
    expect(section.items[0].content).toMatch(/intention of abandonment/i);
    expect(section.items[0].content).toMatch(/one year/i);
  });

  test('living_apart renders §6.006 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'living_apart' })
    );
    expect(section.items[0].content).toMatch(/lived apart/i);
    expect(section.items[0].content).toMatch(/three years/i);
  });

  test('confinement renders §6.007 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'confinement' })
    );
    expect(section.items[0].content).toMatch(/mental hospital/i);
    expect(section.items[0].content).toMatch(/three years/i);
  });

  test('insupportability (default) renders §6.001 language', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'insupportability' })
    );
    expect(section.items[0].content).toMatch(/discord or conflict/i);
  });

  test('missing grounds & no facts falls back to §6.001', () => {
    const section = petition.generateGroundsSection(baseData());
    expect(section.items[0].content).toMatch(/discord or conflict/i);
  });

  test('facts-based inference for each fault ground', () => {
    const cases = {
      cruelty: 'Ray was guilty of cruel treatment of me throughout 2024.',
      adultery: 'Ray committed adultery with a coworker.',
      conviction: 'Ray was convicted of a felony and sent to the penitentiary.',
      abandonment: 'Ray abandoned me in March 2023 and has been gone over a year.',
      living_apart: 'We have lived apart without cohabitation for four years.',
      confinement: 'Ray has been confined in a mental hospital for over three years.',
    };
    for (const [expected, text] of Object.entries(cases)) {
      expect(inferGroundFromText(text)).toBe(expected);
      expect(
        resolveGroundsForDivorce(baseData({ facts: factsGround(text) }))
      ).toBe(expected);
    }
  });
});

describe('Texas petition grounds resolution — real-world Mari shape', () => {
  const petition = new TexasDivorcePetitionTemplate();

  // Exact shape captured from the v8b live replay:
  //   scratchpad/v8b-replay/mari-profile.json — the extractor put
  //   groundsForDivorce="other" (unrecognised placeholder), never wrote
  //   a category:'grounds' fact, and stored the cruelty signal inside
  //   an evidence fact whose subcategory literally names it.
  // The rig's save step then adds `grounds: 'cruelty'` to the payload:
  //   scratchpad/v8b-replay/run.mjs — `content = { ...affidavitData,
  //   grounds: 'cruelty' }`.
  const MARI_LIVE_FACTS = [
    {
      id: 'ef6f32d8',
      type: 'fact',
      content: 'Petitioner resides in Houston, Harris County, Texas.',
      category: 'residence',
      subcategory: 'current residence',
      sourceQuote: 'hi i need to file for divorce in texas, im in houston harris county',
    },
    {
      id: 'abc9bcef',
      type: 'evidence',
      content:
        'Ray Delacroix physically harmed Mari Vasquez-McPherson before the parties separated, and Mari Vasquez-McPherson has emergency-room documentation relating to the harm.',
      category: 'evidence',
      subcategory: 'cruelty and supporting documentation',
      sourceQuote:
        'grounds — cruelty. he hurt me physically, i have er documentation from before we split.',
    },
    {
      id: '1089631a',
      type: 'fact',
      content: 'Mari Vasquez-McPherson earns approximately $4,800 per month in income.',
      category: 'financial',
      subcategory: 'income',
      sourceQuote:
        'my income is about 4800 a month, expenses 2400. i cant afford the filing fee, i need the indigency thing (rule 145).',
    },
  ];

  test('save-path `grounds: "cruelty"` alias promotes to §6.002 even when groundsForDivorce="other"', () => {
    const section = petition.generateGroundsSection(
      baseData({
        groundsForDivorce: 'other',
        grounds: 'cruelty',
        facts: MARI_LIVE_FACTS,
      })
    );
    expect(section.items[0].content).toMatch(/cruel treatment/i);
    expect(section.items[0].content).not.toMatch(/discord or conflict/i);
  });

  test('evidence-category fact with subcategory "cruelty…" promotes to §6.002 when no structured field is set', () => {
    const section = petition.generateGroundsSection(
      baseData({
        groundsForDivorce: 'other', // unrecognised placeholder → drops through
        facts: MARI_LIVE_FACTS,
      })
    );
    expect(section.items[0].content).toMatch(/cruel treatment/i);
    expect(section.items[0].content).not.toMatch(/discord or conflict/i);
  });

  test('resolveGroundsForDivorce returns "cruelty" for the exact Mari shape', () => {
    expect(
      resolveGroundsForDivorce({
        groundsForDivorce: 'other',
        grounds: 'cruelty',
        facts: MARI_LIVE_FACTS,
      })
    ).toBe('cruelty');
  });

  test('unrecognised structured field alone still falls back to §6.001', () => {
    // No grounds alias, no cruelty-shaped fact → the safe default.
    const section = petition.generateGroundsSection(
      baseData({
        groundsForDivorce: 'other',
        facts: [
          {
            category: 'residence',
            content: 'Petitioner resides in Houston.',
            subcategory: 'current residence',
          },
        ],
      })
    );
    expect(section.items[0].content).toMatch(/discord or conflict/i);
  });
});

describe('Texas petition suspected-location caveat rendering', () => {
  const petition = new TexasDivorcePetitionTemplate();

  test('renders "Petitioner has heard, but cannot swear" caveat when respondentAddressUnknown:true + suspected location', () => {
    // v8b Mari acceptance: the caveat sentence was absent from the PDF.
    // With both flags set on divorceData the override MUST render it.
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Louisiana or Mississippi',
      })
    );
    expect(clause).toMatch(/Petitioner has heard, but cannot swear/);
    expect(clause).toMatch(/may be in Louisiana or Mississippi/);
    expect(clause).toMatch(/alternative service/i);
  });

  test('caveat is omitted when respondentAddressUnknown:true and no suspected location', () => {
    // v9-D scope: when the extractor never captured a suspected location,
    // the alt-service clause still renders — just without the caveat.
    const clause = petition.getRespondentResidenceClause(
      baseData({ respondentAddressUnknown: true })
    );
    expect(clause).toMatch(/alternative service/i);
    expect(clause).not.toMatch(/Petitioner has heard/);
  });
});

describe('Texas decree grounds resolution (same bug surface)', () => {
  const decree = new TexasDivorceDecreeTemplate();

  test('facts-only cruelty resolves to §6.002 in decree clause', () => {
    const clause = decree.getDecreeGroundClause(
      baseData({
        facts: factsGround('divorce on the ground of cruelty'),
      })
    );
    expect(clause).toMatch(/cruelty.*§\s*6\.002/i);
  });

  test('missing everything falls back to §6.001 insupportability', () => {
    const clause = decree.getDecreeGroundClause(baseData());
    expect(clause).toMatch(/insupportability.*§\s*6\.001/i);
  });
});

describe('Texas petition suspected-location hedge stripping', () => {
  const petition = new TexasDivorcePetitionTemplate();

  test('strips leading "Possibly," from suspected location', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Possibly Louisiana or Mississippi',
      })
    );
    // No double hedge — the "may be in" caveat carries the hedge itself.
    expect(clause).not.toMatch(/may be in Possibly/i);
    expect(clause).toMatch(/may be in Louisiana or Mississippi/);
    // The sworn-truth caveat remains.
    expect(clause).toMatch(/cannot swear/i);
    expect(clause).toMatch(/alternative service/i);
  });

  test('strips multiple / stacked leading hedges', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Perhaps, maybe Baton Rouge',
      })
    );
    expect(clause).toMatch(/may be in Baton Rouge/);
    expect(clause).not.toMatch(/Perhaps|maybe/i);
  });

  test('leaves an un-hedged suspected location alone', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Baton Rouge',
      })
    );
    expect(clause).toMatch(/may be in Baton Rouge/);
  });
});
