import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { ok } from '@/lib/responses';
import {
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  toErrorResponse,
} from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getStripe } from '@/lib/api/stripe';
import { resolveStripeCustomerId } from '@/lib/api/stripeCustomer';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { getPurchasablePricing, createPurchase } from '@/lib/marketplace/purchaseRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * POST /api/marketplace/templates/[id]/purchase
 *
 * Start a "$1/doc" checkout for a PUBLISHED template. Server-side priced from
 * marketplace_templates.price_cents — the client never supplies an amount.
 * USD-only for v1. Free ($0) templates skip Stripe and resolve to a paid
 * purchase immediately. Settlement (pending -> paid) for charged purchases
 * happens in the Stripe webhook (metadata.kind = 'marketplace_purchase').
 */
export const POST = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireMarketplaceApi();
    const limit = checkRateLimit('marketplace-purchase', user.id, RATE_LIMITS.payment);
    if (!limit.ok) throw new RateLimitError();

    const templateId = Number(params.id);
    if (!Number.isInteger(templateId) || templateId <= 0) throw new NotFoundError('Template not found');

    const pricing = await getPurchasablePricing(templateId);
    if (!pricing) throw new NotFoundError('Template not found');

    const currency = 'usd';

    // Free template: no Stripe round-trip, straight to a paid purchase.
    if (pricing.priceCents === 0) {
      const purchaseId = await createPurchase({
        buyerId: user.id,
        templateId: pricing.templateId,
        lawyerId: pricing.lawyerId,
        amountCents: 0,
        currency,
        stripePaymentIntentId: null,
        status: 'paid',
      });
      return ok({ purchaseId, amountCents: 0, currency, clientSecret: null, free: true });
    }

    const stripe = getStripe();
    if (!stripe) throw new ExternalServiceError('Payment processing is currently unavailable');

    const customerId = await resolveStripeCustomerId(stripe, user.id, user.email);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricing.priceCents,
      currency,
      customer: customerId,
      metadata: {
        kind: 'marketplace_purchase',
        userId: String(user.id),
        templateId: String(pricing.templateId),
        lawyerId: String(pricing.lawyerId),
      },
      receipt_email: user.email ?? undefined,
    });

    // Record in the shared payments table (the webhook keys off this row) ...
    await query(
      `INSERT INTO payments
         (user_id, stripe_payment_intent_id, amount_cents, currency, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, CURRENT_TIMESTAMP)`,
      [
        user.id,
        paymentIntent.id,
        pricing.priceCents,
        currency,
        JSON.stringify({ kind: 'marketplace_purchase', templateId: pricing.templateId }),
      ],
    );
    // ... and as a marketplace purchase the buyer will complete via interview.
    const purchaseId = await createPurchase({
      buyerId: user.id,
      templateId: pricing.templateId,
      lawyerId: pricing.lawyerId,
      amountCents: pricing.priceCents,
      currency,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
    });

    return ok({
      purchaseId,
      amountCents: pricing.priceCents,
      currency,
      clientSecret: paymentIntent.client_secret,
      free: false,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
