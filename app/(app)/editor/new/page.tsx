import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import EditorClient from '@/components/app/EditorClient';

export const metadata = { title: 'New Document' };

export default withPageAuthRequired(
  async function NewEditorPage() {
    return <EditorClient isNew />;
  },
  { returnTo: '/editor/new' },
);
