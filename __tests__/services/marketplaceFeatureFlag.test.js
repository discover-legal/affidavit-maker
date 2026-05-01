'use strict';

/**
 * Marketplace feature-flag and security regression tests.
 *
 * Covers:
 *   1. ENABLE_MARKETPLACE gate on every public service method.
 *   2. ReDoS defence in DynamicOrchestrator.
 *   3. Path-traversal defence in OrchestratorFactory._loadStatic.
 *   4. Price and jurisdiction validation in MarketplaceService.
 *   5. Sort whitelist enforcement (no SQL injection through ORDER BY).
 */

const features = require('../../config/features');

describe('config/features', () => {
  const ORIG = process.env.ENABLE_MARKETPLACE;

  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENABLE_MARKETPLACE;
    else process.env.ENABLE_MARKETPLACE = ORIG;
    delete process.env.MARKETPLACE_AUTO_APPROVE;
  });

  test('isMarketplaceEnabled is false by default', () => {
    delete process.env.ENABLE_MARKETPLACE;
    expect(features.isMarketplaceEnabled()).toBe(false);
  });

  test('isMarketplaceEnabled requires exactly the string "true"', () => {
    for (const v of ['1', 'TRUE', 'yes', 'on', '']) {
      process.env.ENABLE_MARKETPLACE = v;
      expect(features.isMarketplaceEnabled()).toBe(false);
    }
    process.env.ENABLE_MARKETPLACE = 'true';
    expect(features.isMarketplaceEnabled()).toBe(true);
  });

  test('isMarketplaceAutoApprove requires both flags to be true', () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    process.env.MARKETPLACE_AUTO_APPROVE = 'true';
    expect(features.isMarketplaceAutoApprove()).toBe(true);

    process.env.ENABLE_MARKETPLACE = 'false';
    expect(features.isMarketplaceAutoApprove()).toBe(false);
  });

  test('assertEnabled throws AuthorizationError when off', () => {
    delete process.env.ENABLE_MARKETPLACE;
    expect(() => features.assertEnabled('ENABLE_MARKETPLACE'))
      .toThrow(/not enabled/);
  });

  test('requireFlag middleware returns 404 when off', () => {
    delete process.env.ENABLE_MARKETPLACE;
    const mw = features.requireFlag('ENABLE_MARKETPLACE');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    mw({}, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireFlag middleware passes when on', () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const mw = features.requireFlag('ENABLE_MARKETPLACE');
    const next = jest.fn();
    mw({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('MarketplaceService gating + validation', () => {
  const MarketplaceService = require('../../services/MarketplaceService');
  const ORIG = process.env.ENABLE_MARKETPLACE;
  const fakePool = { query: jest.fn() };

  beforeEach(() => fakePool.query.mockReset());
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENABLE_MARKETPLACE;
    else process.env.ENABLE_MARKETPLACE = ORIG;
  });

  test('every public method throws when marketplace is disabled', async () => {
    delete process.env.ENABLE_MARKETPLACE;
    const svc = new MarketplaceService(fakePool);
    const methods = [
      ['createTemplate', ['u1', { title: 'x'.repeat(5), matterType: 'divorce', jurisdictions: ['TX'] }]],
      ['getTemplate', ['t1']],
      ['getTemplateBySlug', ['s']],
      ['updateTemplate', ['t1', 'u1', { title: 'x'.repeat(5) }]],
      ['deleteTemplate', ['t1', 'u1']],
      ['publishTemplate', ['t1', 'u1']],
      ['unpublishTemplate', ['t1', 'u1']],
      ['duplicateTemplate', ['t1', 'u1']],
      ['searchTemplates', [{}]],
      ['getFeaturedTemplates', []],
      ['getTrendingTemplates', []],
      ['getNewTemplates', []],
      ['getCategories', []],
      ['getLawyerTemplates', ['u1']],
      ['getLawyerDashboardSummary', ['u1']],
      ['trackView', ['t1']],
      ['trackDetailView', ['t1']],
    ];
    for (const [name, args] of methods) {
      await expect(svc[name](...args)).rejects.toMatchObject({ errorType: 'authorization_error' });
    }
    expect(fakePool.query).not.toHaveBeenCalled();
  });

  test('searchTemplates rejects unknown sortBy values (no SQL injection)', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const svc = new MarketplaceService(fakePool);
    await expect(svc.searchTemplates({ sortBy: 'mt.id; DROP TABLE marketplace_templates; --' }))
      .rejects.toThrow(/Invalid sortBy/);
    expect(fakePool.query).not.toHaveBeenCalled();
  });

  test('createTemplate rejects unknown jurisdictions', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const svc = new MarketplaceService(fakePool);
    // _assertLawyerRole needs to pass, mock that lookup
    fakePool.query.mockResolvedValueOnce({ rows: [{ user_role: 'lawyer' }] });
    await expect(svc.createTemplate('u1', {
      title: 'My Template',
      matterType: 'divorce',
      jurisdictions: ['XX'], // not a real jurisdiction
    })).rejects.toThrow(/Invalid jurisdiction code/);
  });

  test('createTemplate rejects negative price', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const svc = new MarketplaceService(fakePool);
    fakePool.query.mockResolvedValueOnce({ rows: [{ user_role: 'lawyer' }] });
    await expect(svc.createTemplate('u1', {
      title: 'My Template',
      matterType: 'divorce',
      jurisdictions: ['TX'],
      priceCents: -100,
    })).rejects.toThrow(/priceCents must be an integer/);
  });

  test('createTemplate rejects price above ceiling', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const svc = new MarketplaceService(fakePool);
    fakePool.query.mockResolvedValueOnce({ rows: [{ user_role: 'lawyer' }] });
    await expect(svc.createTemplate('u1', {
      title: 'My Template',
      matterType: 'divorce',
      jurisdictions: ['TX'],
      priceCents: 999_999_999_999,
    })).rejects.toThrow(/priceCents must be an integer/);
  });

  test('_assertLawyerRole rejects non-lawyer users', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const svc = new MarketplaceService(fakePool);
    fakePool.query.mockResolvedValueOnce({ rows: [{ user_role: 'client' }] });
    await expect(svc.createTemplate('u1', {
      title: 'My Template',
      matterType: 'divorce',
      jurisdictions: ['TX'],
    })).rejects.toMatchObject({ errorType: 'authorization_error' });
  });
});

