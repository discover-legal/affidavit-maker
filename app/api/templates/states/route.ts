import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const { templateManager } = await getServices();
    const states = (templateManager as {
      getSupportedStates: () => Array<{ code: string; name: string; requirements: unknown }>;
    }).getSupportedStates();
    const transformed = states.map((s) => ({
      stateCode: s.code,
      stateName: s.name,
      requirements: s.requirements,
    }));
    return NextResponse.json(transformed);
  } catch (err) {
    console.error('[templates/states] failed', err);
    return toErrorResponse(err);
  }
}
