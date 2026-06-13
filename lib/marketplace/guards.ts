/**
 * lib/marketplace/guards.ts
 *
 * Authorization helpers for marketplace provider (lawyer) operations. These sit
 * on top of `withAuth` (which already proved a valid session) and the RLS
 * policies in migration 015 (which are the database-level backstop). Belt and
 * suspenders: the handler check gives a clean 403 with a useful message; RLS
 * guarantees a bug here can't actually mutate another lawyer's rows.
 */
import { AuthorizationError, NotFoundError } from '@/lib/api/errors';
import { isMarketplaceEnabled } from '@/lib/marketplace/flag';
import type { UserRole } from '@/lib/auth';

export function isProvider(role: UserRole): boolean {
  return role === 'lawyer' || role === 'admin';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

/** Throws AuthorizationError (403) unless the user is an admin. */
export function requireAdmin(user: { role: UserRole }): void {
  if (!isAdmin(user.role)) {
    throw new AuthorizationError('Administrator access is required for this action.');
  }
}

/** Gate for authed admin Route Handlers: 404 when flag off, 403 for non-admins. */
export function requireAdminApi(user: { role: UserRole }): void {
  requireMarketplaceApi();
  requireAdmin(user);
}

/**
 * Gate for any marketplace API endpoint: 404 when the feature flag is off, so
 * the route is invisible. Use on buyer endpoints (checkout, interview) where
 * any authenticated role is allowed.
 */
export function requireMarketplaceApi(): void {
  if (!isMarketplaceEnabled()) throw new NotFoundError();
}

/**
 * Gate for authed provider (lawyer) Route Handlers. Combines the feature flag
 * (404 when off, so the endpoint is invisible) with the lawyer-role check (403
 * for client accounts). Call at the top of every /api/lawyer/* handler.
 */
export function requireProviderApi(user: { role: UserRole }): void {
  requireMarketplaceApi();
  requireLawyer(user);
}

/**
 * Throws AuthorizationError (403) unless the user is a lawyer or admin. Use at
 * the top of every authed lawyer-portal Route Handler.
 */
export function requireLawyer(user: { role: UserRole }): void {
  if (!isProvider(user.role)) {
    throw new AuthorizationError('A provider (lawyer) account is required for this action.');
  }
}
