import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import history from '@/templates/validation-history.json';

// Public read-only endpoint (like the rest of /api/templates/*): serves one
// jurisdiction's legal-validation changelog — when each claim was verified,
// what was corrected, and against which sources — so users can judge the
// likelihood of correctness by recency.
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { state: string } },
) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const code = (params.state || '').toUpperCase();
    const jurisdictions = history.jurisdictions as Record<string, unknown>;
    const entry = jurisdictions[code];
    if (!entry) {
      return NextResponse.json(
        { success: false, error: `No validation history for jurisdiction "${code}"`, errorType: 'not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        generatedAt: history.generatedAt,
        methodology: history.methodology,
        jurisdiction: entry,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[templates/validation/state] failed', err);
    return toErrorResponse(err);
  }
}
