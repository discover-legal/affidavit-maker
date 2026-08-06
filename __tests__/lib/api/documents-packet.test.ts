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
jest.mock('@/lib/api/services', () => ({
  getServices: async () => ({ templateManager: { generateAffidavit: () => ({ sections: {} }) } }),
}));

const tempPdf = path.join(process.cwd(), 'packet-payment-test.pdf');
jest.mock('@/services/pdfService', () =>
  jest.fn().mockImplementation(() => ({
    generatePDF: async () => {
      fs.writeFileSync(tempPdf, '%PDF main');
      return { success: true, filepath: tempPdf };
    },
  })),
);
jest.mock('@/services/evidenceStorage', () => ({
  listEvidenceForDocument: async () => [],
  getEvidence: jest.fn(),
}));
jest.mock('@/services/courtPacket', () => ({
  assemblePacket: async () => Buffer.from('%PDF packet'),
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

beforeEach(() => {
  // These tests exercise the payment gate, which is dormant by default
  // (the product is free) — arm it explicitly.
  process.env.PAYMENTS_ENABLED = 'true';
});

afterEach(() => {
  delete process.env.PAYMENTS_ENABLED;
  if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
  jest.clearAllMocks();
});

describe('POST /api/documents/packet payment and ownership gate', () => {
  it('returns 402 before rendering an unpaid document', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...documentRow, payment_status: 'pending' }] });
    const response = await post();
    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({ errorType: 'payment_required' });
    expect(fs.existsSync(tempPdf)).toBe(false);
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
  });

  it('allows owned documents when the payment kill switch is off', async () => {
    process.env.PAYMENTS_ENABLED = 'false';
    mockQuery.mockResolvedValueOnce({ rows: [{ ...documentRow, payment_status: 'pending' }] });
    expect((await post()).status).toBe(200);
  });
});
