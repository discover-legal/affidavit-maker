import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/documents — list documents for the current user.
export const GET = withAuth(async (_req, { user }) => {
  try {
    const limit = checkRateLimit('documents-list', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const result = await query(
      `SELECT id, title, document_type, template_state, status, payment_status,
              case_id, created_at, updated_at, content
         FROM documents
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 200`,
      [user.id],
    );

    // Hydrate convenience fields from JSONB content (mirrors legacy shape).
    const documents = result.rows.map((row: Record<string, unknown>) => {
      const content = (row.content ?? {}) as Record<string, unknown>;
      return {
        ...row,
        affiantName: content.affiantName ?? null,
        state: content.state ?? row.template_state,
        county: content.county ?? null,
        facts: content.facts ?? [],
      };
    });

    return NextResponse.json({ success: true, data: { documents } });
  } catch (err) {
    return toErrorResponse(err);
  }
});
