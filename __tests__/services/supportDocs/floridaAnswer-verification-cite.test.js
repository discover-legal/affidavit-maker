/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): the FL Answer's
 * verification cited Fla. Fam. L.R.P. 12.020 — a general form/definition
 * rule — as authority for the unsworn declaration. The correct authority
 * is Fla. Stat. § 92.525 (Verification of Documents).
 */

const { answerToPetition: flAnswer } =
  require('../../../services/supportDocs/floridaAnswer');

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

describe('FL Answer — verification cites § 92.525, not 12.020 (Round-7)', () => {
  test('perjury statement contains § 92.525', () => {
    const structure = flAnswer(base());
    const perjury = structure.sections.perjuryStatement || '';
    expect(perjury).toMatch(/Fla\.\s*Stat\.\s*§\s*92\.525/);
  });

  test('perjury statement does NOT cite 12.020', () => {
    const structure = flAnswer(base());
    const perjury = structure.sections.perjuryStatement || '';
    expect(perjury).not.toMatch(/12\.020/);
  });
});
