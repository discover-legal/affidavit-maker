import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import UserDashboardClient from '@/components/app/UserDashboardClient';

export const metadata = { title: 'Dashboard' };

export default withPageAuthRequired(
  async function DashboardPage() {
    return <UserDashboardClient />;
  },
  { returnTo: '/dashboard' },
);
