/** @jest-environment node */
/**
 * documents-generate-dispatch.test.ts
 *
 * Guards the fix for the "byte-identical petition PDF for every documentType"
 * blocker (TX Mari, 2026-08-27): /api/documents/generate must honor the
 * request body's `documentType` and dispatch to the correct renderer —
 * divorce petition, divorce decree, or a support-doc builder — rather than
 * silently overwriting the caller's choice with the saved row's
 * document_type and always returning the petition.
 *
 * We mock the template manager + pdfService + supportDocs so the assertions
 * are about which builder was invoked with which type, not about actual PDF
 * bytes. Content-length differing across types is asserted as a secondary
 * sanity check (each mock builder writes a unique marker).
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const mockQuery = jest.fn();

const generateAffidavit = jest.fn(() => ({
  documentType: 'affidavit',
  sections: {},
  marker: 'affidavit',
}));
const generateDivorcePetition = jest.fn(() => ({
  documentType: 'divorce_petition',
  sections: {},
  marker: 'petition',
}));
const generateDivorceDecree = jest.fn(() => ({
  documentType: 'divorce_decree',
  sections: {},
  marker: 'decree',
}));
const hasDocumentType = jest.fn((_state: string, _type: string) => true);

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
      generateAffidavit,
      generateDivorcePetition,
      generateDivorceDecree,
      hasDocumentType,
    },
  }),
}));
jest.mock('@/lib/api/stripe', () => ({ paymentsEnabled: () => true }));
jest.mock('@/lib/api/profile', () => ({
  getUserProfile: async () => ({ profile: { profileFactExists: true }, facts: [] }),
}));

// Each support-doc builder is a jest.fn returning a distinct structure so
// tests can assert exactly which one was called (and confirm the OTHERS
// weren't). Aligns with the kinds services/supportDocs currently registers
// for Utah.
const financialDeclarationBuilder = jest.fn(() => ({
  documentType: 'financial_declaration',
  sections: {},
  marker: 'financial-declaration',
}));
const worksheetBuilder = jest.fn(() => ({
  documentType: 'child_support_worksheet',
  sections: {},
  marker: 'worksheet',
}));
// Bug 1 (Tavita, FL) — divorce_response renders via services/supportDocs'
// `answer` builder. Mocking one for UT lets us assert the same 200 flow that
// documents/generate delivers for petition/decree.
const answerBuilder = jest.fn(() => ({
  documentType: 'answer',
  sections: {},
  marker: 'response',
}));

// Bug 2 (coverage gap, 2026-08-30): every jurisdiction now has an `answer`
// support-doc builder. The mock returns the SAME jest.fn for all of them so
// per-state assertions below can count invocations per test (jest.clearAllMocks
// in afterEach resets the counter).
jest.mock('@/services/supportDocs', () => ({
  __esModule: false,
  getSupportDoc: (state: string, kind: string) => {
    if (state === 'UT') {
      if (kind === 'financial_declaration') return financialDeclarationBuilder;
      if (kind === 'child_support_worksheet') return worksheetBuilder;
      if (kind === 'answer') return answerBuilder;
      return null;
    }
    if (
      kind === 'answer' &&
      (state === 'FL' ||
        state === 'GA' ||
        state === 'NY' ||
        state === 'TX' ||
        state === 'CA' ||
        state === 'ON' ||
        state === 'AB')
    ) {
      return answerBuilder;
    }
    return null;
  },
  list: () => [],
}));

// Unique temp file per generatePDF call — see documents-generate-entitlement
// test for the fire-and-forget-unlink rationale.
let mockPdfSeq = 0;
const mockWrittenPdfs: string[] = [];
const mockGeneratePDF = jest.fn(async (structure: unknown) => {
  const filepath = path.join(
    process.cwd(),
    `generate-dispatch-test-${++mockPdfSeq}.pdf`,
  );
  mockWrittenPdfs.push(filepath);
  const marker =
    (structure as { marker?: string } | null)?.marker ?? 'unknown';
  // Distinct byte length per structure so tests can also assert
  // response.headers['content-length'] differs across documentTypes.
  fs.writeFileSync(filepath, `%PDF ${marker} `.repeat(marker.length + 1));
  return { success: true, filepath, documentType: marker };
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

const paidPackageRow = (): { rows: unknown[] } => ({
  rows: [
    {
      content: {
        state: 'UT',
        affiantName: 'Test Owner',
        petitionerName: 'Alice Petitioner',
        respondentName: 'Bob Respondent',
        facts: [],
      },
      document_type: 'divorce_package',
      payment_status: 'paid',
    },
  ],
});

afterEach(() => {
  jest.clearAllMocks();
  hasDocumentType.mockImplementation(() => true);
  for (const f of mockWrittenPdfs) fs.rmSync(f, { force: true });
  mockWrittenPdfs.length = 0;
});

describe('POST /api/documents/generate documentType dispatch', () => {
  it('routes documentType=divorce_petition to the petition template', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(200);
    expect(generateDivorcePetition).toHaveBeenCalledTimes(1);
    expect(generateDivorceDecree).not.toHaveBeenCalled();
    expect(generateAffidavit).not.toHaveBeenCalled();
    expect(financialDeclarationBuilder).not.toHaveBeenCalled();
    expect(res.headers.get('content-disposition')).toMatch(/filename="petition-/);
  });

  it('routes documentType=divorce_decree to the decree template', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_decree' },
    });
    expect(res.status).toBe(200);
    expect(generateDivorceDecree).toHaveBeenCalledTimes(1);
    expect(generateDivorcePetition).not.toHaveBeenCalled();
    expect(res.headers.get('content-disposition')).toMatch(/filename="decree-/);
  });

  // Bug 1 (Tavita, FL, 2026-08-29): a paid divorce_package row must render
  // its divorce_response sub-document without the entitlement guard rejecting
  // it as "Requested output does not match the saved document type". Pre-fix
  // this returned 400 because 'divorce_response' resolved to 'affidavit'.
  it('routes documentType=divorce_response from a saved divorce_package to the answer support-doc builder (Bug 1)', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_response' },
    });
    expect(res.status).toBe(200);
    expect(answerBuilder).toHaveBeenCalledTimes(1);
    expect(generateDivorcePetition).not.toHaveBeenCalled();
    expect(generateDivorceDecree).not.toHaveBeenCalled();
    expect(financialDeclarationBuilder).not.toHaveBeenCalled();
    expect(res.headers.get('content-disposition')).toMatch(/filename="response-/);
  });

  it('routes a support-doc kind to the supportDocs builder for that kind', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'financial_declaration' },
    });
    expect(res.status).toBe(200);
    expect(financialDeclarationBuilder).toHaveBeenCalledTimes(1);
    expect(worksheetBuilder).not.toHaveBeenCalled();
    expect(generateDivorcePetition).not.toHaveBeenCalled();
    expect(generateDivorceDecree).not.toHaveBeenCalled();
    expect(res.headers.get('content-disposition')).toMatch(
      /filename="financial-declaration-/,
    );
  });

  it('renders DIFFERENT bytes for petition vs decree vs support-doc requests', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const petition = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_petition' },
    });
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const decree = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_decree' },
    });
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const support = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'child_support_worksheet' },
    });
    const lens = [
      petition.headers.get('content-length'),
      decree.headers.get('content-length'),
      support.headers.get('content-length'),
    ];
    // Blocker regression: pre-fix these were all identical (6,092 bytes,
    // the petition). Post-fix each dispatch path produces distinct content.
    expect(new Set(lens).size).toBe(3);
  });

  it('rejects an unknown documentType with a 400', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'gigawidget_certification' },
    });
    expect(res.status).toBe(400);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
  });

  it('rejects a support-doc kind the jurisdiction has no builder for with 400', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    // Task-listed but unwired: state TX has no financial_declaration builder
    // in the mocked registry (only UT does). Route must 400 rather than
    // silently fall through to the affidavit or petition template.
    const res = await post({
      documentId: 42,
      affidavitData: {
        state: 'UT', // Registry mock has UT but not indigency_affidavit
        documentType: 'indigency_affidavit',
      },
    });
    expect(res.status).toBe(400);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
  });

  it('activeSubDocument still selects a divorce_package sub-doc when no explicit documentType', async () => {
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', activeSubDocument: 'divorce_decree' },
    });
    expect(res.status).toBe(200);
    expect(generateDivorceDecree).toHaveBeenCalledTimes(1);
    expect(generateDivorcePetition).not.toHaveBeenCalled();
  });

  it('returns a helpful 400 pointing to /api/documents/packet for documentType=case_packet', async () => {
    // Pre-fix: case_packet requests fell through to assertGenerationTypeAllowed
    // and got "Requested output does not match the saved document type" —
    // opaque, and wrong. Case packets are assembled by /api/documents/packet
    // (with cover sheet + TOC + evidence), not this per-document generator.
    mockQuery.mockResolvedValueOnce(paidPackageRow());
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'case_packet' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/\/api\/documents\/packet/),
      }),
    );
    expect(mockGeneratePDF).not.toHaveBeenCalled();
    expect(generateDivorcePetition).not.toHaveBeenCalled();
    expect(generateDivorceDecree).not.toHaveBeenCalled();
  });

  // Bug 2 (coverage gap, 2026-08-30): divorce_response now has jurisdictional
  // Answer builders for FL, GA, NY, TX, CA, ON, AB — the packet and generate
  // routes must return 200 for each rather than the "coverage gap" 400 that
  // was thrown when only Utah shipped an Answer template.
  it.each(['FL', 'GA', 'NY', 'TX', 'CA', 'ON', 'AB'])(
    'routes documentType=divorce_response through the %s answer builder (Bug 2 coverage gap)',
    async (state) => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            content: {
              state,
              affiantName: 'Test Owner',
              petitionerName: 'Alice Petitioner',
              respondentName: 'Bob Respondent',
              facts: [],
            },
            document_type: 'divorce_package',
            payment_status: 'paid',
          },
        ],
      });
      const res = await post({
        documentId: 42,
        affidavitData: { state, documentType: 'divorce_response' },
      });
      expect(res.status).toBe(200);
      expect(answerBuilder).toHaveBeenCalledTimes(1);
      expect(generateDivorcePetition).not.toHaveBeenCalled();
      expect(generateDivorceDecree).not.toHaveBeenCalled();
      expect(res.headers.get('content-disposition')).toMatch(/filename="response-/);
    },
  );

  it('rejects a caller trying to escalate a stored affidavit into a divorce petition', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          content: { state: 'UT' },
          document_type: 'general_affidavit',
          payment_status: 'paid',
        },
      ],
    });
    const res = await post({
      documentId: 42,
      affidavitData: { state: 'UT', documentType: 'divorce_petition' },
    });
    expect(res.status).toBe(400);
    expect(generateDivorcePetition).not.toHaveBeenCalled();
  });
});
