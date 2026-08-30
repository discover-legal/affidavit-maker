/** @jest-environment node */
'use strict';

/**
 * divorceSemantics.test.js
 *
 * Locks in the semantic fixes from the live Ontario audit:
 *   1. Custody inversion — a stored "joint decision making" (or any
 *      unrecognized value) must NEVER render a sole-custody order; the
 *      machine enums ('joint','sole_petitioner','sole_respondent','shared',
 *      'split','contested','undecided') each render the right branch.
 *   2. The primary-residence order is emitted whenever the data says where
 *      the children live, regardless of the decision-making branch.
 *   3. Truthful service recitals — serviceMethod 'waiver' (spouse accepted
 *      the papers) never recites default; default is recited only when the
 *      data affirmatively says default.
 *   4. The petition pleads agreed corollary relief (custody enum, child
 *      support amount/payor, explicit spousal-support waiver, agreed
 *      property division) instead of pure boilerplate; the Ontario petition
 *      never says "community/marital property".
 *   5. The packet assembler packages every rendered document with real
 *      titles and jurisdiction-neutral cover wording.
 *
 * Mechanism under test: templates/core/parenting.js +
 * BaseDivorceDecreeTemplate / BaseDivorcePetitionTemplate + the Ontario
 * subclasses + services/courtPacket.
 */

const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'templates', 'core');
const STATES = path.join(__dirname, '..', '..', 'templates', 'states');

const BaseDivorceDecreeTemplate = require(path.join(CORE, 'BaseDivorceDecreeTemplate.js'));
const BaseDivorcePetitionTemplate = require(path.join(CORE, 'BaseDivorcePetitionTemplate.js'));
const {
  resolveCustodyArrangement,
  resolvePrimaryResidenceName,
} = require(path.join(CORE, 'parenting.js'));
const OntarioDecree = require(path.join(STATES, 'ontario', 'DivorceDecreeTemplate.js'));
const OntarioPetition = require(path.join(STATES, 'ontario', 'DivorcePetitionTemplate.js'));

// The audited Ontario case: uncontested, joint custody, kids with the
// applicant, $800/month support from the spouse, agreed house/car split,
// spouse accepted service, no spousal support sought.
const ONTARIO_CASE = {
  state: 'ON',
  county: 'Toronto',
  petitionerName: 'Avery Quinn',
  respondentName: 'Jordan Quinn',
  caseNumber: 'FS-24-0001',
  marriageDate: '2012-06-15',
  separationDate: '2024-11-01',
  divorceDate: '2026-08-01',
  groundsForDivorce: 'separation',
  hasMinorChildren: true,
  children: [
    { name: 'Riley Quinn', dob: '2015-04-02' },
    { name: 'Casey Quinn', dob: '2018-09-20' },
  ],
  custodyType: 'joint',
  primaryResidence: 'Avery Quinn',
  primaryCustodian: 'Avery Quinn',
  serviceMethod: 'waiver',
  isUncontested: true,
  spousalSupportRequested: false,
  // Post-2026-08 safety rule: a spousal-support waiver renders ONLY on
  // an affirmative, user-confirmed waiver flag — bare
  // `spousalSupportRequested === false` is no longer sufficient. The
  // audited Ontario fixture is an UNCONTESTED case in which the parties
  // affirmatively agreed to waive support, so set the confirmation.
  spousalSupportWaived: true,
  childSupportAmount: '800',
  childSupportObligor: 'Jordan Quinn',
  childSupportObligee: 'Avery Quinn',
  propertyAgreement: 'The Applicant keeps the house; the Respondent keeps the car.',
  petitionerProperty: ['the matrimonial home at 1 Main St, Toronto'],
  respondentProperty: ['the 2019 Honda Civic'],
  hasProperty: true,
};

function decreeText(Template, overrides = {}) {
  const doc = new Template().generateDocument({ ...ONTARIO_CASE, ...overrides });
  return doc.fullText;
}

