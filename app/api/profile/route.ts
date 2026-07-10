import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getUserProfile, deleteUserProfile } from '@/lib/api/profile';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/profile — the user's life-story profile (structured fields +
// accumulated facts), used to seed new documents and conversations.
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const profile = await getUserProfile(user.id);
    return NextResponse.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// DELETE /api/profile — erase the stored life story (privacy control).
export const DELETE = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    await deleteUserProfile(user.id);
    logger.info('user_profile_deleted', { userId: user.id });
    return NextResponse.json({
      success: true,
      deleted: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
