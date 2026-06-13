import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import LawyerTemplateListClient from '@/components/lawyer/LawyerTemplateListClient';

export const metadata = { title: 'My templates' };

export default withPageAuthRequired(
  async function LawyerTemplatesPage() {
    return <LawyerTemplateListClient />;
  },
  { returnTo: '/lawyer/templates' },
);