function baseDecree(overrides = {}) {
  const template = new BaseDivorceDecreeTemplate();
  template.state = 'TX';
  template.stateName = 'Texas';
  return template.generateDocument({ ...ONTARIO_CASE, state: 'TX', county: 'Travis', ...overrides });
}

// ── parenting.js normalizer ─────────────────────────────────────────────────

describe('resolveCustodyArrangement', () => {
  it('maps the machine enums to their branches', () => {
    expect(resolveCustodyArrangement({ custodyType: 'joint' })).toMatchObject({ kind: 'joint', explicit: true });
    expect(resolveCustodyArrangement({ custodyType: 'shared' })).toMatchObject({ kind: 'joint' });
    expect(resolveCustodyArrangement({ custodyType: 'sole_petitioner' })).toMatchObject({ kind: 'sole_petitioner' });
    expect(resolveCustodyArrangement({ custodyType: 'sole_respondent' })).toMatchObject({ kind: 'sole_respondent' });
    expect(resolveCustodyArrangement({ custodyType: 'split' })).toMatchObject({ kind: 'unspecified' });
    expect(resolveCustodyArrangement({ custodyType: 'contested' })).toMatchObject({ kind: 'unspecified' });
    expect(resolveCustodyArrangement({ custodyType: 'undecided' })).toMatchObject({ kind: 'unspecified' });
  });

  it('recognizes legacy free text that clearly means joint/shared', () => {
    expect(resolveCustodyArrangement({ custodyType: 'joint decision making' })).toMatchObject({ kind: 'joint' });
    expect(resolveCustodyArrangement({ custodyType: 'Shared parenting' })).toMatchObject({ kind: 'joint' });
    expect(resolveCustodyArrangement({ custodyType: 'Joint Custody' })).toMatchObject({ kind: 'joint' });
  });

  it('keeps the legacy exact "sole" value on its historical branch', () => {
    expect(resolveCustodyArrangement({ custodyType: 'sole' })).toMatchObject({ kind: 'legacy_sole' });
  });

  it('never maps ambiguous free text to a sole branch', () => {
    for (const value of ['sole custody to mother', 'primary', 'we agreed', '???']) {
      expect(resolveCustodyArrangement({ custodyType: value }).kind).toBe('unspecified');
    }
  });

  it('treats a missing value as the non-explicit historical joint default', () => {
    expect(resolveCustodyArrangement({})).toEqual({ kind: 'joint', raw: null, explicit: false });
  });
});

describe('resolvePrimaryResidenceName', () => {
  it('maps role tokens to party names and passes real names through', () => {
    const data = { petitionerName: 'Avery', respondentName: 'Jordan' };
    expect(resolvePrimaryResidenceName({ ...data, primaryResidence: 'petitioner' })).toBe('Avery');
    expect(resolvePrimaryResidenceName({ ...data, primaryResidence: 'applicant' })).toBe('Avery');
    expect(resolvePrimaryResidenceName({ ...data, primaryResidence: 'respondent' })).toBe('Jordan');
    expect(resolvePrimaryResidenceName({ ...data, primaryCustodian: 'Avery Quinn' })).toBe('Avery Quinn');
    expect(resolvePrimaryResidenceName(data)).toBeNull();
  });
});

// ── Bug 1 + 2: decree custody branches ──────────────────────────────────────

