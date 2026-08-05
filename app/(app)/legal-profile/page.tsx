import LegalProfileClient from '@/components/app/LegalProfileClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'My Legal Profile' };

async function LegalProfilePage() {
  await requirePageAuth('/legal-profile');
  return <LegalProfileClient />;
}

export default LegalProfilePage;
