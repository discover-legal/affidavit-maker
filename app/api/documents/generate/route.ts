import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TODO(Phase-4-followup): port from routes/documents.js (lines ~559–926).
// PDF generation flow: validates payment, runs services/pdfService two-pass
// generation, returns binary PDF. Needs disk write access to documents/ dir
// or refactor to stream from memory. Rate-limited via RATE_LIMITS.pdf.
export const POST = withAuth(async () =>
  notImplemented('documents.js#generate', 'Port from routes/documents.js POST /generate'),
);
