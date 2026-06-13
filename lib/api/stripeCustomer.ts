import type Stripe from 'stripe';
import { query } from '@/lib/db';

/**
 * Resolve (or lazily create) the Stripe customer id for a user, persisting it
 * on `users.stripe_customer_id`. TOCTOU-safe: two concurrent first-time callers
 * can both create a Stripe customer, but a conditional UPDATE ensures only one
 * id is persisted; the loser re-reads the winner's id (its own orphaned Stripe
 * customer is never billed). Mirrors the logic in app/api/payment/create-intent.
 */
export async function resolveStripeCustomerId(
  stripe: Stripe,
  userId: number,
  fallbackEmail: string | null,
): Promise<string> {
  const userRow = await query<{ stripe_customer_id: string | null; email: string }>(
    'SELECT stripe_customer_id, email FROM users WHERE id = $1',
    [userId],
  );
  const existing = userRow.rows[0]?.stripe_customer_id ?? null;
  if (existing) return existing;

  const email = userRow.rows[0]?.email ?? fallbackEmail ?? undefined;
  const customer = await stripe.customers.create({
    email,
    metadata: { userId, source: 'marketplace' },
  });

  const claim = await query<{ stripe_customer_id: string }>(
    `UPDATE users SET stripe_customer_id = $1
       WHERE id = $2 AND stripe_customer_id IS NULL
     RETURNING stripe_customer_id`,
    [customer.id, userId],
  );
  if (claim.rows.length > 0) return claim.rows[0].stripe_customer_id;

  const refresh = await query<{ stripe_customer_id: string }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId],
  );
  return refresh.rows[0]?.stripe_customer_id ?? customer.id;
}
