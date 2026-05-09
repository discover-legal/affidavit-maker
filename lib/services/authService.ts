'use client';

import { useCallback } from 'react';
import { useAuth0 } from '@/lib/auth0-client';

/**
 * useAuthenticatedApi: makes a fetch to a same-origin API route. Auth is
 * cookie-based (HttpOnly session set by @auth0/nextjs-auth0), so we no
 * longer pass an Authorization header. On 401, redirect to /api/auth/login
 * via the auth0-client shim.
 */

let isRedirectingToLogin = false;
let redirectResetTimer: ReturnType<typeof setTimeout> | null = null;

export type RequestOptions = RequestInit;

export function useAuthenticatedApi() {
  const { loginWithRedirect } = useAuth0();

  const makeAuthenticatedRequest = useCallback(
    async <T = unknown>(url: string, options: RequestOptions = {}): Promise<T> => {
      const response = await fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      });

      if (response.status === 401) {
        if (!isRedirectingToLogin) {
          isRedirectingToLogin = true;
          if (redirectResetTimer) clearTimeout(redirectResetTimer);
          redirectResetTimer = setTimeout(() => {
            isRedirectingToLogin = false;
          }, 5000);
          loginWithRedirect();
        }
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    },
    [loginWithRedirect],
  );

  return { makeAuthenticatedRequest };
}

export function handleAuthError(
  error: { error?: string; message?: string; error_description?: string },
  loginWithRedirect: (opts?: never) => void,
) {
  console.error('Auth error:', error);
  if (
    error.error === 'login_required' ||
    error.error === 'consent_required' ||
    error.message?.includes('login_required')
  ) {
    loginWithRedirect();
    return;
  }
  if (error.error_description) {
    console.error('Auth0 Error:', error.error_description);
  }
}
