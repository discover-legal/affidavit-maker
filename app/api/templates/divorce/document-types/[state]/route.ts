import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DocumentMetadata = {
  documentTitle?: string;
  description?: string | null;
};

type TemplateManagerLike = {
  getDocumentTypes: (stateCode: string) => string[];
  getMetadata: (stateCode: string, documentType: string) => DocumentMetadata | null | undefined;
};

function humanizeDocumentType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * GET /api/templates/divorce/document-types/:state
 * Returns the divorce document types available for a given state.
 */
export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ state: string }> },
) {
  const params = await paramsPromise;
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
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

    const stateCode = state.toUpperCase();
    const { templateManager } = await getServices();
    const tm = templateManager as TemplateManagerLike;

    const allDocTypes = tm.getDocumentTypes(stateCode);
    const divorceDocTypes = allDocTypes.filter(
      (type) => type === 'divorce_petition' || type === 'divorce_decree',
    );

    const documentTypes = divorceDocTypes.map((type) => {
      const metadata = tm.getMetadata(stateCode, type);
      return {
        type,
        name: metadata?.documentTitle || humanizeDocumentType(type),
        available: true,
        description: metadata?.description ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        stateCode,
        documentTypes,
      },
    });
  } catch (err) {
    console.error('[templates/divorce/document-types] failed', err);
    return toErrorResponse(err);
  }
}
