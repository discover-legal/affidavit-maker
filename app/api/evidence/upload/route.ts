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

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const FILENAME_ALLOWED = /^[A-Za-z0-9._\- ()]+$/;

function resolveMaxFileSize(): number {
  const raw = process.env.MAX_FILE_SIZE;
  if (!raw) return DEFAULT_MAX_FILE_SIZE;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FILE_SIZE;
}

/**
 * Strip any directory components from an uploaded filename and reject anything
 * that still looks suspicious (path separators, traversal segments, control
 * chars, names outside our allow-list of safe characters).
 */
function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  if (
    !base ||
    base === '.' ||
    base === '..' ||
    base.includes('..') ||
    base.includes('/') ||
    base.includes('\\') ||
    !FILENAME_ALLOWED.test(base)
  ) {
    throw new ValidationError('Invalid filename');
  }
  return base;
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null;
}

// POST /api/evidence/upload — replaces the legacy multer-based handler.
// Uploads a file (PDF or common image) attached to a document the user owns.
// Files are streamed in via Web FormData (req.formData()) — no temp on-disk
// staging is involved before we sniff content type.
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('evidence-upload', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const form = await req.formData().catch(() => null);
    if (!form) throw new ValidationError('Invalid multipart form data');

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('No file uploaded');
    }

    const documentIdRaw = asString(form.get('documentId'));
    if (!documentIdRaw) throw new ValidationError('documentId is required');

    const documentIdNum = parseInt(documentIdRaw, 10);
    if (
      !Number.isFinite(documentIdNum) ||
      documentIdNum < 1 ||
      documentIdNum > 2147483647 ||
      String(documentIdNum) !== documentIdRaw.trim()
    ) {
      throw new ValidationError('Invalid document ID');
    }

    const evidenceIdRaw = asString(form.get('evidenceId'));
    if (evidenceIdRaw && !/^[a-zA-Z0-9_-]{1,64}$/.test(evidenceIdRaw)) {
      throw new ValidationError(
        'Invalid evidence ID format. Only alphanumeric characters, hyphens, and underscores allowed.',
      );
    }

    const originalName = sanitizeFilename(file.name || 'upload');

    const maxBytes = resolveMaxFileSize();
    if (file.size > maxBytes) {
      logger.warn('evidence_upload_rejected_size', {
        userId: user.id,
        documentId: documentIdNum,
        size: file.size,
        maxBytes,
      });
      throw new ValidationError(
        `File exceeds maximum allowed size (${maxBytes} bytes)`,
      );
    }
    if (file.size === 0) {
      throw new ValidationError('Uploaded file is empty');
    }

    // Verify document ownership before doing any disk work.
    const docRow = await query<{ user_id: number }>(
      'SELECT user_id FROM documents WHERE id = $1',
      [documentIdNum],
    );
    if (!docRow.rows.length) throw new NotFoundError('Document not found');
    if (docRow.rows[0].user_id !== user.id) {
      throw new AuthorizationError('Access denied');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Sniff actual content via magic bytes. file-type@16 ships fromBuffer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileType = require('file-type') as {
      fromBuffer: (
        buf: Buffer,
      ) => Promise<{ mime: string; ext: string } | undefined>;
    };
    const detected = await FileType.fromBuffer(buffer);
    if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
      logger.warn('evidence_upload_rejected_type', {
        userId: user.id,
        documentId: documentIdNum,
        declaredType: file.type,
        detectedMime: detected?.mime ?? null,
      });
      throw new ValidationError(
        'Unsupported file type. Allowed: PDF, JPEG, PNG, GIF, WEBP.',
      );
    }

    // Hand the buffer to the legacy storage service. uploadEvidence expects a
    // multer-style file on disk, so we stage to a temp path it can rename.
    const evidenceId = evidenceIdRaw ?? cryptoRandomId();
    const tmpDir = path.join(process.cwd(), 'temp', 'uploads');
    await fs.mkdir(tmpDir, { recursive: true });
    const ext = mimeToExt(detected.mime);
    const tmpPath = path.join(tmpDir, `${evidenceId}-${Date.now()}${ext}`);
    await fs.writeFile(tmpPath, buffer);

    let result: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const evidenceStorage = require('@/services/evidenceStorage') as {
        uploadEvidence: (
          file: { path: string; originalname: string; mimetype: string; size: number },
          userId: number,
          documentId: number,
          evidenceId: string,
        ) => Promise<Record<string, unknown>>;
      };
      result = await evidenceStorage.uploadEvidence(
        {
          path: tmpPath,
          originalname: originalName,
          mimetype: detected.mime,
          size: buffer.length,
        },
        user.id,
        documentIdNum,
        evidenceId,
      );
    } catch (err) {
      // uploadEvidence renames the file on success; on failure clean it up.
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }

    logger.info('evidence_uploaded', {
      userId: user.id,
      documentId: documentIdNum,
      evidenceId,
      fileName: originalName,
      size: buffer.length,
      mime: detected.mime,
    });

    return NextResponse.json({
      success: true,
      evidence: {
        ...result,
        fileKey: result.fileKey,
        originalName,
        size: buffer.length,
        mime: detected.mime,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

function cryptoRandomId(): string {
  // Lightweight evidence id when client doesn't supply one. We import lazily
  // to avoid pulling node:crypto at module-load time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('node:crypto') as typeof import('node:crypto');
  return randomUUID();
}
