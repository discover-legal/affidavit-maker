/** @jest-environment node */
'use strict';

/**
 * decreeFidelity.test.js
 *
 * Locks in the persona-audit fixes from scratchpad/onresp, /txcont, /calcorr:
 *   1. Contested spousal support never rendered as a mutual waiver.
 *   2. Texas decree renders the PLEADED ground (cruelty/adultery/felony/…),
 *      never silently downgrades to insupportability.
 *   3. California decree never labels community property "as separate
 *      property" — awarded community property is that party's SOLE
 *      property (subject to the parties' prenup when one governs).
 *   4. Petitions omit custody/support prayer items when hasMinorChildren
 *      === false, even when the children[] list holds adult children.
 *   5. Caption formatter preserves McPherson / DiCaprio / van der Berg
 *      internal capitals instead of blindly `.toUpperCase()`.
 *   6. Texas publication service (TRCP 109) does NOT recite default from
 *      serviceMethod alone.
 *   7. Whereabouts-unknown respondent gets a residence-unknown clause,
 *      never "resident of Unknown; possibly Louisiana…".
 *   8. Ontario decree renders substantive parentTimeDetails verbatim.
 *   9. California decree renders an equalization payment as its own
 *      ordered clause under DIVISION OF PROPERTY.
 *  10. California decree renders a prenup recital when the case data
 *      names a premarital agreement.
 */

const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'templates', 'core');
const STATES = path.join(__dirname, '..', '..', 'templates', 'states');

const BaseDivorceDecreeTemplate = require(path.join(CORE, 'BaseDivorceDecreeTemplate.js'));
const BaseDivorcePetitionTemplate = require(path.join(CORE, 'BaseDivorcePetitionTemplate.js'));
const OntarioDecree = require(path.join(STATES, 'ontario', 'DivorceDecreeTemplate.js'));
const TexasDecree = require(path.join(STATES, 'texas', 'DivorceDecreeTemplate.js'));
const TexasPetition = require(path.join(STATES, 'texas', 'DivorcePetitionTemplate.js'));
const CaliforniaDecree = require(path.join(STATES, 'california', 'DivorceDecreeTemplate.js'));
const CaliforniaPetition = require(path.join(STATES, 'california', 'DivorcePetitionTemplate.js'));
const { captionUpper } = require(path.join(CORE, 'nameCase.js'));
const { resolveSpousalSupportDecision } = require(path.join(CORE, 'spousalSupport.js'));

const BASE_CASE = {
  state: 'ON',
  county: 'Toronto',
  petitionerName: 'Marcus Reid',
  respondentName: 'Priya Reid',
  caseNumber: 'FS-25-1234',
  marriageDate: '2010-08-15',
  separationDate: '2024-06-01',
  divorceDate: '2026-09-01',
  groundsForDivorce: 'separation',
  hasMinorChildren: true,
  children: [{ name: 'Kiran Reid', dob: '2014-03-11' }],
  custodyType: 'joint',
  primaryResidence: 'Marcus Reid',
  primaryCustodian: 'Marcus Reid',
  serviceMethod: 'waiver',
  isUncontested: true,
};

// ── 1. Contested spousal support — the Ontario Marcus failure ─────────────

