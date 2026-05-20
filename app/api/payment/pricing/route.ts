import { NextResponse } from 'next/server';
import { getLocale } from '@/lib/locale.server';
import {
  getPrice,
  getOriginalPrice,
  LAUNCH_PRICING_ACTIVE,
  LAUNCH_DISCOUNT_PCT,
  LAUNCH_LABEL,
} from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // reads request-bound headers/cookies

export async function GET() {
  const locale = getLocale();

  const build = (key: 'single_affidavit' | 'divorce_package' | 'all_state_access', label: string) => {
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
    launch: {
      active: LAUNCH_PRICING_ACTIVE,
      discountPct: LAUNCH_PRICING_ACTIVE ? LAUNCH_DISCOUNT_PCT : 0,
      label: LAUNCH_PRICING_ACTIVE ? LAUNCH_LABEL : null,
    },
    pricing: {
      single_affidavit: build('single_affidavit', 'Single Affidavit'),
      divorce_package: build('divorce_package', 'Divorce Package'),
      all_state_access: build('all_state_access', 'All-State Access'),
    },
  });
}
