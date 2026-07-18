/**
 * @jest-environment node
 *
 * Boundary tests for the Node proxy's CSRF + body-cap + scanner-block
 * behavior. We import the proxy directly and synthesize
 * NextRequests by hand. The middleware reads only headers / method /
 * url, so we don't need a real Next.js runtime.
 */

import { proxy } from '../../proxy';
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
  it('lets a same-origin POST through', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://discover.legal', host: 'discover.legal', 'content-length': '2' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('lets a POST from the canada subdomain through (allow-listed)', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://ca.discover.legal', host: 'discover.legal', 'content-length': '2' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('REJECTS a POST from an off-list origin', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { origin: 'https://attacker.example', host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('REJECTS a state-changing API call with NO Origin and NO Referer', async () => {
    // Previously these were allowed through ("Origin missing → allow").
    // Now we refuse; legitimate clients (SPA / curl with --header Origin)
    // can always be explicit.
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'POST',
        headers: { host: 'discover.legal', 'content-length': '128' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('allows webhook paths through with no Origin (signature-verified)', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/payment/webhook',
        method: 'POST',
        headers: { host: 'discover.legal', 'content-length': '128' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('allows safe methods through with no Origin', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/documents',
        method: 'GET',
        headers: { host: 'discover.legal' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects HTTP for a production host', async () => {
    const res = await proxy(makeReq({
      headers: {
        origin: 'http://discover.legal',
        host: 'discover.legal',
        'content-length': '2',
      },
    }));
    expect(res.status).toBe(403);
  });

  it('allows the exact local-development origin', async () => {
    const res = await proxy(makeReq({
      url: 'http://localhost:3000/api/cases',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'content-length': '2',
      },
    }));
    expect(res.status).toBe(200);
  });
});

describe('middleware: known-bad request filters', () => {
  it('refuses the x-middleware-subrequest header (CVE-2025-29927 belt-and-braces)', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/api/cases',
        method: 'GET',
        headers: { 'x-middleware-subrequest': 'middleware:middleware' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('404s on a scanner probe path', async () => {
    const res = await proxy(
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
  it('413s a state-changing API request with an oversize Content-Length', async () => {
    const huge = String(100 * 1024 * 1024); // 100 MB > 25 MB default cap
    const res = await proxy(
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

  it('rejects a buffered POST with no declared length', async () => {
    const res = await proxy(makeReq({
      headers: { origin: 'https://discover.legal', host: 'discover.legal' },
    }));
    expect(res.status).toBe(411);
  });

  it('rejects chunked framing', async () => {
    const res = await proxy(makeReq({
      headers: {
        origin: 'https://discover.legal',
        host: 'discover.legal',
        'content-length': '2',
        'transfer-encoding': 'chunked',
      },
    }));
    expect(res.status).toBe(411);
  });

  it('rejects malformed Content-Length values', async () => {
    const res = await proxy(makeReq({
      headers: {
        origin: 'https://discover.legal',
        host: 'discover.legal',
        'content-length': '-1',
      },
    }));
    expect(res.status).toBe(400);
  });

  it('allows a genuinely bodyless DELETE without Content-Length', async () => {
    const res = await proxy(makeReq({
      url: 'https://discover.legal/api/documents/1',
      method: 'DELETE',
      headers: { origin: 'https://discover.legal', host: 'discover.legal' },
    }));
    expect(res.status).toBe(200);
  });

  it('allows the explicitly bodyless document-render POST', async () => {
    const res = await proxy(makeReq({
      url: 'https://discover.legal/api/documents/42/render',
      method: 'POST',
      headers: { origin: 'https://discover.legal', host: 'discover.legal' },
    }));
    expect(res.status).toBe(200);
  });

  it('uses a smaller cap for ordinary JSON than evidence uploads', async () => {
    const headers = {
      origin: 'https://discover.legal',
      host: 'discover.legal',
      'content-length': String(6 * 1024 * 1024),
    };
    const ordinary = await proxy(makeReq({ url: 'https://discover.legal/api/documents/save', headers }));
    const upload = await proxy(makeReq({ url: 'https://discover.legal/api/evidence/upload', headers }));
    expect(ordinary.status).toBe(413);
    expect(upload.status).toBe(200);
  });

  it('requires signed webhooks to declare their bounded body', async () => {
    const res = await proxy(makeReq({
      url: 'https://discover.legal/api/payment/webhook',
      headers: { host: 'discover.legal' },
    }));
    expect(res.status).toBe(411);
  });
});

describe('middleware: request id', () => {
  it('stamps an x-request-id on every response', async () => {
    const res = await proxy(
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

  it('redirects protected pages before rendering when there is no session', async () => {
    const res = await proxy(
      makeReq({
        url: 'https://discover.legal/profile',
        method: 'GET',
        headers: {},
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://discover.legal/api/auth/login?returnTo=%2Fprofile',
    );
  });
});
