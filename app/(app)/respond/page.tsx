import RespondClient from '@/components/app/RespondClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'You were served — respond' };

async function RespondPage() {
  await requirePageAuth('/respond');
  return <RespondClient />;
}

export default RespondPage;
