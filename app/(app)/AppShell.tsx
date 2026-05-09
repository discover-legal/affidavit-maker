'use client';

// @ts-expect-error — JS module without TS types yet
import { DocumentProvider } from '@/contexts/DocumentContext';
// @ts-expect-error — JS module without TS types yet
import { TOSProvider } from '@/contexts/TOSContext';
// @ts-expect-error — JS module without TS types yet
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
