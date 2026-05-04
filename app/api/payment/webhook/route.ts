import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/api/stripe';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
// Webhook handlers must NOT consume the body before signature verification.
// Next.js Route Handlers expose `await req.text()` for the raw body.
export const dynamic = 'force-dynamic';

async function processPaymentSucceeded(client: Awaited<ReturnType<typeof pool.connect>>, intent: Stripe.PaymentIntent) {
  const billingDetails = (intent as unknown as { charges?: { data?: Array<{ billing_details?: { address?: { postal_code?: string } } }> } })
    .charges?.data?.[0]?.billing_details;
  const postalCode = billingDetails?.address?.postal_code ?? null;

  await client.query(
    `UPDATE payments
        SET status = 'succeeded',
            postal_code = COALESCE($1, postal_code),
            updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = $2`,
    [postalCode, intent.id],
  );

  const documentId = intent.metadata?.documentId;
  if (documentId && documentId !== 'new') {
    await client.query(
      `UPDATE documents SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [documentId],
    );
  }
}

async function processPaymentFailed(client: Awaited<ReturnType<typeof pool.connect>>, intent: Stripe.PaymentIntent) {
  await client.query(
    `UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE stripe_payment_intent_id = $1`,
    [intent.id],
  );
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
