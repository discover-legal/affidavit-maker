import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { getStripe } from '@/lib/api/stripe';
import { getLocale } from '@/lib/locale.server';
import {
  getPrice,
  getOriginalPrice,
  LAUNCH_PRICING_ACTIVE,
  LAUNCH_DISCOUNT_PCT,
} from '@/lib/pricing';
import { query, withRLSBypass } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AppError,
  AuthorizationError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/requestBody';
import { purchaseAttemptNumber } from '@/lib/api/paymentIntegrity';

export const runtime = 'nodejs';

export const paymentIntentSchema = z.object({
  documentId: z.union([
    z.number().int().positive().max(2_147_483_647),
    z.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2_147_483_647),
  ]).optional(),
  documentType: z.enum(['single_affidavit', 'divorce_package']),
});

export function productForDocumentType(documentType: string): 'single_affidavit' | 'divorce_package' {
  return ['divorce_package', 'divorce_petition', 'divorce_decree'].includes(documentType)
    ? 'divorce_package'
    : 'single_affidavit';
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('payment', user.id, RATE_LIMITS.payment);
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

    const body = paymentIntentSchema.parse(await readJsonBody(req, 64 * 1024));
    const documentId = body.documentId ? String(body.documentId) : null;
    if (!documentId) {
      throw new ValidationError('A saved document is required for this purchase');
    }

    // Server-side pricing — never trust client. Locale is resolved from the
    // host header / `locale` cookie so a request from ca.discover.legal (or
    // a user who flipped the toggle) is billed in CAD.
    const locale = getLocale();
    const { amount, currency } = getPrice(locale, body.documentType);
    const original = getOriginalPrice(locale, body.documentType);

    if (documentId) {
      const docRow = await query<{ id: number; user_id: number; document_type: string; payment_status: string }>(
        'SELECT id, user_id, document_type, payment_status FROM documents WHERE id = $1',
        [documentId],
      );
      if (!docRow.rows.length) throw new ValidationError('Document not found');
      if (docRow.rows[0].user_id !== user.id) {
        throw new AuthorizationError('You do not have permission to pay for this document');
      }
      if (productForDocumentType(docRow.rows[0].document_type) !== body.documentType) {
        throw new ValidationError('Selected product does not match this document');
      }
      if (docRow.rows[0].payment_status === 'paid') {
        throw new ValidationError('This document is already available for download');
      }
    }

    // Resolve / create Stripe customer.
    const userRow = await query<{ stripe_customer_id: string | null; email: string }>(
      'SELECT stripe_customer_id, email FROM users WHERE id = $1',
      [user.id],
    );
    let customerId = userRow.rows[0]?.stripe_customer_id ?? null;
    const email = userRow.rows[0]?.email ?? user.email;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: user.id, source: 'affidavit-maker' },
      }, {
        idempotencyKey: `customer:${user.id}`,
      });
      // TOCTOU mitigation: two concurrent first-time payment requests can both
      // observe stripe_customer_id IS NULL above and both create a Stripe
      // customer. Use a conditional UPDATE so only one wins persistence; if we
      // lose the race, re-fetch the persisted id and discard our newly-created
      // customer (orphaned in Stripe but never billed unless used).
      const claim = await query<{ stripe_customer_id: string }>(
        `UPDATE users SET stripe_customer_id = $1
           WHERE id = $2 AND stripe_customer_id IS NULL
         RETURNING stripe_customer_id`,
        [customer.id, user.id],
      );
      if (claim.rows.length > 0) {
        customerId = claim.rows[0].stripe_customer_id;
      } else {
        // Lost the race — re-fetch the winner's customerId.
        const refresh = await query<{ stripe_customer_id: string }>(
          'SELECT stripe_customer_id FROM users WHERE id = $1',
          [user.id],
        );
        customerId = refresh.rows[0]?.stripe_customer_id ?? customer.id;
        if (customerId !== customer.id) {
          // This customer has no payment methods or intents yet and is safe to
          // remove. Keep Stripe free of unreachable duplicate customer records.
          await stripe.customers.del(customer.id).catch(() => undefined);
        }
      }
    }

    // Stripe's idempotency store makes simultaneous retries converge on one
    // intent. Recoverable attempts retain their sequence; terminal attempts
    // advance it so the customer can retry immediately.
    // A terminal local attempt gets a fresh deterministic sequence number;
    // concurrent requests for the same next attempt converge at Stripe.
    const attempts = await withRLSBypass(() => query<{ attempt: number; latest_status: string | null }>(
      `SELECT COUNT(*)::int AS attempt,
              (ARRAY_AGG(status ORDER BY created_at DESC))[1] AS latest_status
         FROM payments
        WHERE user_id = $1 AND document_id = $2`,
      [user.id, documentId],
    ));
    const attemptCount = attempts.rows[0]?.attempt ?? 0;
    const latestStatus = attempts.rows[0]?.latest_status;
    const attempt = purchaseAttemptNumber(attemptCount, latestStatus);
    const intentParams = {
      amount,
      currency,
      customer: customerId,
      metadata: {
        userId: user.id,
        documentId: documentId ?? 'new',
        documentType: body.documentType,
        userEmail: email ?? 'unknown',
        locale,
      },
      receipt_email: email ?? undefined,
      automatic_payment_methods: { enabled: true },
      description: `Discover Legal ${body.documentType.replaceAll('_', ' ')}`,
    };
    let idempotencyKey =
      `purchase:${user.id}:${documentId}:${body.documentType}:${attempt}`;
    let paymentIntent = await stripe.paymentIntents.create(intentParams, { idempotencyKey });
    // If a prior request created an intent but could not persist its ledger,
    // it canceled that intent. Stripe will replay the canceled object for the
    // original idempotency key forever. Follow a deterministic recovery chain
    // so concurrent retries still converge, while each canceled link advances.
    for (let recovery = 0; paymentIntent.status === 'canceled' && recovery < 4; recovery += 1) {
      idempotencyKey = `purchase-recovery:${paymentIntent.id}`;
      paymentIntent = await stripe.paymentIntents.create(intentParams, { idempotencyKey });
    }
    if (paymentIntent.status === 'canceled') {
      throw new AppError(
        'Payment initialization could not recover. Please try again shortly.',
        503,
        'PaymentUnavailable',
      );
    }

    // Payment writes are system-only under FORCE RLS. Use the narrow bypass
    // transaction explicitly instead of silently depending on the caller's
    // user context (which correctly cannot insert into payments).
    try {
      const ledger = await withRLSBypass(() =>
        query<{ id: number }>(
          `INSERT INTO payments (
             user_id, document_id, stripe_payment_intent_id, amount_cents, currency,
             status, metadata, created_at
           ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, CURRENT_TIMESTAMP)
           ON CONFLICT (stripe_payment_intent_id) DO NOTHING
           RETURNING id`,
          [
            user.id,
            documentId,
            paymentIntent.id,
            amount,
            currency,
            JSON.stringify({ documentId, documentType: body.documentType, locale }),
          ],
        ),
      );
      // No row means this was a safe idempotent replay and the original ledger
      // entry remains canonical.
      if (ledger.rowCount === 0) {
        const existing = await withRLSBypass(() =>
          query('SELECT id FROM payments WHERE stripe_payment_intent_id = $1', [paymentIntent.id]),
        );
        if (!existing.rows.length) throw new Error('Payment ledger reconciliation failed');
      }
    } catch (dbError) {
      // Do not leave a payable Stripe intent with no local ledger row: the
      // webhook would receive money but be unable to grant the entitlement.
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        originalAmount: original.amount,
        launchDiscountActive: LAUNCH_PRICING_ACTIVE,
        launchDiscountPct: LAUNCH_PRICING_ACTIVE ? LAUNCH_DISCOUNT_PCT : 0,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
