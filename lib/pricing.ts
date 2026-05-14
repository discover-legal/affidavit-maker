import type { Locale } from '@/lib/locale';

/**
 * Public-facing price for each product, per locale.
 *
 * Amounts are in cents in the local currency (Stripe convention). CAD
 * amounts are set as round retail prices rather than a live FX conversion
 * so the customer sees stable numbers; revisit when FX volatility matters.
 *
 * NOTE: This is the DISPLAY pricing used on marketing surfaces and what we
 * pass to Stripe `payment_intent` creation. Charging in CAD requires the
 * connected Stripe account to support CAD (most do by default for
 * North-American businesses); if a CA payment intent fails with
 * "currency not supported", switch the locale to 'us' or enable CAD in the
 * Stripe dashboard.
 */
export type PriceKey = 'single_affidavit' | 'divorce_package' | 'all_state_access';

type PriceTable = Record<Locale, Record<PriceKey, { amount: number; currency: 'usd' | 'cad' }>>;

const PRICES: PriceTable = {
  us: {
    single_affidavit: { amount: 7900, currency: 'usd' }, // $79.00
    divorce_package: { amount: 24900, currency: 'usd' }, // $249.00
    all_state_access: { amount: 19999, currency: 'usd' }, // $199.99
  },
  ca: {
    single_affidavit: { amount: 9900, currency: 'cad' }, // $99.00 CAD
    divorce_package: { amount: 32900, currency: 'cad' }, // $329.00 CAD
    all_state_access: { amount: 26900, currency: 'cad' }, // $269.00 CAD
  },
};

export function getPrice(locale: Locale, key: PriceKey): { amount: number; currency: 'usd' | 'cad' } {
  return PRICES[locale][key];
}

/**
 * Render a price for display. Returns e.g. "$79" (USD) or "$99 CAD".
 * Strips cents when the amount is whole dollars.
 */
export function formatPrice(locale: Locale, key: PriceKey): string {
  const { amount, currency } = getPrice(locale, key);
  const dollars = amount / 100;
  const isWhole = Number.isInteger(dollars);
  const value = isWhole ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return currency === 'cad' ? `${value} CAD` : value;
}
