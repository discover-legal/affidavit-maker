/**
 * In-memory rate limiter — single-instance only. If the app ever scales to
 * multiple instances on Render, swap this for @upstash/ratelimit or similar.
 *
 * Keys on (bucket, ip-or-userId). Sliding window with `windowMs` size.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Map<string, Entry>>();
let lastSweepAt = 0;

const DEFAULT_MAX_BUCKETS = 128;
const DEFAULT_MAX_KEYS_PER_BUCKET = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sweepExpired(now: number): void {
  for (const [bucket, store] of buckets) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
    if (store.size === 0) buckets.delete(bucket);
  }
  lastSweepAt = now;
}

function evictOldest<K, V>(store: Map<K, V>): void {
  const oldest = store.keys().next();
  if (!oldest.done) store.delete(oldest.value);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  bucket: string,
  key: string | number,
  options: { max: number; windowMs: number },
): RateLimitResult {
  const stringKey = typeof key === 'number' ? String(key) : key;
  const now = Date.now();
  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) sweepExpired(now);

  let store = buckets.get(bucket);
  if (!store) {
    const maxBuckets = positiveIntegerEnv('RATE_LIMIT_MAX_BUCKETS', DEFAULT_MAX_BUCKETS);
    if (buckets.size >= maxBuckets) {
      sweepExpired(now);
      if (buckets.size >= maxBuckets) evictOldest(buckets);
    }
    store = new Map();
    buckets.set(bucket, store);
  }

  const existing = store.get(stringKey);
  if (!existing || existing.resetAt <= now) {
    if (existing) store.delete(stringKey);
    const maxKeys = positiveIntegerEnv(
      'RATE_LIMIT_MAX_KEYS_PER_BUCKET',
      DEFAULT_MAX_KEYS_PER_BUCKET,
    );
    if (store.size >= maxKeys) {
      for (const [storedKey, entry] of store) {
        if (entry.resetAt <= now) store.delete(storedKey);
      }
      if (store.size >= maxKeys) evictOldest(store);
    }
    const resetAt = now + options.windowMs;
    store.set(stringKey, { count: 1, resetAt });
    return { ok: true, remaining: options.max - 1, resetAt };
  }

  if (existing.count >= options.max) {
    // Refresh insertion order so eviction is least-recently-used rather than
    // simply least-recently-created.
    store.delete(stringKey);
    store.set(stringKey, existing);
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  store.delete(stringKey);
  store.set(stringKey, existing);
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