describe('decree custody orders (Ontario)', () => {
  it("enum 'joint' + primaryResidence renders the shared order AND the residence order", () => {
    const text = decreeText(OntarioDecree);
    expect(text).toContain('shared decision-making responsibility');
    expect(text).toContain('shall primarily reside with Avery Quinn');
    expect(text).not.toContain('sole decision-making responsibility');
  });

  it('legacy "joint decision making" NEVER renders a sole order', () => {
    const text = decreeText(OntarioDecree, { custodyType: 'joint decision making' });
    expect(text).toContain('shared decision-making responsibility');
    expect(text).not.toContain('sole decision-making responsibility');
    expect(text).not.toContain('sole legal');
  });

  it('unrecognized custody text renders the neutral placeholder order, never sole', () => {
    const template = new OntarioDecree();
    const doc = template.generateDocument({ ...ONTARIO_CASE, custodyType: 'whatever we said in chat' });
    expect(doc.fullText).not.toContain('sole decision-making responsibility');
    expect(doc.fullText).toContain('as agreed by the parties: [ARRANGEMENT');
    // ...and the validation surface warns about it.
    expect(doc.validation.warnings.join(' ')).toMatch(/not recognized/i);
    // The residence order still appears (bug 2: independent of branch).
    expect(doc.fullText).toContain('shall primarily reside with Avery Quinn');
  });

  it("'sole_respondent' awards sole decision-making to the Respondent, not the Applicant", () => {
    const text = decreeText(OntarioDecree, {
      custodyType: 'sole_respondent',
      primaryResidence: 'respondent',
      primaryCustodian: 'Jordan Quinn',
    });
    expect(text).toContain('IT IS ORDERED that Jordan Quinn shall have sole decision-making responsibility');
    expect(text).toContain('Avery Quinn shall have parenting time');
  });

  it("'sole_petitioner' emits the residence order when the children live with the other parent", () => {
    const text = decreeText(OntarioDecree, {
      custodyType: 'sole_petitioner',
      primaryResidence: 'Jordan Quinn',
      primaryCustodian: 'Jordan Quinn',
    });
    expect(text).toContain('Avery Quinn shall have sole decision-making responsibility');
    expect(text).toContain('shall primarily reside with Jordan Quinn');
  });
});

describe('decree custody orders (US base)', () => {
  it('legacy "joint decision making" never renders a sole order at the base class either', () => {
    const doc = baseDecree({ custodyType: 'joint decision making' });
    expect(doc.fullText).toContain('joint legal custody');
    expect(doc.fullText).not.toContain('sole legal and physical custody');
  });

  it('unrecognized text renders neutral as-agreed language with a placeholder', () => {
    const doc = baseDecree({ custodyType: 'mom has the kids mostly' });
    expect(doc.fullText).not.toContain('sole legal and physical custody');
    expect(doc.fullText).toContain('[ARRANGEMENT');
    expect(doc.validation.warnings.join(' ')).toMatch(/not recognized/i);
  });

  it('missing custodyType keeps the historical joint default wording byte-for-byte', () => {
    const doc = baseDecree({ custodyType: undefined, primaryResidence: undefined });
    expect(doc.fullText).toContain(
      'IT IS ORDERED that Avery Quinn and Jordan Quinn are awarded joint legal custody of the minor child(ren).'
    );
    expect(doc.fullText).toContain(
      'IT IS ORDERED that Avery Quinn shall have primary physical custody and the right to designate the primary residence of the child(ren).'
    );
  });

  it("legacy exact 'sole' still renders its historical sole order", () => {
    const doc = baseDecree({ custodyType: 'sole', primaryResidence: undefined, primaryCustodian: 'Avery Quinn' });
    expect(doc.fullText).toContain('Avery Quinn is awarded sole legal and physical custody');
  });
});

// ── Bug 3: truthful service recitals ────────────────────────────────────────

