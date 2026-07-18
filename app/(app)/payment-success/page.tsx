import { redirect } from 'next/navigation';
import { requirePageAuth } from '@/lib/page-auth';

// Stripe's return_url for 3DS flows. The webhook is the source of truth for
// payment status; the user is just bounced to the dashboard so they can pick up
// the document. (Old behavior preserved.)
export default async function PaymentSuccessPage() {
  await requirePageAuth('/payment-success');
  redirect('/dashboard');
}
