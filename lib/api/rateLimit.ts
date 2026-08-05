import { query, withRLSBypass } from '@/lib/db';

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Map<string, Entry>>();
const MAX_KEYS_PER_BUCKET = 10_000;
let nextSweepAt = 0;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitOptions = {
  max: number;
  windowMs: number;
  /** Reject when the shared store is unavailable. Use for paid/provider-backed work. */
  failClosed?: boolean;
};

function localLimit(bucket: string, key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  if (now >= nextSweepAt) {
    nextSweepAt = now + 60_000;
    for (const [name, store] of buckets) {
      for (const [storedKey, entry] of store) {
        if (entry.resetAt <= now) store.delete(storedKey);
      }
      if (!store.size) buckets.delete(name);
    }
  }
  let store = buckets.get(bucket);
  if (!store) {
    store = new Map();
    buckets.set(bucket, store);
  }
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    if (!entry && store.size >= MAX_KEYS_PER_BUCKET) {
      const oldest = store.keys().next().value as string | undefined;
      if (oldest) store.delete(oldest);
    }
    entry = { count: 1, resetAt: now + options.windowMs };
    store.set(key, entry);
  } else {
    entry.count += 1;
  }
  return {
    ok: entry.count <= options.max,
    remaining: Math.max(0, options.max - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Atomic, PostgreSQL-backed fixed-window limiter shared by every application
 * instance. The bounded in-process fallback keeps read-only endpoints available
 * during a transient database outage; provider-backed endpoints fail closed.
 */
export async function checkRateLimit(
  bucket: string,
  key: string | number,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const normalizedKey = String(key).slice(0, 200);
  try {
    const result = await withRLSBypass(() => query<{ count: number; reset_at: Date }>(
      `INSERT INTO api_rate_limits (bucket, subject_key, count, reset_at)
       VALUES ($1, $2, 1, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'))
       ON CONFLICT (bucket, subject_key) DO UPDATE SET
         count = CASE
           WHEN api_rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1
           ELSE api_rate_limits.count + 1
         END,
         reset_at = CASE
           WHEN api_rate_limits.reset_at <= CURRENT_TIMESTAMP
             THEN CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond')
           ELSE api_rate_limits.reset_at
         END
       RETURNING count, reset_at`,
      [bucket.slice(0, 100), normalizedKey, options.windowMs],
    ));
    const row = result.rows[0];
    const count = Number(row.count);
    return {
      ok: count <= options.max,
      remaining: Math.max(0, options.max - count),
      resetAt: new Date(row.reset_at).getTime(),
    };
  } catch (error) {
    console.error('Shared rate limiter unavailable', {
      bucket,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    if (options.failClosed) {
      return { ok: false, remaining: 0, resetAt: Date.now() + options.windowMs };
    }
    return localLimit(bucket, normalizedKey, options);
  }
}

export const RATE_LIMITS = {
  standard: { max: 100, windowMs: 15 * 60 * 1000 },
  strict: { max: 20, windowMs: 15 * 60 * 1000 },
  chat: { max: 50, windowMs: 15 * 60 * 1000, failClosed: true },
  chatDaily: { max: 250, windowMs: 24 * 60 * 60 * 1000, failClosed: true },
  payment: { max: 10, windowMs: 60 * 60 * 1000, failClosed: true },
  pdf: { max: 10, windowMs: 60 * 60 * 1000, failClosed: true },
  pdfDaily: { max: 40, windowMs: 24 * 60 * 60 * 1000, failClosed: true },
  auth: { max: 10, windowMs: 15 * 60 * 1000 },
} as const;
