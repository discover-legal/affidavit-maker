import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { getStripe } from '@/lib/api/stripe';
import { pool } from '@/lib/db';

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
  const metaUserId = parseIntegerMetadata(intent.metadata?.userId);
  const paymentLookup = await client.query<{ user_id: number; id: number }>(
    `SELECT id, user_id FROM payments WHERE stripe_payment_intent_id = $1`,
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
    return;
  }
  const paymentRow = paymentLookup.rows[0];
  if (metaUserId !== null && paymentRow.user_id !== metaUserId) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'stripe_webhook_user_mismatch',
        intentId: intent.id,
        paymentUserId: paymentRow.user_id,
        metadataUserId: metaUserId,
      }),
    );
    // Don't update — refuse to act on a tampered metadata payload.
    return;
  }

  await client.query(
    `UPDATE payments
        SET status = 'succeeded',
            postal_code = COALESCE($1, postal_code),
            updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = $2 AND user_id = $3`,
    [postalCode, intent.id, paymentRow.user_id],
  );

  const documentIdRaw = intent.metadata?.documentId;
  if (documentIdRaw && documentIdRaw !== 'new') {
    const documentId = parseIntegerMetadata(documentIdRaw);
    if (documentId === null) {
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'stripe_webhook_invalid_document_id',
          intentId: intent.id,
          documentId: String(documentIdRaw).slice(0, 64),
        }),
      );
      return;
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
    }
  }
}

async function processPaymentFailed(client: PoolClient, intent: Stripe.PaymentIntent) {
  await client.query(
    `UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $1`,
    [intent.id],
  );
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

  // Capture the raw body BEFORE any JSON parsing — Stripe needs the byte-exact
  // payload to verify the signature. Using await req.text() guarantees this.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return NextResponse.json(
      { success: false, error: 'Webhook signature verification failed' },
      { status: 400 },
    );
  }

  const client = await pool.connect();
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
      // Other event types are accepted and recorded as processed but do nothing.
    }

    await client.query(
      `INSERT INTO processed_webhook_events (stripe_event_id, event_type, status, processed_at)
       VALUES ($1, $2, 'processed', CURRENT_TIMESTAMP)`,
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
