import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getBigLawClient } from '@/lib/biglaw/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY_PROFILE = {
  profile: null,
  facts: [],
  pendingYourApproval: [],
  pendingLawyerApproval: [],
} as const;

// GET /api/firm/profile — the client's CRM profile at the firm. Null-safe:
// firm mode off, or a client the firm has never seen (upstream 404), both
// return the empty shape so the UI renders a clean empty state.
export const GET = withAuth(async (_req, { user }) => {
  try {
    const limit = checkRateLimit('firm-profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const biglaw = getBigLawClient();
    if (!biglaw) {
      return NextResponse.json({
        success: true,
        data: EMPTY_PROFILE,
        timestamp: new Date().toISOString(),
      });
    }

    const profile = await biglaw.getClientProfile(user.auth0Id);
    return NextResponse.json({
      success: true,
      data: profile ?? EMPTY_PROFILE,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
