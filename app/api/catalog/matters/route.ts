import { NextRequest, NextResponse } from 'next/server';
import { MATTER_TYPES } from '@/lib/api/catalog-data';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = checkRateLimit('catalog', ip, RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const practiceArea = req.nextUrl.searchParams.get('practice_area');
    let matters = MATTER_TYPES;
    if (practiceArea) {
      if (practiceArea !== 'family' && practiceArea !== 'civil') {
        throw new ValidationError('practice_area must be "family" or "civil"');
      }
      matters = matters.filter((m) => m.practice_area === practiceArea);
    }
    return NextResponse.json({
      success: true,
      data: { matters },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
