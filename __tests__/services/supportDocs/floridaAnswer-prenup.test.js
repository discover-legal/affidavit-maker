/**
 * FL Answer — prenup affirmative defense + WHEREFORE closing (attorney
 * round-2, Tavita, 2026-08-30). When prenupSigned=true the Answer must
 * plead a dedicated FL prenup defense citing Fla. Stat. §§ 61.079
 * (UPAA) and 61.075 (equitable distribution) and specifically deny the
 * marital characterization of the Petition's identified assets. Every
 * FL Answer must carry a WHEREFORE closing preserving defenses and
 * asking for enforcement of the prenuptial agreement.
 */

const { answerToPetition } = require('../../../services/supportDocs/floridaAnswer');

function base(overrides = {}) {
  return {
    firstName: 'Tavita',
    lastName: 'Poloa',
    petitionerName: 'Ana Poloa',
    respondentName: 'Tavita Poloa',
    role: 'respondent',
    state: 'FL',
    county: 'Miami-Dade',
    ...overrides,
  };
}

function joinBody(structure) {
  return structure.sections.facts.items.map((i) => i.content).join('\n');
}

describe('FL Answer — prenup affirmative defense', () => {
  test('prenupSigned=true → dedicated prenup defense citing §§ 61.079 and 61.075', () => {
    const structure = answerToPetition(base({
      prenupSigned: true,
      prenupYear: 2018,
    }));
    const body = joinBody(structure);
    expect(body).toMatch(/AFFIRMATIVE DEFENSES/);
    expect(body).toMatch(/PRENUPTIAL AGREEMENT/);
    expect(body).toMatch(/dated 2018/);
    expect(body).toMatch(/Fla\. Stat\. § 61\.079/);
    expect(body).toMatch(/§ 61\.075/);
    expect(body).toMatch(/independent counsel/);
    expect(body).toMatch(/specifically denies that the assets and debts identified in the Petition are marital/);
  });

  test('no prenup → no prenup defense clause', () => {
    const structure = answerToPetition(base());
    const body = joinBody(structure);
    expect(body).not.toMatch(/PRENUPTIAL AGREEMENT/);
    expect(body).not.toMatch(/Fla\. Stat\. § 61\.079/);
  });
});

describe('FL Answer — WHEREFORE closing', () => {
  test('answer_wherefore item cites enforcement under §§ 61.079 & 61.075 and preserves defenses', () => {
    const structure = answerToPetition(base({ prenupSigned: true, prenupYear: 2018 }));
    const wherefore = structure.sections.facts.items.find((i) => i.type === 'answer_wherefore');
    expect(wherefore).toBeDefined();
    expect(wherefore.content).toMatch(/WHEREFORE/);
    expect(wherefore.content).toMatch(/prenuptial agreement/);
    expect(wherefore.content).toMatch(/Fla\. Stat\. §§ 61\.079 and 61\.075/);
    expect(wherefore.content).toMatch(/preserve all affirmative defenses/);
    expect(wherefore.content).toMatch(/just and proper/);
  });
});
