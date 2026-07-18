/**
 * @jest-environment node
 *
 * Regression tests for the trusted client-IP resolver.
 *
 * History: the previous IP-keyed rate limit took `split(',')[0]` from the
 * X-Forwarded-For header, which is the value the client appended — i.e.
 * fully attacker-controlled on any normal reverse-proxy setup. Each
 * `bypass` test below corresponds to a real spoofing pattern that the new
 * implementation must refuse.
 */

import { getClientIp, rateLimitKey } from '@/lib/util/clientIp';

function makeReq(headers: Record<string, string>): Request {
  return new Request('https://discover.legal/api/test', { headers });
}

const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    TRUSTED_PROXY_HOPS: '1',
    TRUSTED_PROXY_PROVIDER: 'render',
  };
});
afterAll(() => {
  process.env = originalEnv;
});

describe('getClientIp', () => {
  it('takes the rightmost XFF entry when TRUSTED_PROXY_HOPS=1', () => {
    const req = makeReq({ 'x-forwarded-for': '9.9.9.9, 1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('refuses an XFF header containing only a spoofed value', () => {
    // With NODE_ENV=production we reject private/loopback values entirely.
    // A solo `127.0.0.1` (or attacker-controlled string) returns null.
    const req = makeReq({ 'x-forwarded-for': '127.0.0.1' });
    expect(getClientIp(req)).toBeNull();
  });

  it('does NOT trust the leftmost XFF value when it is spoofed by the client', () => {
    // The attacker sets 1.1.1.1 themselves; the trusted edge appends the
    // real peer 8.8.8.8. We must return 8.8.8.8, never 1.1.1.1.
    const req = makeReq({ 'x-forwarded-for': '1.1.1.1, 8.8.8.8' });
    expect(getClientIp(req)).toBe('8.8.8.8');
  });

  it('steps in further when TRUSTED_PROXY_HOPS=2 (CDN + Render)', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    const req = makeReq({
      'x-forwarded-for': 'attacker, 1.2.3.4, 5.6.7.8',
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
    process.env.TRUSTED_PROXY_HOPS = '1';
  });

  it('ignores spoofable provider headers on the default Render deployment', () => {
    const req = makeReq({
      'cf-connecting-ip': '203.0.113.5',
      'fly-client-ip': '203.0.113.6',
      'x-forwarded-for': 'attacker, 9.9.9.9',
    });
    expect(getClientIp(req)).toBe('9.9.9.9');
  });

  it('honours the provider header only when that ingress is explicit', () => {
    const req = makeReq({
      'cf-connecting-ip': '203.0.113.5',
      'x-forwarded-for': 'attacker, 9.9.9.9',
    });
    expect(getClientIp(req, { provider: 'cloudflare' })).toBe('203.0.113.5');
  });

  it('does not fall back to XFF when a configured provider header is absent', () => {
    const req = makeReq({ 'x-forwarded-for': 'attacker, 9.9.9.9' });
    expect(getClientIp(req, { provider: 'cloudflare' })).toBeNull();
  });

  it('rejects garbage that does not parse as an IP', () => {
    const req = makeReq({ 'x-forwarded-for': 'definitely-not-an-ip' });
    expect(getClientIp(req)).toBeNull();
  });

  it('returns null when no IP-bearing header is present', () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBeNull();
  });
});

describe('rateLimitKey', () => {
  it('returns an ip-prefixed key when an IP is resolvable', () => {
    const req = makeReq({ 'x-forwarded-for': '1.1.1.1, 8.8.8.8' });
    expect(rateLimitKey(req, 'bucket')).toBe('ip:8.8.8.8');
  });

  it('returns a noip-bucketed key per route when no IP is resolvable', () => {
    // Two routes with no IP must NOT share the same fallback bucket — the
    // bucket label keeps them isolated so blowing one budget can't lock
    // out the others.
    const req = makeReq({});
    expect(rateLimitKey(req, 'a')).toBe('noip:a');
    expect(rateLimitKey(req, 'b')).toBe('noip:b');
  });

  it('does NOT allow a client to bypass its bucket by rotating XFF prefixes', () => {
    // The header sent by the attacker:
    //   X-Forwarded-For: <spoof>, <real>
    // The trusted edge sets <real>. No matter what <spoof> the attacker
    // chooses, the key derived must be the same for the same real IP.
    const real = '8.8.8.8';
    const keyA = rateLimitKey(makeReq({ 'x-forwarded-for': `aaa, ${real}` }), 'bucket');
    const keyB = rateLimitKey(makeReq({ 'x-forwarded-for': `bbb, ${real}` }), 'bucket');
    const keyC = rateLimitKey(makeReq({ 'x-forwarded-for': `99.99.99.99, ${real}` }), 'bucket');
    expect(keyA).toBe(`ip:${real}`);
    expect(keyB).toBe(`ip:${real}`);
    expect(keyC).toBe(`ip:${real}`);
  });
});
