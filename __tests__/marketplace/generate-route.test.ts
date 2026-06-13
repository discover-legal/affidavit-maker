/**
 * @jest-environment node
 */
jest.mock('@/lib/api/auth', () => ({ withAuth: (h: unknown) => h }));
jest.mock('@/lib/marketplace/purchaseRepository', () => ({
  getPurchaseDetail: jest.fn(),
  saveGeneratedDocument: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/marketplace/purchases/[id]/generate/route';
import { getPurchaseDetail, saveGeneratedDocument } from '@/lib/marketplace/purchaseRepository';

const mockGet = getPurchaseDetail as jest.Mock;
const mockSave = saveGeneratedDocument as jest.Mock;
const ORIGINAL = process.env.ENABLE_MARKETPLACE;
const buyer = { id: 8, role: 'client' as const };

function call(id = '3') {
  return (POST as any)(new NextRequest('http://localhost/api/marketplace/purchases/3/generate', { method: 'POST' }), {
    user: buyer,
    params: { id },
  });
}

const paidDetail = {
  id: 3,
  status: 'paid',
  interviewAnswers: { fullName: 'Jane' },
  templateConfig: {
    questions: [{ id: 'fullName', label: 'Full name', type: 'text', required: true }],
    body: 'I am {{fullName}}.',
  },
};

afterEach(() => {
  process.env.ENABLE_MARKETPLACE = ORIGINAL;
  mockGet.mockReset();
  mockSave.mockReset();
});

describe('POST generate', () => {
  it('404s when the flag is off', async () => {
    process.env.ENABLE_MARKETPLACE = 'false';
    expect((await call()).status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('403s when the purchase is not paid', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockGet.mockResolvedValue({ ...paidDetail, status: 'pending' });
    expect((await call()).status).toBe(403);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('400s when a required question is unanswered', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockGet.mockResolvedValue({ ...paidDetail, interviewAnswers: {} });
    expect((await call()).status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('renders the document and stores it on success', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockGet.mockResolvedValue(paidDetail);
    mockSave.mockResolvedValue({ ...paidDetail, completedDocument: 'I am Jane.' });
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.purchase.completedDocument).toBe('I am Jane.');
    expect(mockSave).toHaveBeenCalledWith(8, 3, 'I am Jane.');
  });
});
