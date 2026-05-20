import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion });
  }
  return stripeInstance;
}
