import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import LegalProfileClient from '@/components/app/LegalProfileClient';

export const metadata = { title: 'My Legal Profile' };

export default withPageAuthRequired(
  async function LegalProfilePage() {
    return <LegalProfileClient />;
  },
  { returnTo: '/profile' },
);
