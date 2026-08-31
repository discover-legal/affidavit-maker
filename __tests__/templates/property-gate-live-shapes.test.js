// Round-3 attorney-review fixes (2026-08-30).
// Live-shape regressions: Mari (TX), Sarah (AB), David (NY) — the property
// section must NOT fabricate community/marital-property boilerplate against
// a payload that either says "no property" via facts OR is silent OR carries
// a status token like "pending" as propertyAgreement.

const TexasDivorcePetitionTemplate =
  require('../../templates/states/texas/DivorcePetitionTemplate');
const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');
const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

const COMMUNITY_ALLEGATION =
  /there exists community property owned by the parties/i;
const NY_FAB_ALLEGATION =
  /marital property during the marriage, including but not limited to real property/i;
const AB_APPROVE_AGREEMENT =
  /approve the parties' agreement regarding the division/i;
const NIL_TX = /no community property or community debt to be divided|own no community or marital property/i;
const NIL_AB = /no family property to be divided under the Family Property Act/i;

function collectText(section) {
  return section.items.map((it) => it.content).join('\n');
}

describe('round-3 property-gate live shapes', () => {
  test('Mari TX shape (facts say no property; structured flags unset) renders nil-property clause', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const data = {
      petitionerName: 'Mari Vasquez-McPherson',
      respondentName: 'Ray Delacroix',
      state: 'TX',
      county: 'Harris',
      marriageDate: '2020',
      hasMinorChildren: false,
      facts: [
        // Mari's assistant reply captured the no-property statement in
        // the sourceQuote of a residence/parties-context fact even though
        // no dedicated property fact was emitted.
        {
          content: 'The parties confirm they have no property, no house, no retirement.',
          category: 'property',
          subcategory: 'no_property',
          sourceQuote: 'no property, no house, no retirement, no kids.',
        },
      ],
    };
    const section = tpl.generatePropertySection(data);
    const text = collectText(section);
    expect(text).not.toMatch(COMMUNITY_ALLEGATION);
    expect(text).toMatch(NIL_TX);
  });

  test('Sarah AB shape (propertyAgreement="pending", hasProperty=false) does NOT plead fabricated agreement', () => {
    const tpl = new AlbertaDivorcePetitionTemplate();
    // Direct predicate check — this is the exact bug: "pending" was treated
    // as an agreement, so relief (f) invited the court to approve it.
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'pending', hasProperty: false }))
      .toBe(false);
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'unknown' })).toBe(false);
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'undecided' })).toBe(false);
    // Affirmative status tokens still count as agreement (no description
    // needed) — only non-affirmative tokens are rejected.
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'agreed' })).toBe(true);
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'yes' })).toBe(true);
    // A described agreement still counts.
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'She keeps the house; he keeps the truck.' }))
      .toBe(true);
    // Explicit confirmation flag counts even when propertyAgreement is a status token.
    expect(tpl.hasAgreedPropertyDivision({ propertyAgreement: 'pending', propertyAgreementConfirmed: true }))
      .toBe(true);

    const section = tpl.generatePropertySection({
      petitionerName: 'Sarah Khoury',
      respondentName: 'Ahmed Khoury',
      state: 'AB',
      county: 'Calgary',
      hasProperty: false,
      hasDebts: false,
      propertyAgreement: 'pending',
    });
    const text = collectText(section);
    expect(text).toMatch(NIL_AB);
    expect(text).not.toMatch(AB_APPROVE_AGREEMENT);
  });

  test('David NY shape (silent hasProperty + silent hasDebts) does NOT fabricate marital-property/debts paragraphs', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generatePropertySection({
      petitionerName: 'David Rosenberg',
      respondentName: 'Yvonne Rosenberg',
      state: 'NY',
      county: 'Kings',
      // hasProperty, hasDebts BOTH intentionally absent
      facts: [
        { content: 'The parties have agreed on the terms of an uncontested divorce.',
          category: 'relational', subcategory: 'uncontested_agreement' },
      ],
    });
    const text = collectText(section);
    expect(text).not.toMatch(NY_FAB_ALLEGATION);
    expect(text).not.toMatch(/accumulated debts during the marriage/i);
    // Silence renders a draft-note blank, not a fabricated allegation.
    expect(text).toMatch(/Draft — confirm whether you and your spouse have any/i);
  });
});
