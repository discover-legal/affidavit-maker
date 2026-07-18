import UserDashboardClient from '@/components/app/UserDashboardClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'Dashboard' };

async function DashboardPage() {
  await requirePageAuth('/dashboard');
  return <UserDashboardClient />;
}

export default DashboardPage;
