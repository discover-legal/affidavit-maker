import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { getStripe, paymentsEnabled } from '@/lib/api/stripe';
import { getLocale } from '@/lib/locale.server';
import {
  getPrice,
  getOriginalPrice,
  LAUNCH_PRICING_ACTIVE,
  LAUNCH_DISCOUNT_PCT,
} from '@/lib/pricing';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  documentId: z.union([z.string(), z.number()]).optional(),
  documentType: z.enum(['single_affidavit', 'divorce_package', 'all_state_access']),
});

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('payment', user.id, RATE_LIMITS.payment);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    if (!paymentsEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payments are temporarily disabled',
          errorType: 'payments_disabled',
        },
        { status: 503 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: 'Payment processing is currently unavailable' },
        { status: 503 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const documentId = body.documentId ? String(body.documentId) : null;

    // Server-side pricing — never trust client. Locale is resolved from the
    // host header / `locale` cookie so a request from ca.discover.legal (or
    // a user who flipped the toggle) is billed in CAD.
    const locale = getLocale();
    const { amount, currency } = getPrice(locale, body.documentType);
    const original = getOriginalPrice(locale, body.documentType);

    if (documentId) {
      const docRow = await query<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM documents WHERE id = $1',
        [documentId],
      );
      if (!docRow.rows.length) throw new ValidationError('Document not found');
      if (docRow.rows[0].user_id !== user.id) {
        throw new AuthorizationError('You do not have permission to pay for this document');
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
        // (orphaned Stripe customer is the runtime cost of losing the race)
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
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
    });

    await query(
      `INSERT INTO payments (
         user_id, stripe_payment_intent_id, amount_cents, currency,
         status, metadata, created_at
       ) VALUES ($1, $2, $3, $4, 'pending', $5, CURRENT_TIMESTAMP)`,
      [
        user.id,
        paymentIntent.id,
        amount,
        currency,
        JSON.stringify({ documentId, documentType: body.documentType, locale }),
      ],
    );

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
