/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';

describe('payment route database contract', () => {
  const root = process.cwd();
  const routeSources = [
    'app/api/payment/webhook/route.ts',
    'app/api/payment/status/[paymentIntentId]/route.ts',
    'app/api/payment/history/route.ts',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8'));

  it('never references the nonexistent payments.updated_at column', () => {
    for (const source of routeSources) {
      expect(source).not.toMatch(/payments[\s\S]{0,300}\bupdated_at\b/i);
    }
  });

  it('records canonical success and failure timestamps', () => {
    expect(routeSources[0]).toContain('succeeded_at');
    expect(routeSources[0]).toContain('failed_at');
    expect(routeSources[1]).toContain('succeeded_at');
  });

  it('bounds webhook bytes before verifying the exact signed payload', () => {
    expect(routeSources[0]).toContain('readBody(req, 256 * 1024)');
    expect(routeSources[0]).toContain('constructEvent(Buffer.from(body), sig, secret)');
  });
});
