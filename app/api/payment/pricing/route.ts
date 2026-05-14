import { NextResponse } from 'next/server';
import { getLocale } from '@/lib/locale.server';
import { getPrice } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // reads request-bound headers/cookies

export async function GET() {
  const locale = getLocale();
  const affidavit = getPrice(locale, 'single_affidavit');
  const divorce = getPrice(locale, 'divorce_package');
  const allState = getPrice(locale, 'all_state_access');

  return NextResponse.json({
    success: true,
    locale,
    pricing: {
      single_affidavit: { amount: affidavit.amount, currency: affidavit.currency, label: 'Single Affidavit' },
      divorce_package: { amount: divorce.amount, currency: divorce.currency, label: 'Divorce Package' },
      all_state_access: { amount: allState.amount, currency: allState.currency, label: 'All-State Access' },
    },
  });
}
