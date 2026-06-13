import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getCurrentUser, type AppUser } from '@/lib/auth';
import { withRLSContext } from '@/lib/db';
import { logger } from '@/lib/logger';

export type RouteContext<P = Record<string, string | string[]>> = {
  params: P;
};

export type AuthedHandler<P = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: RouteContext<P> & { user: AppUser },
) => Promise<Response> | Response;

/**
 * Auth wrapper for Route Handlers. Resolves the Auth0 session, ensures a
 * `users` row exists for the auth0_id, then runs the handler inside a
 * per-request RLS-scoped transaction (migrations 010/012/013 rely on
 * app.user_id / app.current_user_id session variables; see `withRLSContext`
 * in lib/db.ts). The transaction COMMITs on success and ROLLBACKs if the
 * handler throws.
 *
 * Without this wrapper, queries run against the global pool with no RLS
 * context — explicit `WHERE user_id = $1` checks in handlers still work,
 * but the database-level defense in depth from RLS policies is inactive.
 */
export function withAuth<P = Record<string, string | string[]>>(handler: AuthedHandler<P>) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    const session = await getSession();
    if (!session?.user?.sub) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      logger.error('user_provisioning_failed', { auth0Id: session.user.sub });
      return NextResponse.json(
        { success: false, error: 'User provisioning failed' },
        { status: 500 },
      );
    }

    return withRLSContext(
      user.id,
      /* isAdmin */ user.role === 'admin',
      () => Promise.resolve(handler(req, { ...ctx, user })),
      /* userRole */ user.role,
    );
  };
}
