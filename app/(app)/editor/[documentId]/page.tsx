import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import EditorClient from '@/components/app/EditorClient';

export const metadata = { title: 'Editor' };

export default withPageAuthRequired(
  async function ExistingEditorPage() {
    return <EditorClient />;
  },
);
