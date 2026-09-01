/**
 * FL Bug 1 replay guard (Tavita, 2026-08-29): the Florida Petition for
 * Dissolution's property section must plead a signed prenuptial agreement
 * as controlling and request its incorporation into the final Judgment of
 * Dissolution. Tavita told the interview her 2018 prenup governed the
 * disposition of property, and the base template's generic "divide marital
 * property in a just and right manner" pleading swallowed that fact.
 *
 * The override in FloridaDivorcePetitionTemplate.generatePropertySection
 * detects the prenup via the canonical `prenupSigned` flag (populated by
 * BaseDivorceOrchestrator's structured extraction) OR via an LLM-assigned
 * fact `subcategory` naming a prenup. It inserts a recital + an
 * incorporation-request paragraph BEFORE the base section's items and
 * renumbers them so paragraph numbers stay sequential.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

function renderPropertySection(data) {
  const tpl = new FloridaDivorcePetitionTemplate();
  const section = tpl.generatePropertySection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

describe('Florida petition — prenuptial agreement incorporation (Bug 1, Tavita)', () => {
  test('prenupSigned=true with year: pleads recital + incorporation request', () => {
    const { body, section } = renderPropertySection({
      hasProperty: true,
      prenupSigned: true,
      prenupSignedYear: 2018,
    });
    expect(body).toMatch(/valid prenuptial agreement dated 2018/);
    expect(body).toMatch(
      /property provisions of said prenuptial agreement be incorporated into the final Judgment of Dissolution/,
    );
    expect(section.title).toBe('VI. PROPERTY AND DEBTS');
  });

  test('prenupSigned=true without year: still pleads without a bracket placeholder', () => {
    const { body } = renderPropertySection({
      hasProperty: true,
      prenupSigned: true,
    });
    expect(body).toMatch(/valid prenuptial agreement,/);
    expect(body).not.toMatch(/\[PRENUP/);
    expect(body).not.toMatch(/dated undefined/);
    expect(body).not.toMatch(/dated null/);
  });

  test('fact subcategory "prenuptial_agreement" triggers the incorporation clause', () => {
    // LLM-first path — subcategory is a model-assigned label, not a regex
    // over free text.
    const { body } = renderPropertySection({
      hasProperty: true,
      facts: [
        { type: 'divorce', subcategory: 'prenuptial_agreement', text: 'we signed one' },
      ],
    });
    expect(body).toMatch(/prenuptial agreement/);
    expect(body).toMatch(/incorporated into the final Judgment of Dissolution/);
  });

  test('no prenup mentioned: prenup clauses are NOT inserted', () => {
    const { body } = renderPropertySection({
      hasProperty: true,
    });
    expect(body).not.toMatch(/prenuptial agreement/);
    expect(body).toMatch(/community\/marital property/);
  });

  test('paragraph numbers stay sequential when prenup clauses are inserted', () => {
    const { section } = renderPropertySection({
      hasProperty: true,
      prenupSigned: true,
      prenupSignedYear: 2018,
      _paragraphNum: 12,
    });
    const numbered = section.items.filter((i) => typeof i.number === 'number').map((i) => i.number);
    // Every numbered item is unique and strictly increasing.
    const sorted = [...numbered].sort((a, b) => a - b);
    expect(numbered).toEqual(sorted);
    expect(new Set(numbered).size).toBe(numbered.length);
    expect(numbered[0]).toBe(12);
  });
});
