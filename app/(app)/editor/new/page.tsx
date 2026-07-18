import EditorClient from '@/components/app/EditorClient';
import { requirePageAuth } from '@/lib/page-auth';

export const metadata = { title: 'New Document' };

async function NewEditorPage() {
  await requirePageAuth('/editor/new');
  return <EditorClient isNew />;
}

export default NewEditorPage;
