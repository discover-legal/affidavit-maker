import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export const GET = withAuth(async (_req, { user }) => {
  try {
    const result = await query(
      `SELECT id, stripe_payment_intent_id, amount_cents, currency, status, metadata,
              created_at, succeeded_at, failed_at, refunded_at
         FROM payments
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [user.id],
    );
    return NextResponse.json({ success: true, data: { payments: result.rows } });
  } catch (err) {
    return toErrorResponse(err);
  }
});
