/**
 * @jest-environment node
 */
jest.mock('@/lib/marketplace/repository', () => ({
  searchTemplates: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/marketplace/templates/route';
import { searchTemplates } from '@/lib/marketplace/repository';

const mockSearch = searchTemplates as jest.Mock;
const ORIGINAL = process.env.ENABLE_MARKETPLACE;

function get(url = 'http://localhost/api/marketplace/templates') {
  return GET(new NextRequest(url));
}

afterEach(() => {
  process.env.ENABLE_MARKETPLACE = ORIGINAL;
  mockSearch.mockReset();
});

describe('GET /api/marketplace/templates feature gating', () => {
  it('404s when the marketplace flag is off (route is invisible)', async () => {
    process.env.ENABLE_MARKETPLACE = 'false';
    const res = await get();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('serves the page when the flag is on', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    mockSearch.mockResolvedValue({ templates: [], nextCursor: null, total: 0 });
    const res = await get('http://localhost/api/marketplace/templates?sort=newest&limit=5');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ templates: [], nextCursor: null, total: 0 });
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'newest', limit: 5 }),
    );
  });

  it('returns a 400 on invalid query params when enabled', async () => {
    process.env.ENABLE_MARKETPLACE = 'true';
    const res = await get('http://localhost/api/marketplace/templates?sort=not-a-sort');
    expect(res.status).toBe(400);
  });
});
