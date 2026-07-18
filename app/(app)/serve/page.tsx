import ServeGuideClient from '@/components/app/ServeGuideClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'Serve the papers' };

async function ServePage() {
  await requirePageAuth('/serve');
  return <ServeGuideClient />;
}

export default ServePage;
