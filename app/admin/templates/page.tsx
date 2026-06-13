import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import AdminModerationClient from '@/components/admin/AdminModerationClient';
import type { TemplateStatus } from '@discover-legal/sdk';

export const metadata = { title: 'Moderation' };

const STATUSES: (TemplateStatus | 'all')[] = [
  'draft',
  'pending_review',
  'published',
  'suspended',
  'archived',
  'all',
];

export default withPageAuthRequired(
  async function AdminModerationPage({
    searchParams,
  }: {
    searchParams?: { [key: string]: string | string[] | undefined };
  }) {
    const raw = searchParams?.status;
    const status = (Array.isArray(raw) ? raw[0] : raw) as TemplateStatus | 'all' | undefined;
    const initialStatus = status && STATUSES.includes(status) ? status : 'pending_review';
    return <AdminModerationClient initialStatus={initialStatus} />;
  },
  { returnTo: '/admin/templates' },
);
