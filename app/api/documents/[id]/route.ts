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
    // Single DELETE with `RETURNING id` — if the row didn't belong to us, the
    // affected count is zero and we 404. No probe oracle.
    const deleted = await query<{ id: number }>(
      `DELETE FROM documents d
        WHERE d.id = $1 AND d.user_id = $2
          AND NOT EXISTS (
            SELECT 1
              FROM payments p
             WHERE p.user_id = $2
               AND (p.document_id = d.id OR
                    (p.document_id IS NULL AND p.metadata->>'documentId' = d.id::text))
               AND p.status NOT IN (
                 'failed', 'canceled', 'succeeded',
                 'partially_refunded', 'refunded', 'disputed'
               )
          )
        RETURNING d.id`,
      [id, user.id],
    );
    if (deleted.rowCount === 0) {
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
      throw new AppError('Document could not be deleted', 409, 'DocumentDeleteConflict');
    }

    // The database row is authoritative. Disk cleanup is bounded to the
    // authenticated user's exact document directory and retried briefly.
    const evidenceStorage = require('@/services/evidenceStorage') as {
      deleteEvidenceForDocument: (userId: number, documentId: number) => Promise<unknown>;
    };
    let cleanupError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await evidenceStorage.deleteEvidenceForDocument(user.id, id);
        cleanupError = undefined;
        break;
      } catch (err) {
        cleanupError = err;
      }
    }
    if (cleanupError) {
      const { logger } = await import('@/lib/logger');
      logger.error('document_evidence_cleanup_failed', {
        userId: user.id,
        documentId: id,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    return toErrorResponse(err);
  }
});
