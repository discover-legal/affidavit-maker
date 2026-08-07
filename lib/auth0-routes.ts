/**
 * Client-visible Auth0 profile route, shared by the server config
 * (lib/auth0.ts), the proxy, and every client-side useUser() call.
 *
 * The v4 SDK resolves the profile URL independently inside each useUser()
 * call (options.route || NEXT_PUBLIC_PROFILE_ROUTE || '/auth/profile') —
 * Auth0Provider's `profileRoute` prop is NOT forwarded to the hook, it only
 * keys the SWR fallback. A useUser() call without { route } therefore
 * fetches the SDK-default /auth/profile, 404s against our custom-route
 * middleware, and treats a signed-in user as signed out (the production
 * login loop of 2026-08-07).
 */
export const AUTH0_PROFILE_ROUTE = '/api/auth/me';
