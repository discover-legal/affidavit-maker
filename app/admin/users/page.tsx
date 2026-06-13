import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import AdminUsersClient from '@/components/admin/AdminUsersClient';

export const metadata = { title: 'Users' };

export default withPageAuthRequired(
  async function AdminUsersPage() {
    return <AdminUsersClient />;
  },
  { returnTo: '/admin/users' },
);