describe('decree appearance recitals', () => {
  it("serviceMethod 'waiver' (spouse accepted the papers) never recites default", () => {
    const onText = decreeText(OntarioDecree);
    expect(onText).not.toMatch(/default/i);
    expect(onText).toContain('accepted service of the Application and consents to the terms of this Order');

    const usDoc = baseDecree();
    expect(usDoc.fullText).not.toMatch(/made default/i);
    expect(usDoc.fullText).toContain('accepted service and waived further service of process');
  });

  it("serviceMethod 'formal' without a default flag does not recite default", () => {
    const doc = baseDecree({ serviceMethod: 'formal', isUncontested: false });
    expect(doc.fullText).not.toMatch(/made default/i);
    expect(doc.fullText).toContain('was duly served');
  });

  it('default is recited only when the data affirmatively says default', () => {
    const doc = baseDecree({
      serviceMethod: 'formal',
      isUncontested: false,
      respondentDefaulted: true,
    });
    expect(doc.fullText).toContain('although duly cited, did not appear and wholly made default');
  });

  it('a respondent who appeared in an uncontested case is recited as agreeing', () => {
    const doc = baseDecree({ respondentAppeared: true });
    expect(doc.fullText).toContain('appeared and announced agreement');
    expect(doc.fullText).not.toMatch(/made default/i);
  });

  it('no service data + contested no longer asserts "wholly made default"', () => {
    const doc = baseDecree({ serviceMethod: undefined, isUncontested: false });
    expect(doc.fullText).not.toContain('wholly made default');
  });

  it('the Ontario recital uses Applicant/Self-Represented terminology, not Petitioner/pro se', () => {
    const text = decreeText(OntarioDecree);
    expect(text).toContain('Applicant, Avery Quinn, appeared self-represented');
    expect(text).not.toMatch(/pro se/i);
    expect(text).not.toContain('Petitioner');
  });
});

// ── spousal support: explicit waiver enum on the decree ─────────────────────

describe('decree spousal support', () => {
  it('spousalSupportRequested === false renders the waiver order', () => {
    expect(decreeText(OntarioDecree)).toContain(
      'waives and releases any claim for spousal support'
    );
    expect(baseDecree().fullText).toContain('waives and relinquishes any claim for spousal maintenance');
  });

  it('no spousal data at all still renders no spousal section', () => {
    const doc = baseDecree({ spousalSupportRequested: undefined, spousalSupportWaived: undefined });
    expect(doc.sections.spousalSupport).toBeNull();
  });
});

// ── Bug 4: petition pleads agreed corollary relief ──────────────────────────

describe('Ontario petition pleads the agreed relief', () => {
  const doc = new OntarioPetition().generateDocument({ ...ONTARIO_CASE });
  const text = doc.fullText;

  it('pleads the shared decision-making agreement', () => {
    expect(text).toContain('agreed to share decision-making responsibility');
  });

  it('pleads the primary residence', () => {
    expect(text).toContain('primarily reside with Avery Quinn');
  });

  it('pleads the $800/month child support and the payor, in the body and the relief', () => {
    expect(text).toContain('Jordan Quinn shall pay child support to Avery Quinn in the amount of $800 per month');
    expect(text).toContain('requiring Jordan Quinn to pay $800 per month');
  });

  it('pleads the explicit spousal-support waiver instead of staying silent', () => {
    expect(text).toContain('neither party shall pay spousal support to the other');
    expect(text).not.toContain('A spousal support order pursuant to section 15.2');
  });

  it('pleads the agreed property division (house to Applicant, car to Respondent)', () => {
    expect(text).toContain('The Applicant keeps the house; the Respondent keeps the car.');
    expect(text).toContain('Avery Quinn is to receive: the matrimonial home at 1 Main St, Toronto.');
    expect(text).toContain('Jordan Quinn is to receive: the 2019 Honda Civic.');
  });

  it('never says community/marital property, Petitioner, or County', () => {
    expect(text).not.toMatch(/community/i);
    expect(text).not.toMatch(/marital property/i);
    expect(text).not.toMatch(/petitioner/i);
    expect(text).not.toMatch(/\bcounty\b/i);
  });

  it('unknown data keeps the generic language (no fabricated agreements)', () => {
    const generic = new OntarioPetition().generateDocument({
      ...ONTARIO_CASE,
      custodyType: undefined,
      primaryResidence: undefined,
      primaryCustodian: undefined,
      childSupportAmount: undefined,
      spousalSupportRequested: undefined,
      propertyAgreement: undefined,
      petitionerProperty: undefined,
      respondentProperty: undefined,
    }).fullText;
    expect(generic).toContain('equalization of the parties\' net family property');
    expect(generic).not.toContain('The parties have agreed');
    expect(generic).not.toMatch(/community/i);
  });
});

