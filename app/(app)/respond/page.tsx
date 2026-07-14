import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import RespondClient from '@/components/app/RespondClient';

export const metadata = { title: 'You were served — respond' };

export default withPageAuthRequired(
  async function RespondPage() {
    return <RespondClient />;
  },
  { returnTo: '/respond' },
);
