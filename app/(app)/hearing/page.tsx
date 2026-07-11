import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import HearingPrepClient from '@/components/app/HearingPrepClient';

export const metadata = { title: 'Your day in court' };

export default withPageAuthRequired(
  async function HearingPage() {
    return <HearingPrepClient />;
  },
  { returnTo: '/hearing' },
);
