import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import PaymentSuccessClient from './PaymentSuccessClient';

export default withPageAuthRequired(
  async function PaymentSuccessPage() {
    return <PaymentSuccessClient />;
  },
);
