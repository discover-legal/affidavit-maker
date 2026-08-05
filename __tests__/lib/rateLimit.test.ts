/** @jest-environment node */

import { checkRateLimit } from '../../lib/api/rateLimit';
import { query } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  query: jest.fn().mockRejectedValue(new Error('database unavailable')),
  withRLSBypass: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

describe('rate limiter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the atomic shared counter result', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ count: 2, reset_at: new Date('2026-01-01T00:01:00Z') }],
    });
    const result = await checkRateLimit('unit-shared', 'key', {
      max: 2,
      windowMs: 60_000,
    });
    expect(result).toEqual({
      ok: true,
      remaining: 0,
      resetAt: new Date('2026-01-01T00:01:00Z').getTime(),
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (bucket, subject_key) DO UPDATE'),
      ['unit-shared', 'key', 60_000],
    );
  });

  it('blocks a key after the configured maximum', async () => {
    const options = { max: 2, windowMs: 60_000 };
    expect((await checkRateLimit('unit-limit', 'key', options)).ok).toBe(true);
    expect((await checkRateLimit('unit-limit', 'key', options)).ok).toBe(true);
    expect((await checkRateLimit('unit-limit', 'key', options)).ok).toBe(false);
  });

  it('starts a fresh window after expiry', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const options = { max: 1, windowMs: 1_000 };
    expect((await checkRateLimit('unit-expiry', 'key', options)).ok).toBe(true);
    expect((await checkRateLimit('unit-expiry', 'key', options)).ok).toBe(false);
    jest.advanceTimersByTime(1_001);
    expect((await checkRateLimit('unit-expiry', 'key', options)).ok).toBe(true);
    jest.useRealTimers();
  });

  it('fails closed for costly work when the shared store is unavailable', async () => {
    const result = await checkRateLimit('unit-costly', 'key', {
      max: 10,
      windowMs: 60_000,
      failClosed: true,
    });
    expect(result.ok).toBe(false);
  });
});
