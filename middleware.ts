import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Stub middleware. Auth0 JWT verification, CSRF, and rate-limiting will be
// wired in during Phase 4 (API migration). For now this is a passthrough so
// the matcher exists and the file builds.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match every request except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|logo512.png|logo192.png|app-icon.svg|app-icon-1024.png|manifest.json|gtm.js|robots.txt|sitemap.xml).*)',
  ],
};
