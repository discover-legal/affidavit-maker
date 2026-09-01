/** @jest-environment node */
'use strict';

/**
 * parentTimeNaming.test.js
 *
 * Locks in the fixes from the 2026-08 live Utah persona QA run:
 *
 *   1. Parent-time / visitation orders name the NON-residential parent —
 *      the parent-time order belongs to the parent the children do NOT
 *      primarily live with. The bug: templates compared
 *      primaryCustodian === petitionerName with strict equality, so a
 *      stored go-by ("Katie O'Brien-Hatch" vs the caption's "Kathleen
 *      O'Brien-Hatch") flipped the order to the WRONG parent. When the
 *      residence is unknown, neutral wording with no name.
 *   2. Order paragraphs use the caption's full legal name consistently —
 *      a go-by stored in primaryCustodian/primaryResidence never leaks
 *      into an order.
 *   3. The Utah petition pleads the parties' agreed relief (custody enum,
 *      support amount, agreed property split, spousal-support waiver) —
 *      the waiver especially is never silently omitted.
 *
 * Mechanism under test: templates/core/parenting.js
 * (matchPartyRole / resolveResidenceRole / resolveNonResidentialParentName
 * + canonicalizing resolvePrimaryResidenceName) and the wired templates.
 */

const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'templates', 'core');
const STATES = path.join(__dirname, '..', '..', 'templates', 'states');

const {
  resolveResidenceRole,
  resolveNonResidentialParentName,
  resolvePrimaryResidenceName,
} = require(path.join(CORE, 'parenting.js'));

// The audited Utah persona: petitioner goes by "Katie", legal name
// "Kathleen O'Brien-Hatch"; children live with her; Daniel has the
// every-other-weekend schedule.
const PERSONA = {
  state: 'UT',
  county: 'Salt Lake',
  petitionerName: "Kathleen O'Brien-Hatch",
  respondentName: 'Daniel James Hatch',
  caseNumber: '123',
  marriageDate: '2012-02-14',
  divorceDate: '2026-08-27',
  groundsForDivorce: 'irreconcilable_differences',
  hasMinorChildren: true,
  children: [
    { name: 'Emma Rose Hatch', dob: '2014-08-03' },
    { name: 'Lucas Daniel Hatch', dob: '2018-05-19' },
  ],
  custodyType: 'joint',
  primaryCustodian: "Katie O'Brien-Hatch", // the stored go-by
  parentTimePlan: 'custom',
  parentTimeDetails: 'Every other weekend plus Wednesday nights',
  childSupportAmount: '850',
  childSupportObligor: 'Daniel James Hatch',
  childSupportObligee: "Kathleen O'Brien-Hatch",
  spousalSupportRequested: false,
  // Post-2026-08 safety rule: waiver requires an affirmative confirmation
  // flag — Utah persona is an uncontested case where the parties agreed
  // to waive support.
  spousalSupportWaived: true,
  petitionerProperty: ['house at 1487 E Sycamore Way in Millcreek', '2019 Honda Odyssey'],
  respondentProperty: ['Fidelity 401(k)', '2021 Toyota Tacoma'],
  propertyAgreement: 'The parties agree to the division set out below.',
  serviceMethod: 'waiver',
  isUncontested: true,
};

// ── residence-role resolution ───────────────────────────────────────────────

describe('resolveResidenceRole / resolveNonResidentialParentName', () => {
  const names = { petitionerName: "Kathleen O'Brien-Hatch", respondentName: 'Daniel James Hatch' };

  it('resolves role tokens and exact names', () => {
    expect(resolveResidenceRole({ ...names, primaryResidence: 'petitioner' })).toBe('petitioner');
    expect(resolveResidenceRole({ ...names, primaryResidence: 'respondent' })).toBe('respondent');
    expect(resolveResidenceRole({ ...names, primaryCustodian: 'Daniel James Hatch' })).toBe('respondent');
  });

  it('resolves a stored go-by by unique surname', () => {
    expect(resolveResidenceRole({ ...names, primaryCustodian: "Katie O'Brien-Hatch" })).toBe('petitioner');
  });

  it('is null when both parties share the surname (ambiguous)', () => {
    const shared = { petitionerName: 'Kathleen Hatch', respondentName: 'Daniel Hatch' };
    expect(resolveResidenceRole({ ...shared, primaryCustodian: 'Katie Hatch' })).toBeNull();
  });

  it('the non-residential parent is the OTHER party', () => {
    expect(resolveNonResidentialParentName({ ...names, primaryResidence: 'petitioner' }))
      .toBe('Daniel James Hatch');
    expect(resolveNonResidentialParentName({ ...names, primaryCustodian: "Katie O'Brien-Hatch" }))
      .toBe('Daniel James Hatch');
    expect(resolveNonResidentialParentName({ ...names, primaryResidence: 'respondent' }))
      .toBe("Kathleen O'Brien-Hatch");
  });

  it('falls back to the sole-custody enum, else null (neutral)', () => {
    expect(resolveNonResidentialParentName({ ...names, custodyType: 'sole_petitioner' }))
      .toBe('Daniel James Hatch');
    expect(resolveNonResidentialParentName({ ...names, custodyType: 'joint' })).toBeNull();
    expect(resolveNonResidentialParentName({ ...names })).toBeNull();
  });

  it('canonicalizes a go-by to the caption full legal name', () => {
    expect(resolvePrimaryResidenceName({ ...names, primaryCustodian: "Katie O'Brien-Hatch" }))
      .toBe("Kathleen O'Brien-Hatch");
  });
});

