/** @jest-environment node */
'use strict';

/**
 * georgia-petition-alt-service.test.js
 *
 * v19 replay: Amara's profile carried respondentAddressUnknown=true and
 * respondentSuspectedLocation="Alabama near Mobile", but the GA petition
 * dropped the "cannot swear" caveat. Fix mirrors the TX v7 override
 * (templates/states/texas/DivorcePetitionTemplate.js#getRespondentResidenceClause).
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    groundsForDivorce: 'irretrievably_broken',
    ...overrides,
  };
}

describe('Georgia petition — respondent residence / alternative service clause', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('address unknown + suspected location renders caveat', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Alabama near Mobile',
      })
    );
    expect(clause).toMatch(/address unknown/i);
    expect(clause).toMatch(/alternative service/i);
    expect(clause).toMatch(/has heard, but cannot swear, that Defendant may be in Alabama near Mobile/);
  });

  test('address unknown, no suspected location — bare alt-service clause, no bracketed follow-up', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({ respondentAddressUnknown: true })
    );
    expect(clause).toMatch(/address unknown/i);
    expect(clause).toMatch(/alternative service/i);
    expect(clause).not.toMatch(/cannot swear/);
    expect(clause).not.toMatch(/\(/);
  });

  test('known street address is sworn as residence', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({ respondentAddress: '123 Peachtree St, Atlanta, GA 30303' })
    );
    expect(clause).toBe('is a resident of 123 Peachtree St, Atlanta, GA 30303');
    expect(clause).not.toMatch(/alternative service/i);
    expect(clause).not.toMatch(/cannot swear/);
  });

  test('hedged free-text address falls back to alt-service, appends suspected note when supplied', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddress: 'No current address known; possibly in Alabama with his brother',
        respondentSuspectedLocation: 'Alabama near Mobile',
      })
    );
    expect(clause).toMatch(/address unknown/i);
    expect(clause).toMatch(/alternative service/i);
    expect(clause).toMatch(/cannot swear, that Defendant may be in Alabama near Mobile/);
    // The raw hedged free text must not survive into the sworn clause.
    expect(clause).not.toMatch(/possibly in Alabama with his brother/);
  });

  test('leading hedge on suspected location is stripped ("Possibly Alabama" -> "Alabama")', () => {
    const clause = petition.getRespondentResidenceClause(
      baseData({
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Possibly Alabama near Mobile',
      })
    );
    expect(clause).toMatch(/may be in Alabama near Mobile/);
    expect(clause).not.toMatch(/may be in Possibly/i);
  });

  test('empty respondentAddress + no unknown flag still triggers alt-service (defensive)', () => {
    const clause = petition.getRespondentResidenceClause(baseData({}));
    expect(clause).toMatch(/alternative service/i);
  });
});
