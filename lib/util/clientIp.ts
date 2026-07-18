import type { NextRequest } from 'next/server';

/**
 * Resolve the trusted client IP for the current request.
 *
 * THREAT MODEL
 * ────────────
 * `X-Forwarded-For` is set by every hop in front of the app. The convention
 * (Render, AWS ALB, Cloudflare, GCP LB, …) is that each proxy *appends* the
 * peer IP it saw, so the header reads:
 *
 *     X-Forwarded-For: <client supplied …>, <edge proxy peer IP>
 *
 * Taking the LEFTMOST value (`split(',')[0]`) returns the value the client
 * supplied — which is attacker-controlled. The previous helpers used that
 * shape, which made every IP-keyed rate limit trivially bypassable by
 * rotating spoofed prefixes. See SECURITY audit C-3 / H-1 (May 2026).
 *
 * The RIGHTMOST value of XFF is used for the default direct-Render
 * deployment. Platform-specific headers are ignored unless that provider is
 * explicitly configured; otherwise clients reaching Render directly could
 * forge them.
 *
 * `TRUSTED_PROXY_HOPS` — how many proxies are between us and the public
 * internet. On Render: 1. If you ever go behind Cloudflare AS WELL, set
 * `TRUSTED_PROXY_HOPS=2`. The function steps that many entries in from the
 * right when reading XFF.
 *
 * Returns `null` when we cannot determine a trusted IP. Callers should
 * treat null as "no IP available" — fall back to a less-spoofable key
 * (e.g. the authenticated user id) or refuse the request.
 */

export type ClientIpOptions = {
  /** Override the trusted-hop count (defaults to env var or 1). */
  trustedHops?: number;
  /** Override the deployment provider (defaults to TRUSTED_PROXY_PROVIDER or render). */
  provider?: 'render' | 'cloudflare' | 'akamai' | 'fly' | 'generic';
};

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^127\./,
  /^::1$/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isLikelyIp(value: string): boolean {
  // Strip surrounding whitespace and optional `:port` from IPv4-mapped or
  // `IP:port` shapes. IPv6 is bracketed (`[::1]:80`) so we only strip the
  // suffix when there's exactly one `:`.
  const cleaned = value.replace(/^\[|\]$/g, '');
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}(?::\d+)?$/.test(cleaned)) return true;
  // IPv6 (very loose — pg's inet validation owns the canonical form)
  if (/^[0-9a-f:]+$/i.test(cleaned) && cleaned.includes(':')) return true;
  return false;
}

function normalize(value: string): string {
  return value.trim().replace(/^\[|\]$/g, '').replace(/:\d+$/, (m) => {
    // For IPv4:port, drop the port. For pure IPv6 (`::1`), leave it alone.
    const colons = (value.match(/:/g) ?? []).length;
    return colons === 1 ? '' : m;
  });
}

function resolveTrustedHops(opts?: ClientIpOptions): number {
  if (opts?.trustedHops && opts.trustedHops > 0) return opts.trustedHops;
  const env = Number(process.env.TRUSTED_PROXY_HOPS);
  if (Number.isFinite(env) && env > 0) return env;
  return 1;
}

function resolveProvider(opts?: ClientIpOptions): ClientIpOptions['provider'] {
  if (opts?.provider) return opts.provider;
  const configured = process.env.TRUSTED_PROXY_PROVIDER?.toLowerCase();
  if (
    configured === 'cloudflare' ||
    configured === 'akamai' ||
    configured === 'fly' ||
    configured === 'generic'
  ) {
    return configured;
  }
  // Production is deployed directly behind Render. In particular, do not
  // trust CDN/provider headers by default: a client can send those itself to
  // a Render origin unless that provider is the configured ingress.
  return 'render';
}

/**
 * Get the trusted client IP (or null).
 *
 * Trust is deployment-specific. Render (the default) uses the N-th-from-right
 * value of `x-forwarded-for`, where N = trusted
 *      hops. With one hop the rightmost value is the edge's peer (= the
 *      client). With two hops we step in one more, etc.
 * Platform-specific single-value headers are considered only when
 * TRUSTED_PROXY_PROVIDER explicitly names that platform.
 *
 * The function refuses values that don't parse as an IP, and refuses
 * RFC1918 / loopback values unless `NODE_ENV !== 'production'` (in
 * development the loopback is the legitimate peer).
 */
export function getClientIp(req: NextRequest | Request, opts?: ClientIpOptions): string | null {
  const headers = 'headers' in req ? req.headers : new Headers();
  const provider = resolveProvider(opts);

  const providerHeader =
    provider === 'cloudflare'
      ? 'cf-connecting-ip'
      : provider === 'akamai'
        ? 'true-client-ip'
        : provider === 'fly'
          ? 'fly-client-ip'
          : null;
  if (providerHeader) {
    const value = headers.get(providerHeader);
    if (value) {
      const norm = normalize(value);
      if (isLikelyIp(norm)) return norm;
    }
  }

  // Render and generic reverse proxies use XFF with trusted-hop arithmetic.
  // Do not fall back to XFF for explicitly configured CDN providers: doing so
  // would silently weaken a missing/stripped provider-header deployment.
  if (provider === 'render' || provider === 'generic') {
    const xff = headers.get('x-forwarded-for');
    if (xff) {
      const parts = xff
        .split(',')
        .map((p) => normalize(p))
        .filter((p) => p.length > 0);
      if (parts.length > 0) {
        const hops = resolveTrustedHops(opts);
        const idx = Math.max(0, parts.length - hops);
        const candidate = parts[idx];
        if (isLikelyIp(candidate)) {
          if (process.env.NODE_ENV !== 'production') return candidate;
          if (!PRIVATE_RANGES.some((r) => r.test(candidate))) return candidate;
        }
      }
    }
  }

  // x-real-ip is accepted only for an explicitly configured generic proxy.
  if (provider === 'generic') {
    const value = headers.get('x-real-ip');
    if (value) {
      const norm = normalize(value);
      if (isLikelyIp(norm)) {
        if (process.env.NODE_ENV !== 'production') return norm;
        if (!PRIVATE_RANGES.some((r) => r.test(norm))) return norm;
      }
    }
  }

  return null;
}

/**
 * Convenience wrapper for rate-limit keys. Returns a stable string for
 * `checkRateLimit` even when no IP is resolvable, but bins all of those
 * requests into a single high-cost bucket so the limit fires fast for
 * misbehaving clients. The label is included so different routes don't
 * share the no-IP bucket.
 */
export function rateLimitKey(req: NextRequest | Request, label: string): string {
  const ip = getClientIp(req);
  if (ip) return `ip:${ip}`;
  return `noip:${label}`;
}
