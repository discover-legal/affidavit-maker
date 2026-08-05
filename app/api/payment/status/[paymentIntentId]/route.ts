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
import {
  assertPaymentIntentBinding,
  type PaymentLedgerBinding,
} from '@/lib/api/paymentIntegrity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe PaymentIntent IDs look like `pi_<24+ alnum>` (test) or `pi_3..`
// (live). Lock the URL parameter to that shape so we never make an outbound
// call to Stripe with attacker-crafted input.
const PI_ID = /^pi_[A-Za-z0-9]{14,80}$/;

export const GET = withAuth<{ paymentIntentId: string | string[] }>(async (_req, { user, params }) => {
  try {
    // Polling uses a short bounded burst after checkout; the standard bucket
    // allows that recovery flow without opening an unbounded Stripe API sink.
    const limit = await checkRateLimit('payment-status', user.id, RATE_LIMITS.standard);
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

    const row = await query<PaymentLedgerBinding & {
      id: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT id, user_id, status, amount_cents, created_at, currency, metadata
         FROM payments
        WHERE stripe_payment_intent_id = $1 AND user_id = $2`,
      [paymentIntentId, user.id],
    );
    // Refuse to admit existence of someone else's PaymentIntent — always 404.
    if (!row.rows.length) throw new NotFoundError('Payment not found');
    const payment = row.rows[0];

    // A succeeded PaymentIntent remains "succeeded" after a later refund or
    // dispute. The local revocation state is authoritative; never let polling
    // resurrect an entitlement that a webhook revoked.
    if (payment.status === 'refunded' || payment.status === 'disputed') {
      return NextResponse.json({
        success: true,
        data: {
          paymentIntentId,
          status: payment.status,
          amount: payment.amount_cents,
          currency: payment.currency ?? 'usd',
          createdAt: payment.created_at,
          entitlementReady: false,
          documentId: payment.metadata?.documentId ?? null,
        },
      });
    }
    if (payment.status === 'partially_refunded') {
      return NextResponse.json({
        success: true,
        data: {
          paymentIntentId,
          status: 'succeeded',
          amount: payment.amount_cents,
          currency: payment.currency ?? 'usd',
          createdAt: payment.created_at,
          entitlementReady: true,
          documentId: payment.metadata?.documentId ?? null,
        },
      });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    assertPaymentIntentBinding(intent, payment);

    let entitlementReady = intent.status === 'succeeded';
    const documentIdRaw = payment.metadata?.documentId;
    await withRLSBypass(async () => {
      const transitioned = await query<{ status: string }>(
        `UPDATE payments
            SET status = $1,
                succeeded_at = CASE
                  WHEN $1 = 'succeeded' THEN COALESCE(succeeded_at, CURRENT_TIMESTAMP)
                  ELSE succeeded_at
                END,
                failed_at = CASE
                  WHEN $1 = 'succeeded' THEN NULL
                  ELSE failed_at
                END
          WHERE stripe_payment_intent_id = $2 AND user_id = $3
            AND status NOT IN ('refunded', 'disputed', 'partially_refunded')
          RETURNING status`,
        [intent.status, paymentIntentId, user.id],
      );
      if (transitioned.rowCount === 0) {
        entitlementReady = false;
        return;
      }

      if (intent.status === 'succeeded' && documentIdRaw !== null && documentIdRaw !== undefined) {
        const documentId = Number(documentIdRaw);
        if (!Number.isSafeInteger(documentId) || documentId < 1 || documentId > 2_147_483_647) {
          throw new ValidationError('Payment has invalid document metadata');
        }
        // Polling recovers when Stripe reaches the browser before its webhook.
        const updated = await query(
          `UPDATE documents
              SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING id`,
          [documentId, user.id],
        );
        entitlementReady = updated.rows.length === 1;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentIntentId,
        status: intent.status,
        amount: payment.amount_cents,
        currency: payment.currency ?? 'usd',
        createdAt: payment.created_at,
        entitlementReady,
        documentId:
          documentIdRaw === null || documentIdRaw === undefined
            ? null
            : Number(documentIdRaw),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
