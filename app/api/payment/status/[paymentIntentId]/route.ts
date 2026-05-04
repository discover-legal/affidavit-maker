import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getStripe } from '@/lib/api/stripe';
import { query } from '@/lib/db';
import { AuthorizationError, toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export const GET = withAuth<{ paymentIntentId: string | string[] }>(async (_req, { user, params }) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Payment processing is currently unavailable' },
        { status: 503 },
      );
    }
    const paymentIntentId = Array.isArray(params.paymentIntentId)
      ? params.paymentIntentId[0]
      : params.paymentIntentId;

    const row = await query<{ id: string; status: string; amount_cents: number; created_at: Date }>(
      'SELECT id, status, amount_cents, created_at FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
      [paymentIntentId, user.id],
    );
    if (!row.rows.length) throw new AuthorizationError('Payment not found or access denied');
    const payment = row.rows[0];

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (payment.status !== intent.status) {
      await query(
        'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $2',
        [intent.status, paymentIntentId],
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId,
        status: intent.status,
        amount: payment.amount_cents,
        currency: 'usd',
        createdAt: payment.created_at,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
