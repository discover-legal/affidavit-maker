/**
 * FL Answer — AFFIRMATIVE DEFENSES section MUST render whenever a
 * per-paragraph admission cross-refers to it (attorney round-5, Tavita,
 * 2026-08-30). The Tavita FL replay produced admissions like:
 *
 *   "8. Respondent ADMITS that the parties executed a prenuptial
 *       agreement … (see AFFIRMATIVE DEFENSES)."
 *
 * but the AFFIRMATIVE DEFENSES section itself was missing because the
 * builder only auto-seeded defenses when `prenupSigned === true`. Real
 * profiles frequently arrive with the prenup captured only in facts[]
 * (subcategory=prenuptial_agreement), so the boolean flag was absent.
 *
 * This guard: given a prenup fact and no boolean flag, the AFFIRMATIVE
 * DEFENSES section renders AND every "(see AFFIRMATIVE DEFENSES)"
 * cross-reference resolves.
 */

const { answerToPetition } = require('../../../services/supportDocs/floridaAnswer');

describe('FL Answer — AFFIRMATIVE DEFENSES section always renders when cross-referenced', () => {
  const tavitaLike = {
    firstName: 'Tavita',
    lastName: 'Faletau',
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    role: 'respondent',
    state: 'FL',
    county: 'Miami-Dade',
    // NO prenupSigned boolean — mirroring the real Tavita profile
    facts: [
      {
        type: 'fact',
        subcategory: 'prenuptial_agreement',
        content: 'We entered into a prenuptial agreement in 2018.',
        sourceQuote: 'we have a prenup, signed in 2018 before the wedding.',
      },
      {
        type: 'fact',
        subcategory: 'spousal_support_waiver',
        content: 'Neither party will seek alimony.',
      },
    ],
  };

  test('facts-only prenup → AFFIRMATIVE DEFENSES section renders', () => {
    const structure = answerToPetition(tavitaLike);
    const items = structure.sections.facts.items;

    const header = items.find(
      (it) => it.type === 'section_header' && /AFFIRMATIVE DEFENSES/.test(it.content),
    );
    expect(header).toBeDefined();

    const defenses = items.filter((it) => it.type === 'affirmative_defense');
    expect(defenses.length).toBeGreaterThanOrEqual(3);
    const joined = defenses.map((d) => d.content).join('\n');
    expect(joined).toMatch(/PRENUPTIAL AGREEMENT — EXECUTION/);
    // Year extracted from facts sourceQuote.
    expect(joined).toMatch(/dated 2018/);
  });

  test('every "(see AFFIRMATIVE DEFENSES)" cross-ref resolves to a rendered header', () => {
    const structure = answerToPetition(tavitaLike);
    const items = structure.sections.facts.items;
    const body = items.map((i) => i.content).join('\n');

    // At least one preAdmit references the section.
    expect(body).toMatch(/see AFFIRMATIVE DEFENSES/);

    // And a matching section header renders (not dangling).
    const hasHeader = items.some(
      (it) => it.type === 'section_header' && /AFFIRMATIVE DEFENSES/.test(it.content),
    );
    expect(hasHeader).toBe(true);
  });
});
