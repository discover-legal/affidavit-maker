import HearingPrepClient from '@/components/app/HearingPrepClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'Your day in court' };

async function HearingPage() {
  await requirePageAuth('/hearing');
  return <HearingPrepClient />;
}

export default HearingPage;
