import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import TemplateBuilderClient from '@/components/lawyer/TemplateBuilderClient';

export const metadata = { title: 'New template' };

export default withPageAuthRequired(
  async function NewTemplatePage() {
    return <TemplateBuilderClient />;
  },
  { returnTo: '/lawyer/templates/new' },
);
