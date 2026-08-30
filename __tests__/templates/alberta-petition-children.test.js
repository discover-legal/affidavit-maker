/**
 * Alberta Statement of Claim for Divorce — Section V (Children).
 *
 * Bug replay (2026-08, Sarah): divorce_package for Alberta rendered
 * "no minor children" for a case with two minor children (Layla, Zayn).
 * The Alberta petition template inherited the base children section
 * unchanged and, more importantly, used US-style "custody" language via
 * inheritance instead of the Divorce Act 2021 vocabulary
 * ("decision-making responsibility" / "parenting time" — Divorce Act,
 * ss.16, 16.1).
 *
 * The Alberta override wires children[] into the Statement of Claim,
 * lists each child with name + DOB, pleads the current parenting
 * arrangement under Divorce Act s.16, and handles the extraction-gap
 * case where hasMinorChildren=true but children[] is empty.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

function renderChildrenSection(data) {
  const tpl = new AlbertaDivorcePetitionTemplate();
  const section = tpl.generateChildrenSection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

describe('Alberta petition Section V — children', () => {
  test('Sarah bug replay: 2 minor children (Layla, Zayn) render with names and DOBs, not "no minor children"', () => {
    const { section, body } = renderChildrenSection({
      petitionerName: 'Sarah Doe',
      respondentName: 'John Doe',
      hasMinorChildren: true,
      children: [
        { name: 'Layla', birthDate: '2015-04-01' },
        { name: 'Zayn', birthDate: '2018-11-20' },
      ],
    });
    expect(body).not.toMatch(/no minor children/i);
    expect(body).not.toMatch(/There are no children of the marriage/);
    expect(body).toMatch(/Layla, born /);
    expect(body).toMatch(/Zayn, born /);
    expect(body).toMatch(/section 16 of the Divorce Act/);
    // Divorce Act 2021 vocabulary — never "custody"/"access".
    expect(body).not.toMatch(/\bcustody\b/i);
    expect(body).not.toMatch(/\baccess\b/i);
    expect(section.title).toBe('V. CHILDREN');
  });

  test('hasMinorChildren=true but children[] empty (extraction gap): still pleads minor children with placeholder', () => {
    const { body } = renderChildrenSection({
      hasMinorChildren: true,
      children: [],
      numberOfChildren: 2,
    });
    expect(body).not.toMatch(/no minor children/i);
    expect(body).toMatch(/There are minor children of the marriage/);
    // Name is a required field — keep as sentinel so the denylist catches it.
    expect(body).toMatch(/\[CHILD NAME\]/);
    // DOB renders as a visible fill-in blank + Draft note, NOT `[BIRTH DATE]`.
    expect(body).not.toMatch(/\[BIRTH DATE\]/);
    expect(body).toMatch(/born _{6,}/);
    expect(body).toMatch(/\(Draft — insert exact date of birth before filing\)/);
    // Padded up to numberOfChildren so both slots are pleaded.
    expect(body).toMatch(/Child 1: /);
    expect(body).toMatch(/Child 2: /);
  });

  test('Sarah AB regression: child without DOB renders visible blank + Draft note (no `[BIRTH DATE]` sentinel)', () => {
    const { body } = renderChildrenSection({
      petitionerName: 'Sarah Doe',
      respondentName: 'John Doe',
      hasMinorChildren: true,
      children: [
        { name: 'Layla' /* no DOB */ },
        { name: 'Zayn', birthDate: '2018-11-20' },
      ],
    });
    // Sentinel never leaks — generate-route denylist would 422 otherwise.
    expect(body).not.toMatch(/\[BIRTH DATE\]/);
    // Layla (no DOB) → visible blank + Draft note; keeps her name.
    expect(body).toMatch(/Layla, born _{6,}/);
    expect(body).toMatch(/\(Draft — insert exact date of birth before filing\)/);
    // Zayn (has DOB) → real date, NO Draft note attached to his line.
    const zaynLine = body.split('\n').find((l) => l.includes('Zayn'));
    expect(zaynLine).toMatch(/Zayn, born /);
    expect(zaynLine).not.toMatch(/_{6,}/);
    expect(zaynLine).not.toMatch(/Draft/);
  });

  test('adult children only (hasMinorChildren=false, numberOfChildren=2): pleads adult children, no parenting/support orders', () => {
    const { body } = renderChildrenSection({
      hasMinorChildren: false,
      numberOfChildren: 2,
    });
    expect(body).toMatch(/2 adult child\(ren\) of the marriage/);
    expect(body).toMatch(/No orders regarding decision-making responsibility, parenting time, or child support/);
    expect(body).not.toMatch(/There are no children of the marriage/);
    expect(body).not.toMatch(/section 16 of the Divorce Act/);
  });

  test('no children (hasMinorChildren=false, no children[]): pleads "no children of the marriage"', () => {
    const { body } = renderChildrenSection({
      hasMinorChildren: false,
    });
    expect(body).toMatch(/There are no children of the marriage/);
    expect(body).not.toMatch(/section 16 of the Divorce Act/);
  });

  test('parenting arrangement (joint decision-making) renders Divorce Act s.16.1 language', () => {
    const { body } = renderChildrenSection({
      petitionerName: 'Sarah Doe',
      respondentName: 'John Doe',
      hasMinorChildren: true,
      children: [{ name: 'Layla', birthDate: '2015-04-01' }],
      custodyArrangement: 'joint',
    });
    expect(body).toMatch(/share decision-making responsibility/);
    expect(body).toMatch(/section 16\.1 of the Divorce Act/);
    expect(body).not.toMatch(/\bcustody\b/i);
  });

  test('agreed child support amount renders as a Federal Child Support Guidelines pleading', () => {
    const { body } = renderChildrenSection({
      petitionerName: 'Sarah Doe',
      respondentName: 'John Doe',
      hasMinorChildren: true,
      children: [
        { name: 'Layla', birthDate: '2015-04-01' },
        { name: 'Zayn', birthDate: '2018-11-20' },
      ],
      childSupportAmount: 1200,
      childSupportObligor: 'John Doe',
      childSupportObligee: 'Sarah Doe',
    });
    expect(body).toMatch(/John Doe shall pay child support to Sarah Doe/);
    expect(body).toMatch(/\$1200 per month/);
    expect(body).toMatch(/Federal Child Support Guidelines, SOR\/97-175/);
  });

  test('full petition full-text includes children pleadings in the AB Statement of Claim output', () => {
    const tpl = new AlbertaDivorcePetitionTemplate();
    const out = tpl.generateDocument({
      petitionerName: 'Sarah Doe',
      respondentName: 'John Doe',
      state: 'AB',
      county: 'Calgary',
      marriageDate: '2010-06-15',
      groundsForDivorce: 'separation',
      hasMinorChildren: true,
      children: [
        { name: 'Layla', birthDate: '2015-04-01' },
        { name: 'Zayn', birthDate: '2018-11-20' },
      ],
    });
    expect(out.fullText).toMatch(/Layla, born /);
    expect(out.fullText).toMatch(/Zayn, born /);
    expect(out.fullText).not.toMatch(/no minor children/i);
    // Relief section keeps its own parenting/child-support prayer items.
    expect(out.fullText).toMatch(/parenting order/);
    expect(out.fullText).toMatch(/section 16\.1 of the Divorce Act/);
  });
});
