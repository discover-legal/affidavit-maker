/**
 * Attorney round-2 replay guard (2026-08): the base divorce petition
 * must NOT fire the "resides at an address unknown … will request
 * alternative service" hedge whenever the case data merely lacks a
 * respondent address, or when the address IS known. That hedge is a
 * sworn allegation and may render ONLY on an affirmative signal —
 * `respondentAddressUnknown === true`, or an empty address paired
 * with a `respondentSuspectedLocation` the petitioner can't swear to.
 *
 * The regression: Alison's petition (Julian in Reno, NV) and
 * Tavita's petition (respondent's whereabouts clearly known in the
 * transcript) both rendered the unknown-address branch because the
 * old base clause fell through to alt-service on any missing raw
 * address.
 */

const BaseDivorcePetitionTemplate = require('../../templates/core/BaseDivorcePetitionTemplate');

function renderParties(data) {
  const tpl = new BaseDivorcePetitionTemplate();
  tpl.state = 'CA';
  tpl.stateName = 'California';
  const section = tpl.generatePartiesSection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

const UNKNOWN_HEDGE = /resides at an address unknown/i;

describe('BaseDivorcePetitionTemplate — respondent residence hedging', () => {
  test('known respondent address renders "is a resident of <address>" without unknown-address hedge', () => {
    const { body } = renderParties({
      petitionerName: 'Alison Miller',
      respondentName: 'Julian Miller',
      respondentAddress: 'Reno, NV',
    });
    expect(body).toContain('is a resident of Reno, NV');
    expect(body).not.toMatch(UNKNOWN_HEDGE);
    expect(body).not.toMatch(/or if not, resides at an address unknown/i);
  });

  test('respondentAddressUnknown=true fires the alt-service unknown-address branch', () => {
    const { body } = renderParties({
      petitionerName: 'Amara Jones',
      respondentName: 'DJ Jones',
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Alabama',
    });
    expect(body).toMatch(UNKNOWN_HEDGE);
    expect(body).toContain('will request alternative service');
  });

  test('missing address without unknown flag emits a Draft-note blank, not a fabricated hedge', () => {
    const { body } = renderParties({
      petitionerName: 'Tavita Sio',
      respondentName: 'Marco Sio',
      // no respondentAddress, no respondentAddressUnknown flag,
      // no respondentSuspectedLocation
    });
    expect(body).not.toMatch(UNKNOWN_HEDGE);
    expect(body).not.toMatch(/or if not, resides at an address unknown/i);
    // Blank + Draft note the filer must complete before filing.
    expect(body).toMatch(/resides at _+/);
    expect(body).toMatch(/\(Draft —/);
  });
});
