import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getCurrentUser, type AppUser } from '@/lib/auth';

export type RouteContext<P = Record<string, string | string[]>> = {
  params: P;
};

export type AuthedHandler<P = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: RouteContext<P> & { user: AppUser },
) => Promise<Response> | Response;

/** 401 wrapper — every authed Route Handler should go through this. */
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
      return NextResponse.json(
        { success: false, error: 'User provisioning failed' },
        { status: 500 },
      );
    }
    return handler(req, { ...ctx, user });
  };
}
