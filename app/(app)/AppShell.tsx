'use client';

import { DocumentProvider } from '@/contexts/DocumentContext';
import { TOSProvider } from '@/contexts/TOSContext';
import TOSGuard from '@/components/app/TOSGuard';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TOSProvider>
      <DocumentProvider>
        <TOSGuard>{children}</TOSGuard>
      </DocumentProvider>
    </TOSProvider>
  );
}
