/**
 * SAFETY: No fabricated dispositive findings from silent profiles.
 *
 * Attorney review (2026-08): base petition/decree templates were
 * rendering "each party waives ... spousal support", "no community or
 * marital property to be divided", and "no community debts to be
 * allocated" for cases whose profiles NEVER recorded those waivers.
 * A self-rep filer who filed those documents would irrevocably waive
 * property, debt, and support rights that were never discussed.
 *
 * Contract: NO waiver / nil-finding / release clause renders unless a
 * matching AFFIRMATIVE fact exists in the profile. When the profile is
 * silent, either omit the paragraph or render a visible "(Draft — ...)"
 * blank prompting the filer to confirm.
 */

'use strict';

const BaseDivorcePetitionTemplate = require('../../templates/core/BaseDivorcePetitionTemplate');
const BaseDivorceDecreeTemplate = require('../../templates/core/BaseDivorceDecreeTemplate');
const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');
const AlbertaDivorceDecreeTemplate = require('../../templates/states/alberta/DivorceDecreeTemplate');
const OntarioDivorceDecreeTemplate = require('../../templates/states/ontario/DivorceDecreeTemplate');

const WAIVER_PATTERN = /waiv(e|es|er|ing)|releases? any claim/i;
const NIL_PROPERTY_PATTERN = /no (community or marital|community|marital|family|net family) property/i;
const NIL_DEBTS_PATTERN = /no (community|marital) debts/i;
const NIL_EQUALIZATION_PATTERN = /no net family property to be equalized/i;

function baseCaseData(overrides = {}) {
  return {
    petitionerName: 'Sarah Test',
    respondentName: 'Marcus Test',
    petitionerFirstName: 'Sarah',
    petitionerLastName: 'Test',
    respondentFirstName: 'Marcus',
    respondentLastName: 'Test',
    state: 'TX',
    county: 'Travis',
    marriageDate: '2015-06-14',
    separationDate: '2024-08-01',
    caseNumber: 'D-1-FM-24-000001',
    groundsForDivorce: 'insupportability',
    hasMinorChildren: false,
    ...overrides,
  };
}

describe('SAFETY: no fabricated dispositive findings (base petition)', () => {
  const tpl = new BaseDivorcePetitionTemplate();

  test('silent profile: NO spousal-support waiver text renders anywhere', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });

  test('silent profile: spousalSupportRequested === false alone does NOT trigger waiver', () => {
    const doc = tpl.generateDocument(baseCaseData({
      spousalSupportRequested: false,
    }));
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });

  test('affirmative spousalSupportWaived === true DOES render the waiver text', () => {
    const doc = tpl.generateDocument(baseCaseData({
      spousalSupportWaived: true,
    }));
    expect(doc.fullText).toMatch(WAIVER_PATTERN);
    expect(doc.fullText).toMatch(/spousal maintenance\/alimony/i);
  });

  test('affirmative spousalSupportAgreed === true DOES render the waiver text', () => {
    const doc = tpl.generateDocument(baseCaseData({
      spousalSupportAgreed: true,
    }));
    expect(doc.fullText).toMatch(WAIVER_PATTERN);
  });

  test('silent profile: NO nil-property finding renders (Draft note only)', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).not.toMatch(NIL_PROPERTY_PATTERN);
  });

  test('hasProperty === false alone (silence-derived) renders a Draft note, not a nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({ hasProperty: false }));
    expect(doc.fullText).not.toMatch(NIL_PROPERTY_PATTERN);
    expect(doc.fullText).toMatch(/Draft — confirm/i);
    expect(doc.fullText).toMatch(/property/i);
  });

  test('hasProperty === false AND noPropertyConfirmed === true DOES render the nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({
      hasProperty: false,
      noPropertyConfirmed: true,
    }));
    expect(doc.fullText).toMatch(NIL_PROPERTY_PATTERN);
  });

  test('DRAFT top-of-document banner renders', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).toMatch(/^DRAFT — This document was prepared with an AI intake tool/);
    expect(doc.htmlContent).toMatch(/draft-banner/);
  });
});

