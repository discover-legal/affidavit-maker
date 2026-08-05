import { ValidationError } from '@/lib/api/errors';

const DEFAULT_JSON_LIMIT_BYTES = 1024 * 1024;

/**
 * Read JSON with an actual streaming byte ceiling. Content-Length alone is
 * advisory and absent on chunked requests, so every chunk is counted before
 * it is retained in memory.
 */
export async function readBody(
  req: Request,
  maxBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid request body limit');
  }

  const declared = req.headers.get('content-length');
  if (declared) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      throw new ValidationError('Invalid Content-Length');
    }
    if (length > maxBytes) throw new ValidationError('Request body too large');
  }

  if (!req.body) throw new ValidationError('Request body is required');

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('request body too large').catch(() => undefined);
        throw new ValidationError('Request body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) throw new ValidationError('Request body is required');
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

export async function readJsonBody(
  req: Request,
  maxBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<unknown> {
  const body = await readBody(req, maxBytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new ValidationError('Invalid JSON request body');
  }
}
