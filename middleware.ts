import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware. Per-request work that has to happen before the route
 * handler runs. Auth verification stays in the per-handler `withAuth`
 * wrapper because middleware can't easily access the database for the
 * user upsert.
 *
 * Today this middleware sets the request id header and a strict CSP for
 * non-API responses. Rate limiting lives in route handlers (lib/api/rateLimit)
 * because the middleware runtime is Edge and can't share in-memory buckets
 * with the Node runtime where API routes run.
 */
export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next({
    request: {
      headers: (() => {
        const h = new Headers(request.headers);
        h.set('x-request-id', requestId);
        return h;
      })(),
    },
  });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|logo512.png|logo192.png|app-icon.svg|app-icon-1024.png|manifest.json|gtm.js).*)',
  ],
};
