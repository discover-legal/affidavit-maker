import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import AdminOverviewClient from '@/components/admin/AdminOverviewClient';

export const metadata = { title: 'Overview' };

export default withPageAuthRequired(
  async function AdminOverviewPage() {
    return <AdminOverviewClient />;
  },
  { returnTo: '/admin' },
);
