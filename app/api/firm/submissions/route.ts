import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { ExternalServiceError, toErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { isFirmMode } from '@/lib/biglaw/config';
import { getBigLawClient } from '@/lib/biglaw/client';
import {
  normalizeSubmissionStatus,
  type IntakeSubmissionDetail,
} from '@/lib/biglaw/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Budget for the live BigLaw status refresh; on timeout we fall back to
 * the locally-stored status so the dashboard never blocks on the firm. */
const LIVE_REFRESH_TIMEOUT_MS = 5000;

type FirmSubmissionRow = {
  id: number;
  document_id: number;
  biglaw_submission_id: string;
  status: string;
  conflict: boolean;
  firm_note: string | null;
  created_at: string;
  updated_at: string;
};

// GET /api/firm/submissions — the current user's firm submissions, decorated
// with live status from BigLaw when reachable (data.live indicates whether
// the refresh succeeded).
export const GET = withAuth(async (_req, { user }) => {
  try {
    const limit = checkRateLimit('firm-submissions', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    if (!isFirmMode()) {
      throw new ExternalServiceError('Firm mode is not enabled on this deployment');
    }

    const local = await query<FirmSubmissionRow>(
      `SELECT id, document_id, biglaw_submission_id, status, conflict, firm_note,
              created_at, updated_at
         FROM firm_submissions
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [user.id],
    );

    if (!local.rows.length) {
      return NextResponse.json({
        success: true,
        data: { submissions: [], live: true },
        timestamp: new Date().toISOString(),
      });
    }

    // Live refresh — one call decorates every row. Degrade gracefully: a
    // slow or unreachable BigLaw must never break the dashboard.
    let remoteById = new Map<string, IntakeSubmissionDetail>();
    let live = false;
    const biglaw = getBigLawClient();
    if (biglaw) {
      try {
        const remote = await biglaw.getClientSubmissions(user.auth0Id, {
          timeoutMs: LIVE_REFRESH_TIMEOUT_MS,
        });
        remoteById = new Map(remote.map((s) => [s.id, s]));
        live = true;
      } catch (err) {
        logger.warn('firm_submissions_live_refresh_failed', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const submissions = [];
    for (const row of local.rows) {
      let status = normalizeSubmissionStatus(row.status);
      let conflict = row.conflict;
      let note = row.firm_note;
      let updatedAt = row.updated_at;

      const remote = live ? remoteById.get(row.biglaw_submission_id) : undefined;
      if (remote) {
        const remoteStatus = normalizeSubmissionStatus(remote.status);
        const remoteNote =
          typeof remote.note === 'string' && remote.note ? remote.note : null;
        const remoteConflict = Boolean(remote.conflict?.hasConflict);

        if (
          remoteStatus !== status ||
          remoteConflict !== conflict ||
          (remoteNote ?? '') !== (note ?? '')
        ) {
          // Opportunistic sync — best-effort, the response reflects the
          // live values regardless.
          try {
            await query(
              `UPDATE firm_submissions
                  SET status = $1, conflict = $2, firm_note = $3, updated_at = NOW()
                WHERE id = $4 AND user_id = $5`,
              [remoteStatus, remoteConflict, remoteNote, row.id, user.id],
            );
          } catch (dbErr) {
            logger.warn('firm_submissions_sync_failed', {
              userId: user.id,
              firmSubmissionId: row.id,
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          }
        }

        status = remoteStatus;
        conflict = remoteConflict;
        note = remoteNote;
        if (remote.updatedAt) updatedAt = remote.updatedAt;
      }

      submissions.push({
        documentId: row.document_id,
        biglawSubmissionId: row.biglaw_submission_id,
        status,
        conflict,
        note,
        createdAt: row.created_at,
        updatedAt,
      });
    }

    return NextResponse.json({
      success: true,
      data: { submissions, live },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
