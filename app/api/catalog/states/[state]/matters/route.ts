import { NextResponse } from 'next/server';
import { MATTER_TYPES, SUPPORTED_STATES, getAllJurisdictions } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { state: string } }) {
  const limit = await checkRateLimit('catalog', rateLimitKey(req, 'catalog'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const state = params.state.toUpperCase();
    const active = getAllJurisdictions();
    if (!active.includes(state)) {
      throw new NotFoundError(
        `"${state}" is not currently supported. Supported jurisdictions: ${active.join(', ')}`,
      );
    }
    const matters = MATTER_TYPES.filter((m) => {
      const supported = SUPPORTED_STATES[m.code];
      if (!supported) return true;
      return supported.includes(state);
    });
    return NextResponse.json({
      success: true,
      data: { state, matters },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
