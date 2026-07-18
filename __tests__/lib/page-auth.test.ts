/** @jest-environment node */

jest.mock('@/lib/auth', () => ({ getCurrentSession: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { requirePageAuth } from '@/lib/page-auth';
import { getCurrentSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

const getCurrentSessionMock = jest.mocked(getCurrentSession);
const redirectMock = jest.mocked(redirect);

describe('requirePageAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects an unauthenticated request and preserves its return path', async () => {
    getCurrentSessionMock.mockResolvedValue(null);

    await expect(requirePageAuth('/profile')).rejects.toThrow(
      'REDIRECT:/api/auth/login?returnTo=%2Fprofile',
    );
    expect(redirectMock).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fprofile');
  });

  it('allows an authenticated session through', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { sub: 'auth0|person' } } as never);

    await expect(requirePageAuth('/dashboard')).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
