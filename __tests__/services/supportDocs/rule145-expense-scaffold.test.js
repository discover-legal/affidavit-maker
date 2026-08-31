/**
 * TX Rule 145 Statement of Inability — expense scaffold and template-state
 * leak scrubbing (attorney round-3, Mari, 2026-08-30).
 *
 * Tex. R. Civ. P. 145 requires the declarant to itemize income and
 * expenses by category. The expense block was previously rendering as a
 * single "Monthly expenses: $X" line when only a scalar total was on
 * file, dropping the required categorical itemization. It must now:
 *   1. Scaffold the standard expense categories when no numbers are on
 *      file (housing/utilities/food/transport/insurance/medical/
 *      childcare/debts/other).
 *   2. NOT render the "(no itemized income on file)" placeholder when a
 *      scalar income total IS present (mirror scalar branch).
 *   3. NOT surface the Rule 145 surplus qualification note in the sworn
 *      text sent to the court — it belongs in the editor sidebar
 *      (metadata.warnings) only.
 */

const { statementOfInability } = require('../../../services/supportDocs/texas');

function base(overrides = {}) {
  return {
    firstName: 'Mari',
    lastName: 'Espinoza',
    petitionerName: 'Mari Espinoza',
    respondentName: 'Roberto Espinoza',
    role: 'petitioner',
    state: 'TX',
    county: 'Travis',
    ...overrides,
  };
}

function bodyText(structure) {
  return structure.sections.facts.items.map((i) => i.content).join('\n');
}

describe('TX Rule 145 — expense scaffold', () => {
  test('no expenses on file → scaffolds every required category', () => {
    const structure = statementOfInability(base());
    const body = bodyText(structure);
    expect(body).toMatch(/Rent \/ mortgage/);
    expect(body).toMatch(/Utilities/);
    expect(body).toMatch(/Food \/ groceries/);
    expect(body).toMatch(/Transportation/);
    expect(body).toMatch(/Health insurance/);
    expect(body).toMatch(/Child care/);
    expect(body).toMatch(/Debt payments/);
    expect(body).toMatch(/Clothing \/ household necessities/);
    expect(body).toMatch(/Other necessary expenses/);
  });

  test('scalar income only → renders "Monthly income: $X" line, not the "(no itemized)" placeholder', () => {
    const structure = statementOfInability(base({
      petitionerIncome: 3500,
      monthlyIncome: 3500,
    }));
    const body = bodyText(structure);
    expect(body).toMatch(/Monthly income: \$/);
    expect(body).not.toMatch(/\(no itemized income on file\)/);
  });

  test('surplus qualification note stays out of the sworn text', () => {
    const structure = statementOfInability(base({
      petitionerIncome: 6000,
      monthlyIncome: 6000,
      monthlyExpenses: 2400,
    }));
    const body = bodyText(structure);
    // Sworn body must not carry the qualification hint that used to
    // appear in the introduction paragraph.
    expect(body).not.toMatch(/review whether you qualify/i);
    expect(body).not.toMatch(/surplus/i);
    expect(structure.sections.introduction).not.toMatch(/review whether you qualify/i);
    expect(structure.sections.introduction).not.toMatch(/surplus/i);
    // But it still surfaces in metadata.warnings for the editor UI.
    expect(structure.metadata.warnings).toBeDefined();
    expect(structure.metadata.warnings.some((w) => /surplus/i.test(w))).toBe(true);
  });

  test('itemized expenses present → renders the itemization, no scaffold blanks', () => {
    const structure = statementOfInability(base({
      expenseBreakdown: [
        { label: 'Rent', amount: 1200, person: 'petitioner' },
        { label: 'Utilities', amount: 200, person: 'petitioner' },
      ],
    }));
    const body = bodyText(structure);
    expect(body).toMatch(/Rent/);
    expect(body).not.toMatch(/Food \/ groceries \.+ \$_+/);
  });
});
