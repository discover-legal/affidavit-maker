'use client';

/**
 * Compatibility shim for legacy components that were written against
 * `@auth0/auth0-react`. The Next.js SDK has a different surface (`useUser()`
 * only — no token getter, no login/logout helpers), so this shim recreates
 * the old API on top of it.
 *
 * Auth model: HttpOnly SameSite=Lax cookie session managed by
 * `@auth0/nextjs-auth0`. Client → API calls succeed via the cookie alone;
 * `getAccessTokenSilently` exists only to satisfy legacy call sites and
 * always returns an empty string. Don't add it to fetch() headers — the
 * legacy bearer-header pattern was removed in the comprehensive review pass.
 *
 * Migration target: as each consumer is converted to TypeScript, replace
 * `useAuth0()` with `useUser()` from `@auth0/nextjs-auth0/client` directly
 * and delete this shim.
 */

import { useUser } from '@auth0/nextjs-auth0/client';
import { useCallback } from 'react';
import { AUTH0_PROFILE_ROUTE } from '@/lib/auth0-routes';

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
  const { user, error, isLoading } = useUser({ route: AUTH0_PROFILE_ROUTE });
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

  // Tokens are server-side only (Route Handlers read the cookie session via
  // getSession()). This stub exists so the legacy `useAuth0()` surface keeps
  // type-checking and never throws; callers should drop the call rather than
  // pass the empty string anywhere.
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
