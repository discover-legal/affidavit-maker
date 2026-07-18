/** @jest-environment node */

import { NextRequest } from 'next/server';

const mockGetCurrentSession = jest.fn();
const mockGetCurrentUser = jest.fn();
jest.mock('@/lib/auth', () => ({
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
jest.mock('@/lib/db', () => ({
  withRLSContext: (_id: number, _admin: boolean, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { withAuth } from '@/lib/api/auth';
import { TOS_VERSION } from '@/lib/content/termsOfService';

describe('withAuth current-TOS gate', () => {
  const request = new NextRequest('https://discover.legal/api/cases');
  const handler = jest.fn(async () => Response.json({ success: true }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSession.mockResolvedValue({ user: { sub: 'auth0|123' } });
  });

  it('blocks business APIs when the current version has not been accepted', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 7,
      auth0Id: 'auth0|123',
      email: 'a@example.com',
      name: null,
      tosAccepted: true,
      tosVersionAccepted: 'older-version',
    });
    const response = await withAuth(handler)(request, { params: {} });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ errorType: 'terms_required' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows business APIs after current-version acceptance', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 7,
      auth0Id: 'auth0|123',
      email: 'a@example.com',
      name: null,
      tosAccepted: true,
      tosVersionAccepted: TOS_VERSION,
    });
    const response = await withAuth(handler)(request, { params: {} });
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows only explicitly exempt bootstrap routes to run before acceptance', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 7,
      auth0Id: 'auth0|123',
      email: 'a@example.com',
      name: null,
      tosAccepted: false,
      tosVersionAccepted: null,
    });
    const response = await withAuth(handler, { requireCurrentTos: false })(request, { params: {} });
    expect(response.status).toBe(200);
  });

  it('fails fast before one user can occupy more than four DB-backed handlers', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 7,
      auth0Id: 'auth0|123',
      email: 'a@example.com',
      name: null,
      tosAccepted: true,
      tosVersionAccepted: TOS_VERSION,
    });
    const releases: Array<() => void> = [];
    const slowHandler = jest.fn(() => new Promise<Response>((resolve) => {
      releases.push(() => resolve(Response.json({ success: true })));
    }));
    const guarded = withAuth(slowHandler);
    const pending = Array.from({ length: 5 }, () => guarded(request, { params: {} }));
    const rejected = await pending[4];
    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toMatchObject({ errorType: 'concurrency_limit' });
    releases.forEach((release) => release());
    await Promise.all(pending.slice(0, 4));
  });
});
