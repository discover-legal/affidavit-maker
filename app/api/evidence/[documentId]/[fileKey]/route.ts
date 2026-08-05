import path from 'node:path';
import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { documentId: string; fileKey: string };

const FILENAME_ALLOWED = /^[A-Za-z0-9._\- ()]+$/;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Validate a single path segment supplied via URL params. Rejects anything
 * containing path separators, traversal hops, control chars, or characters
 * outside our allow-list. The legacy handler used `isValidFilename` from
 * utils/pathSecurity for the same purpose.
 */
function validateSegment(value: string, label: string): string {
  if (!value || value === '.' || value === '..') {
    throw new ValidationError(`Invalid ${label}`);
  }
  if (
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new ValidationError(`Invalid ${label}: path traversal attempt`);
  }
  // path.basename collapses any sneaky leading `./` or trailing slashes.
  if (path.basename(value) !== value) {
    throw new ValidationError(`Invalid ${label}`);
  }
  if (!FILENAME_ALLOWED.test(value)) {
    throw new ValidationError(`Invalid ${label} format`);
  }
  return value;
}

function validateDocumentId(raw: string): number {
  const num = parseInt(raw, 10);
  if (
    !Number.isFinite(num) ||
    num < 1 ||
    num > 2147483647 ||
    String(num) !== raw.trim()
  ) {
    throw new ValidationError('Invalid document ID');
  }
  return num;
}

async function ensureOwnership(documentId: number, userId: number): Promise<void> {
  const docRow = await query<{ user_id: number }>(
    'SELECT user_id FROM documents WHERE id = $1',
    [documentId],
  );
  if (!docRow.rows.length) throw new NotFoundError('Document not found');
  if (docRow.rows[0].user_id !== userId) {
    throw new AuthorizationError('Access denied');
  }
}

// GET /api/evidence/:documentId/:fileKey — stream the binary back to the
// authenticated owner of the document. The legacy implementation lived at
// routes/evidence.js#getFile.
export const GET = withAuth<Params>(async (_req: NextRequest, { user, params }) => {
  try {
    const limit = await checkRateLimit('evidence-read', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const documentId = validateDocumentId(params.documentId);
    const fileKey = validateSegment(params.fileKey, 'file key');

    await ensureOwnership(documentId, user.id);

    const evidenceStorage = require('@/services/evidenceStorage') as {
      getEvidence: (
        userId: number,
        documentId: number,
        fileKey: string,
      ) => Promise<{ filepath: string; exists: boolean }>;
      basePath?: string;
    };

    // The service expects the relative fileKey to land inside the user/doc
    // directory. Reconstruct the same shape the legacy clients used:
    // `<userId>/<documentId>/<fileKey>`.
    const relativeKey = path.posix.join(
      String(user.id),
      String(documentId),
      fileKey,
    );

    let evidence: { filepath: string; exists: boolean };
    try {
      evidence = await evidenceStorage.getEvidence(user.id, documentId, relativeKey);
    } catch {
      throw new NotFoundError('Evidence file not found');
    }
    if (!evidence.exists) throw new NotFoundError('Evidence file not found');

    const buffer = await fs.readFile(/* turbopackIgnore: true */ evidence.filepath);
    const ext = path.extname(evidence.filepath).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
    const sanitized = path.basename(evidence.filepath);

    logger.info('evidence_read', {
      userId: user.id,
      documentId,
      fileKey,
      size: buffer.byteLength,
      mime: contentType,
    });

    // Cast Buffer to Uint8Array for the Web Response BodyInit type.
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': `inline; filename="${sanitized}"`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// DELETE /api/evidence/:documentId/:fileKey — verify ownership, then call
// evidenceStorage.deleteEvidence. The legacy route additionally accepted a
// `thumbnailKey` in the JSON body; we honour that for backwards compatibility
// when the client supplies one, but it's optional.
export const DELETE = withAuth<Params>(async (req: NextRequest, { user, params }) => {
  try {
    const limit = await checkRateLimit('evidence-delete', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const documentId = validateDocumentId(params.documentId);
    const fileKey = validateSegment(params.fileKey, 'file key');

    let thumbnailKey: string | undefined;
    try {
      const body = (await req.json().catch(() => null)) as { thumbnailKey?: unknown } | null;
      if (body && typeof body.thumbnailKey === 'string' && body.thumbnailKey) {
        // Reuse the same allow-list to refuse path traversal in the optional
        // thumbnail key. The service also checks ownership of the path, but
        // defence in depth is cheap.
        const tBase = path.basename(body.thumbnailKey);
        if (
          tBase &&
          !tBase.includes('..') &&
          !body.thumbnailKey.includes('..') &&
          FILENAME_ALLOWED.test(tBase)
        ) {
          thumbnailKey = path.posix.join(
            String(user.id),
            String(documentId),
            tBase,
          );
        }
      }
    } catch {
      // No-op: body parsing is best-effort.
    }

    await ensureOwnership(documentId, user.id);

    const evidenceStorage = require('@/services/evidenceStorage') as {
      deleteEvidence: (
        userId: number,
        documentId: number,
        fileKey: string,
        thumbnailKey?: string,
      ) => Promise<{ success: boolean }>;
    };

    const relativeKey = path.posix.join(
      String(user.id),
      String(documentId),
      fileKey,
    );

    await evidenceStorage.deleteEvidence(user.id, documentId, relativeKey, thumbnailKey);

    logger.info('evidence_deleted', {
      userId: user.id,
      documentId,
      fileKey,
    });

    return NextResponse.json({ success: true, deleted: fileKey });
  } catch (err) {
    return toErrorResponse(err);
  }
});
