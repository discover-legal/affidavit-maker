/**
 * @jest-environment node
 */
import { DiscoverLegalClient } from '../client';
import { MarketplaceApiError, MarketplaceNetworkError } from '../errors';
import type { MarketplaceTemplate, TemplateListPage } from '../types';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

const sampleTemplate: MarketplaceTemplate = {
  id: 1,
  slug: 'simple-affidavit-tx',
  title: 'Simple Affidavit (TX)',
  shortDescription: 'A general-purpose Texas affidavit',
  description: 'Full description',
  matterType: 'affidavit',
  practiceArea: 'civil',
  jurisdictions: ['TX'],
  priceCents: 100,
  coverImageUrl: null,
  tags: ['affidavit', 'texas'],
  estimatedMinutes: 10,
  difficultyLevel: 'basic',
  totalPurchases: 42,
  avgRating: 4.7,
  ratingCount: 12,
  publishedAt: '2026-06-01T00:00:00.000Z',
  lawyer: { id: 7, displayName: 'Jane Counsel' },
};

const samplePage: TemplateListPage = {
  templates: [sampleTemplate],
  nextCursor: null,
  total: 1,
};

describe('DiscoverLegalClient.templates', () => {
  it('lists templates and unwraps the success envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: samplePage, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({ baseUrl: 'https://discover.legal', fetch: fetchMock });

    const page = await client.templates.list({ sortBy: 'popular', limit: 20 });

    expect(page).toEqual(samplePage);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/marketplace/templates');
    expect(url.searchParams.get('sort')).toBe('popular');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('maps camelCase search params to snake_case query keys', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: samplePage, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({ baseUrl: '', fetch: fetchMock });

    await client.templates.search({
      q: 'divorce',
      matterType: 'divorce',
      practiceArea: 'family',
      jurisdiction: 'CA',
      minPrice: 100,
      maxPrice: 500,
      minRating: 4,
      sortBy: 'rating',
      cursor: 'abc',
      limit: 10,
    });

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    const qp = url.searchParams;
    expect(qp.get('q')).toBe('divorce');
    expect(qp.get('matter_type')).toBe('divorce');
    expect(qp.get('practice_area')).toBe('family');
    expect(qp.get('jurisdiction')).toBe('CA');
    expect(qp.get('min_price')).toBe('100');
    expect(qp.get('max_price')).toBe('500');
    expect(qp.get('min_rating')).toBe('4');
    expect(qp.get('sort')).toBe('rating');
    expect(qp.get('cursor')).toBe('abc');
    expect(qp.get('limit')).toBe('10');
  });

  it('omits undefined params from the query string', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: samplePage, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({ fetch: fetchMock });

    await client.templates.list({});

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect([...url.searchParams.keys()]).toEqual([]);
  });

  it('fetches a single template by slug', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { template: sampleTemplate }, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({ baseUrl: 'https://discover.legal', fetch: fetchMock });

    const tpl = await client.templates.get('simple-affidavit-tx');

    expect(tpl).toEqual(sampleTemplate);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/marketplace/templates/simple-affidavit-tx');
  });

  it('url-encodes the slug', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { template: sampleTemplate }, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({ fetch: fetchMock });

    await client.templates.get('a/b slug');

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/marketplace/templates/a%2Fb%20slug');
  });

  it('throws MarketplaceApiError carrying status + requestId on a failure envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(
        { success: false, error: 'Not found', errorType: 'NotFoundError', requestId: 'req-123' },
        { status: 404 },
      ),
    );
    const client = new DiscoverLegalClient({ fetch: fetchMock });

    await expect(client.templates.get('missing')).rejects.toMatchObject({
      name: 'MarketplaceApiError',
      status: 404,
      errorType: 'NotFoundError',
      requestId: 'req-123',
      message: 'Not found',
    });
  });

  it('throws MarketplaceApiError on a non-JSON error body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response('upstream exploded', { status: 502 }),
    );
    const client = new DiscoverLegalClient({ fetch: fetchMock });

    const err = await client.templates.list({}).catch((e) => e);
    expect(err).toBeInstanceOf(MarketplaceApiError);
    expect(err.status).toBe(502);
  });

  it('wraps fetch rejections as MarketplaceNetworkError', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new DiscoverLegalClient({ fetch: fetchMock });

    await expect(client.templates.list({})).rejects.toBeInstanceOf(MarketplaceNetworkError);
  });

  it('sends default + per-request headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: samplePage, timestamp: 'now' }),
    );
    const client = new DiscoverLegalClient({
      fetch: fetchMock,
      headers: { 'x-api-key': 'secret' },
    });

    await client.templates.list({});

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('secret');
    expect(headers.get('accept')).toBe('application/json');
  });
});
