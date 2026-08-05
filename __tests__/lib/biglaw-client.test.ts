/**
 * @jest-environment node
 *
 * Unit tests for the BigLaw intake client (lib/biglaw/) — the portal side
 * of docs/BIGLAW_INTEGRATION.md. Covers the HMAC signing scheme (known
 * vectors), the request wiring (headers computed over the exact serialized
 * body), the 404→null profile contract, non-2xx → ExternalServiceError,
 * and the isFirmMode() env matrix.
 */

import { createHash, createHmac } from 'node:crypto';
import {
  BigLawClient,
  BigLawRequestError,
  signIntakeRequest,
} from '@/lib/biglaw/client';
import { ExternalServiceError } from '@/lib/api/errors';

const SECRET = 'test-secret';
const TS = '1700000000';

/** Independent reference implementation of the contract's signing scheme. */
function referenceSign(
  secret: string,
  method: string,
  pathWithQuery: string,
  timestamp: string,
  rawBody: string,
): string {
  const bodyHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const canonical = `${method}\n${pathWithQuery}\n${timestamp}\n${bodyHash}`;
  return `v1=${createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')}`;
}

describe('signIntakeRequest', () => {
  it('matches the known POST vector exactly', () => {
    const sig = signIntakeRequest(
      SECRET,
      'POST',
      '/intake/submissions',
      TS,
      '{"externalId":"am-doc-1"}',
    );
    // Precomputed with node:crypto:
    //   bodyHash  = sha256('{"externalId":"am-doc-1"}')
    //   canonical = 'POST\n/intake/submissions\n1700000000\n' + bodyHash
    //   signature = 'v1=' + hmac_sha256('test-secret', canonical)
    expect(sig).toBe('v1=3e9cebb58e55a52253b6f816c6b7a2d041b0fcc86e68d7c5f3d7a5e1d58658f3');
  });

  it('matches the known GET vector (empty body, query string included)', () => {
    const sig = signIntakeRequest(
      SECRET,
      'GET',
      '/intake/clients/auth0%7Cabc/submissions?limit=5',
      TS,
      '',
    );
    expect(sig).toBe('v1=7a388dded2c376eda4ad01f9b9ed49f881672967cd55fb4189d2bb1c3a94e51f');
  });

  it('includes the query string in the canonical string', () => {
    const withQuery = signIntakeRequest(SECRET, 'GET', '/intake/x?a=1', TS, '');
    const withoutQuery = signIntakeRequest(SECRET, 'GET', '/intake/x', TS, '');
    expect(withQuery).not.toBe(withoutQuery);
    expect(withQuery).toBe(referenceSign(SECRET, 'GET', '/intake/x?a=1', TS, ''));
  });

  it('hashes the empty string for GET bodies (sha256(""))', () => {
    // sha256('') = e3b0c442...; the reference implementation uses the same
    // empty-body hash, so a GET signature must equal the reference exactly.
    const path = '/intake/submissions/abc';
    expect(signIntakeRequest(SECRET, 'GET', path, TS, '')).toBe(
      referenceSign(SECRET, 'GET', path, TS, ''),
    );
    expect(createHash('sha256').update('', 'utf8').digest('hex')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('BigLawClient', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('signs POST requests over the exact serialized body it sends', async () => {
    const submission = {
      id: 'sub-1',
      externalId: 'am-doc-1',
      status: 'received',
      clientId: 'c1',
      clientNumber: 'AM-1',
      crmProfileId: 'p1',
      documentId: 'd1',
      conflict: { hasConflict: false },
      createdAt: '2026-08-03T00:00:00Z',
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { submission }));

    const client = new BigLawClient('https://biglaw.example', SECRET);
    const request = {
      externalId: 'am-doc-1',
      client: { externalId: 'auth0|abc', email: 'a@b.c', name: 'A' },
      title: 'T',
      documentType: 'affidavit',
      content: 'draft text',
    };
    const result = await client.submitIntake(request);
    expect(result).toEqual(submission);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://biglaw.example/intake/submissions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Intake-Timestamp']).toMatch(/^\d+$/);
    // Recompute the signature independently over the body actually sent.
    const expected = referenceSign(
      SECRET,
      'POST',
      '/intake/submissions',
      headers['X-Intake-Timestamp'],
      init.body as string,
    );
    expect(headers['X-Intake-Signature']).toBe(expected);
    expect(init.body).toBe(JSON.stringify(request));
  });

  it('signs the full path (including a base-URL prefix) and sends no body on GET', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { submissions: [] }));

    const client = new BigLawClient('https://firm.example/biglaw/', SECRET);
    await client.getClientSubmissions('auth0|abc');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://firm.example/biglaw/intake/clients/auth0%7Cabc/submissions');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();

    const headers = init.headers as Record<string, string>;
    const expected = referenceSign(
      SECRET,
      'GET',
      '/biglaw/intake/clients/auth0%7Cabc/submissions',
      headers['X-Intake-Timestamp'],
      '', // GET signs sha256("")
    );
    expect(headers['X-Intake-Signature']).toBe(expected);
  });

  it('returns null when the profile GET responds 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }));
    const client = new BigLawClient('https://biglaw.example', SECRET);
    await expect(client.getClientProfile('auth0|abc')).resolves.toBeNull();
  });

  it('throws ExternalServiceError on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
    const client = new BigLawClient('https://biglaw.example', SECRET);
    await expect(client.getSubmission('sub-1')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('carries the upstream status on BigLawRequestError (403 pass-through)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: 'not yours' }));
    const client = new BigLawClient('https://biglaw.example', SECRET);
    try {
      await client.decideProposal('prop-1', 'auth0|abc', 'approve');
      throw new Error('expected decideProposal to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BigLawRequestError);
      expect((err as BigLawRequestError).upstreamStatus).toBe(403);
      expect((err as BigLawRequestError).status).toBe(503);
    }
  });

  it('wraps network failures in ExternalServiceError (never leaks the secret)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const client = new BigLawClient('https://biglaw.example', SECRET);
    try {
      await client.getSubmission('sub-1');
      throw new Error('expected getSubmission to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalServiceError);
      expect((err as Error).message).not.toContain(SECRET);
    }
  });
});

describe('isFirmMode env matrix', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BIGLAW_API_URL;
    delete process.env.BIGLAW_INTAKE_SECRET;
    delete process.env.BIGLAW_FIRM_NAME;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function loadConfig() {
    return require('@/lib/biglaw/config') as typeof import('@/lib/biglaw/config');
  }

  it('is false when both env vars are unset', () => {
    expect(loadConfig().isFirmMode()).toBe(false);
  });

  it('is false when only BIGLAW_API_URL is set', () => {
    process.env.BIGLAW_API_URL = 'https://biglaw.example';
    expect(loadConfig().isFirmMode()).toBe(false);
  });

  it('is false when only BIGLAW_INTAKE_SECRET is set', () => {
    process.env.BIGLAW_INTAKE_SECRET = 'shhh';
    expect(loadConfig().isFirmMode()).toBe(false);
  });

  it('is false when either var is an empty string', () => {
    process.env.BIGLAW_API_URL = '';
    process.env.BIGLAW_INTAKE_SECRET = 'shhh';
    expect(loadConfig().isFirmMode()).toBe(false);
  });

  it('is true when both are set, and getBigLawClient returns a client', () => {
    process.env.BIGLAW_API_URL = 'https://biglaw.example';
    process.env.BIGLAW_INTAKE_SECRET = 'shhh';
    expect(loadConfig().isFirmMode()).toBe(true);

    const clientModule = require('@/lib/biglaw/client') as typeof import('@/lib/biglaw/client');
    expect(clientModule.getBigLawClient()).not.toBeNull();
  });

  it('getBigLawClient returns null when firm mode is off', () => {
    const clientModule = require('@/lib/biglaw/client') as typeof import('@/lib/biglaw/client');
    expect(clientModule.getBigLawClient()).toBeNull();
  });

  it('firmName falls back when BIGLAW_FIRM_NAME is unset and honors it when set', () => {
    expect(loadConfig().firmName()).toBe('Your law firm');
    process.env.BIGLAW_FIRM_NAME = 'Dewey & Howe LLP';
    jest.resetModules();
    expect(loadConfig().firmName()).toBe('Dewey & Howe LLP');
  });
});
