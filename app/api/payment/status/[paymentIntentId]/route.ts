import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getStripe } from '@/lib/api/stripe';
import { query, withRLSBypass } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe PaymentIntent IDs look like `pi_<24+ alnum>` (test) or `pi_3..`
// (live). Lock the URL parameter to that shape so we never make an outbound
// call to Stripe with attacker-crafted input.
const PI_ID = /^pi_[A-Za-z0-9]{14,80}$/;

export const GET = withAuth<{ paymentIntentId: string | string[] }>(async (_req, { user, params }) => {
  try {
    // Tighter rate limit on this endpoint — it makes a synchronous outbound
    // call to Stripe and writes the DB when the status differs. The SPA's
    // success page polls this; 20/15min keeps that comfortable while
    // blocking the "spam status to drive Stripe API spend" abuse.
    const limit = checkRateLimit('payment-status', user.id, RATE_LIMITS.strict);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

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
    if (!paymentIntentId || !PI_ID.test(paymentIntentId)) {
      throw new ValidationError('Invalid payment intent ID');
    }

    const row = await query<{ id: string; status: string; amount_cents: number; created_at: Date; currency: string }>(
      'SELECT id, status, amount_cents, created_at, currency FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
      [paymentIntentId, user.id],
    );
    // Refuse to admit existence of someone else's PaymentIntent — always 404.
    if (!row.rows.length) throw new NotFoundError('Payment not found');
    const payment = row.rows[0];

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Only the webhook is supposed to flip a payment's terminal status. To
    // avoid this poll endpoint racing the webhook into an inconsistent
    // state, we only ever advance OUT of a non-terminal status. Terminal
    // statuses (succeeded / canceled / failed) are write-once.
    const TERMINAL = new Set(['succeeded', 'canceled', 'failed']);
    if (!TERMINAL.has(payment.status) && payment.status !== intent.status) {
      await withRLSBypass(async () => {
        await query(
          `UPDATE payments
              SET status = $1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE stripe_payment_intent_id = $2
              AND user_id = $3
              AND status NOT IN ('succeeded','canceled','failed')`,
          [intent.status, paymentIntentId, user.id],
        );
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId,
        status: intent.status,
        amount: payment.amount_cents,
        currency: payment.currency ?? 'usd',
        createdAt: payment.created_at,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
