'use client';

import { useRouter } from 'next/navigation';
import EditorView from './EditorView';

type EditorClientProps = {
  isNew?: boolean;
};

export default function EditorClient({ isNew = false }: EditorClientProps) {
  const router = useRouter();
  return <EditorView isNew={isNew} onBack={() => router.push('/dashboard')} />;
}
