import { NextRequest, NextResponse } from 'next/server';
import {
  ExternalServiceError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AffidavitTypeRegistry = {
  getType: (typeId: string) => unknown | null;
};

function loadRegistry(): AffidavitTypeRegistry | null {
  try {
    return require('@/services/affidavits/AffidavitTypeRegistry') as AffidavitTypeRegistry;
  } catch {
    return null;
  }
}

/**
 * GET /api/templates/affidavit-types/:typeId
 * Returns metadata for a single affidavit type.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { typeId: string } },
) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const { typeId } = params;

    if (!typeId || !/^[a-z_]{1,60}$/.test(typeId)) {
      throw new ValidationError('Invalid type ID format.');
    }

    const registry = loadRegistry();
    if (!registry) {
      throw new ExternalServiceError('Registry not available.');
    }

    const type = registry.getType(typeId);
    if (!type) {
      throw new NotFoundError('Affidavit type not found.');
    }

    return NextResponse.json({ success: true, type });
  } catch (err) {
    return toErrorResponse(err);
  }
}
