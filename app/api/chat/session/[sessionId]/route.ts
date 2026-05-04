import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';

export const GET = withAuth(async () =>
  notImplemented('chat.js#getSession', 'Port from routes/chat.js GET /session/:sessionId'),
);

export const DELETE = withAuth(async () =>
  notImplemented('chat.js#deleteSession', 'Port from routes/chat.js DELETE /session/:sessionId'),
);
