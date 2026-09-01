/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';

const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Function) => (req: Request) => handler(req, { params: {}, user: { id: 7 } }),
}));
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: () => ({ ok: true }),
  RATE_LIMITS: { pdf: {} },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Template manager with the divorce sub-document surface so divorce_package
// rows expand to petition + decree. hasDocumentType is a jest.fn so a test
// can simulate a jurisdiction missing one template.
const mockTemplateManager = {
  generateAffidavit: jest.fn(() => ({ sections: {} })),
  hasDocumentType: jest.fn((_state: string, _type: string) => true),
  generateDivorcePetition: jest.fn(() => ({
    sections: {},
    metadata: { documentTitle: 'Verified Petition for Divorce' },
  })),
  generateDivorceDecree: jest.fn(() => ({
    sections: {},
    metadata: { documentTitle: 'Decree of Divorce' },
  })),
};
jest.mock('@/lib/api/services', () => ({
  getServices: async () => ({ templateManager: mockTemplateManager }),
}));

// Each generatePDF call writes a UNIQUE temp file. The route consumes the
// file and then unlinks it fire-and-forget (not awaited before the response
// resolves), so a shared filename lets a stale unlink from the previous test
// delete the file the next test just wrote — readFile then ENOENTs and the
// route 500s. Only reproduces under full-run load (threadpool contention
// delays the pending unlink into the next test's window).
let mockPdfSeq = 0;
const mockWrittenPdfs: string[] = [];
const mockGeneratePDF = jest.fn(async () => {
  const filepath = path.join(process.cwd(), `packet-payment-test-${++mockPdfSeq}.pdf`);
  mockWrittenPdfs.push(filepath);
  fs.writeFileSync(filepath, '%PDF main');
  return { success: true, filepath };
});
jest.mock('@/services/pdfService', () =>
  jest.fn().mockImplementation(() => ({ generatePDF: mockGeneratePDF })),
);
jest.mock('@/services/evidenceStorage', () => ({
  listEvidenceForDocument: async () => [],
  getEvidence: jest.fn(),
}));
const mockAssemblePacket = jest.fn(async (..._args: unknown[]) => Buffer.from('%PDF packet'));
jest.mock('@/services/courtPacket', () => ({
  assemblePacket: (...args: unknown[]) => mockAssemblePacket(...args),
}));

import { POST } from '@/app/api/documents/packet/route';

const documentRow = {
  content: { state: 'UT', facts: [] },
  title: 'Utah filing',
  document_type: 'affidavit',
  template_state: 'UT',
  payment_status: 'paid',
};

function post(): Promise<Response> {
  return (POST as unknown as (req: Request) => Promise<Response>)(
    new Request('https://discover.legal/api/documents/packet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentId: 42 }),
    }),
  );
}

type PacketCall = {
  documents?: Array<{ buffer: Buffer; title?: string }>;
  mainPdfBuffer?: Buffer;
  mainTitle?: string;
};

function lastPacketCall(): PacketCall {
  expect(mockAssemblePacket).toHaveBeenCalledTimes(1);
  return mockAssemblePacket.mock.calls[0][0] as unknown as PacketCall;
}

const ORIGINAL_PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED;

beforeEach(() => {
  // These tests exercise the payment gate, which is dormant by default
  // (the product is free) — arm it explicitly. lib/api/stripe.ts reads the
  // flag lazily per call, so pinning per-test is sufficient.
  process.env.PAYMENTS_ENABLED = 'true';
});

afterEach(() => {
  if (ORIGINAL_PAYMENTS_ENABLED === undefined) delete process.env.PAYMENTS_ENABLED;
  else process.env.PAYMENTS_ENABLED = ORIGINAL_PAYMENTS_ENABLED;
  // force:true — the route's own fire-and-forget unlink may still race us.
  for (const f of mockWrittenPdfs) fs.rmSync(f, { force: true });
  mockWrittenPdfs.length = 0;
  jest.clearAllMocks();
  // clearAllMocks resets calls but NOT implementations — restore the default
  // "every template exists" behavior a test may have overridden.
  mockTemplateManager.hasDocumentType.mockImplementation(() => true);
});

describe('POST /api/documents/packet payment and ownership gate', () => {
  it('returns 402 before rendering an unpaid document', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...documentRow, payment_status: 'pending' }] });
    const response = await post();
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({ errorType: 'payment_required' });
    expect(mockWrittenPdfs).toHaveLength(0);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
  });

  it('returns 402 before rendering ANY part of an unpaid divorce package', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...documentRow, document_type: 'divorce_package', payment_status: 'pending' }],
    });
    expect((await post()).status).toBe(402);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
  });

  it('returns 404 for a document owned by someone else', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect((await post()).status).toBe(404);
  });

  it('renders a paid filing packet', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [documentRow] });
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    // Single-document types keep the historical single-buffer call shape.
    expect(mockGeneratePDF).toHaveBeenCalledTimes(1);
    const call = lastPacketCall();
    expect(call.documents).toBeUndefined();
    expect(Buffer.isBuffer(call.mainPdfBuffer)).toBe(true);
    expect(call.mainTitle).toBe('Utah filing');
  });

  it('allows owned documents when the payment kill switch is off', async () => {
    process.env.PAYMENTS_ENABLED = 'false';
    mockQuery.mockResolvedValueOnce({ rows: [{ ...documentRow, payment_status: 'pending' }] });
    expect((await post()).status).toBe(200);
  });
});

describe('POST /api/documents/packet divorce package expansion', () => {
  it('renders the petition alone (proposed decree is not part of the initiating packet)', async () => {
    // Sarah AB round-2: the initiating packet ships the Statement of
    // Claim / Petition only. The proposed Divorce Judgment / Decree is a
    // post-hearing / on-consent document and belongs in a separate
    // finalization packet, not next to the petition.
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...documentRow, document_type: 'divorce_package' }],
    });
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');

    expect(mockGeneratePDF).toHaveBeenCalledTimes(1);
    expect(mockTemplateManager.generateDivorcePetition).toHaveBeenCalledTimes(1);
    expect(mockTemplateManager.generateDivorceDecree).not.toHaveBeenCalled();

    const call = lastPacketCall();
    expect(call.documents).toBeUndefined();
    expect(Buffer.isBuffer(call.mainPdfBuffer)).toBe(true);
    expect(call.mainTitle).toBe('Verified Petition for Divorce');
  });

  it('degrades to the petition alone when the jurisdiction has no decree template', async () => {
    mockTemplateManager.hasDocumentType.mockImplementation(
      (_state: string, type: string) => type !== 'divorce_decree',
    );
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...documentRow, document_type: 'divorce_package' }],
    });
    const response = await post();
    expect(response.status).toBe(200);
    expect(mockGeneratePDF).toHaveBeenCalledTimes(1);
    const call = lastPacketCall();
    expect(call.documents).toBeUndefined();
    expect(Buffer.isBuffer(call.mainPdfBuffer)).toBe(true);
    expect(call.mainTitle).toBe('Verified Petition for Divorce');
  });
});
