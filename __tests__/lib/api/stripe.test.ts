/** @jest-environment node */

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
