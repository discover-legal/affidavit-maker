import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { documentId: string };

function validateDocumentId(raw: string): number {
  const num = parseInt(raw, 10);
  if (
    !Number.isFinite(num) ||
    num < 1 ||
    num > 2147483647 ||
    String(num) !== raw.trim()
  ) {
    throw new ValidationError('Invalid document ID');
  }
  return num;
}

// GET /api/evidence/document/:documentId — list evidence files attached to a
// document the authenticated user owns. Ports routes/evidence.js#listForDocument.
export const GET = withAuth<Params>(async (_req: NextRequest, { user, params }) => {
  try {
    const limit = checkRateLimit('evidence-list', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const documentId = validateDocumentId(params.documentId);

    const docRow = await query<{ user_id: number }>(
      'SELECT user_id FROM documents WHERE id = $1',
      [documentId],
    );
    if (!docRow.rows.length) throw new NotFoundError('Document not found');
    if (docRow.rows[0].user_id !== user.id) {
      throw new AuthorizationError('Access denied');
    }

    const evidenceStorage = require('@/services/evidenceStorage') as {
      listEvidenceForDocument: (
        userId: number,
        documentId: number,
      ) => Promise<Array<Record<string, unknown>>>;
    };

    const evidence = await evidenceStorage.listEvidenceForDocument(user.id, documentId);

    logger.info('evidence_listed', {
      userId: user.id,
      documentId,
      count: evidence.length,
    });

    return NextResponse.json({ success: true, evidence });
  } catch (err) {
    return toErrorResponse(err);
  }
});
