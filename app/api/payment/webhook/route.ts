import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { getStripe } from '@/lib/api/stripe';
import { getPool } from '@/lib/db';
import { readBody } from '@/lib/api/requestBody';
import {
  assertPaymentIntentBinding,
  type PaymentLedgerBinding,
} from '@/lib/api/paymentIntegrity';

export const runtime = 'nodejs';
// Webhook handlers must NOT consume the body before signature verification.
// Next.js Route Handlers expose `await req.text()` for the raw body.
export const dynamic = 'force-dynamic';

async function processPaymentSucceeded(client: PoolClient, intent: Stripe.PaymentIntent) {
  const billingDetails = (intent as unknown as { charges?: { data?: Array<{ billing_details?: { address?: { postal_code?: string } } }> } })
    .charges?.data?.[0]?.billing_details;
  const postalCode = billingDetails?.address?.postal_code ?? null;

  // Bind the payment row by BOTH the intent id and the user id captured in
  // metadata at intent-creation time (lib/api/payment/create-intent sets
  // metadata.userId server-side). If the intent's metadata is missing or
  // mismatched against our local payments row, the UPDATE matches zero rows
  // and we log loudly — better than a silent cross-user write.
  const paymentLookup = await client.query<
    PaymentLedgerBinding & { id: number; status: string; document_id: number | null }
  >(
    `SELECT id, user_id, document_id, amount_cents, currency, metadata, status
       FROM payments WHERE stripe_payment_intent_id = $1
       FOR UPDATE`,
    [intent.id],
  );
  if (paymentLookup.rows.length === 0) {
    console.error(
      JSON.stringify({
        level: 'warn',
        event: 'stripe_webhook_payment_row_missing',
        intentId: intent.id,
      }),
    );
    // Do not mark the event processed. Stripe retries give a concurrently
    // created ledger row time to commit and avoid permanently orphaning a
    // successful charge.
    throw new Error('Payment ledger row missing for succeeded intent');
  }
  const paymentRow = paymentLookup.rows[0];
  assertPaymentIntentBinding(intent, paymentRow);
  if (['refunded', 'disputed', 'partially_refunded'].includes(paymentRow.status)) {
    return;
  }

  const transitioned = await client.query(
    `UPDATE payments
        SET status = 'succeeded',
            stripe_charge_id = COALESCE($4, stripe_charge_id),
            billing_postal_code = COALESCE($1, billing_postal_code),
            succeeded_at = COALESCE(succeeded_at, CURRENT_TIMESTAMP),
            failed_at = NULL
      WHERE stripe_payment_intent_id = $2 AND user_id = $3
        AND status NOT IN ('refunded', 'disputed', 'partially_refunded')
      RETURNING id`,
    [
      postalCode,
      intent.id,
      paymentRow.user_id,
      typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id,
    ],
  );
  if (transitioned.rowCount === 0) return;

  const metadataDocumentId = parseIntegerMetadata(paymentRow.metadata?.documentId);
  const documentId = paymentRow.document_id ?? metadataDocumentId;
  if (documentId === null) {
    throw new Error('Payment ledger has no document entitlement binding');
  }
  if (documentId !== null) {
    if (
      metadataDocumentId === null ||
      (paymentRow.document_id !== null && paymentRow.document_id !== metadataDocumentId)
    ) {
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'stripe_webhook_invalid_document_binding',
          intentId: intent.id,
          relationalDocumentId: paymentRow.document_id,
          metadataDocumentId: String(paymentRow.metadata?.documentId).slice(0, 64),
        }),
      );
      throw new Error('Payment ledger has invalid document binding');
    }
    // Defense in depth: only flip payment_status when the document belongs
    // to the same user the payment is bound to. Metadata is server-set so
    // this should always hold; if it doesn't, something is very wrong.
    const updated = await client.query<{ id: number }>(
      `UPDATE documents
          SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [documentId, paymentRow.user_id],
    );
    if (updated.rowCount === 0) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'stripe_webhook_document_mismatch',
          intentId: intent.id,
          documentId,
          expectedUserId: paymentRow.user_id,
        }),
      );
      throw new Error('Payment document entitlement target is missing or mismatched');
    }
  }
}

async function processPaymentFailed(client: PoolClient, intent: Stripe.PaymentIntent) {
  const paymentLookup = await client.query<PaymentLedgerBinding>(
    `SELECT user_id, amount_cents, currency, metadata
       FROM payments WHERE stripe_payment_intent_id = $1`,
    [intent.id],
  );
  if (paymentLookup.rows.length === 0) {
    throw new Error('Payment ledger row missing for failed intent');
  }
  assertPaymentIntentBinding(intent, paymentLookup.rows[0]);
  await client.query(
    `UPDATE payments
        SET status = 'failed', failed_at = COALESCE(failed_at, CURRENT_TIMESTAMP)
      WHERE stripe_payment_intent_id = $1 AND status IN ('pending', 'requires_payment_method')`,
    [intent.id],
  );
}

async function revokeDocumentEntitlement(
  client: PoolClient,
  lookup: { paymentIntentId?: string; chargeId?: string },
  reason: 'refunded' | 'disputed',
  refundedAmountCents = 0,
) {
  const payment = await client.query<{
    id: number;
    document_id: number | null;
    stripe_payment_intent_id: string;
    user_id: number;
    amount_cents: number;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT id, document_id, stripe_payment_intent_id, user_id, amount_cents, metadata
       FROM payments
      WHERE ($1::text IS NOT NULL AND stripe_payment_intent_id = $1)
         OR ($2::text IS NOT NULL AND stripe_charge_id = $2)
      FOR UPDATE`,
    [lookup.paymentIntentId ?? null, lookup.chargeId ?? null],
  );
  if (!payment.rows.length) {
    throw new Error(`Payment ledger row missing for ${reason} intent`);
  }

  const row = payment.rows[0];
  const isFullRefund = reason === 'refunded' && refundedAmountCents >= row.amount_cents;
  const shouldRevoke = reason === 'disputed' || isFullRefund;
  const ledgerStatus =
    reason === 'refunded' && !isFullRefund ? 'partially_refunded' : reason;
  await client.query(
    `UPDATE payments
        SET status = CASE
              WHEN status = 'refunded' AND $2 = 'disputed' THEN status
              WHEN status = 'disputed' AND $2 = 'partially_refunded' THEN status
              ELSE $2
            END,
            refunded_amount_cents = GREATEST(refunded_amount_cents, $3),
            refund_reason = $4,
            refunded_at = CASE WHEN $5 THEN COALESCE(refunded_at, CURRENT_TIMESTAMP)
                               ELSE refunded_at END
      WHERE stripe_payment_intent_id = $1`,
    [
      row.stripe_payment_intent_id,
      ledgerStatus,
      refundedAmountCents,
      reason === 'disputed' ? 'Stripe dispute opened' : 'Stripe refund',
      shouldRevoke,
    ],
  );

  const documentId = row.document_id ?? parseIntegerMetadata(row.metadata?.documentId);
  if (documentId !== null) {
    const valid = await client.query(
      `SELECT 1 FROM payments
        WHERE user_id = $1
          AND (document_id = $2 OR (document_id IS NULL AND metadata->>'documentId' = $2::text))
          AND status IN ('succeeded', 'partially_refunded')
        LIMIT 1`,
      [row.user_id, documentId],
    );
    await client.query(
      `UPDATE documents
          SET payment_status = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2`,
      [documentId, row.user_id, valid.rows.length ? 'paid' : 'refunded'],
    );
  }
}

