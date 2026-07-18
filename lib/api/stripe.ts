import Stripe from 'stripe';
import { ExternalServiceError } from '@/lib/api/errors';

let stripeInstance: Stripe | null = null;

/**
 * Kill-switch: set PAYMENTS_ENABLED=false (Render env var) to turn off
 * charging entirely — create-intent refuses and the document-generate
 * payment gate waves documents through as free. Defaults to enabled so
 * production behavior is unchanged until the flag is set explicitly.
 */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED !== 'false';
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (
    process.env.NODE_ENV !== 'production' &&
    key.startsWith('sk_live_') &&
    process.env.ALLOW_LIVE_STRIPE_IN_NONPRODUCTION !== '1'
  ) {
    throw new ExternalServiceError(
      'Payments are disabled in this non-production environment because a live Stripe key is configured. Use Stripe test keys to test checkout.',
    );
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
  }
  return stripeInstance;
}
