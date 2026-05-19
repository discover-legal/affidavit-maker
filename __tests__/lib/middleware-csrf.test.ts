/**
 * @jest-environment node
 *
 * Pure-function tests for the edge middleware's CSRF + body-cap + scanner-
 * block behavior. We import the middleware directly and synthesize
 * NextRequests by hand. The middleware reads only headers / method /
 * url, so we don't need a real Next.js runtime.
 */

import { middleware } from '../../middleware';
import { NextRequest } from 'next/server';

function makeReq(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const url = opts.url ?? 'https://discover.legal/api/cases';
  const req = new NextRequest(url, {
    method: opts.method ?? 'POST',
    headers: opts.headers ?? {},
  });
  return req;
}

describe('middleware: CSRF Origin enforcement', () => {
  it('lets a same-origin POST through', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://discover.legal', host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('lets a POST from the canada subdomain through (allow-listed)', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://ca.discover.legal', host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('REJECTS a POST from an off-list origin', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://attacker.example', host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('REJECTS a state-changing API call with NO Origin and NO Referer', () => {
    // Previously these were allowed through ("Origin missing → allow").
    // Now we refuse; legitimate clients (SPA / curl with --header Origin)
    // can always be explicit.
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('allows webhook paths through with no Origin (signature-verified)', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/payment/webhook',
        method: 'POST',
        headers: { host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('allows safe methods through with no Origin', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/documents',
        method: 'GET',
        headers: { host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe('middleware: known-bad request filters', () => {
  it('refuses the x-middleware-subrequest header (CVE-2025-29927 belt-and-braces)', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'GET',
        headers: { 'x-middleware-subrequest': 'middleware:middleware' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('404s on a scanner probe path', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/.git/config',
        method: 'GET',
        headers: { host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('middleware: body-size cap', () => {
  it('413s a state-changing API request with an oversize Content-Length', () => {
    const huge = String(100 * 1024 * 1024); // 100 MB > 25 MB default cap
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/api/documents/save',
        method: 'POST',
        headers: {
          origin: 'https://discover.legal',
          host: 'discover.legal',
          'content-length': huge,
        },
      }),
    );
    expect(res.status).toBe(413);
  });
});

describe('middleware: request id', () => {
  it('stamps an x-request-id on every response', () => {
    const res = middleware(
      makeReq({
        url: 'https://discover.legal/dashboard',
        method: 'GET',
        headers: {},
      }),
    );
    expect(res.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
