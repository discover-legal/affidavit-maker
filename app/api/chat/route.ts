import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TODO(Phase-4-followup): port from routes/chat.js (POST /).
// Streaming LLM chat backed by services/affidavitService. Should return
// a streaming Response (ReadableStream) rather than the legacy buffered
// JSON shape, but staged in two PRs:
//   1. Direct port that returns the final JSON (matches current SPA expectation).
//   2. Switch to streaming with EventStream/Server-Sent-Events.
//
// Country routing (detectCountry) and orchestrator dispatch in chat.js are
// what make this the largest port. Service singletons in lib/api/services.ts
// give the handler direct access to the necessary modules without re-exporting
// req.app.locals.
export const POST = withAuth(async () =>
  notImplemented('chat.js#root', 'Port from routes/chat.js POST /'),
);
