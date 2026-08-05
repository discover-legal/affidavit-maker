import { NextResponse } from 'next/server';
import { MATTER_MAP, DOCS_BY_MATTER } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { code: string } }) {
  const limit = await checkRateLimit('catalog', rateLimitKey(req, 'catalog'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    if (!MATTER_MAP[params.code]) {
      throw new NotFoundError(`Matter type "${params.code}" not found`);
    }
    return NextResponse.json({
      success: true,
      data: { matter_code: params.code, documents: DOCS_BY_MATTER[params.code] ?? [] },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
