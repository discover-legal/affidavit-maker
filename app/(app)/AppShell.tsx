'use client';

import { DocumentProvider } from '@/contexts/DocumentContext';
import { TOSProvider } from '@/contexts/TOSContext';
import { FirmProvider } from '@/contexts/FirmContext';
import TOSGuard from '@/components/app/TOSGuard';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TOSProvider>
      <FirmProvider>
        <DocumentProvider>
          <TOSGuard>{children}</TOSGuard>
        </DocumentProvider>
      </FirmProvider>
    </TOSProvider>
  );
}
