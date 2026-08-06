/** @jest-environment node */

describe('paymentsEnabled', () => {
  const originalFlag = process.env.PAYMENTS_ENABLED;

  afterEach(() => {
    jest.resetModules();
    if (originalFlag === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = originalFlag;
  });

  it('defaults OFF — the product is free unless charging is re-armed', async () => {
    delete process.env.PAYMENTS_ENABLED;
    const { paymentsEnabled } = await import('@/lib/api/stripe');
    expect(paymentsEnabled()).toBe(false);
  });

  it('arms only on the explicit string true', async () => {
    process.env.PAYMENTS_ENABLED = 'true';
    let mod = await import('@/lib/api/stripe');
    expect(mod.paymentsEnabled()).toBe(true);

    jest.resetModules();
    process.env.PAYMENTS_ENABLED = '1';
    mod = await import('@/lib/api/stripe');
    expect(mod.paymentsEnabled()).toBe(false);
  });
});

describe('getStripe', () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalOptIn = process.env.ALLOW_LIVE_STRIPE_IN_NONPRODUCTION;

  afterEach(() => {
    jest.resetModules();
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalOptIn === undefined) delete process.env.ALLOW_LIVE_STRIPE_IN_NONPRODUCTION;
    else process.env.ALLOW_LIVE_STRIPE_IN_NONPRODUCTION = originalOptIn;
  });

  it('returns null when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import('@/lib/api/stripe');
    expect(getStripe()).toBeNull();
  });

  it('rejects live keys outside production unless explicitly enabled', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_synthetic_test_value';
    delete process.env.ALLOW_LIVE_STRIPE_IN_NONPRODUCTION;
    const { getStripe } = await import('@/lib/api/stripe');

    expect(() => getStripe()).toThrow(
      'Payments are disabled in this non-production environment because a live Stripe key is configured',
    );
  });

  it('accepts test keys outside production', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_test_value';
    const { getStripe } = await import('@/lib/api/stripe');
    expect(getStripe()).not.toBeNull();
  });
});
