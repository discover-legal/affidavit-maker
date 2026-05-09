import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazily build the @auth0/nextjs-auth0 handler so the SDK isn't invoked at
// module load time. v3's `handleAuth` is sometimes evaluated during Next.js's
// build-time page-data collection (which calls the route export with no
// arguments) and trips the SDK's `req.headers` access.
let handlerPromise: Promise<(req: NextRequest, ctx: { params: { auth0: string } }) => Promise<Response>> | null = null;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { handleAuth, handleLogin, handleLogout, handleCallback } = await import('@auth0/nextjs-auth0');
      return handleAuth({
        login: handleLogin({
          returnTo: '/dashboard',
          authorizationParams: {
            audience: process.env.AUTH0_AUDIENCE,
            scope: 'openid profile email',
          },
        }),
        signup: handleLogin({
          returnTo: '/dashboard',
          authorizationParams: {
            audience: process.env.AUTH0_AUDIENCE,
            scope: 'openid profile email',
            screen_hint: 'signup',
          },
        }),
        callback: handleCallback(),
        logout: handleLogout({ returnTo: '/' }),
      }) as (req: NextRequest, ctx: { params: { auth0: string } }) => Promise<Response>;
    })().catch((err) => {
      handlerPromise = null;
      throw err;
    });
  }
  return handlerPromise;
}

export async function GET(req: NextRequest, ctx: { params: { auth0: string } }) {
  const handler = await getHandler();
  return handler(req, ctx);
}
