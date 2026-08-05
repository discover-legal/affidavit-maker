import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError, AuthorizationError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { sessionId: string };

/**
 * Session ID format: `chat_{timestamp}_{userId}` (generated server-side in
 * app/api/chat/route.ts). Ownership requires an exact format match with the
 * authenticated user's id as the final segment — substring checks like
 * `endsWith('_1')` / `includes('_1_')` are ambiguous between user ids that
 * are prefixes of each other. Hardens the SECURITY (MED-01) check from
 * legacy chat.js.
 */
function assertOwnsSession(sessionId: string, userId: string): void {
  if (!sessionId || sessionId.length > 100) {
    throw new ValidationError('Invalid session ID');
  }
  const match = /^chat_(\d{1,17})_(\d+)$/.exec(sessionId);
  const ownsSession = match !== null && match[2] === userId;
  if (!ownsSession) {
    logger.warn('session_ownership_violation', {
      sessionId: sessionId.substring(0, 50),
      userId,
    });
    throw new AuthorizationError('Access denied');
  }
}

// GET /api/chat/session/:sessionId — return session metadata.
//
// The legacy implementation in routes/chat.js never persisted full transcripts
// to the database; sessions live in the AffidavitService in-memory queue +
// orchestratorState on the document row. We mirror that here: the response is
// the metadata the SPA needs (sessionId, userId, status). Conversation
// persistence is handled by the document save flow.
export const GET = withAuth<Params>(async (_req: NextRequest, { params, user }) => {
  try {
    const limit = await checkRateLimit('chat', user.id, RATE_LIMITS.chat);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const { sessionId } = params;
    assertOwnsSession(sessionId, String(user.id));

    return NextResponse.json({
      success: true,
      session: {
        sessionId,
        userId: user.id,
        status: 'active',
        messages: [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// DELETE /api/chat/session/:sessionId — clear/reset the session. There is no
// server-side state to delete in the current implementation; we still return
// 200 and log the event so the SPA can reset its local state confidently.
export const DELETE = withAuth<Params>(async (_req: NextRequest, { params, user }) => {
  try {
    const limit = await checkRateLimit('chat', user.id, RATE_LIMITS.chat);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const { sessionId } = params;
    assertOwnsSession(sessionId, String(user.id));

    logger.info('chat_session_cleared', { sessionId, userId: user.id });

    return NextResponse.json({
      success: true,
      deleted: true,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
