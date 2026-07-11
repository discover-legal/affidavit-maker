import { NextResponse } from 'next/server';
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

type IdParams = { id: string | string[] };

/**
 * Validate and parse a document id from the URL. We refuse anything that
 * isn't a positive 32-bit integer so a non-numeric value never reaches pg
 * (which would otherwise return a 500 with a Postgres error string, leaking
 * a small amount of internal state).
 */
function parseDocumentId(params: IdParams): number {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!raw || typeof raw !== 'string') throw new ValidationError('Invalid document ID');
  if (!/^[1-9]\d{0,9}$/.test(raw.trim())) throw new ValidationError('Invalid document ID');
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 1 || n > 2_147_483_647) throw new ValidationError('Invalid document ID');
  return n;
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

    const id = parseDocumentId(params);
    // Combined ownership + fetch in one statement. RLS will already filter,
    // but the explicit `AND user_id = $2` predicate keeps the check obvious
    // and survives any future "system bypass" handler that forgets it.
    //
    // NOTE: SELECT * intentionally includes `conversation_history` (JSONB) —
    // the client restores the chat transcript from it when a saved document
    // is reopened (DocumentContext.loadDocument). If this ever becomes an
    // explicit column list, keep conversation_history in it.
    const row = await query<Record<string, unknown>>(
      `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!row.rows.length) {
      // Probe protection: don't tell the caller whether the row exists for
      // someone else. Always 404.
      throw new NotFoundError('Document not found');
    }
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

    const id = parseDocumentId(params);
    // Single DELETE with `RETURNING id` — if the row didn't belong to us, the
    // affected count is zero and we 404. No probe oracle.
    const deleted = await query<{ id: number }>(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id],
    );
    if (deleted.rowCount === 0) throw new NotFoundError('Document not found');
    // Suppress unused import warning for AuthorizationError; left in scope
    // for symmetry with the other handlers in this folder.
    void AuthorizationError;
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    return toErrorResponse(err);
  }
});