// ── Utah decree: the audited document ───────────────────────────────────────

describe('Utah decree parent-time naming (persona regression)', () => {
  const UtahDecree = require(path.join(STATES, 'utah', 'DivorceDecreeTemplate.js'));

  it('parent-time goes to the non-residential parent despite the stored go-by', () => {
    const text = new UtahDecree().generateDocument({ ...PERSONA }).fullText;
    expect(text).toContain(
      'IT IS ORDERED that Daniel James Hatch shall have parent-time with the minor child(ren) as follows: Every other weekend plus Wednesday nights'
    );
    expect(text).not.toContain("Kathleen O'Brien-Hatch shall have parent-time");
  });

  it('orders never use the go-by — only the caption full legal name', () => {
    const text = new UtahDecree().generateDocument({ ...PERSONA }).fullText;
    expect(text).not.toContain('Katie');
    expect(text).toContain(
      "IT IS ORDERED that Kathleen O'Brien-Hatch is awarded primary physical custody of the minor child(ren)."
    );
  });

  it('residence with the respondent gives the petitioner parent-time', () => {
    const text = new UtahDecree().generateDocument({
      ...PERSONA,
      primaryCustodian: 'Daniel James Hatch',
    }).fullText;
    expect(text).toContain("Kathleen O'Brien-Hatch shall have parent-time");
  });

  it('unknown residence renders neutral wording with no name', () => {
    const text = new UtahDecree().generateDocument({
      ...PERSONA,
      primaryCustodian: undefined,
      primaryResidence: undefined,
    }).fullText;
    expect(text).toContain('the non-custodial parent shall have parent-time');
  });

  it('renders exactly one court identification (the doubled-caption bug)', () => {
    const text = new UtahDecree().generateDocument({ ...PERSONA }).fullText;
    const count = text.split('IN THE DISTRICT COURT OF THE STATE OF UTAH').length - 1;
    expect(count).toBe(1);
  });
});

// ── the eight other strict-equality templates ───────────────────────────────

describe.each([
  ['arizona', 'Parenting Time'],
  ['illinois', 'Parenting Time'],
  ['georgia', 'visitation'],
  ['michigan', 'parenting time'],
  ['massachusetts', 'parenting time'],
  ['new_jersey', 'parenting time'],
  ['ohio', 'parenting time'],
  ['pennsylvania', 'physical custody'],
])('%s decree visitation naming', (dir, phrase) => {
  const Template = require(path.join(STATES, dir, 'DivorceDecreeTemplate.js'));

  it('names the respondent when the children live with the petitioner (go-by stored)', () => {
    const language = new Template().getVisitationLanguage({ ...PERSONA });
    expect(language).toContain('Daniel James Hatch');
    expect(language).toContain(phrase);
    expect(language).not.toContain('Kathleen');
    expect(language).not.toContain('Katie');
  });

  it('names the petitioner when the children live with the respondent', () => {
    const language = new Template().getVisitationLanguage({
      ...PERSONA,
      primaryCustodian: 'respondent',
    });
    expect(language).toContain("Kathleen O'Brien-Hatch");
    expect(language).not.toContain('Daniel');
  });

  it('unknown residence renders neutral wording, no name', () => {
    const language = new Template().getVisitationLanguage({
      ...PERSONA,
      primaryCustodian: undefined,
      custodyType: 'joint',
    });
    expect(language).not.toContain('Hatch');
    expect(language.toLowerCase()).toMatch(/parent/);
  });
});

// ── Utah petition pleads the agreed relief ──────────────────────────────────

describe('Utah petition pleads the agreed relief (persona regression)', () => {
  const UtahPetition = require(path.join(STATES, 'utah', 'DivorcePetitionTemplate.js'));
  const doc = new UtahPetition().generateDocument({ ...PERSONA });
  const text = doc.fullText;

  it('pleads the joint custody agreement', () => {
    expect(text).toContain('agreed to joint legal custody');
  });

  it('pleads the primary residence with the full legal name', () => {
    expect(text).toContain("primarily reside with Kathleen O'Brien-Hatch");
    expect(text).not.toContain('Katie');
  });

  it('pleads the $850/month agreed child support with the payor', () => {
    expect(text).toContain(
      "Daniel James Hatch shall pay child support to Kathleen O'Brien-Hatch in the amount of $850 per month"
    );
    expect(text).toContain('Order that Daniel James Hatch pay child support of $850 per month');
  });

  it('pleads the agreed property division item by item', () => {
    expect(text).toContain(
      "Kathleen O'Brien-Hatch is to receive: house at 1487 E Sycamore Way in Millcreek; 2019 Honda Odyssey."
    );
    expect(text).toContain('Daniel James Hatch is to receive: Fidelity 401(k); 2021 Toyota Tacoma.');
  });

  it('pleads the spousal-support waiver — never silently omitted', () => {
    expect(text).toContain('each party having waived such support');
  });

  it('renders exactly one court identification', () => {
    const count = text.split('IN THE DISTRICT COURT OF THE STATE OF UTAH').length - 1;
    expect(count).toBe(1);
  });
});
