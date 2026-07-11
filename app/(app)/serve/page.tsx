import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import ServeGuideClient from '@/components/app/ServeGuideClient';

export const metadata = { title: 'Serve the papers' };

export default withPageAuthRequired(
  async function ServePage() {
    return <ServeGuideClient />;
  },
  { returnTo: '/serve' },
);