describe('SAFETY: no fabricated dispositive findings (base decree)', () => {
  const tpl = new BaseDivorceDecreeTemplate();

  test('silent profile: NO spousal-support waiver text and NO section', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
    // spousalSupport section should be null / omitted for silent data
    expect(doc.sections.spousalSupport).toBeNull();
  });

  test('spousalSupportRequested === false alone does NOT trigger waiver', () => {
    const doc = tpl.generateDocument(baseCaseData({
      spousalSupportRequested: false,
    }));
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });

  test('spousalSupportWaived === true DOES render mutual-waiver order', () => {
    const doc = tpl.generateDocument(baseCaseData({
      spousalSupportWaived: true,
    }));
    expect(doc.fullText).toMatch(/each party waives and relinquishes any claim for spousal maintenance/i);
  });

  test('silent profile: NO "Court finds there is no property" text', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).not.toMatch(NIL_PROPERTY_PATTERN);
  });

  test('hasProperty === false alone renders a Draft note, not a nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({ hasProperty: false }));
    expect(doc.fullText).not.toMatch(NIL_PROPERTY_PATTERN);
    expect(doc.fullText).toMatch(/Draft — confirm/i);
  });

  test('hasProperty === false AND noPropertyConfirmed DOES render the nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({
      hasProperty: false,
      noPropertyConfirmed: true,
    }));
    expect(doc.fullText).toMatch(NIL_PROPERTY_PATTERN);
  });

  test('silent profile: NO "no community debts" nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).not.toMatch(NIL_DEBTS_PATTERN);
  });

  test('hasDebts === false alone renders a Draft note, not a nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({ hasDebts: false }));
    expect(doc.fullText).not.toMatch(NIL_DEBTS_PATTERN);
    expect(doc.fullText).toMatch(/Draft — confirm/i);
    expect(doc.fullText).toMatch(/debts/i);
  });

  test('hasDebts === false AND noDebtsConfirmed DOES render the nil finding', () => {
    const doc = tpl.generateDocument(baseCaseData({
      hasDebts: false,
      noDebtsConfirmed: true,
    }));
    expect(doc.fullText).toMatch(NIL_DEBTS_PATTERN);
  });

  test('DRAFT top-of-document banner renders', () => {
    const doc = tpl.generateDocument(baseCaseData());
    expect(doc.fullText).toMatch(/^DRAFT — This document was prepared with an AI intake tool/);
    expect(doc.htmlContent).toMatch(/draft-banner/);
  });
});

describe('SAFETY: Canadian-override subclasses do not fabricate either', () => {
  test('Alberta decree: silent profile renders NO family-property nil finding and NO waiver', () => {
    const tpl = new AlbertaDivorceDecreeTemplate();
    const doc = tpl.generateDocument(baseCaseData({ state: 'AB' }));
    expect(doc.fullText).not.toMatch(/no family property to be distributed/i);
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });

  test('Alberta decree: spousalSupportRequested === false alone does NOT trigger waiver', () => {
    const tpl = new AlbertaDivorceDecreeTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'AB',
      spousalSupportRequested: false,
    }));
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });

  test('Alberta decree: affirmative spousalSupportWaived DOES render waiver', () => {
    const tpl = new AlbertaDivorceDecreeTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'AB',
      spousalSupportWaived: true,
    }));
    expect(doc.fullText).toMatch(WAIVER_PATTERN);
  });

  test('Ontario decree: silent profile renders NO equalization nil finding and NO waiver', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const doc = tpl.generateDocument(baseCaseData({ state: 'ON' }));
    expect(doc.fullText).not.toMatch(NIL_EQUALIZATION_PATTERN);
    expect(doc.fullText).not.toMatch(WAIVER_PATTERN);
  });
});

describe('Texas petition: alternative insupportability plea when a fault ground is primary', () => {
  test('cruelty ground pleads §6.002 cruelty AND §6.001 insupportability alternative', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'TX',
      groundsForDivorce: 'cruelty',
    }));
    // §6.002 cruelty: "cruel treatment ... insupportable"
    expect(doc.fullText).toMatch(/cruel treatment/i);
    // §6.001 alternative plea explicitly cited
    expect(doc.fullText).toMatch(/§6\.001/);
    expect(doc.fullText).toMatch(/in the alternative/i);
    expect(doc.fullText).toMatch(/insupportab/i);
  });

  test('adultery ground also pleads §6.001 alternative', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'TX',
      groundsForDivorce: 'adultery',
    }));
    expect(doc.fullText).toMatch(/committed adultery/i);
    expect(doc.fullText).toMatch(/§6\.001/);
    expect(doc.fullText).toMatch(/in the alternative/i);
  });

  test('primary insupportability does NOT double-plead an alternative', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'TX',
      groundsForDivorce: 'insupportability',
    }));
    // Primary insupportability rendered; no alternative-plea sentence
    expect(doc.fullText).toMatch(/insupportab/i);
    expect(doc.fullText).not.toMatch(/in the alternative/i);
  });

  test('skipInsupportabilityAlt suppresses the alternative plea', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseCaseData({
      state: 'TX',
      groundsForDivorce: 'cruelty',
      skipInsupportabilityAlt: true,
    }));
    expect(doc.fullText).not.toMatch(/in the alternative/i);
  });
});
