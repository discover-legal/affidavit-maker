/**
 * "married in YEAR" grammar (attorney round-5, Tavita FL, 2026-08-30).
 * The FL Answer preAdmit rendered "the parties were married on 2019"
 * when marriageDate was a bare year — grammatically wrong. A bare year
 * must render with the preposition "in", not "on".
 */

const { answerToPetition: flAnswer } =
  require('../../services/supportDocs/floridaAnswer');

function base(overrides = {}) {
  return {
    firstName: 'Tavita',
    lastName: 'Faletau',
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    role: 'respondent',
    state: 'FL',
    county: 'Miami-Dade',
    ...overrides,
  };
}

describe('FL Answer — year-only marriage date renders with "in", not "on"', () => {
  test('marriageDate = "2019" → "married in 2019", never "married on 2019"', () => {
    const structure = flAnswer(base({ marriageDate: '2019' }));
    const body = structure.sections.facts.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/married in 2019/);
    expect(body).not.toMatch(/married on 2019/);
  });

  test('marriageDate = "2020-06-15" (full ISO) still uses "on"', () => {
    const structure = flAnswer(base({ marriageDate: '2020-06-15' }));
    const body = structure.sections.facts.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/married on 2020-06-15/);
    expect(body).not.toMatch(/married in 2020-06-15/);
  });

  test('counterclaim clause also uses "in" for a bare year', () => {
    const structure = flAnswer(base({
      marriageDate: '2019',
      includeCounterclaim: true,
    }));
    const body = structure.sections.facts.items.map((i) => i.content).join('\n');
    // The counterclaim's own "Petitioner and Respondent were married ..." line.
    expect(body).toMatch(/were married in 2019/);
    expect(body).not.toMatch(/were married on 2019/);
  });
});
