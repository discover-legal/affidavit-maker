import LifeStoryClient from '@/components/app/LifeStoryClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'Your life story' };

async function ProfilePage() {
  await requirePageAuth('/profile');
  return <LifeStoryClient />;
}

export default ProfilePage;
