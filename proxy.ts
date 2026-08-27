import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { AUTH0_PROFILE_ROUTE } from '@/lib/auth0-routes';

/**
 * Node proxy. Per-request work that runs before the Route Handler:
 *   1. Stamp x-request-id on both directions.
 *   2. Reject cross-origin state-changing /api/* requests (CSRF defense in
 *      depth on top of the Auth0 SameSite=Lax cookie).
 *   3. Enforce a hard cap on request body size for the API so an attacker
 *      can't trickle a multi-GB body and hold a worker for minutes.
 *   4. Block obvious scanning / known-bad request patterns.
 *
 * Auth0's middleware also runs here so its callback/profile routes and rolling
 * session cookies share the same network boundary. Local user resolution and
 * RLS still stay in the per-handler `withAuth` wrapper.
 */

/** Exact origins allowed to POST/PUT/DELETE/PATCH the API. */
const ALLOWED_API_ORIGINS = new Set([
  'https://discover.legal',
  'https://www.discover.legal',
  'https://ca.discover.legal',
  'https://canada.discover.legal',
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://localhost',
        'http://127.0.0.1:3000',
        'http://127.0.0.1',
        // E2E harness (e2e/setup-worktree.sh) serves on :3100.
        'http://localhost:3100',
        'http://127.0.0.1:3100',
      ]),
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

