import { notFound } from 'next/navigation';
import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import InterviewRunnerClient from '@/components/marketplace/InterviewRunnerClient';

export const metadata = { title: 'Complete your document', robots: { index: false } };

export default withPageAuthRequired(
  async function PurchaseInterviewPage({ params }: { params?: Record<string, string | string[]> }) {
    const raw = params?.id;
    const id = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return <InterviewRunnerClient purchaseId={id} />;
  },
  { returnTo: '/marketplace' },
);
