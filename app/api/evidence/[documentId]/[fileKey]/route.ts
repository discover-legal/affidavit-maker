import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';

export const GET = withAuth(async () =>
  notImplemented('evidence.js#getFile', 'Port from routes/evidence.js GET /:documentId/:fileKey'),
);

export const DELETE = withAuth(async () =>
  notImplemented(
    'evidence.js#deleteFile',
    'Port from routes/evidence.js DELETE /:documentId/:evidenceId',
  ),
);
