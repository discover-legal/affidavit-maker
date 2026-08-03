import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { ExternalServiceError, toErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { getBigLawClient } from '@/lib/biglaw/client';
import { FACT_CATEGORIES } from '@/lib/biglaw/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  facts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES),
        predicate: z.string().min(1).max(64),
        value: z.string().min(1).max(2000),
        note: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(20),
});

// POST /api/firm/profile/propose — the client proposes profile updates to
// the firm (each created pending, approver=lawyer).
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('firm-propose', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const biglaw = getBigLawClient();
    if (!biglaw) {
      throw new ExternalServiceError('Firm mode is not enabled on this deployment');
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = bodySchema.parse(json);

    const proposals = await biglaw.proposeFacts(
      user.auth0Id,
      { email: user.email, name: user.name || user.email },
      body.facts.map((fact) => ({
        category: fact.category,
        predicate: fact.predicate,
        value: fact.value,
        note: fact.note ?? '',
      })),
    );

    logger.info('firm_facts_proposed', {
      userId: user.id,
      count: proposals.length,
    });

    return NextResponse.json(
      {
        success: true,
        data: { proposals },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
});
