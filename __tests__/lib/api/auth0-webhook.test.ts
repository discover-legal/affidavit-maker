/** @jest-environment node */

import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withRLSBypass: (fn: () => unknown) => fn(),
}));
jest.mock('@/lib/api/rateLimit', () => ({
  RATE_LIMITS: { auth: { max: 10, windowMs: 1000 } },
  checkRateLimit: () => ({ ok: true }),
}));
jest.mock('@/lib/util/clientIp', () => ({ rateLimitKey: () => 'test-key' }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { handleUserUpsert, processAuth0Webhook } from '@/lib/api/auth0-webhook';

const secret = 'webhook-test-secret';

function signedRequest(payload: object): NextRequest {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return new NextRequest('https://discover.legal/api/auth/webhook/user-update', {
    method: 'POST',
    body,
    headers: { 'auth0-signature': signature, 'content-type': 'application/json' },
  });
}

describe('Auth0 webhook freshness', () => {
  const handler = jest.fn(async () => NextResponse.json({ success: true }));

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH0_WEBHOOK_SECRET = secret;
  });

  it('requires a signed event timestamp', async () => {
    const response = await processAuth0Webhook(
      signedRequest({ user: { user_id: 'auth0|123', email: 'a@example.com' } }),
      handler,
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores captured stale events without invoking the handler', async () => {
    const response = await processAuth0Webhook(
      signedRequest({
        user: { user_id: 'auth0|123', email: 'old@example.com' },
        updateTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      }),
      handler,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: true, reason: 'stale_event' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes the signed timestamp to the database handler', async () => {
    const updateTime = new Date(Date.now() - 1000).toISOString();
    const response = await processAuth0Webhook(
      signedRequest({
        user: { user_id: 'auth0|123', email: 'new@example.com' },
        updateTime,
      }),
      handler,
    );
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.any(Object), new Date(updateTime));
  });

  it('uses a conditional upsert so older deliveries cannot overwrite identity data', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const response = await handleUserUpsert(
      { user_id: 'auth0|123', email: 'old@example.com' },
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(mockQuery.mock.calls[0][0]).toContain('users.auth0_updated_at < EXCLUDED.auth0_updated_at');
    await expect(response.json()).resolves.toMatchObject({ success: true, ignored: true });
  });
});
