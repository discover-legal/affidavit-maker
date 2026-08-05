import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getCurrentUser, type AppUser } from '@/lib/auth';
import { query, withRLSContext } from '@/lib/db';
import { logger } from '@/lib/logger';
import { TOS_VERSION } from '@/lib/content/termsOfService';

export type RouteContext<P = Record<string, string | string[]>> = {
  params: P;
};

export type AuthedHandler<P = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: RouteContext<P> & { user: AppUser },
) => Promise<Response> | Response;

/**
 * Auth wrapper for Route Handlers. Resolves the Auth0 session, ensures a
 * `users` row exists for the auth0_id, then runs the handler with a
 * per-request RLS identity (migrations 010/012/013 rely on
 * app.user_id / app.current_user_id session variables; see `withRLSContext`
 * in lib/db.ts). Each query uses a short transaction; network, PDF, and LLM
 * work never pins a connection.
 *
 * Without this wrapper, queries run against the global pool with no RLS
 * context — explicit `WHERE user_id = $1` checks in handlers still work,
 * but the database-level defense in depth from RLS policies is inactive.
 */
type AuthOptions = { requireCurrentTos?: boolean };

export function withAuth<P = Record<string, string | string[]>>(
  handler: AuthedHandler<P>,
  options: AuthOptions = {},
) {
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

    return withRLSContext(user.id, /* isAdmin */ false, async () => {
      if (options.requireCurrentTos !== false) {
        const accepted = await query<{ accepted: boolean }>(
          `SELECT (tos_accepted = true AND tos_version_accepted = $1) AS accepted
             FROM users
            WHERE id = $2`,
          [TOS_VERSION, user.id],
        );
        if (accepted.rows[0]?.accepted !== true) {
          return NextResponse.json(
            {
              success: false,
              error: 'Current Terms of Service acceptance required',
              errorType: 'TosAcceptanceRequired',
            },
            { status: 403 },
          );
        }
      }
      return Promise.resolve(handler(req, { ...ctx, user }));
    });
  };
}

/** Authentication-only wrapper for the two endpoints used to establish TOS state. */
export function withBasicAuth<P = Record<string, string | string[]>>(
  handler: AuthedHandler<P>,
) {
  return withAuth(handler, { requireCurrentTos: false });
}
