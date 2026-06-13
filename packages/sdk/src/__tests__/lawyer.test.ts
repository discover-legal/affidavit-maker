/**
 * @jest-environment node
 */
import { DiscoverLegalClient } from '../client';
import type { LawyerTemplate } from '../types';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

const tpl = { id: 5, slug: 'draft-x', title: 'Draft X', status: 'draft' } as unknown as LawyerTemplate;

function clientWith(fetchMock: jest.Mock) {
  return new DiscoverLegalClient({ baseUrl: 'https://discover.legal', fetch: fetchMock });
}

describe('LawyerResource', () => {
  it('lists own templates with status/limit query and sends credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { templates: [tpl], nextCursor: null, total: 1 }, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    const page = await client.lawyer.list({ status: 'draft', limit: 10 });

    expect(page.total).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe('/api/lawyer/templates');
    expect(u.searchParams.get('status')).toBe('draft');
    expect(u.searchParams.get('limit')).toBe('10');
    expect((init as RequestInit).credentials).toBe('same-origin');
  });

  it('creates a template via POST with a JSON body + content-type', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { template: tpl }, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    const created = await client.lawyer.create({
      title: 'Draft X',
      matterType: 'affidavit',
      practiceArea: 'civil',
    });

    expect(created).toEqual(tpl);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/lawyer/templates');
    expect((init as RequestInit).method).toBe('POST');
    expect(new Headers((init as RequestInit).headers).get('content-type')).toBe('application/json');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      title: 'Draft X',
      matterType: 'affidavit',
    });
  });

  it('updates via PUT to the id path', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { template: tpl }, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    await client.lawyer.update(5, { priceCents: 250 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/lawyer/templates/5');
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ priceCents: 250 });
  });

  it('removes via DELETE with no body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { id: 5 }, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    const res = await client.lawyer.remove(5);

    expect(res).toEqual({ id: 5 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/lawyer/templates/5');
    expect((init as RequestInit).method).toBe('DELETE');
    expect((init as RequestInit).body).toBeUndefined();
  });

  it('publishes via POST to the publish sub-path', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { template: { ...tpl, status: 'published' } }, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    const published = await client.lawyer.publish(5);

    expect(published.status).toBe('published');
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/lawyer/templates/5/publish');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('fetches the dashboard', async () => {
    const dashboard = {
      totals: { templates: 2, published: 1, drafts: 1, totalPurchases: 9, totalRevenueCents: 900, avgRating: 4.5 },
      recentTemplates: [tpl],
    };
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: dashboard, timestamp: 'n' }),
    );
    const client = clientWith(fetchMock);

    const result = await client.lawyer.dashboard();
    expect(result).toEqual(dashboard);
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/lawyer/dashboard');
  });

  it('respects a custom credentials option', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { templates: [], nextCursor: null, total: 0 }, timestamp: 'n' }),
    );
    const client = new DiscoverLegalClient({ fetch: fetchMock, credentials: 'include' });
    await client.lawyer.list();
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('include');
  });
});
