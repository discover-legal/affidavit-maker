/** @jest-environment node */

describe('in-memory rate limiter bounds', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      RATE_LIMIT_MAX_BUCKETS: '2',
      RATE_LIMIT_MAX_KEYS_PER_BUCKET: '2',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('evicts the least-recently-used key when a bucket reaches its cap', async () => {
    const { checkRateLimit } = await import('@/lib/api/rateLimit');
    const options = { max: 2, windowMs: 60_000 };

    expect(checkRateLimit('api', 'first', options).remaining).toBe(1);
    expect(checkRateLimit('api', 'second', options).remaining).toBe(1);
    // Touch first, making second the least-recently-used entry.
    expect(checkRateLimit('api', 'first', options).remaining).toBe(0);
    expect(checkRateLimit('api', 'third', options).remaining).toBe(1);
    // second was evicted, so it starts with a fresh allowance.
    expect(checkRateLimit('api', 'second', options).remaining).toBe(1);
  });

  it('bounds the number of named buckets', async () => {
    const { checkRateLimit } = await import('@/lib/api/rateLimit');
    const options = { max: 2, windowMs: 60_000 };

    checkRateLimit('first', 'ip', options);
    checkRateLimit('second', 'ip', options);
    checkRateLimit('third', 'ip', options);
    // The oldest bucket was evicted rather than allowing unbounded growth.
    expect(checkRateLimit('first', 'ip', options).remaining).toBe(1);
  });
});