describe('DynamicOrchestrator ReDoS defence', () => {
  const ORIG = process.env.ENABLE_MARKETPLACE;

  beforeAll(() => { process.env.ENABLE_MARKETPLACE = 'true'; });
  afterAll(() => {
    if (ORIG === undefined) delete process.env.ENABLE_MARKETPLACE;
    else process.env.ENABLE_MARKETPLACE = ORIG;
  });

  const DynamicOrchestrator = require('../../services/DynamicOrchestrator');

  test('placeholder tokens with non-identifier chars are not replaced', () => {
    const out = DynamicOrchestrator._resolvePlaceholders(
      'a {{stateName}} b {{a+b}} c {{state-name}} d',
      { stateName: 'Texas', 'a+b': 'evil', 'state-name': 'evil' }
    );
    expect(out).toBe('a Texas b {{a+b}} c {{state-name}} d');
  });

  test('placeholder replacement ignores prototype keys', () => {
    const repl = { stateName: 'Texas' };
    const out = DynamicOrchestrator._resolvePlaceholders('{{toString}} {{constructor}}', repl);
    expect(out).toBe('{{toString}} {{constructor}}');
  });

  test('matches operator rejects long patterns', () => {
    const result = DynamicOrchestrator.evaluateCondition(
      { field: 'x', operator: 'matches', value: 'a'.repeat(500) },
      { x: 'aaa' }
    );
    expect(result).toBe(false);
  });

  test('matches operator caps input size (ReDoS protection)', () => {
    const start = Date.now();
    const result = DynamicOrchestrator.evaluateCondition(
      { field: 'x', operator: 'matches', value: '(a+)+b' },
      { x: 'a'.repeat(5000) } // > MAX_REGEX_INPUT
    );
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });

  test('matches operator works on legitimate input', () => {
    expect(DynamicOrchestrator.evaluateCondition(
      { field: 'name', operator: 'matches', value: '^Joe' },
      { name: 'Joe Smith' }
    )).toBe(true);
  });

  test('constructor refuses to instantiate when marketplace is disabled', () => {
    delete process.env.ENABLE_MARKETPLACE;
    expect(() => new DynamicOrchestrator(
      { matterTypeCode: 'divorce', phases: { intro: { prompt: 'x' } } },
      'tpl-1'
    )).toThrow(/not enabled/);
    process.env.ENABLE_MARKETPLACE = 'true';
  });
});

describe('OrchestratorFactory path-traversal defence', () => {
  const ORIG = process.env.ENABLE_MARKETPLACE;
  beforeAll(() => { process.env.ENABLE_MARKETPLACE = 'true'; });
  afterAll(() => {
    if (ORIG === undefined) delete process.env.ENABLE_MARKETPLACE;
    else process.env.ENABLE_MARKETPLACE = ORIG;
  });

  const OrchestratorFactory = require('../../services/OrchestratorFactory');

  test('rejects state codes with path-traversal sequences', async () => {
    const f = new OrchestratorFactory({ query: () => Promise.resolve({ rows: [] }) });
    for (const stateCode of ['../../etc/passwd', '..\\..\\config', '/etc', 'TX/../']) {
      const result = await f.getOrchestrator({ matterTypeCode: 'divorce', stateCode });
      expect(result).toBeNull();
    }
  });

  test('rejects non-whitelisted state codes (e.g. ZZ)', async () => {
    const f = new OrchestratorFactory({ query: () => Promise.resolve({ rows: [] }) });
    expect(await f.getOrchestrator({ matterTypeCode: 'divorce', stateCode: 'ZZ' })).toBeNull();
  });

  test('rejects __proto__ as a matterTypeCode', async () => {
    const f = new OrchestratorFactory({ query: () => Promise.resolve({ rows: [] }) });
    expect(await f.getOrchestrator({ matterTypeCode: '__proto__', stateCode: 'TX' })).toBeNull();
    expect(await f.getOrchestrator({ matterTypeCode: 'constructor', stateCode: 'TX' })).toBeNull();
  });

  test('returns null for marketplaceTemplateId when feature is disabled', async () => {
    delete process.env.ENABLE_MARKETPLACE;
    const f = new OrchestratorFactory({ query: () => Promise.resolve({ rows: [] }) });
    expect(await f.getOrchestrator({ marketplaceTemplateId: 'abc' })).toBeNull();
    process.env.ENABLE_MARKETPLACE = 'true';
  });

  test('legitimate matterTypeCode loads the orchestrator', async () => {
    const f = new OrchestratorFactory({ query: () => Promise.resolve({ rows: [] }) });
    const mod = await f.getOrchestrator({ matterTypeCode: 'custody' });
    expect(mod).toBeTruthy();
  });
});
