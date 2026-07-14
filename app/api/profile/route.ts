import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { getUserProfile, deleteUserProfile, updateUserProfile } from '@/lib/api/profile';
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

// PATCH /api/profile — explicit "fix my story" edits from the profile page.
// Provided fields are set verbatim (empty clears); whitelisting happens in
// updateUserProfile so per-document state can never be written here.
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const patch = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new ValidationError('A JSON object of fields to update is required');
    }
    if (JSON.stringify(patch).length > 64 * 1024) {
      throw new ValidationError('Update too large');
    }

    const updated = await updateUserProfile(user.id, patch);
    logger.info('user_profile_edited', { userId: user.id, fields: Object.keys(patch) });
    return NextResponse.json({
      success: true,
      data: updated,
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
