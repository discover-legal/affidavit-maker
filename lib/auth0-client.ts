'use client';

/**
 * Compatibility shim for components that were written against
 * `@auth0/auth0-react`. The Next.js SDK has a different surface
 * (`useUser()` only — no token getter, no login/logout helpers), so
 * this shim recreates the old API on top of it.
 *
 * KEY DIFFERENCE: getAccessTokenSilently() now returns an empty string.
 * Auth0 nextjs-auth0 keeps tokens server-side and uses an HttpOnly
 * cookie session for client→API calls. Components passing
 * `Authorization: Bearer ${token}` to /api/* will succeed because the
 * Route Handlers read the session from the cookie, not the header.
 */

import { useUser } from '@auth0/nextjs-auth0/client';
import { useCallback } from 'react';

type LoginOptions = {
  authorizationParams?: {
    screen_hint?: 'signup' | 'login';
    [key: string]: unknown;
  };
  appState?: { returnTo?: string };
};

type LogoutOptions = {
  logoutParams?: { returnTo?: string };
  returnTo?: string;
};

export function useAuth0() {
  const { user, error, isLoading } = useUser();
  const isAuthenticated = Boolean(user) && !isLoading;

  const loginWithRedirect = useCallback((opts?: LoginOptions) => {
    if (typeof window === 'undefined') return;
    const screenHint = opts?.authorizationParams?.screen_hint;
    const path = screenHint === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const returnTo = opts?.appState?.returnTo;
    const url = returnTo
      ? `${path}?returnTo=${encodeURIComponent(returnTo)}`
      : path;
    window.location.assign(url);
  }, []);

  const logout = useCallback((opts?: LogoutOptions) => {
    if (typeof window === 'undefined') return;
    const returnTo = opts?.logoutParams?.returnTo ?? opts?.returnTo;
    const url = returnTo
      ? `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`
      : '/api/auth/logout';
    window.location.assign(url);
  }, []);

  // Tokens live server-side now. Calls to /api/* succeed via cookie session;
  // any Authorization: Bearer header is harmless (route handlers ignore it).
  const getAccessTokenSilently = useCallback(async () => '', []);

  return {
    user,
    error,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  };
}
