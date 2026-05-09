import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/tos-status — read-only query for the SPA's TOSGuard.
 *
 * Returns the current TOS acceptance state for the authenticated user.
 * Mirrors the legacy routes/auth.js GET /tos-status endpoint.
 */
export const GET = withAuth(async (_req, { user }) => {
  try {
    const row = await query<{
      tos_accepted: boolean | null;
      tos_accepted_at: Date | null;
      tos_version_accepted: string | null;
    }>(
      `SELECT tos_accepted, tos_accepted_at, tos_version_accepted
         FROM users
        WHERE id = $1`,
      [user.id],
    );

    const record = row.rows[0];
    return NextResponse.json({
      success: true,
      tosAccepted: record?.tos_accepted ?? false,
      tosAcceptedAt: record?.tos_accepted_at ?? null,
      tosVersionAccepted: record?.tos_version_accepted ?? null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
