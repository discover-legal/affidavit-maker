import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AppError,
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
    const limit = await checkRateLimit('documents-by-id', user.id, RATE_LIMITS.standard);
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
    const limit = await checkRateLimit('documents-by-id', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const id = parseDocumentId(params);
    // Ownership + payment-state check in one statement, BEFORE any
    // destructive work: a document whose payment is still processing must
    // not be deleted (and its evidence must not be wiped either).
    const existing = await query<{ has_active_payment: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM payments p
          WHERE p.user_id = $2
            AND (p.document_id = d.id OR
                 (p.document_id IS NULL AND p.metadata->>'documentId' = d.id::text))
            AND p.status NOT IN (
              'failed', 'canceled', 'succeeded',
              'partially_refunded', 'refunded', 'disputed'
            )
       ) AS has_active_payment
         FROM documents d
        WHERE d.id = $1 AND d.user_id = $2`,
      [id, user.id],
    );
    if (!existing.rows.length) throw new NotFoundError('Document not found');
    if (existing.rows[0].has_active_payment) {
      throw new AppError(
        'This document cannot be deleted while its payment is processing.',
        409,
        'PaymentInProgress',
      );
    }

    // Remove sensitive files while the owned row still exists, so a failed
    // cleanup remains retryable and can never be orphaned by a committed DB
    // deletion. A later DB failure may require re-uploading evidence, but it
    // does not leave undeletable private files behind. Cleanup is bounded to
    // the authenticated user's exact document directory.
    const evidenceStorage = require('@/services/evidenceStorage') as {
      deleteDocumentEvidence: (userId: number, documentId: number) => Promise<unknown>;
    };
    await evidenceStorage.deleteDocumentEvidence(user.id, id);

    // Single DELETE with `RETURNING id` — if the row didn't belong to us, the
    // affected count is zero and we 404. No probe oracle.
    const deleted = await query<{ id: number }>(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id],
    );
    if (deleted.rowCount === 0) throw new NotFoundError('Document not found');
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    return toErrorResponse(err);
  }
});
