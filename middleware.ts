import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware. Per-request work that runs before the Route Handler:
 *   1. Stamp x-request-id on both directions.
 *   2. Reject cross-origin state-changing /api/* requests (CSRF defense in
 *      depth on top of the Auth0 SameSite=Lax cookie).
 *   3. Enforce a hard cap on request body size for the API so an attacker
 *      can't trickle a multi-GB body and hold a worker for minutes.
 *   4. Block obvious scanning / known-bad request patterns.
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

// 25 MB hard ceiling for any /api/* request. The legitimate maximum today
// is the evidence upload at MAX_FILE_SIZE=10 MB; double it as headroom for
// multipart framing. Anything larger is rejected at the edge so we don't
// pay for the bytes to land on a Node worker.
const API_MAX_BODY_BYTES = Number(process.env.API_MAX_BODY_BYTES ?? 25 * 1024 * 1024);

// Patterns that are never a legitimate request — refuse them at the edge so
// they never touch a Route Handler. Block list intentionally narrow: only
// paths that are pure scanner noise.
const BLOCKED_PATH_PREFIXES = [
  '/.git/',
  '/.env',
  '/wp-admin',
  '/wp-includes',
  '/phpmyadmin',
  '/.well-known/security.txt.',
];

const BLOCKED_HEADERS = [
  // CVE-2025-29927: Next.js middleware bypass via this header. Patched in
  // 14.2.25+; we're on 14.2.35. Belt-and-braces: reject the header outright
  // so any future regression cannot make it past the edge.
  'x-middleware-subrequest',
];

function reject(status: number, error: string, errorType: string): NextResponse {
  return new NextResponse(JSON.stringify({ success: false, error, errorType }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block scanner noise + CVE header.
  for (const header of BLOCKED_HEADERS) {
    if (request.headers.get(header) !== null) {
      return reject(400, 'Bad request', 'BadRequest');
    }
  }
  if (BLOCKED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return reject(404, 'Not found', 'NotFound');
  }

  const isApi = pathname.startsWith('/api/');

  // CSRF Origin allow-list for state-changing /api/* requests, except webhooks.
  if (
    !SAFE_METHODS.has(request.method) &&
    isApi &&
    !WEBHOOK_PATHS.has(pathname)
  ) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    let originHost: string | null = null;
    if (origin) {
      try {
        originHost = new URL(origin).host;
      } catch {
        return reject(403, 'Cross-origin request rejected', 'CsrfError');
      }
    } else if (referer) {
      // Some browsers / proxies strip Origin but preserve Referer. Accept
      // it as a CSRF signal — but ONLY if we can parse it. A request with
      // neither is rejected; SameSite=Lax already gates browser CSRF, but
      // a state-changing call with no origin signal at all is suspicious
      // enough that we'd rather force the SPA / API client to be explicit.
      try {
        originHost = new URL(referer).host;
      } catch {
        return reject(403, 'Cross-origin request rejected', 'CsrfError');
      }
    } else {
      // No Origin and no Referer: refuse. This is stricter than the legacy
      // behavior (which let these through and relied on SameSite=Lax). The
      // SPA always sends Origin; server-to-server callers (Stripe + Auth0)
      // hit /api/.../webhook which is allow-listed above. Legitimate clients
      // can always add `Origin: https://discover.legal`.
      return reject(403, 'Cross-origin request rejected', 'CsrfError');
    }

    if (originHost) {
      const requestHost = request.headers.get('host') ?? request.nextUrl.host;
      if (originHost !== requestHost && !ALLOWED_API_ORIGINS.has(originHost)) {
        return reject(403, 'Cross-origin request rejected', 'CsrfError');
      }
    }
  }

  // Edge-side body size cap for API routes. content-length is advisory but
  // it's what HTTP clients normally set; the Node runtime layer will also
  // refuse oversized streams, this is just an early rejection so we don't
  // route to a handler at all.
  if (isApi && !SAFE_METHODS.has(request.method)) {
    const len = request.headers.get('content-length');
    if (len) {
      const bytes = Number(len);
      if (Number.isFinite(bytes) && bytes > API_MAX_BODY_BYTES) {
        return reject(413, 'Request body too large', 'PayloadTooLarge');
      }
    }
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
