import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, getCurrentUser, type AppUser } from '@/lib/auth';
import { withRLSContext } from '@/lib/db';
import { logger } from '@/lib/logger';
import { TOS_VERSION } from '@/lib/content/termsOfService';

export type RouteContext<P = Record<string, string | string[]>> = {
  params: P;
};

export type AuthedHandler<P = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: RouteContext<P> & { user: AppUser },
) => Promise<Response> | Response;

type WithAuthOptions = {
  /** Only the TOS accept/status routes may disable this gate. */
  requireCurrentTos?: boolean;
};

const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX ?? 20);
const MAX_ACTIVE_AUTHED_REQUESTS = Math.max(
  1,
  (Number.isSafeInteger(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 20) - 8,
);
const MAX_ACTIVE_REQUESTS_PER_USER = 4;
let activeAuthedRequests = 0;
const activeByUser = new Map<number, number>();

function acquireRequestSlot(userId: number): (() => void) | null {
  const userActive = activeByUser.get(userId) ?? 0;
  if (
    activeAuthedRequests >= MAX_ACTIVE_AUTHED_REQUESTS
    || userActive >= MAX_ACTIVE_REQUESTS_PER_USER
  ) {
    return null;
  }
  activeAuthedRequests += 1;
  activeByUser.set(userId, userActive + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAuthedRequests -= 1;
    const remaining = (activeByUser.get(userId) ?? 1) - 1;
    if (remaining <= 0) activeByUser.delete(userId);
    else activeByUser.set(userId, remaining);
  };
}

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
export function withAuth<P = Record<string, string | string[]>>(
  handler: AuthedHandler<P>,
  options: WithAuthOptions = {},
) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    const session = await getCurrentSession();
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

    // Handlers currently keep their RLS transaction open through LLM/OCR/PDF
    // work. Reserve pool headroom and stop one account from exhausting every
    // client while longer-term query-scoped RLS refactoring remains possible.
    const releaseSlot = acquireRequestSlot(user.id);
    if (!releaseSlot) {
      return NextResponse.json(
        { success: false, error: 'Too many concurrent requests', errorType: 'concurrency_limit' },
        { status: 429 },
      );
    }
    try {
      return await withRLSContext(user.id, /* isAdmin */ false, async () => {
        if (options.requireCurrentTos !== false) {
          if (!user.tosAccepted || user.tosVersionAccepted !== TOS_VERSION) {
            return NextResponse.json(
              {
                success: false,
                error: 'Current Terms of Service acceptance required',
                errorType: 'terms_required',
                tosVersion: TOS_VERSION,
              },
              { status: 403 },
            );
          }
        }
        return Promise.resolve(handler(req, { ...ctx, user }));
      });
    } finally {
      releaseSlot();
    }
  };
}
