'use client';

import { useRouter } from 'next/navigation';
// @ts-expect-error — JS module without TS types yet
import EditorView from './EditorView';

type EditorClientProps = {
  isNew?: boolean;
};

export default function EditorClient({ isNew = false }: EditorClientProps) {
  const router = useRouter();
  return <EditorView isNew={isNew} onBack={() => router.push('/dashboard')} />;
}
