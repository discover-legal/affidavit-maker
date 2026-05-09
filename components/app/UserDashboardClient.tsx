'use client';

import { useRouter } from 'next/navigation';
import UserDashboard from './UserDashboard';

type DocumentLite = { id: number | string };

export default function UserDashboardClient() {
  const router = useRouter();

  const handleNewDocument = (
    documentType: string = 'affidavit',
    caseType: string = 'family',
  ) => {
    router.push(`/editor/new?type=${documentType}&caseType=${caseType}`);
  };

  const handleContinueDocument = (doc: DocumentLite) => {
    router.push(`/editor/${doc.id}`);
  };

  return (
    <UserDashboard
      onNewDocument={handleNewDocument}
      onContinueDocument={handleContinueDocument}
    />
  );
}
