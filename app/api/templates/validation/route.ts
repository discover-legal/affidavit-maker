import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import history from '@/templates/validation-history.json';

// Public read-only endpoint (like the rest of /api/templates/*): serves the
// legal-validation changelog summaries so clients can show content freshness.
export const runtime = 'nodejs';

type Changelog = { date: string; type: string; claim?: string };
type Jurisdiction = {
  stateCode: string;
  stateName: string;
  lastVerified: string;
  changelog: Changelog[];
};

export async function GET(req: Request) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const jurisdictions = Object.values(history.jurisdictions as Record<string, Jurisdiction>).map((j) => ({
      stateCode: j.stateCode,
      stateName: j.stateName,
      lastVerified: j.lastVerified,
      verifications: j.changelog.filter((e) => e.type === 'verification').length,
      corrections: j.changelog.filter((e) => e.type === 'correction').length,
    }));
    return NextResponse.json({
      success: true,
      data: {
        generatedAt: history.generatedAt,
        methodology: history.methodology,
        jurisdictions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[templates/validation] failed', err);
    return toErrorResponse(err);
  }
}
