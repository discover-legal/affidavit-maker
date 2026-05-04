import { withAuth } from '@/lib/api/auth';
import { notImplemented } from '@/lib/api/notImplemented';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TODO(Phase-4-followup): port from routes/evidence.js (lines ~74–186).
// Replaces multer with Next.js native FormData parsing:
//   const form = await req.formData();
//   const file = form.get('file') as File | null;
// Buffers file to disk via services/evidenceStorage. File-type validation
// stays the same (file-type package).
export const POST = withAuth(async () =>
  notImplemented('evidence.js#upload', 'Port from routes/evidence.js POST /upload (use req.formData())'),
);
