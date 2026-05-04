import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';

export const GET = withAuth(async () =>
  notImplemented(
    'evidence.js#listForDocument',
    'Port from routes/evidence.js GET /document/:documentId',
  ),
);
