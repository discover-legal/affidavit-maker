import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import { getProcedure } from '@/lib/api/procedure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/procedure/:state
 * Per-state divorce procedure information (residency, waiting period,
 * service methods, deadlines, filing logistics) for the What's-next panel.
 *
 * PUBLIC read-only route — serves static procedure metadata, no user data.
 * IP rate-limited via rateLimitKey (same pattern as the templates routes).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { state: string } },
) {
  const limit = await checkRateLimit('procedure', rateLimitKey(req, 'procedure'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const { state } = params;

    if (!state || !/^[A-Za-z]{2}$/.test(state)) {
      throw new ValidationError('Invalid state code format. Must be a 2-letter state code.');
    }

    const procedure = getProcedure(state);
    if (!procedure) {
      return NextResponse.json(
        {
          success: false,
          error: `No procedure information is available for ${state.toUpperCase()} yet.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: procedure });
  } catch (err) {
    console.error('[procedure] failed', err);
    return toErrorResponse(err);
  }
}
