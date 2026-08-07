import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { AUTH0_PROFILE_ROUTE } from './auth0-routes';

function auth0Domain(): string | undefined {
  const value = process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL;
  if (!value) return undefined;
  try {
    return value.includes('://') ? new URL(value).hostname : value;
  } catch {
    return value;
  }
}

function positiveDuration(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildAuth0SessionConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return {
    rolling: true,
    absoluteDuration: positiveDuration(env.AUTH0_SESSION_ABSOLUTE_DURATION, 86400),
    inactivityDuration: positiveDuration(
      env.AUTH0_SESSION_INACTIVITY_DURATION ?? env.AUTH0_SESSION_ROLLING_DURATION,
      3600,
    ),
  };
}

export const auth0SessionConfig = buildAuth0SessionConfig();

/**
 * Shared Auth0 v4 client. Custom route paths preserve the production v3 URLs,
 * so the existing Auth0 dashboard callback/logout configuration and all
 * bookmarked login links continue to work during the framework migration.
 */
export const auth0 = new Auth0Client({
  domain: auth0Domain(),
  appBaseUrl: process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL,
  signInReturnToPath: '/dashboard',
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: 'openid profile email',
  },
  routes: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    callback: '/api/auth/callback',
    profile: AUTH0_PROFILE_ROUTE,
  },
  // The app is a token-mediating backend. Browser code only needs the profile
  // endpoint; API access tokens remain server-side.
  enableAccessTokenEndpoint: false,
  session: auth0SessionConfig,
});
