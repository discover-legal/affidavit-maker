import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import LifeStoryClient from '@/components/app/LifeStoryClient';

export const metadata = { title: 'Your life story' };

export default withPageAuthRequired(
  async function ProfilePage() {
    return <LifeStoryClient />;
  },
  { returnTo: '/profile' },
);
