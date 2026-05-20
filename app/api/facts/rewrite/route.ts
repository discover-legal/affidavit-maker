import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/facts/rewrite
 *
 * Authenticated endpoint that calls the LLM to professionally rewrite a
 * fact the user typed in the editor. Auth + per-user rate limits are
 * mandatory — this route was previously unauthenticated with an
 * IP-keyed limiter that was trivially spoofable (security audit
 * finding C-3 / H-1, May 2026). Letting unauthenticated traffic hit
 * the LLM means a stranger can run up the OpenAI bill at will.
 */

const factSchema = z.object({
  fact: z
    .object({
      content: z.string().min(1).max(1000),
      category: z.string().max(64).optional(),
    })
    .passthrough(),
  // The other inputs travel as opaque blobs to the LLM prompt. We cap the
  // total payload to keep prompt-injection-by-volume bounded and to limit
  // the OpenAI tokens billed per request.
  allFacts: z.array(z.unknown()).max(200).optional(),
  factIndex: z.number().int().nonnegative().max(1000).optional(),
  context: z.record(z.unknown()).optional(),
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('facts-rewrite', user.id, RATE_LIMITS.chat);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = factSchema.parse(await req.json().catch(() => ({})));
    if (!body.fact?.content) {
      throw new ValidationError('Fact content is required');
    }

    const { factValidator } = await getServices();
    const professionalRewrite = await (
      factValidator as {
        generateProfessionalRewriteWithLLM: (
          fact: unknown,
          ctx: unknown,
          all: unknown,
          idx: unknown,
        ) => Promise<string>;
      }
    ).generateProfessionalRewriteWithLLM(
      body.fact,
      body.context,
      body.allFacts,
      body.factIndex,
    );

    logger.info('facts_rewrite', {
      userId: user.id,
      inputLength: body.fact.content.length,
      outputLength: professionalRewrite?.length ?? 0,
    });

    return NextResponse.json({
      success: true,
      professionalRewrite,
      original: body.fact.content,
      category: body.fact.category,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
