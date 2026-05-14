import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware. Per-request work that runs before the Route Handler:
 *   1. Stamp x-request-id on both directions.
 *   2. Reject cross-origin state-changing /api/* requests (CSRF defense in
 *      depth on top of the Auth0 SameSite=Lax cookie).
 *
 * Auth itself (session resolution + user upsert) stays in the per-handler
 * `withAuth` wrapper because the middleware runtime is Edge and can't reach
 * the Node-side pg pool used by `lib/auth.ts`.
 */

/** Hosts allowed to POST/PUT/DELETE/PATCH the API (same-origin SPA). */
const ALLOWED_API_ORIGINS = new Set([
  'discover.legal',
  'www.discover.legal',
  'ca.discover.legal',
  'canada.discover.legal',
  // Local development
  'localhost:3000',
  'localhost',
  '127.0.0.1:3000',
  '127.0.0.1',
]);

/**
 * Webhook endpoints that legitimately receive cross-origin POSTs from
 * external services. They authenticate the request via signature
 * verification, NOT Origin, so we exempt them from the Origin check.
 */
const WEBHOOK_PATHS = new Set([
  '/api/payment/webhook',
  '/api/auth/webhook/user-update',
  '/api/auth/webhook/email-update',
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function rejectCSRF(): NextResponse {
  return new NextResponse(
    JSON.stringify({
      success: false,
      error: 'Cross-origin request rejected',
      errorType: 'CsrfError',
    }),
    {
      status: 403,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF Origin allow-list for state-changing /api/* requests, except webhooks.
  if (
    !SAFE_METHODS.has(request.method) &&
    pathname.startsWith('/api/') &&
    !WEBHOOK_PATHS.has(pathname)
  ) {
    const origin = request.headers.get('origin');
    if (origin) {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return rejectCSRF();
      }
      const requestHost = request.headers.get('host') ?? request.nextUrl.host;
      if (originHost !== requestHost && !ALLOWED_API_ORIGINS.has(originHost)) {
        return rejectCSRF();
      }
    }
    // Origin missing → some HTTP clients (curl, server-to-server) omit it.
    // Allow through; the Auth0 SameSite=Lax cookie + per-handler session
    // check still gate access.
  }

  // Stamp x-request-id on the forwarded request and the response.
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
    '/((?!_next/static|_next/image|favicon.ico|logo512.png|logo192.png|app-icon.svg|app-icon-1024.png|manifest.json|gtm.js|robots.txt|sitemap.xml).*)',
  ],
};
