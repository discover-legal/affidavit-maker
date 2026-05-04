import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import { redirect } from 'next/navigation';

// Stripe's return_url for 3DS flows. The webhook is the source of truth for
// payment status; the user is just bounced to the dashboard so they can pick up
// the document. (Old behavior preserved.)
export default withPageAuthRequired(
  async function PaymentSuccessPage() {
    redirect('/dashboard');
  },
);
