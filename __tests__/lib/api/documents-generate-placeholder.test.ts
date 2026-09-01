/** @jest-environment node */
/**
 * Guards the TX Mari fix: /api/documents/generate must refuse to render a
 * PDF whose built document structure still contains literal `[…]`-shaped
 * placeholder tokens the templates leave behind when required data is
 * missing (e.g. `[PETITIONER NAME]`). Response: 422 with a
 * `missingFields` list the UI can use to prompt the user for the specific
 * gap — not a generic 500.
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const mockQuery = jest.fn();

// The template manager here EMITS a structure carrying literal placeholder
// tokens — the exact failure mode we're guarding against. The response
// must reject BEFORE pdfService renders it, so we also assert generatePDF
// was never called.
const generateDivorcePetitionWithPlaceholders = jest.fn(() => ({
  documentType: 'divorce_petition',
  sections: {
    caption: {
      // Two of the denylisted tokens land in the caption — the check must
      // dedupe missing-field labels and list both.
      petitioner: '[PETITIONER NAME]',
      respondent: '[RESPONDENT NAME]',
      court:      'District Court, Travis County, Texas',
    },
    body: [
      { text: 'The parties were married on 2015-01-01 in Austin, TX.' },
    ],
  },
}));

const generateDivorcePetitionClean = jest.fn(() => ({
  documentType: 'divorce_petition',
  sections: {
    caption: {
      petitioner: 'Mari Guerrero',
      respondent: 'Devin Guerrero',
    },
    // Legit `[…]` placeholders the court fills in — NOT on the denylist,
    // so the response must succeed.
    body: [
      { text: 'Signed at Austin, Texas, on [DATE].' },
      { text: '[NOTARY SEAL]' },
    ],
  },
}));

jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Function) => (req: Request) =>
    handler(req, { params: {}, user: { id: 7 } }),
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
      generateDivorcePetition: (...args: unknown[]) =>
        currentPetitionBuilder(...args),
      generateDivorceDecree: jest.fn(),
      generateAffidavit: jest.fn(),
      hasDocumentType: () => true,
    },
  }),
}));
jest.mock('@/lib/api/stripe', () => ({ paymentsEnabled: () => true }));
jest.mock('@/lib/api/profile', () => ({
  getUserProfile: async () => ({ profile: {}, facts: [] }),
}));

let mockPdfSeq = 0;
const mockWrittenPdfs: string[] = [];
const mockGeneratePDF = jest.fn(async () => {
  const filepath = path.join(process.cwd(), `generate-placeholder-test-${++mockPdfSeq}.pdf`);
  mockWrittenPdfs.push(filepath);
  fs.writeFileSync(filepath, '%PDF ok');
  return { success: true, filepath, documentType: 'petition' };
});
jest.mock('@/services/pdfService', () =>
  jest.fn().mockImplementation(() => ({ generatePDF: mockGeneratePDF })),
);

// Switchable petition builder — the placeholder-emitting one for the
// blocker case, the clean one for the pass-through case.
let currentPetitionBuilder: (...args: unknown[]) => unknown =
  generateDivorcePetitionWithPlaceholders;

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

const paidPackageRow = (): { rows: unknown[] } => ({
  rows: [{
    content: { state: 'UT', facts: [] },
    document_type: 'divorce_package',
    payment_status: 'paid',
  }],
});

afterEach(() => {
  jest.clearAllMocks();
  currentPetitionBuilder = generateDivorcePetitionWithPlaceholders;
  for (const f of mockWrittenPdfs) fs.rmSync(f, { force: true });
  mockWrittenPdfs.length = 0;
});

describe('POST /api/documents/generate placeholder guard', () => {
  test('rejects with 422 and lists missing fields when structure contains [PETITIONER NAME]', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(422);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorType).toBe('MissingRequiredFields');
    expect(body.missingFields).toEqual(
      expect.arrayContaining(['petitioner name', 'respondent name']),
    );
    expect(body.error).toMatch(/missing required fields/i);
    expect(body.error).toMatch(/petitioner name/);
    expect(body.error).toMatch(/respondent name/);
  });

  test('renders normally when only whitelisted [DATE] / [NOTARY SEAL] tokens remain', async () => {
    currentPetitionBuilder = generateDivorcePetitionClean;
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(200);
    expect(mockGeneratePDF).toHaveBeenCalledTimes(1);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });
});
