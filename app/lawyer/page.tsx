import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import LawyerDashboardClient from '@/components/lawyer/LawyerDashboardClient';

export const metadata = { title: 'Dashboard' };

export default withPageAuthRequired(
  async function LawyerDashboardPage() {
    return <LawyerDashboardClient />;
  },
  { returnTo: '/lawyer' },
);