describe('spousal support precedence', () => {
  it('resolveSpousalSupportDecision awards when request + amount are set (no explicit awarded flag)', () => {
    const d = resolveSpousalSupportDecision({
      requestSpousalSupport: true,
      spousalSupportAmount: '1800',
      petitionerName: 'Marcus',
      respondentName: 'Priya',
    });
    expect(d.outcome).toBe('award');
    expect(d.amount).toBe('1800');
    expect(d.payor).toBe('Priya');
    expect(d.payee).toBe('Marcus');
  });

  it('request wins over a waived flag — never false-waives an asking spouse', () => {
    const d = resolveSpousalSupportDecision({
      requestSpousalSupport: true,
      spousalSupportAmount: '1800',
      spousalSupportWaived: true,
    });
    expect(d.outcome).toBe('award');
  });

  it('bare request without an amount pleads reservation, not a waiver', () => {
    const d = resolveSpousalSupportDecision({ requestSpousalSupport: true });
    expect(d.outcome).toBe('reserve');
  });

  it('Ontario decree renders the AWARD when the persona asks $1,800/mo', () => {
    const text = new OntarioDecree().generateDocument({
      ...BASE_CASE,
      requestSpousalSupport: true,
      spousalSupportAmount: '1800',
      spousalSupportDuration: '48 months',
    }).fullText;
    expect(text).toContain('shall pay spousal support');
    expect(text).toContain('$1800 per month');
    expect(text).not.toMatch(/waives and releases any claim for spousal support/i);
  });

  it('Texas decree renders the AWARD for a request+amount, never a waiver', () => {
    const text = new TexasDecree().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      requestSpousalSupport: true,
      spousalSupportAmount: '1800',
      spousalSupportDuration: '24 months',
    }).fullText;
    expect(text).toContain('shall pay spousal maintenance');
    expect(text).toContain('$1800');
    expect(text).not.toMatch(/waives any right to spousal maintenance/i);
  });

  it('California decree reserves jurisdiction when a request has no amount', () => {
    const text = new CaliforniaDecree().generateDocument({
      ...BASE_CASE,
      state: 'CA',
      county: 'Alameda',
      requestSpousalSupport: true,
    }).fullText;
    expect(text).toContain('reserves jurisdiction over spousal support');
    expect(text).not.toMatch(/terminates jurisdiction to award spousal support/i);
  });
});

// ── 2. Texas fault ground preserved ────────────────────────────────────────

describe('Texas decree preserves the pleaded ground', () => {
  const grounds = [
    ['cruelty', '§ 6.002'],
    ['adultery', '§ 6.003'],
    ['conviction', '§ 6.004'],
    ['abandonment', '§ 6.005'],
  ];
  for (const [g, cite] of grounds) {
    it(`renders ${g} as ${cite}, never downgrades to insupportability`, () => {
      const text = new TexasDecree().generateDocument({
        ...BASE_CASE,
        state: 'TX',
        county: 'Travis',
        groundsForDivorce: g,
      }).fullText;
      expect(text).toContain(cite);
      expect(text).not.toMatch(/on the ground of insupportability/i);
    });
  }

  it('no ground / no_fault / insupportability all render as § 6.001', () => {
    for (const g of ['insupportability', 'no_fault', 'irreconcilable_differences', undefined]) {
      const text = new TexasDecree().generateDocument({
        ...BASE_CASE, state: 'TX', county: 'Travis', groundsForDivorce: g,
      }).fullText;
      expect(text).toMatch(/§ 6\.001/);
    }
  });
});

// ── 3. California — community property never "as separate property" ───────

