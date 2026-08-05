import { NextResponse } from 'next/server';
import { getLocale } from '@/lib/locale.server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import {
  getPrice,
  getOriginalPrice,
  LAUNCH_PRICING_ACTIVE,
  LAUNCH_DISCOUNT_PCT,
  LAUNCH_LABEL,
} from '@/lib/pricing';
import { paymentsEnabled } from '@/lib/api/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // reads request-bound headers/cookies

export async function GET(req: Request) {
  const limit = await checkRateLimit('payment-pricing', rateLimitKey(req, 'payment-pricing'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  const locale = getLocale();

  const build = (key: 'single_affidavit' | 'divorce_package', label: string) => {
    const current = getPrice(locale, key);
    const original = getOriginalPrice(locale, key);
    return {
      amount: current.amount,
      currency: current.currency,
      originalAmount: original.amount,
      label,
    };
  };

  return NextResponse.json({
    success: true,
    locale,
    paymentsEnabled: paymentsEnabled(),
    launch: {
      active: LAUNCH_PRICING_ACTIVE,
      discountPct: LAUNCH_PRICING_ACTIVE ? LAUNCH_DISCOUNT_PCT : 0,
      label: LAUNCH_PRICING_ACTIVE ? LAUNCH_LABEL : null,
    },
    pricing: {
      single_affidavit: build('single_affidavit', 'Single Affidavit'),
      divorce_package: build('divorce_package', 'Divorce Package'),
    },
  });
}
