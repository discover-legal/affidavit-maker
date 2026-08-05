/** @jest-environment node */

import { readBody, readJsonBody } from '../../lib/api/requestBody';

describe('bounded request body reader', () => {
  it('parses JSON within the configured limit', async () => {
    const req = new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(req, 100)).resolves.toEqual({ ok: true });
  });

  it('rejects a body whose declared size is too large', async () => {
    const req = new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-length': '1000' },
      body: '{}',
    });
    await expect(readBody(req, 10)).rejects.toThrow('Request body too large');
  });

  it('counts streamed chunks when Content-Length is absent', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    });
    const req = new Request('https://example.test', {
      method: 'POST',
      body: stream,
      // Required by Node's Request implementation for streaming bodies.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    await expect(readBody(req, 10)).rejects.toThrow('Request body too large');
  });
});