describe('California decree property division', () => {
  const CA_CASE = {
    ...BASE_CASE,
    state: 'CA',
    county: 'Alameda',
    petitionerName: 'Alison Rae McPherson',
    respondentName: 'Devin McPherson',
    petitionerProperty: ['the 2019 Subaru Outback'],
    respondentProperty: ['the Fidelity 401(k) account'],
  };

  it('awards community property as SOLE property, never labels it "as separate property"', () => {
    const text = new CaliforniaDecree().generateDocument(CA_CASE).fullText;
    expect(text).toMatch(/awarded to Petitioner .* as that party's sole property/);
    expect(text).toMatch(/awarded to Respondent .* as that party's sole property/);
    expect(text).not.toMatch(/community property is confirmed to Petitioner.*as separate property/i);
    expect(text).not.toMatch(/community property is confirmed to Respondent.*as separate property/i);
  });

  it('renders an equalization payment as its own ordered clause under DIVISION OF PROPERTY', () => {
    const doc = new CaliforniaDecree().generateDocument({
      ...CA_CASE,
      equalizationAmount: '80000',
      equalizationSchedule: 'in equal monthly installments over 36 months',
      equalizationPayor: 'Alison Rae McPherson',
      equalizationPayee: 'Devin McPherson',
    });
    const propItems = doc.sections.propertyDivision.items.map((i) => i.content).join('\n');
    expect(propItems).toContain('equalization payment of $80000');
    expect(propItems).toMatch(/in equal monthly installments over 36 months/);
    // Must NOT appear under debt allocation.
    const debtItems = doc.sections.debtAllocation.items.map((i) => i.content).join('\n');
    expect(debtItems).not.toMatch(/equalization/i);
  });

  it('renders a prenup recital when the case data names a premarital agreement', () => {
    const doc = new CaliforniaDecree().generateDocument({
      ...CA_CASE,
      prenuptialAgreement: true,
      prenupYear: '2001',
    });
    const jur = doc.sections.jurisdiction.text;
    expect(jur).toMatch(/premarital agreement dated 2001/);
    expect(jur).toMatch(/continues to govern/);
  });

  // Interview extraction schema (services/agents/BaseDivorceOrchestrator):
  // prenup_signed / prenup_signed_year / prenup_governs_after_divorce land as
  // prenupSigned / prenupSignedYear / prenupGovernsAfterDivorce — the CA
  // decree must read those too.
  it('renders the prenup recital from the interview-extraction fields (prenupSigned + prenupSignedYear)', () => {
    const doc = new CaliforniaDecree().generateDocument({
      ...CA_CASE,
      prenupSigned: true,
      prenupSignedYear: 2001,
      prenupGovernsAfterDivorce: true,
    });
    const jur = doc.sections.jurisdiction.text;
    expect(jur).toMatch(/premarital agreement dated 2001/);
    expect(jur).toMatch(/continues to govern/);
  });

  it('given equalizationAmount+schedule, decree DIVISION OF PROPERTY carries the ordered clause and it does NOT appear in ALLOCATION OF DEBTS', () => {
    // Mirrors the live CA acceptance run: $80k equalization once buried under
    // ALLOCATION OF DEBTS because the interview described it as a debt.
    const doc = new CaliforniaDecree().generateDocument({
      ...CA_CASE,
      equalizationAmount: 80000,
      equalizationSchedule: 'in 36 monthly installments of $2,222.22 beginning October 1, 2026',
      equalizationPayor: 'Alison Rae McPherson',
      equalizationPayee: 'Devin McPherson',
    });
    const propItems = doc.sections.propertyDivision.items.map((i) => i.content).join('\n');
    expect(propItems).toMatch(/IT IS ORDERED that Alison Rae McPherson shall pay to Devin McPherson an equalization payment of \$80000/);
    expect(propItems).toMatch(/in 36 monthly installments of \$2,222\.22/);
    // Never under debt allocation.
    const debtItems = doc.sections.debtAllocation.items.map((i) => i.content).join('\n');
    expect(debtItems).not.toMatch(/equalization/i);
    expect(debtItems).not.toMatch(/\$80000/);
  });

  it('name-aware caption preserves the McPherson pattern (never MCPHERSON)', () => {
    const doc = new CaliforniaDecree().generateDocument(CA_CASE);
    expect(doc.sections.caseCaption.formatted).toContain('McPHERSON');
    expect(doc.sections.caseCaption.formatted).not.toContain('MCPHERSON');
  });
});

// ── 4. No-minors petition drops custody/support prayer ─────────────────────

describe('no-minor-children petitions omit custody/support prayer', () => {
  const noMinors = {
    ...BASE_CASE,
    hasMinorChildren: false,
    children: undefined,
    state: 'TX',
    county: 'Travis',
    groundsForDivorce: 'insupportability',
  };

  it('Texas petition prayer has no custody / conservatorship / support items', () => {
    const text = new TexasPetition().generateDocument(noMinors).fullText;
    expect(text).not.toMatch(/Appointment of conservators/i);
    expect(text).not.toMatch(/child support as provided by law/i);
    expect(text).not.toMatch(/possession and access to the child/i);
  });

  it('California petition prayer has no "Determine custody" or "Order child support"', () => {
    const text = new CaliforniaPetition().generateDocument({
      ...noMinors, state: 'CA', county: 'Alameda', separationDate: '2024-01-01',
    }).fullText;
    expect(text).not.toMatch(/Determine custody and visitation/i);
    expect(text).not.toMatch(/Order child support per the California Statewide Uniform Guideline/i);
  });

  it('California petition names ADULT children as adults, never as minors', () => {
    const text = new CaliforniaPetition().generateDocument({
      ...noMinors,
      state: 'CA',
      county: 'Alameda',
      separationDate: '2024-01-01',
      hasMinorChildren: false,
      children: [{ name: 'Ada McPherson' }, { name: 'Ben McPherson' }],
    }).fullText;
    // New CA v7 pleading phrasing: adult children are pleaded with an
    // explicit count and no custody/visitation/support orders requested,
    // with names in parens. Names must still appear, and the minor-children
    // paragraph must never fire.
    expect(text).toMatch(/adult children of the marriage \(Ada McPherson, and Ben McPherson\)/);
    expect(text).toMatch(/no orders regarding custody, visitation, or child support are requested/);
    expect(text).not.toMatch(/The minor children of this marriage are as listed/i);
  });

  // ── CA petition polish (acceptance v6, 2026-08) ───────────────────────
  // (a) The caption must never leak literal placeholder tokens; (b) party
  // names must route through captionUpper (McPHERSON, not MCPHERSON);
  // (c) an adult-children-only case must not headline the section
  // "V. MINOR CHILDREN".

  const CA_MCP = {
    petitionerName: 'Alison Rae McPherson',
    respondentName: 'Devin McPherson',
    state: 'CA',
    county: 'Alameda',
    caseNumber: 'FL-2026-001234',
    marriageDate: '2015-06-20',
    separationDate: '2024-11-15',
    groundsForDivorce: 'irreconcilable_differences',
    hasMinorChildren: false,
    children: [{ name: 'Ethan McPherson' }, { name: 'Sofía McPherson' }],
  };

  it('California petition caption renders no placeholder tokens with McPherson data', () => {
    const doc = new CaliforniaPetition().generateDocument(CA_MCP);
    const caption = doc.sections.caseCaption.formatted;
    for (const token of ['[COURT NAME]', '[PLAINTIFF NAME]', '[DEFENDANT NAME]', '[CASE NUMBER]', '[PETITIONER NAME]', '[RESPONDENT NAME]', '[COUNTY]']) {
      expect(caption).not.toContain(token);
    }
    // fullText head (before the title) must also carry none of them.
    const title = doc.sections.title || '';
    const head = title && doc.fullText.includes(title)
      ? doc.fullText.slice(0, doc.fullText.indexOf(title))
      : doc.fullText;
    for (const token of ['[COURT NAME]', '[PLAINTIFF NAME]', '[DEFENDANT NAME]', '[CASE NUMBER]', '[PETITIONER NAME]', '[RESPONDENT NAME]']) {
      expect(head).not.toContain(token);
    }
  });

  it('California petition caption preserves McPherson (never MCPHERSON)', () => {
    const doc = new CaliforniaPetition().generateDocument(CA_MCP);
    const caption = doc.sections.caseCaption.formatted;
    expect(caption).toContain('McPHERSON');
    expect(caption).not.toContain('MCPHERSON');
  });

  it('California petition: adult-children-only case does NOT headline "MINOR CHILDREN"', () => {
    const doc = new CaliforniaPetition().generateDocument(CA_MCP);
    expect(doc.sections.childrenInfo.title).not.toMatch(/MINOR CHILDREN/);
    expect(doc.sections.childrenInfo.title).toMatch(/CHILDREN/);
    expect(doc.fullText).not.toMatch(/^V\. MINOR CHILDREN$/m);
  });

  it('California petition: real minor children still get the "MINOR CHILDREN" header', () => {
    const doc = new CaliforniaPetition().generateDocument({
      ...CA_MCP,
      hasMinorChildren: true,
      children: [{ name: 'Ethan McPherson', dob: '2016-04-01' }],
    });
    expect(doc.sections.childrenInfo.title).toBe('V. MINOR CHILDREN');
  });
});

// ── 5. Caption Mc/Di/van preservation ─────────────────────────────────────

describe('captionUpper preserves internal-capital name patterns', () => {
  it('McPherson → McPHERSON', () => {
    expect(captionUpper('Alison Rae McPherson')).toBe('ALISON RAE McPHERSON');
  });
  it('MacArthur → MacARTHUR', () => {
    expect(captionUpper('Diane MacArthur')).toBe('DIANE MacARTHUR');
  });
  it("DiCaprio, O'Brien, van der Berg patterns", () => {
    expect(captionUpper('Leonardo DiCaprio')).toBe('LEONARDO DiCAPRIO');
    expect(captionUpper("Kathleen O'Brien-Hatch")).toBe("KATHLEEN O'BRIEN-HATCH");
    expect(captionUpper('Anna van der Berg')).toBe('ANNA van der BERG');
  });
  it('plain names still fully uppercase (byte-identical to historical behavior)', () => {
    expect(captionUpper('John Smith')).toBe('JOHN SMITH');
    expect(captionUpper('Mary Johnson-Lee')).toBe('MARY JOHNSON-LEE');
  });

  it('BaseAffidavitTemplate.generateTitle routes affiant through captionUpper', () => {
    // Live CA acceptance run regression: financial declaration rendered
    // "AFFIDAVIT OF ALISON RAE MCPHERSON" (naive .toUpperCase), which
    // corrupted the Mc/PHERSON pattern the case caption preserved.
    const BaseAffidavitTemplate = require(path.join(CORE, 'BaseAffidavitTemplate.js'));
    const tpl = new BaseAffidavitTemplate();
    expect(tpl.generateTitle('Alison Rae McPherson')).toBe(
      'AFFIDAVIT OF ALISON RAE McPHERSON',
    );
    expect(tpl.generateTitle('Leonardo DiCaprio')).toBe('AFFIDAVIT OF LEONARDO DiCAPRIO');
    // No name → placeholder unchanged.
    expect(tpl.generateTitle('')).toBe('AFFIDAVIT OF [NAME]');
  });
});

// ── 6. Texas publication service — no false default ──────────────────────

describe('Texas publication service recital', () => {
  it("serviceMethod 'publication' without default flag does NOT recite default", () => {
    const text = new TexasDecree().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      groundsForDivorce: 'cruelty',
      isUncontested: false,
      serviceMethod: 'publication',
    }).fullText;
    expect(text).toMatch(/citation by publication pursuant to Tex\. R\. Civ\. P\. 109/);
    expect(text).toMatch(/attorney ad litem was appointed/);
    expect(text).not.toMatch(/although duly cited, did not appear/i);
    expect(text).not.toMatch(/made default/i);
  });

  it("serviceMethod 'publication' NEVER falls through to the bare-default fallback (Mari)", () => {
    // Regression guard: even for a contested case with no isUncontested flag,
    // no agreed flag, no default flag, and no respondentAppeared flag, the
    // 'publication' branch must fire — never the "although duly cited, did
    // not appear" fallback that a bare-data case previously hit.
    const text = new TexasDecree().generateDocument({
      state: 'TX',
      county: 'Travis',
      petitionerName: 'Mari Elena Delgado',
      respondentName: 'Rafael Delgado',
      caseNumber: 'D-1-FM-26-000123',
      marriageDate: '2015-06-01',
      groundsForDivorce: 'insupportability',
      serviceMethod: 'publication',
    }).fullText;
    expect(text).toMatch(/citation by publication pursuant to Tex\. R\. Civ\. P\. 109/);
    expect(text).toMatch(/attorney ad litem was appointed pursuant to Tex\. R\. Civ\. P\. 244/);
    expect(text).not.toMatch(/although duly cited, did not appear/i);
  });

  // v5 audit (2026-08-28): the live Mari-shape decree still fell through to
  // "although duly cited, did not appear" — the persona said "his
  // whereabouts are unknown, I'll need publication", but the stored data
  // did not surface the canonical serviceMethod='publication'. The TX
  // template's normalizeServiceMethod() now reads alternate keys, textual
  // synonyms, and infers publication from whereabouts-unknown addresses.
  describe.each([
    ['snake_case service_method', { service_method: 'publication' }],
    ['legacy serviceType key',    { serviceType: 'publication' }],
    ['legacy service_type key',   { service_type: 'publication' }],
    ['textual synonym: publish',  { serviceMethod: 'publish' }],
    ['textual synonym: citation by publication', { serviceMethod: 'citation by publication' }],
    ['textual synonym: newspaper',{ serviceMethod: 'newspaper' }],
    ['textual synonym: substituted', { serviceMethod: 'substituted' }],
    ['alternativeService flag',   { alternativeService: true }],
    ['serviceByPublication flag', { serviceByPublication: true }],
    ['respondentAddress "unknown"', { respondentAddress: 'unknown' }],
    ['respondentAddress "whereabouts unknown; possibly Louisiana"',
      { respondentAddress: 'whereabouts unknown; possibly Louisiana with his brother' }],
    ['respondentAddressUnknown flag', { respondentAddressUnknown: true }],
  ])('publication signal via %s', (_label, signal) => {
    it('routes to TRCP 109 branch, never the bare-default fallback', () => {
      const text = new TexasDecree().generateDocument({
        state: 'TX',
        county: 'Travis',
        petitionerName: 'Mari Elena Delgado',
        respondentName: 'Rafael Delgado',
        caseNumber: 'D-1-FM-26-000123',
        marriageDate: '2015-06-01',
        groundsForDivorce: 'insupportability',
        ...signal,
      }).fullText;
      expect(text).toMatch(/citation by publication pursuant to Tex\. R\. Civ\. P\. 109/);
      expect(text).toMatch(/attorney ad litem was appointed pursuant to Tex\. R\. Civ\. P\. 244/);
      expect(text).not.toMatch(/although duly cited, did not appear/i);
    });
  });

  it("waiver phrasings still route to the waiver branch, not publication", () => {
    const text = new TexasDecree().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      serviceMethod: 'accepted service',
    }).fullText;
    expect(text).toMatch(/accepted service and waived/i);
    expect(text).not.toMatch(/publication/i);
  });

  it("serviceMethod 'publication' + defaulted flag recites default AND the ad litem", () => {
    const text = new TexasDecree().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      groundsForDivorce: 'cruelty',
      isUncontested: false,
      serviceMethod: 'publication',
      respondentDefaulted: true,
    }).fullText;
    expect(text).toMatch(/served by publication .* made default/);
    expect(text).toMatch(/attorney ad litem was appointed/);
  });
});

