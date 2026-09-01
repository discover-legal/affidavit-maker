/** @jest-environment node */
/**
 * Extends the placeholder guard for the CA v7 replay tokens:
 * `[DATE OF SEPARATION]` (Alison, CA III¶6), `[CASE NUMBER]`, and
 * `[BIRTH DATE]` (Marcus, ON decree) must trip the /api/documents/generate
 * denylist and return 422 before pdfService renders anything. A structure
 * without any denylisted tokens must render (200).
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const mockQuery = jest.fn();

let currentBuilder: (...args: unknown[]) => unknown = () => ({});

jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Function) => (req: Request) =>
    handler(req, { params: {}, user: { id: 9 } }),
}));
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: () => ({ ok: true }),
  RATE_LIMITS: { pdf: {}, pdfDaily: {} },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/api/services', () => ({
  getServices: async () => ({
    templateManager: {
      generateDivorcePetition: (...args: unknown[]) => currentBuilder(...args),
      generateDivorceDecree: (...args: unknown[]) => currentBuilder(...args),
      generateAffidavit: (...args: unknown[]) => currentBuilder(...args),
      hasDocumentType: () => true,
    },
  }),
}));
jest.mock('@/lib/api/stripe', () => ({ paymentsEnabled: () => true }));
jest.mock('@/lib/api/profile', () => ({
  getUserProfile: async () => ({ profile: {}, facts: [] }),
}));

const written: string[] = [];
let seq = 0;
const mockGeneratePDF = jest.fn(async () => {
  const filepath = path.join(process.cwd(), `generate-denylist-test-${++seq}.pdf`);
  written.push(filepath);
  fs.writeFileSync(filepath, '%PDF ok');
  return { success: true, filepath, documentType: 'petition' };
});
jest.mock('@/services/pdfService', () =>
  jest.fn().mockImplementation(() => ({ generatePDF: mockGeneratePDF })),
);

import { POST } from '@/app/api/documents/generate/route';

function post(body: unknown): Promise<Response> {
  return (POST as unknown as (req: Request) => Promise<Response>)(
    new NextRequest('https://discover.legal/api/documents/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const paidRow = (): { rows: unknown[] } => ({
  rows: [{
    content: { state: 'CA', facts: [] },
    document_type: 'divorce_package',
    payment_status: 'paid',
  }],
});

afterEach(() => {
  jest.clearAllMocks();
  for (const f of written) fs.rmSync(f, { force: true });
  written.length = 0;
});

describe('POST /api/documents/generate denylist (CA v7 replay tokens)', () => {
  test.each([
    ['[DATE OF SEPARATION]', 'separation date'],
    ['[CASE NUMBER]',        'case number'],
    ['[BIRTH DATE]',         'child birth date'],
    ['[COUNTY NAME]',        'county'],
  ])('rejects with 422 when structure contains %s', async (token, label) => {
    currentBuilder = () => ({
      documentType: 'divorce_petition',
      sections: {
        caption: { petitioner: 'Alison Doe', respondent: 'Sam Doe' },
        body: [{ text: `Something ${token} slipped through.` }],
      },
    });
    mockQuery.mockResolvedValueOnce(paidRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'CA', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(422);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.errorType).toBe('MissingRequiredFields');
    expect(body.missingFields).toEqual(expect.arrayContaining([label]));
  });

  test('renders when structure contains none of the denylisted tokens', async () => {
    currentBuilder = () => ({
      documentType: 'divorce_petition',
      sections: {
        caption: { petitioner: 'Alison Doe', respondent: 'Sam Doe' },
        body: [
          { text: 'The parties separated on or about January 4, 2020.' },
          { text: 'Signed on [DATE].' },
        ],
      },
    });
    mockQuery.mockResolvedValueOnce(paidRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'CA', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(200);
    expect(mockGeneratePDF).toHaveBeenCalledTimes(1);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });
});