describe('US base petition pleads the agreed relief', () => {
  const template = new BaseDivorcePetitionTemplate();
  template.state = 'TX';
  template.stateName = 'Texas';
  const text = template.generateDocument({ ...ONTARIO_CASE, state: 'TX', county: 'Travis' }).fullText;

  it('pleads joint custody, residence, support amount, waiver, and property split', () => {
    expect(text).toContain('agreed to joint legal custody');
    expect(text).toContain('primarily reside with Avery Quinn');
    expect(text).toContain('Jordan Quinn shall pay child support to Avery Quinn in the amount of $800 per month');
    expect(text).toContain('Order that Jordan Quinn pay child support of $800 per month');
    expect(text).toContain('neither party shall pay spousal maintenance/alimony');
    expect(text).toContain('Avery Quinn is to receive: the matrimonial home at 1 Main St, Toronto.');
  });

  it('a bare petition keeps the historical generic wording', () => {
    const generic = new BaseDivorcePetitionTemplate();
    generic.state = 'TX';
    generic.stateName = 'Texas';
    const genericText = generic.generateDocument({
      state: 'TX',
      county: 'Travis',
      petitionerName: 'Avery Quinn',
      respondentName: 'Jordan Quinn',
      marriageDate: '2012-06-15',
      groundsForDivorce: 'irreconcilable_differences',
      hasMinorChildren: true,
      children: [{ name: 'Riley Quinn', dob: '2015-04-02' }],
    }).fullText;
    expect(genericText).toContain('divide the community/marital property in a just and right manner');
    expect(genericText).toContain('Order child support in accordance with state guidelines;');
    expect(genericText).not.toContain('The parties have agreed');
  });
});

// ── Packet titles: real document type + jurisdiction ────────────────────────

describe('generated document metadata titles', () => {
  it('petition and decree expose a real display title (type + jurisdiction)', () => {
    const petition = new OntarioPetition().generateDocument({ ...ONTARIO_CASE });
    const decree = new OntarioDecree().generateDocument({ ...ONTARIO_CASE });
    expect(petition.metadata.documentTitle).toBe('Application for Divorce — Ontario');
    expect(decree.metadata.documentTitle).toBe('Divorce Order — Ontario');

    const us = baseDecree();
    expect(us.metadata.documentTitle).toBe('Final Decree of Divorce — Texas');
  });
});

describe('property data shape tolerance (string vs array)', () => {
  const { asList } = require('../../templates/core/dataShapes');

  test('asList keeps a string description as ONE item, never splits it', () => {
    expect(asList('the house at 12 Main St, Ottawa')).toEqual(['the house at 12 Main St, Ottawa']);
    expect(asList(['a', ' b '])).toEqual(['a', 'b']);
    expect(asList('')).toEqual([]);
    expect(asList(undefined)).toEqual([]);
  });

  test('ON decree renders string-shaped property without crashing (the preview_template_failed bug)', () => {
    const Template = require('../../templates/states/ontario/DivorceDecreeTemplate');
    const t = new Template();
    const doc = t.generateDocument({
      petitionerName: 'Jordan Rivers',
      respondentName: 'Casey Rivers',
      petitionerProperty: 'the family home',
      respondentProperty: 'the car',
      propertyAgreement: 'agreed',
      hasMinorChildren: false,
      serviceMethod: 'waiver',
    });
    const text = JSON.stringify(doc.sections);
    expect(text).toContain('the family home');
    expect(text).toContain('the car');
  });

  test('base petition pleads string-shaped agreed property', () => {
    const Template = require('../../templates/core/BaseDivorcePetitionTemplate');
    const t = new Template('TX', 'Texas');
    const doc = t.generateDocument({
      petitionerName: 'Sam Matrix',
      respondentName: 'Riley Matrix',
      petitionerProperty: 'the family home',
      respondentProperty: 'the car',
      propertyAgreement: 'agreed',
      county: 'Travis',
    });
    const text = JSON.stringify(doc.sections);
    expect(text).toContain('the family home');
    expect(text).toContain('the car');
  });
});