// ── 7. Whereabouts-unknown respondent residence ───────────────────────────

describe('respondent residence clause handles unknown whereabouts', () => {
  it('missing address renders residence-unknown, never "resident of Unknown"', () => {
    const text = new TexasPetition().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      groundsForDivorce: 'insupportability',
      respondentAddress: undefined,
    }).fullText;
    expect(text).not.toMatch(/resident of Unknown/);
  });

  it('address containing "Unknown" is not dumped into a "resident of" clause', () => {
    const text = new TexasPetition().generateDocument({
      ...BASE_CASE,
      state: 'TX',
      county: 'Travis',
      groundsForDivorce: 'insupportability',
      respondentAddress: 'Unknown; possibly in Louisiana with his brother, no address available.',
    }).fullText;
    expect(text).not.toMatch(/is a resident of Unknown/);
    expect(text).toMatch(/resides at an address unknown/);
    expect(text).toMatch(/alternative service/i);
  });
});

// ── 8. Ontario parentTimeDetails rendered verbatim ────────────────────────

describe('Ontario decree parenting-time details render verbatim', () => {
  const PARENT_TIME = 'The Respondent shall have the child on alternate Fridays 6pm to Sundays 6pm, plus Wednesday dinners 5pm-8pm; the parties shall alternate the Christmas break and share the March Break equally.';

  it('renders the substantive parent-time schedule in the parenting-time order', () => {
    const text = new OntarioDecree().generateDocument({
      ...BASE_CASE,
      parentTimeDetails: PARENT_TIME,
    }).fullText;
    expect(text).toContain(PARENT_TIME);
    expect(text).not.toMatch(/failing agreement, in accordance with a parenting schedule to be filed with this Court\./);
  });

  it('no parentTimeDetails keeps the historical boilerplate clause', () => {
    const text = new OntarioDecree().generateDocument({ ...BASE_CASE }).fullText;
    expect(text).toMatch(/as agreed in writing by the parties/);
  });
});

