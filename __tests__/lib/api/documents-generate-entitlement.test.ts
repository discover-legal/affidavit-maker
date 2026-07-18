/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const mockQuery = jest.fn();
const generateAffidavit = jest.fn(() => ({ documentType: 'affidavit', sections: {} }));
jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Function) => (req: Request) => handler(req, { params: {}, user: { id: 7 } }),
}));
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: () => ({ ok: true }),
  RATE_LIMITS: { pdf: {} },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/api/services', () => ({
  getServices: async () => ({ templateManager: { generateAffidavit } }),
}));
jest.mock('@/lib/api/stripe', () => ({ paymentsEnabled: () => true }));

const tempPdf = path.join(process.cwd(), 'generate-entitlement-test.pdf');
jest.mock('@/services/pdfService', () =>
  jest.fn().mockImplementation(() => ({
    generatePDF: async () => {
      fs.writeFileSync(tempPdf, '%PDF canonical');
      return { success: true, filepath: tempPdf };
    },
  })),
);

import { POST } from '@/app/api/documents/generate/route';

afterEach(() => {
  jest.clearAllMocks();
  if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
});

it('renders only the paid owned saved content, ignoring caller replacement data', async () => {
  mockQuery.mockResolvedValueOnce({
    rows: [{
      content: { state: 'UT', affiantName: 'Saved Owner', facts: ['saved fact'] },
      document_type: 'general_affidavit',
      payment_status: 'paid',
    }],
  });
  const response = await (POST as unknown as (req: Request) => Promise<Response>)(
    new NextRequest('https://discover.legal/api/documents/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        documentId: 42,
        affidavitData: { state: 'TX', affiantName: 'Attacker Replacement', facts: ['replacement'] },
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(generateAffidavit).toHaveBeenCalledWith(
    'UT',
    expect.objectContaining({ state: 'UT', affiantName: 'Saved Owner', facts: ['saved fact'] }),
  );
});
