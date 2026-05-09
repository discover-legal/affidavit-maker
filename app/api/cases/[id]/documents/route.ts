import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const linkSchema = z.object({
  document_id: z.union([z.string(), z.number()]),
});

// POST /api/cases/[id]/documents — link an existing document to a case.
export const POST = withAuth<{ id: string | string[] }>(async (req: NextRequest, { user, params }) => {
  try {
    const limit = checkRateLimit('cases-link-doc', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const caseId = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      throw new ValidationError('Invalid case ID');
    }
    const body = linkSchema.parse(await req.json().catch(() => ({})));
    const documentId = String(body.document_id);

    const caseRow = await query<{ user_id: string }>(
      'SELECT user_id FROM cases WHERE id = $1',
      [caseId],
    );
    if (!caseRow.rows.length) throw new NotFoundError('Case not found');
    if (caseRow.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');

    const docRow = await query<{ user_id: string }>(
      'SELECT user_id FROM documents WHERE id = $1',
      [documentId],
    );
    if (!docRow.rows.length) throw new NotFoundError('Document not found');
    if (docRow.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');

    await query('UPDATE documents SET case_id = $1 WHERE id = $2', [caseId, documentId]);

    return NextResponse.json({
      success: true,
      data: { linked: true, case_id: caseId, document_id: documentId },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
