import type { Locale } from '@/lib/locale';

/**
 * Public-facing price for each product, per locale.
 *
 * Amounts are in cents in the local currency (Stripe convention). CAD
 * amounts are set as round retail prices rather than a live FX conversion
 * so the customer sees stable numbers; revisit when FX volatility matters.
 *
 * These are the actual launch prices. Do not present reference/list prices
 * unless they have been genuinely offered and the campaign has a fixed end.
 */
export type PriceKey = 'single_affidavit' | 'divorce_package' | 'all_state_access';

type PriceTable = Record<Locale, Record<PriceKey, { amount: number; currency: 'usd' | 'cad' }>>;

const PRICES: PriceTable = {
  us: {
    single_affidavit: { amount: 1580, currency: 'usd' }, // $15.80
    divorce_package: { amount: 4980, currency: 'usd' }, // $49.80
    all_state_access: { amount: 19999, currency: 'usd' }, // $199.99
  },
  ca: {
    single_affidavit: { amount: 1980, currency: 'cad' }, // $19.80 CAD
    divorce_package: { amount: 6580, currency: 'cad' }, // $65.80 CAD
    all_state_access: { amount: 26900, currency: 'cad' }, // $269.00 CAD
  },
};

/**
 * Special launch promotion. Set LAUNCH_PRICING_ACTIVE to false to revert
 * to list prices everywhere (marketing, API, Stripe intent) in one edit.
 */
export const LAUNCH_PRICING_ACTIVE = false;
export const LAUNCH_DISCOUNT_PCT = 0;
export const LAUNCH_LABEL = 'Launch pricing';

type Price = { amount: number; currency: 'usd' | 'cad' };

function applyDiscount(amount: number): number {
  // Round to the nearest cent to keep Stripe happy with integer cents.
  return Math.round(amount * (1 - LAUNCH_DISCOUNT_PCT));
}

/**
 * Returns the LIST (pre-discount) price.
 */
export function getOriginalPrice(locale: Locale, key: PriceKey): Price {
  return PRICES[locale][key];
}

/**
 * Returns the price the customer is actually charged. When the launch
 * promotion is active this is the discounted amount; otherwise it equals
 * the list price.
 */
export function getPrice(locale: Locale, key: PriceKey): Price {
  const list = PRICES[locale][key];
  if (!LAUNCH_PRICING_ACTIVE) return list;
  return { amount: applyDiscount(list.amount), currency: list.currency };
}

function renderAmount(price: Price): string {
  const dollars = price.amount / 100;
  const isWhole = Number.isInteger(dollars);
  const value = isWhole ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return price.currency === 'cad' ? `${value} CAD` : value;
}

/**
 * Render the customer-facing (discounted, when applicable) price.
 */
export function formatPrice(locale: Locale, key: PriceKey): string {
  return renderAmount(getPrice(locale, key));
}

/**
 * Render the list / pre-discount price (for strike-through display).
 */
export function formatOriginalPrice(locale: Locale, key: PriceKey): string {
  return renderAmount(getOriginalPrice(locale, key));
}

export function getDiscountPercentLabel(): string {
  return `${Math.round(LAUNCH_DISCOUNT_PCT * 100)}% OFF`;
}
