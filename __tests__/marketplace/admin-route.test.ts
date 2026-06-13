/**
 * @jest-environment node
 */
jest.mock('@/lib/api/auth', () => ({ withAuth: (h: unknown) => h }));
jest.mock('@/lib/marketplace/adminRepository', () => ({
  getAdminStats: jest.fn(),
  setUserRole: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/stats/route';
import { PUT } from '@/app/api/admin/users/[id]/role/route';
import { getAdminStats, setUserRole } from '@/lib/marketplace/adminRepository';

const mockStats = getAdminStats as jest.Mock;
const mockSetRole = setUserRole as jest.Mock;
const ORIGINAL = process.env.ENABLE_MARKETPLACE;

type TestUser = { id: number; role: 'client' | 'lawyer' | 'admin' };
const admin: TestUser = { id: 1, role: 'admin' };
const lawyer: TestUser = { id: 2, role: 'lawyer' };

afterEach(() => {
  process.env.ENABLE_MARKETPLACE = ORIGINAL;
  mockStats.mockReset();
  mockSetRole.mockReset();
});

function statsReq() {
  return (GET as any)(new NextRequest('http://localhost/api/admin/stats'), { user: admin });
}

describe('admin stats gating', () => {
  it('404s when the flag is off', async () => {
    process.env.ENABLE_MARKETPLACE = 'false';
    expect((await statsReq()).status).toBe(404);
    expect(mockStats).not.toHaveBeenCalled();
  });

  it('403s a non-admin (lawyer) when on', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const res = await (GET as any)(new NextRequest('http://localhost/api/admin/stats'), { user: lawyer });
    expect(res.status).toBe(403);
    expect(mockStats).not.toHaveBeenCalled();
  });

  it('serves stats to an admin', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockStats.mockResolvedValue({ users: {}, templates: {}, sales: {} });
    expect((await statsReq()).status).toBe(200);
    expect(mockStats).toHaveBeenCalled();
  });
});

describe('admin set role', () => {
  function roleReq(body: unknown, user: TestUser = admin, id = '2') {
    return (PUT as any)(
      new NextRequest('http://localhost/api/admin/users/2/role', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      { user, params: { id } },
    );
  }

  it('403s a non-admin', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    expect((await roleReq({ role: 'lawyer' }, lawyer)).status).toBe(403);
  });

  it('grants the lawyer role', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockSetRole.mockResolvedValue({ id: 2, email: 'x@y.z', name: 'X', role: 'lawyer', createdAt: '' });
    const res = await roleReq({ role: 'lawyer' });
    expect(res.status).toBe(200);
    expect(mockSetRole).toHaveBeenCalledWith(2, 'lawyer');
  });

  it('400s an invalid role', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    expect((await roleReq({ role: 'wizard' })).status).toBe(400);
    expect(mockSetRole).not.toHaveBeenCalled();
  });
});
