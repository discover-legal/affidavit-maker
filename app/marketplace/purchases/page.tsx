import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import PurchaseListClient from '@/components/marketplace/PurchaseListClient';

export const metadata = { title: 'My documents', robots: { index: false } };

export default withPageAuthRequired(
  async function PurchasesPage() {
    return <PurchaseListClient />;
  },
  { returnTo: '/marketplace/purchases' },
);
