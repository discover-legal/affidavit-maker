import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ValidationResult = {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
};

type DivorceMetadata = {
  requiredFields?: string[];
};

type TemplateManagerLike = {
  validateDivorceData?: (
    stateCode: string,
    data: Record<string, unknown>,
    documentType: string,
  ) => ValidationResult;
  validateAffidavitData: (
    stateCode: string,
    data: Record<string, unknown>,
    documentType?: string,
  ) => ValidationResult;
  getMetadata: (stateCode: string, documentType: string) => DivorceMetadata | null | undefined;
};

const VALID_DOC_TYPES = ['divorce_petition', 'divorce_decree'] as const;

const bodySchema = z
  .object({
    state: z.string(),
    documentType: z.enum(VALID_DOC_TYPES).optional(),
    divorceData: z.record(z.unknown()).optional(),
    data: z.record(z.unknown()).optional(),
  })
  .refine((b) => b.divorceData || b.data, {
    message: 'divorceData (or data) is required',
  });

/**
 * POST /api/templates/divorce/validate
 * Validates divorce data against a state-specific template.
 * Accepts `{ state, divorceData }` (preferred) or the legacy
 * `{ state, documentType, data }` shape.
 */
export async function POST(req: NextRequest) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates-divorce-validate'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = bodySchema.parse(json);
    const { state } = body;
    const documentType = body.documentType ?? 'divorce_petition';
    const data = (body.divorceData ?? body.data) as Record<string, unknown>;

    if (!/^[A-Za-z]{2}$/.test(state)) {
      throw new ValidationError('Invalid state code format. Must be a 2-letter state code.');
    }

    const stateCode = state.toUpperCase();

    const { templateManager } = await getServices();
    const tm = templateManager as TemplateManagerLike;

    let validation: ValidationResult;
    try {
      // Prefer the divorce-aware validator when present (StateTemplateManager
      // exposes validateDivorceData(state, data, documentType)). Fall back to
      // the affidavit validator with a 3rd-arg documentType, matching the
      // legacy templates.js behavior.
      validation = typeof tm.validateDivorceData === 'function'
        ? tm.validateDivorceData(stateCode, data, documentType)
        : tm.validateAffidavitData(stateCode, data, documentType);
    } catch (innerErr) {
      console.error('[templates/divorce/validate] template threw', innerErr);
      return NextResponse.json({
        success: true,
        data: {
          isValid: false,
          errors: ['Validation service temporarily unavailable'],
          warnings: [],
          completionPercentage: 0,
          state: stateCode,
          documentType,
        },
      });
    }

    // Completion percentage based on the template's required fields.
    const metadata = tm.getMetadata(stateCode, documentType);
    const requiredFields = metadata?.requiredFields ?? [
      'petitionerName',
      'respondentName',
      'state',
    ];
    const filledRequired = requiredFields.filter((field) => {
      const v = data[field];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    const completionPercentage = requiredFields.length === 0
      ? 100
      : Math.round((filledRequired.length / requiredFields.length) * 100);

    return NextResponse.json({
      success: true,
      data: {
        isValid: !!validation.isValid,
        errors: validation.errors ?? [],
        warnings: validation.warnings ?? [],
        completionPercentage,
        state: stateCode,
        documentType,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