async function processDisputeClosed(client: PoolClient, dispute: Stripe.Dispute) {
  // Stripe's terminal "won" state means the charge was returned to us. Only
  // restore a row still marked disputed; a separate refund must remain revoked.
  if (dispute.status !== 'won') return;
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
  const payment = await client.query<{
    stripe_payment_intent_id: string;
    user_id: number;
    metadata: Record<string, unknown> | null;
    document_id: number | null;
  }>(
    `UPDATE payments
        SET status = CASE WHEN refunded_amount_cents > 0
                          THEN 'partially_refunded' ELSE 'succeeded' END,
            refund_reason = CASE WHEN refunded_amount_cents > 0
                                 THEN refund_reason ELSE NULL END,
            refunded_at = CASE WHEN refunded_amount_cents > 0
                               THEN refunded_at ELSE NULL END
      WHERE stripe_charge_id = $1 AND status = 'disputed'
      RETURNING stripe_payment_intent_id, user_id, metadata, document_id`,
    [chargeId],
  );
  if (!payment.rows.length) return;
  const row = payment.rows[0];
  const documentId = row.document_id ?? parseIntegerMetadata(row.metadata?.documentId);
  if (documentId !== null) {
    await client.query(
      `UPDATE documents
          SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND payment_status = 'refunded'`,
      [documentId, row.user_id],
    );
  }
}

/** Stripe metadata values are strings; validate they parse to a positive int. */
function parseIntegerMetadata(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw);
  if (!/^[1-9]\d{0,9}$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { success: false, error: 'Webhook not configured' },
      { status: 503 },
    );
  }
  if (!sig) {
    return NextResponse.json(
      { success: false, error: 'Missing stripe-signature' },
      { status: 400 },
    );
  }

  // Capture exact bytes with a hard ceiling before signature verification.
  // Stripe webhook events are small; a generous 256 KiB prevents an
  // unauthenticated request from forcing an unbounded allocation.
  let body: Uint8Array;
  try {
    body = await readBody(req, 256 * 1024);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook body' },
      { status: 413 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(body), sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return NextResponse.json(
      { success: false, error: 'Webhook signature verification failed' },
      { status: 400 },
    );
  }

  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    // Webhooks write across users (any user's payment may settle), so they
    // must bypass RLS. Scoped to this transaction via is_local=true.
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'true']);

    // Idempotency
    const existing = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM processed_webhook_events WHERE stripe_event_id = $1',
      [event.id],
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        eventId: event.id,
        eventType: event.type,
        previousStatus: existing.rows[0].status,
        timestamp: new Date().toISOString(),
      });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await processPaymentSucceeded(client, event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await processPaymentFailed(client, event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.canceled':
        // A canceled intent never succeeded; close out a still-pending ledger
        // row without touching any document entitlement.
        await client.query(
          `UPDATE payments SET status = 'canceled'
            WHERE stripe_payment_intent_id = $1
              AND status IN ('pending', 'requires_payment_method')`,
          [(event.data.object as Stripe.PaymentIntent).id],
        );
        break;
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) throw new Error('Refund has no payment intent');
        await revokeDocumentEntitlement(
          client,
          { paymentIntentId, chargeId: charge.id },
          'refunded',
          charge.amount_refunded,
        );
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
        await revokeDocumentEntitlement(client, { chargeId }, 'disputed');
        break;
      }
      case 'charge.dispute.closed':
        await processDisputeClosed(client, event.data.object as Stripe.Dispute);
        break;
      // Other event types are accepted and recorded as processed but do nothing.
    }

    await client.query(
      `INSERT INTO processed_webhook_events (stripe_event_id, event_type, status, processed_at)
       VALUES ($1, $2, 'success', CURRENT_TIMESTAMP)`,
      [event.id, event.type],
    );
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      eventId: event.id,
      eventType: event.type,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[stripe-webhook] processing error', err);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
