/** @jest-environment node */
/**
 * Round-7 attorney (Marcus ON, 2026-08-30 v30b): the ON decree appearances
 * section defaulted to "appeared self-represented" whenever
 * petitionerRepresentation was not affirmatively 'lawyer'/'attorney' —
 * but a missing field is NOT evidence of self-representation. Marcus's
 * Priya (his ex-wife, the Applicant) never said she was self-representing;
 * putting her on record as such is fabrication. Also verifies the
 * property-section safety gate no longer treats propertyAgreement='pending'
 * (a status marker meaning parties have NOT yet agreed) as a described
 * agreement — that path used to render the "no NFP to be equalized" finding,
 * silently waiving the equalization claim.
 */

'use strict';

const OntarioDivorceDecreeTemplate = require('../../templates/states/ontario/DivorceDecreeTemplate');

function build(overrides = {}) {
  const t = new OntarioDivorceDecreeTemplate();
  return t.generateDocument({
    role: 'respondent',
    state: 'ON',
    county: 'Toronto',
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    affiantName: 'Marcus Thompson',
    marriageDate: '2013-08-03',
    marriageLocation: 'Toronto, ON',
    separationDate: '2025-01-01',
    groundsForDivorce: 'breakdown_of_marriage',
    hasMinorChildren: true,
    children: [
      { name: 'Ava', birthDate: '2016-03-01' },
      { name: 'Ethan', birthDate: '2019-09-01' },
    ],
    ...overrides,
  });
}

function appearanceText(decree) {
  const app = decree && decree.sections && decree.sections.appearances;
  return app && app.text ? app.text : '';
}

function propertyItems(decree) {
  const prop = decree && decree.sections && decree.sections.propertyDivision;
  return (prop && prop.items) || [];
}

describe('Ontario decree — no fabricated appearance / property waiver', () => {
  test('missing petitionerRepresentation renders a Draft note, NOT "self-represented"', () => {
    const decree = build();
    const text = appearanceText(decree);
    // The affirmative recital ("Priya Thompson, appeared self-represented.")
    // must not surface — but the Draft-note enumeration of options may
    // mention it as one of the choices. Assert the recital shape is absent.
    expect(text).not.toMatch(/Thompson,\s+appeared self-represented/i);
    expect(text).toMatch(/Draft.*confirm representation/i);
  });

  test('explicit petitionerRepresentation="lawyer" renders the lawyer-of-record clause', () => {
    const decree = build({ petitionerRepresentation: 'lawyer' });
    const text = appearanceText(decree);
    expect(text).toMatch(/appeared by and through a lawyer of record/);
    expect(text).not.toMatch(/Draft/);
  });

  test('explicit petitionerRepresentation="self" renders the self-represented clause', () => {
    const decree = build({ petitionerRepresentation: 'self' });
    const text = appearanceText(decree);
    expect(text).toMatch(/appeared self-represented/i);
    expect(text).not.toMatch(/Draft/);
  });

  test('propertyAgreement="pending" no longer counts as described — renders Draft note, not "no NFP" finding', () => {
    const decree = build({ hasProperty: false, propertyAgreement: 'pending' });
    const items = propertyItems(decree);
    const text = items.map((i) => i.content || '').join('\n');
    expect(text).not.toMatch(/no net family property to be equalized/i);
    expect(text).toMatch(/Draft.*net family property.*before filing/is);
  });

  test('propertyAgreement="contested" also no longer waives equalization', () => {
    const decree = build({ hasProperty: false, propertyAgreement: 'contested' });
    const items = propertyItems(decree);
    const text = items.map((i) => i.content || '').join('\n');
    expect(text).not.toMatch(/no net family property to be equalized/i);
  });

  test('propertyAgreement="agreed" + hasProperty:false still emits the confirmed nil finding', () => {
    const decree = build({ hasProperty: false, propertyAgreement: 'agreed' });
    const items = propertyItems(decree);
    const text = items.map((i) => i.content || '').join('\n');
    expect(text).toMatch(/no net family property to be equalized/i);
  });

  test('noPropertyConfirmed=true + hasProperty:false emits the confirmed nil finding', () => {
    const decree = build({ hasProperty: false, noPropertyConfirmed: true });
    const items = propertyItems(decree);
    const text = items.map((i) => i.content || '').join('\n');
    expect(text).toMatch(/no net family property to be equalized/i);
  });
});
