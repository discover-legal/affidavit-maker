/**
 * In-memory rate limiter — single-instance only. If the app ever scales to
 * multiple instances on Render, swap this for @upstash/ratelimit or similar.
 *
 * Keys on (bucket, ip-or-userId). Sliding window with `windowMs` size.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Map<string, Entry>>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  bucket: string,
  key: string,
  options: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  let store = buckets.get(bucket);
  if (!store) {
    store = new Map();
    buckets.set(bucket, store);
  }

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: options.max - 1, resetAt };
  }

  if (existing.count >= options.max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: options.max - existing.count, resetAt: existing.resetAt };
}

export const RATE_LIMITS = {
  standard: { max: 100, windowMs: 15 * 60 * 1000 },
  strict: { max: 20, windowMs: 15 * 60 * 1000 },
  chat: { max: 50, windowMs: 15 * 60 * 1000 },
  payment: { max: 5, windowMs: 60 * 60 * 1000 },
  pdf: { max: 10, windowMs: 60 * 60 * 1000 },
  auth: { max: 10, windowMs: 15 * 60 * 1000 },
} as const;
