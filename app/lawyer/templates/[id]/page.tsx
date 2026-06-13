import { notFound } from 'next/navigation';
import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import TemplateBuilderClient from '@/components/lawyer/TemplateBuilderClient';

export const metadata = { title: 'Edit template' };

export default withPageAuthRequired(
  async function EditTemplatePage({ params }: { params?: Record<string, string | string[]> }) {
    const raw = params?.id;
    const id = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return <TemplateBuilderClient templateId={id} />;
  },
  { returnTo: '/lawyer/templates' },
);
