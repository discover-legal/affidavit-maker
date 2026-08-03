import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  ExternalServiceError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { BigLawRequestError, getBigLawClient } from '@/lib/biglaw/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(2000).optional(),
});

/** BigLaw ids are opaque; constrain to a sane charset before interpolating
 * into the upstream path. */
const PROPOSAL_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

// POST /api/firm/profile/proposals/:proposalId/decision — the client
// approves or rejects a lawyer-proposed fact.
export const POST = withAuth<{ proposalId: string }>(async (req: NextRequest, { user, params }) => {
  try {
    const limit = checkRateLimit('firm-proposal-decision', user.id, RATE_LIMITS.standard);
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

    const proposalId = params.proposalId;
    if (!PROPOSAL_ID_PATTERN.test(proposalId)) {
      throw new ValidationError('Invalid proposal id');
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = bodySchema.parse(json);

    let fact;
    try {
      fact = await biglaw.decideProposal(
        proposalId,
        user.auth0Id,
        body.decision,
        body.note ?? '',
      );
    } catch (err) {
      // BigLaw returns 403 when the proposal isn't this client's to decide
      // (wrong profile, wrong approver role, or already decided).
      if (err instanceof BigLawRequestError && err.upstreamStatus === 403) {
        throw new AuthorizationError('This proposal is not yours to decide');
      }
      throw err;
    }

    logger.info('firm_proposal_decided', {
      userId: user.id,
      proposalId,
      decision: body.decision,
    });

    return NextResponse.json({
      success: true,
      data: { fact },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
