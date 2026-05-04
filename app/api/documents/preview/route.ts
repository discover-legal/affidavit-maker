import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TODO(Phase-4-followup): port from routes/documents.js (lines ~363–558).
// Calls into services/previewRenderer + StateTemplateManager to produce
// HTML preview from affidavitData. Service classes are usable as-is from
// here once getServices() is extended to expose previewRenderer.
export const POST = withAuth(async () =>
  notImplemented('documents.js#preview', 'Port from routes/documents.js POST /preview'),
);
