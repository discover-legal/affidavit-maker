import { NextResponse } from 'next/server';
import { PRICING_CONFIG } from '@/lib/api/stripe';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    success: true,
    pricing: {
      single_affidavit: { amount: PRICING_CONFIG.single_affidavit, currency: 'usd', label: 'Single Affidavit' },
      divorce_package: { amount: PRICING_CONFIG.divorce_package, currency: 'usd', label: 'Divorce Package' },
      all_state_access: { amount: PRICING_CONFIG.all_state_access, currency: 'usd', label: 'All-State Access' },
    },
  });
}
