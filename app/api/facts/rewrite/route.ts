import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';

export const runtime = 'nodejs';

const factSchema = z.object({
  fact: z.object({
    content: z.string().max(1000),
    category: z.string().optional(),
  }).passthrough(),
  allFacts: z.array(z.unknown()).optional(),
  factIndex: z.number().int().nonnegative().optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const userKey = (session?.user?.sub as string) ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const limit = checkRateLimit('facts-rewrite', userKey, RATE_LIMITS.chat);
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
    const professionalRewrite = await (factValidator as {
      generateProfessionalRewriteWithLLM: (
        fact: unknown,
        ctx: unknown,
        all: unknown,
        idx: unknown,
      ) => Promise<string>;
    }).generateProfessionalRewriteWithLLM(
      body.fact,
      body.context,
      body.allFacts,
      body.factIndex,
    );

    return NextResponse.json({
      success: true,
      professionalRewrite,
      original: body.fact.content,
      category: body.fact.category,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
