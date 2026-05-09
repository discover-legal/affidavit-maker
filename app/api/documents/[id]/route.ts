import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IdParams = { id: string | string[] };

function getId(params: IdParams): string {
  return Array.isArray(params.id) ? params.id[0] : params.id;
}

// GET /api/documents/[id]
export const GET = withAuth<IdParams>(async (_req, { user, params }) => {
  try {
    const limit = checkRateLimit('documents-by-id', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const id = getId(params);
    const row = await query<Record<string, unknown>>(
      `SELECT * FROM documents WHERE id = $1`,
      [id],
    );
    if (!row.rows.length) throw new NotFoundError('Document not found');
    if (row.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');
    return NextResponse.json({ success: true, document: row.rows[0] });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// DELETE /api/documents/[id]
export const DELETE = withAuth<IdParams>(async (_req, { user, params }) => {
  try {
    const limit = checkRateLimit('documents-by-id', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const id = getId(params);
    const row = await query<{ user_id: number }>(
      'SELECT user_id FROM documents WHERE id = $1',
      [id],
    );
    if (!row.rows.length) throw new NotFoundError('Document not found');
    if (row.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');
    await query('DELETE FROM documents WHERE id = $1', [id]);
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    return toErrorResponse(err);
  }
});
