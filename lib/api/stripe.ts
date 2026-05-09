import Stripe from 'stripe';

export const PRICING_CONFIG: Record<string, number> = {
  single_affidavit: 7900,
  divorce_package: 24900,
  all_state_access: 19999,
};

export type DocumentType = keyof typeof PRICING_CONFIG;

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
  }
  return stripeInstance;
}
