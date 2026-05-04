import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';

export const runtime = 'nodejs';

const bodySchema = z.object({
  affidavitData: z.object({
    state: z.string().optional(),
    affiantName: z.string().optional(),
    documentType: z.string().optional(),
    facts: z.array(z.unknown()).optional(),
  }).passthrough(),
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('validation', user.id, RATE_LIMITS.chat);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }
    const json = (await req.json().catch(() => ({}))) as unknown;
    const { affidavitData } = bodySchema.parse(json);
    if (!affidavitData) throw new ValidationError('affidavitData is required');

    const { templateManager, factValidator } = getServices();
    const validation = (templateManager as { validateDocument: (d: unknown) => Record<string, unknown> })
      .validateDocument(affidavitData);

    if (Array.isArray(affidavitData.facts) && affidavitData.facts.length > 0) {
      const factValidation = await (factValidator as {
        validateFactsBatchProfessional: (
          facts: unknown[],
          ctx: Record<string, unknown>,
        ) => Promise<{
          isValid: boolean;
          results: { errors: unknown[]; warnings: unknown[] }[];
        }>;
      }).validateFactsBatchProfessional(affidavitData.facts, {
        state: affidavitData.state,
        affiantName: affidavitData.affiantName,
        documentType: affidavitData.documentType ?? 'general',
      });

      (validation as { factValidation?: unknown }).factValidation = factValidation;
      if (!factValidation.isValid) {
        const errors = (validation.errors as unknown[]) ?? [];
        const warnings = (validation.warnings as unknown[]) ?? [];
        validation.isValid = false;
        validation.errors = [...errors, ...factValidation.results.flatMap((r) => r.errors)];
        validation.warnings = [...warnings, ...factValidation.results.flatMap((r) => r.warnings)];
      }
    }

    return NextResponse.json({ success: true, validation });
  } catch (err) {
    return toErrorResponse(err);
  }
});