function isBodylessPost(pathname: string, method: string): boolean {
  return method === 'POST' && /^\/api\/documents\/[1-9]\d*\/render$/.test(pathname);
}

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/editor',
  '/profile',
  '/respond',
  '/serve',
  '/hearing',
  '/payment-success',
];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Absolute ceiling for any /api/* request. Route-specific limits are tighter.
// Render must ALSO enforce this limit at ingress: a Next proxy can reject a
// declared Content-Length, but cannot count a chunked body without consuming
// it before the Route Handler.
const DEFAULT_API_MAX_BODY_BYTES = 25 * 1024 * 1024;
const DEFAULT_JSON_MAX_BODY_BYTES = 5 * 1024 * 1024;
const WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const PROFILE_INGEST_MAX_BODY_BYTES = 12 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function maxBodyBytesFor(pathname: string): number {
  let routeLimit = DEFAULT_JSON_MAX_BODY_BYTES;
  if (pathname === '/api/evidence/upload') {
    routeLimit =
      positiveIntegerEnv('MAX_FILE_SIZE', 10 * 1024 * 1024) +
      MULTIPART_OVERHEAD_BYTES;
  } else if (pathname === '/api/profile/ingest') {
    // 8MB decoded images expand to roughly 10.7MB as base64 JSON.
    routeLimit = PROFILE_INGEST_MAX_BODY_BYTES;
  } else if (WEBHOOK_PATHS.has(pathname)) {
    routeLimit = WEBHOOK_MAX_BODY_BYTES;
  }
  return Math.min(
    positiveIntegerEnv('API_MAX_BODY_BYTES', DEFAULT_API_MAX_BODY_BYTES),
    routeLimit,
  );
}

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
  // CVE-2025-29927: historical Next.js middleware bypass via this header.
  // Belt-and-braces: reject it outright
  // so any future regression cannot make it past the edge.
  'x-middleware-subrequest',
];

function reject(status: number, error: string, errorType: string): NextResponse {
  return new NextResponse(JSON.stringify({ success: false, error, errorType }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const e2eBypass =
    process.env.NODE_ENV !== 'production' && process.env.E2E_AUTH_BYPASS === '1';

  // Kill switch: MAINTENANCE_MODE=true pauses the whole site behind a
  // static 503 page (owner testing / incident response), flipped purely by
  // env var — no code deploy to pause or resume. /api/health stays live so
  // the platform's health checks don't fail the deploy and roll it back.
  if (process.env.MAINTENANCE_MODE === 'true' && pathname !== '/api/health') {
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>discover.legal — back soon</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"></head><body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0"><div style="text-align:center;padding:2rem"><div style="font-size:2rem;font-weight:700;margin-bottom:.5rem">discover<span style="color:#f59e0b">.</span>legal</div><p style="color:#94a3b8;max-width:28rem">We&rsquo;re briefly paused for testing and polish. Back very soon &mdash; nothing of yours is lost.</p></div></body></html>`,
      {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '3600' },
      },
    );
  }

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

  // Auth0Provider revalidates its initial user through the profile endpoint.
  // In E2E mode Auth0's middleware is intentionally bypassed, so provide the
  // same deterministic test identity at both the configured and SDK-default
  // v4 profile paths. This branch is impossible in production.
  if (e2eBypass && (pathname === '/api/auth/me' || pathname === '/auth/profile')) {
    const response = NextResponse.json({
      sub: 'e2e|discover-legal-test-user',
      email: 'e2e@discover.legal',
      name: 'E2E Test User',
      email_verified: true,
    });
    response.headers.set('x-request-id', crypto.randomUUID());
    return response;
  }

  // v4 mounts one login endpoint. Preserve the existing signup URL by
  // forwarding its intent as Auth0's supported screen_hint parameter.
  if (pathname === '/api/auth/signup') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/api/auth/login';
    loginUrl.searchParams.set('screen_hint', 'signup');
    return NextResponse.redirect(loginUrl);
  }

  // CSRF Origin allow-list for state-changing /api/* requests, except webhooks.
  if (
    !SAFE_METHODS.has(request.method) &&
    isApi &&
    !WEBHOOK_PATHS.has(pathname)
  ) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    let requestOrigin: string | null = null;
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (
          parsed.origin !== origin ||
          parsed.username ||
          parsed.password ||
          parsed.pathname !== '/' ||
          parsed.search ||
          parsed.hash
        ) {
          return reject(403, 'Cross-origin request rejected', 'CsrfError');
        }
        requestOrigin = parsed.origin;
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
        requestOrigin = new URL(referer).origin;
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

    if (!requestOrigin || !ALLOWED_API_ORIGINS.has(requestOrigin)) {
      return reject(403, 'Cross-origin request rejected', 'CsrfError');
    }
  }

  // POST/PUT/PATCH API handlers buffer JSON, text, or multipart data. Fail
  // closed unless framing declares a valid length, and reject chunked bodies.
  // A genuinely bodyless DELETE remains valid. Signed webhooks are exempt
  // from CSRF above, but not from this cap.
  if (isApi && !SAFE_METHODS.has(request.method)) {
    const len = request.headers.get('content-length');
    const bodylessPost = isBodylessPost(pathname, request.method);
    if (request.headers.get('transfer-encoding')) {
      return reject(411, 'Content-Length required', 'LengthRequired');
    }
    if (len === null || len === '') {
      if (request.method !== 'DELETE' && !bodylessPost) {
        return reject(411, 'Content-Length required', 'LengthRequired');
      }
    } else if (!/^(0|[1-9]\d*)$/.test(len)) {
      return reject(400, 'Invalid Content-Length', 'BadRequest');
    } else {
      const bytes = Number(len);
      if (!Number.isSafeInteger(bytes)) {
        return reject(400, 'Invalid Content-Length', 'BadRequest');
      }
      if (bodylessPost && bytes > 0) {
        return reject(400, 'Request body not allowed', 'BadRequest');
      }
      if (request.method !== 'DELETE' && !bodylessPost && bytes === 0) {
        return reject(400, 'Request body required', 'BadRequest');
      }
      if (bytes > maxBodyBytesFor(pathname)) {
        return reject(413, 'Request body too large', 'PayloadTooLarge');
      }
    }
  }

  // Stamp x-request-id on the forwarded request and the response, then let
  // Auth0 mount its routes and refresh rolling sessions. E2E bypass is only
  // legal outside production and deliberately skips the real OIDC boundary.
  const requestId = crypto.randomUUID();
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-request-id', requestId);
  // The v4 SDK client falls back to its default profile path when a
  // useUser() call doesn't pass { route }. Serve that path at the configured
  // route too, so stale cached bundles never 404 into the treat-as-logged-out
  // login loop.
  let forwardedRequest: NextRequest;
  if (pathname === '/auth/profile') {
    const profileUrl = request.nextUrl.clone();
    profileUrl.pathname = AUTH0_PROFILE_ROUTE;
    forwardedRequest = new NextRequest(profileUrl, { headers: forwardedHeaders });
  } else {
    forwardedRequest = new NextRequest(request, { headers: forwardedHeaders });
  }
  let response: NextResponse;
  if (e2eBypass) {
    response = NextResponse.next({ request: { headers: forwardedHeaders } });
  } else {
    response = await auth0.middleware(forwardedRequest);
    if (isProtectedPage(pathname)) {
      const session = await auth0.getSession(forwardedRequest);
      if (!session?.user?.sub) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/api/auth/login';
        loginUrl.search = '';
        loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`);
        response = NextResponse.redirect(loginUrl);
      }
    }
  }
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|logo512.png|logo192.png|app-icon.svg|app-icon-1024.png|manifest.json|gtm.js|robots.txt|sitemap.xml).*)',
  ],
};
