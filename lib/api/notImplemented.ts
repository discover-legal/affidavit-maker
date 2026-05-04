import { NextResponse } from 'next/server';

/**
 * Returned by Route Handlers that haven't been fully ported from
 * routes/*.js yet. Each call site cites the legacy file so an AI tool
 * (or human) can pick the next port off a clear list.
 *
 * This is intentional intermediate state. Tracked as the Phase-4 follow-up
 * work in CLAUDE.md.
 */
export function notImplemented(legacyFile: string, hint?: string): Response {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint has not yet been ported to Next.js Route Handlers.',
      errorType: 'NotImplemented',
      legacyFile,
      hint: hint ?? 'See routes/' + legacyFile + ' for the original implementation.',
    },
    { status: 501 },
  );
}
