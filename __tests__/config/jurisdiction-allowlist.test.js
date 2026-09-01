/** @jest-environment node */
'use strict';

// Regression test for JURISDICTION_ALLOWLIST env-var feature flag.
// The flag lets us launch narrow (ON + UT only) and expand progressively
// without touching template files. Overrides ENABLE_INTERNATIONAL.

describe('JURISDICTION_ALLOWLIST feature flag', () => {
  const originalAllow = process.env.JURISDICTION_ALLOWLIST;
  const originalIntl = process.env.ENABLE_INTERNATIONAL;

  afterEach(() => {
    if (originalAllow === undefined) delete process.env.JURISDICTION_ALLOWLIST;
    else process.env.JURISDICTION_ALLOWLIST = originalAllow;
    if (originalIntl === undefined) delete process.env.ENABLE_INTERNATIONAL;
    else process.env.ENABLE_INTERNATIONAL = originalIntl;
    jest.resetModules();
  });

  function loadConfig() {
    jest.resetModules();
    return require('../../config/jurisdictions');
  }

  test('unset allowlist + no international flag → NA_JURISDICTIONS pass, international rejected', () => {
    delete process.env.JURISDICTION_ALLOWLIST;
    delete process.env.ENABLE_INTERNATIONAL;
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('ON')).toBe(true);
    expect(isAllowedJurisdiction('UT')).toBe(true);
    expect(isAllowedJurisdiction('CA')).toBe(true);
    expect(isAllowedJurisdiction('ENG')).toBe(false);
    expect(isAllowedJurisdiction('NSW')).toBe(false);
  });

  test('allowlist=ON,UT → only ON and UT pass, ALL other NA + international rejected', () => {
    process.env.JURISDICTION_ALLOWLIST = 'ON,UT';
    delete process.env.ENABLE_INTERNATIONAL;
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('ON')).toBe(true);
    expect(isAllowedJurisdiction('UT')).toBe(true);
    // Other NA jurisdictions now BLOCKED
    expect(isAllowedJurisdiction('CA')).toBe(false);
    expect(isAllowedJurisdiction('TX')).toBe(false);
    expect(isAllowedJurisdiction('NY')).toBe(false);
    expect(isAllowedJurisdiction('AB')).toBe(false);
    expect(isAllowedJurisdiction('FL')).toBe(false);
    expect(isAllowedJurisdiction('GA')).toBe(false);
    // International still blocked
    expect(isAllowedJurisdiction('ENG')).toBe(false);
  });

  test('allowlist accepts lowercase, whitespace, and trailing commas', () => {
    process.env.JURISDICTION_ALLOWLIST = ' on , ut , ';
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('on')).toBe(true);
    expect(isAllowedJurisdiction('ON')).toBe(true);
    expect(isAllowedJurisdiction('ut')).toBe(true);
    expect(isAllowedJurisdiction('CA')).toBe(false);
  });

  test('allowlist=ON,UT overrides ENABLE_INTERNATIONAL=true (allowlist wins)', () => {
    process.env.JURISDICTION_ALLOWLIST = 'ON,UT';
    process.env.ENABLE_INTERNATIONAL = 'true';
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('ON')).toBe(true);
    expect(isAllowedJurisdiction('UT')).toBe(true);
    expect(isAllowedJurisdiction('ENG')).toBe(false);
    expect(isAllowedJurisdiction('CA')).toBe(false);
  });

  test('empty allowlist string is treated as unset', () => {
    process.env.JURISDICTION_ALLOWLIST = '';
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('CA')).toBe(true);
    expect(isAllowedJurisdiction('ON')).toBe(true);
  });

  test('whitespace-only allowlist is treated as unset', () => {
    process.env.JURISDICTION_ALLOWLIST = '  , , ';
    const { isAllowedJurisdiction } = loadConfig();
    expect(isAllowedJurisdiction('CA')).toBe(true);
  });

  test('activeJurisdictions returns the allowlist when set', () => {
    process.env.JURISDICTION_ALLOWLIST = 'ON,UT';
    const { activeJurisdictions } = loadConfig();
    const active = activeJurisdictions();
    expect(active.has('ON')).toBe(true);
    expect(active.has('UT')).toBe(true);
    expect(active.has('CA')).toBe(false);
    expect(active.size).toBe(2);
  });
});

describe('catalog-data getAllJurisdictions honors JURISDICTION_ALLOWLIST', () => {
  const originalAllow = process.env.JURISDICTION_ALLOWLIST;

  afterEach(() => {
    if (originalAllow === undefined) delete process.env.JURISDICTION_ALLOWLIST;
    else process.env.JURISDICTION_ALLOWLIST = originalAllow;
    jest.resetModules();
  });

  test('allowlist=ON,UT → getAllJurisdictions returns [ON, UT] only', () => {
    process.env.JURISDICTION_ALLOWLIST = 'ON,UT';
    jest.resetModules();
    const { getAllJurisdictions } = require('../../lib/api/catalog-data');
    const active = getAllJurisdictions();
    expect(active).toEqual(expect.arrayContaining(['ON', 'UT']));
    expect(active).not.toContain('CA');
    expect(active).not.toContain('TX');
    expect(active).not.toContain('NY');
    expect(active.length).toBe(2);
  });
});