// ── 8b. Separate property "Separate property:" prefix routing ────────────

describe('separate-property prefix routes items out of community estate', () => {
  const withSeparate = {
    ...BASE_CASE,
    state: 'CA',
    county: 'Alameda',
    petitionerName: 'Alison McPherson',
    respondentName: 'Devin McPherson',
    petitionerProperty: [
      'the 2019 Subaru Outback',
      'Separate property: $45,000 certificate of deposit inherited from Aunt Rita in 2018, held in Alison\'s sole name',
    ],
    respondentProperty: [
      'the Fidelity 401(k) account',
      'Separate property: the family cabin at 12 Lakeshore Rd, inherited from Devin\'s father in 2011',
    ],
    petitionerDebts: [
      'the joint Amex card, balance $6,400',
      'Separate debt: Alison\'s pre-marital SoFi student loan, balance $22,500',
    ],
  };

  it('California decree confirms separate items in the §2581 clause, not as community', () => {
    const doc = new CaliforniaDecree().generateDocument(withSeparate);
    const propText = doc.sections.propertyDivision.items.map((i) => i.content).join('\n');
    // Community award for Petitioner must include only the Subaru — the
    // inherited CD must NOT show up under "community property awarded to
    // Petitioner as that party's sole property".
    const petCommunityBlock = propText.split('community property is awarded to Respondent')[0];
    expect(petCommunityBlock).toContain('2019 Subaru Outback');
    expect(petCommunityBlock).not.toMatch(/certificate of deposit inherited from Aunt Rita/);
    // Separate confirmation clause names both parties' inherited items.
    expect(propText).toMatch(/confirmed as the separate property/i);
    expect(propText).toMatch(/Alison McPherson's separate property: \$45,000 certificate of deposit/);
    expect(propText).toMatch(/Devin McPherson's separate property: the family cabin/);
    // The "Separate property: " prefix itself must be stripped from the payload.
    expect(propText).not.toMatch(/separate property: Separate property:/i);
  });

  it('Texas decree confirms separate items under § 3.001, not as community', () => {
    const doc = new TexasDecree().generateDocument({
      ...withSeparate,
      state: 'TX',
      county: 'Travis',
      groundsForDivorce: 'insupportability',
    });
    const propText = doc.sections.propertyDivision.items.map((i) => i.content).join('\n');
    // Petitioner's community award: Subaru only, no inherited CD.
    const petCommunityBlock = propText.split(`${withSeparate.respondentName} is awarded`)[0];
    expect(petCommunityBlock).toContain('2019 Subaru Outback');
    expect(petCommunityBlock).not.toMatch(/certificate of deposit/);
    // Tex. Fam. Code § 3.001 confirmation clause with both items.
    expect(propText).toMatch(/§ 3\.001/);
    expect(propText).toMatch(/Alison McPherson's separate property:/);
    expect(propText).toMatch(/Devin McPherson's separate property:/);
  });

  it('base decree debt allocation splits "Separate debt:" out of community allocation', () => {
    const doc = new CaliforniaDecree().generateDocument(withSeparate);
    const debtText = doc.sections.debtAllocation.items.map((i) => i.content).join('\n');
    // The community Amex allocation is present; the SoFi separate loan is
    // confirmed separately, not lumped into Petitioner's community debt.
    expect(debtText).toMatch(/joint Amex/);
    expect(debtText).toMatch(/confirmed as the separate obligations/i);
    expect(debtText).toMatch(/Alison McPherson's separate debt: .*SoFi student loan/);
  });
});

// ── 9. Base decree spousal support: no data → no section ──────────────────

describe('base decree spousal support decision', () => {
  it('no spousal data renders no spousal section', () => {
    const template = new BaseDivorceDecreeTemplate();
    template.state = 'TX';
    template.stateName = 'Texas';
    const doc = template.generateDocument({
      state: 'TX',
      county: 'Travis',
      petitionerName: 'A',
      respondentName: 'B',
      caseNumber: '1',
      marriageDate: '2010-01-01',
    });
    expect(doc.sections.spousalSupport).toBeNull();
  });
});

// ── 10. Ontario respondent-perspective divorce_package renders a decree ──

describe('Ontario respondent flow still produces a real decree draft', () => {
  // v5 audit: for a Marcus-shape divorce_package where role='respondent',
  // the driver's findByType(/decree|order/) returned nothing on the saved
  // doc. The template contract (below) is that OntarioDecree.generateDocument
  // renders a full DIVORCE ORDER draft regardless of role — so any upstream
  // fix that wires the decree tab for respondents has a working renderer to
  // hand off to.
  const MARCUS_RESPONDENT = {
    state: 'ON',
    county: 'Toronto',
    role: 'respondent',
    // In respondent-perspective interviews the SPOUSE occupies the
    // Applicant caption side; the USER is the Respondent.
    petitionerName: 'Priya Reid',
    respondentName: 'Marcus Reid',
    caseNumber: 'FS-25-1234',
    marriageDate: '2010-08-15',
    separationDate: '2024-06-01',
    divorceDate: '2026-09-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [{ name: 'Kiran Reid', dob: '2014-03-11' }],
    custodyType: 'joint',
    serviceMethod: 'formal',
    serviceDate: '2025-06-24',
  };

  it('renders a non-empty DIVORCE ORDER draft for a respondent-role case', () => {
    const doc = new OntarioDecree().generateDocument(MARCUS_RESPONDENT);
    expect(doc).toBeDefined();
    expect(doc.fullText || '').toMatch(/DIVORCE ORDER/i);
    expect(doc.metadata?.documentTitle || '').toMatch(/Divorce Order/i);
    // documentType must match /decree|order/ so tab-lookups by type hit.
    expect(String(doc.documentType || '')).toMatch(/decree|order/i);
  });

  it('carries the core decretal sections (jurisdiction, dissolution, custody, finalOrders)', () => {
    const doc = new OntarioDecree().generateDocument(MARCUS_RESPONDENT);
    expect(doc.sections.caseCaption).toBeDefined();
    expect(doc.sections.jurisdiction).toBeDefined();
    expect(doc.sections.dissolution).toBeDefined();
    expect(doc.sections.childCustody).toBeDefined();
    expect(doc.sections.finalOrders).toBeDefined();
    // "MARCUS REID" appears on the Respondent line of the caption.
    expect(doc.sections.caseCaption.formatted).toMatch(/MARCUS REID/);
    // "PRIYA REID" occupies the Applicant caption side.
    expect(doc.sections.caseCaption.formatted).toMatch(/PRIYA REID[\s\S]*Applicant/);
  });
});
