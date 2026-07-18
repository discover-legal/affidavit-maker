import EditorClient from '@/components/app/EditorClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'Editor' };

async function ExistingEditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  await requirePageAuth(`/editor/${encodeURIComponent(documentId)}`);
  return <EditorClient />;
}

export default ExistingEditorPage;
