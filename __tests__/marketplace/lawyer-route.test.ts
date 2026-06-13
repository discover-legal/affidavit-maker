/**
 * @jest-environment node
 */
// withAuth -> passthrough so we can drive the handler with a fabricated user/ctx.
jest.mock('@/lib/api/auth', () => ({
  withAuth: (h: unknown) => h,
}));
jest.mock('@/lib/marketplace/lawyerRepository', () => ({
  listLawyerTemplates: jest.fn(),
  createTemplate: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/lawyer/templates/route';
import { listLawyerTemplates, createTemplate } from '@/lib/marketplace/lawyerRepository';

const mockList = listLawyerTemplates as jest.Mock;
const mockCreate = createTemplate as jest.Mock;
const ORIGINAL = process.env.ENABLE_MARKETPLACE;

const lawyer = { id: 7, role: 'lawyer' as const };
const client = { id: 8, role: 'client' as const };

function getReq(url = 'http://localhost/api/lawyer/templates') {
  return new NextRequest(url);
}
function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/lawyer/templates', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  process.env.ENABLE_MARKETPLACE = ORIGINAL;
  mockList.mockReset();
  mockCreate.mockReset();
});

describe('lawyer templates handler gating', () => {
  it('404s when the marketplace flag is off, even for a lawyer', async () => {
    process.env.ENABLE_MARKETPLACE = 'false';
    const res = await (GET as any)(getReq(), { user: lawyer });
    expect(res.status).toBe(404);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('403s a client-role user when the flag is on', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const res = await (GET as any)(getReq(), { user: client });
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('lists templates scoped to the lawyer id', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockList.mockResolvedValue({ templates: [], nextCursor: null, total: 0 });
    const res = await (GET as any)(getReq('http://localhost/api/lawyer/templates?status=draft'), {
      user: lawyer,
    });
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'draft' }));
  });

  it('creates a draft and returns 201', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockCreate.mockResolvedValue({ id: 1, slug: 'x', status: 'draft' });
    const res = await (POST as any)(
      postReq({ title: 'My Template', matterType: 'affidavit', practiceArea: 'civil' }),
      { user: lawyer },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.template).toMatchObject({ status: 'draft' });
    expect(mockCreate).toHaveBeenCalledWith(7, expect.objectContaining({ title: 'My Template' }));
  });

  it('rejects an invalid create body with 400', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const res = await (POST as any)(postReq({ title: 'x' }), { user: lawyer });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
