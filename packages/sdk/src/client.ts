import { MarketplaceApiError, MarketplaceNetworkError } from './errors';
import type {
  AdminStats,
  AdminTemplate,
  AdminTemplateListPage,
  AdminUser,
  AdminUserListPage,
  ApiErrorBody,
  ApiSuccess,
  CheckoutSession,
  CreateTemplateInput,
  LawyerDashboard,
  LawyerTemplate,
  LawyerTemplateListPage,
  LawyerTemplateListParams,
  MarketplaceTemplate,
  Purchase,
  PurchaseDetail,
  PurchaseListPage,
  TemplateListPage,
  TemplateSearchParams,
  TemplateStatus,
  UpdateTemplateInput,
  UserRole,
} from './types';

export interface DiscoverLegalClientOptions {
  /**
   * Origin the API is served from, e.g. 'https://discover.legal'. Defaults to
   * '' (same-origin) — the right value when the SDK runs in the browser inside
   * the discover.legal app itself.
   */
  baseUrl?: string;
  /**
   * Fetch implementation. Defaults to the global `fetch`. Inject for tests, or
   * to add retry/proxy behavior. In Node < 18 with no global fetch, pass one
   * explicitly (e.g. `undici`).
   */
  fetch?: typeof globalThis.fetch;
  /** Headers sent on every request (e.g. an API key for partner integrations). */
  headers?: Record<string, string>;
  /**
   * Credentials mode for requests. Defaults to 'same-origin' so the in-browser
   * UI sends its session cookie to the authed provider endpoints. Partners
   * authenticating with an API key in `headers` can leave this as-is.
   */
  credentials?: RequestCredentials;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Maps SDK camelCase search params onto the API's snake_case query keys. */
const SEARCH_PARAM_MAP: Record<keyof TemplateSearchParams, string> = {
  q: 'q',
  matterType: 'matter_type',
  practiceArea: 'practice_area',
  jurisdiction: 'jurisdiction',
  minPrice: 'min_price',
  maxPrice: 'max_price',
  minRating: 'min_rating',
  sortBy: 'sort',
  cursor: 'cursor',
  limit: 'limit',
};

/**
 * Typed client for the discover.legal document marketplace API.
 *
 * @example
 * const client = new DiscoverLegalClient({ baseUrl: 'https://discover.legal' });
 * const page = await client.templates.search({ q: 'divorce', jurisdiction: 'CA' });
 */
export class DiscoverLegalClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly credentials: RequestCredentials;

  /** Public, unauthenticated reads of published templates. */
  readonly templates: TemplatesResource;
  /** Authenticated provider (lawyer) template authoring. */
  readonly lawyer: LawyerResource;
  /** Authenticated buyer checkout, interview, and document generation. */
  readonly purchases: PurchasesResource;
  /** Authenticated admin moderation + user/role management. */
  readonly admin: AdminResource;

  constructor(options: DiscoverLegalClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new Error(
        'DiscoverLegalClient: no fetch implementation available. Pass `fetch` in options (Node < 18).',
      );
    }
    // Bind so a global `fetch` keeps its expected `this`.
    this.fetchImpl = f.bind(globalThis);
    this.defaultHeaders = { accept: 'application/json', ...(options.headers ?? {}) };
    this.credentials = options.credentials ?? 'same-origin';
    this.templates = new TemplatesResource(this);
    this.lawyer = new LawyerResource(this);
    this.purchases = new PurchasesResource(this);
    this.admin = new AdminResource(this);
  }

  /** @internal — builds an absolute (or same-origin relative) URL with query. */
  buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const qs = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          qs.set(key, String(value));
        }
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return `${this.baseUrl}${path}${suffix}`;
  }

  /** @internal — performs a request and unwraps the `{ success, data }` envelope. */
  async request<T>(method: HttpMethod, url: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        credentials: this.credentials,
        headers: {
          ...this.defaultHeaders,
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw new MarketplaceNetworkError(
        `Request to ${url} failed before a response was received`,
        cause,
      );
    }

    const parsed = await this.parseBody(res);

    if (!res.ok) {
      const errBody = (parsed ?? {}) as Partial<ApiErrorBody>;
      throw new MarketplaceApiError(errBody.error ?? `Request failed with status ${res.status}`, {
        status: res.status,
        errorType: errBody.errorType,
        requestId: errBody.requestId ?? res.headers.get('x-request-id') ?? undefined,
        body: parsed,
      });
    }

    const envelope = parsed as ApiSuccess<T> | null;
    if (!envelope || envelope.success !== true) {
      throw new MarketplaceApiError('Malformed success response from server', {
        status: res.status,
        body: parsed,
      });
    }
    return envelope.data;
  }

  /** @internal — GET shorthand. */
  getJson<T>(url: string): Promise<T> {
    return this.request<T>('GET', url);
  }

  private async parseBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

/** `client.templates.*` — read access to published marketplace templates. */
export class TemplatesResource {
  constructor(private readonly client: DiscoverLegalClient) {}

  /** List published templates (no full-text query). */
  list(params: TemplateSearchParams = {}): Promise<TemplateListPage> {
    return this.search(params);
  }

  /** Search/filter published templates with cursor pagination. */
  search(params: TemplateSearchParams = {}): Promise<TemplateListPage> {
    const query: Record<string, string | number | undefined> = {};
    for (const [key, apiKey] of Object.entries(SEARCH_PARAM_MAP)) {
      const value = params[key as keyof TemplateSearchParams];
      if (value !== undefined) query[apiKey] = value as string | number;
    }
    const url = this.client.buildUrl('/api/marketplace/templates', query);
    return this.client.getJson<TemplateListPage>(url);
  }

  /** Fetch a single published template by its slug. */
  async get(slug: string): Promise<MarketplaceTemplate> {
    const url = this.client.buildUrl(`/api/marketplace/templates/${encodeURIComponent(slug)}`);
    const data = await this.client.getJson<{ template: MarketplaceTemplate }>(url);
    return data.template;
  }
}

/**
 * `client.lawyer.*` — authenticated provider template authoring. All calls
 * require a lawyer/admin session (cookie) or partner credentials; a client-role
 * or anonymous caller gets a `MarketplaceApiError` with `status: 403`/`401`.
 */
export class LawyerResource {
  constructor(private readonly client: DiscoverLegalClient) {}

  /** List the calling lawyer's own templates (any status). */
  list(params: LawyerTemplateListParams = {}): Promise<LawyerTemplateListPage> {
    const url = this.client.buildUrl('/api/lawyer/templates', {
      status: params.status,
      cursor: params.cursor,
      limit: params.limit,
    });
    return this.client.getJson<LawyerTemplateListPage>(url);
  }

  async get(id: number): Promise<LawyerTemplate> {
    const url = this.client.buildUrl(`/api/lawyer/templates/${id}`);
    const data = await this.client.getJson<{ template: LawyerTemplate }>(url);
    return data.template;
  }

  async create(input: CreateTemplateInput): Promise<LawyerTemplate> {
    const url = this.client.buildUrl('/api/lawyer/templates');
    const data = await this.client.request<{ template: LawyerTemplate }>('POST', url, input);
    return data.template;
  }

  async update(id: number, patch: UpdateTemplateInput): Promise<LawyerTemplate> {
    const url = this.client.buildUrl(`/api/lawyer/templates/${id}`);
    const data = await this.client.request<{ template: LawyerTemplate }>('PUT', url, patch);
    return data.template;
  }

  async remove(id: number): Promise<{ id: number }> {
    const url = this.client.buildUrl(`/api/lawyer/templates/${id}`);
    return this.client.request<{ id: number }>('DELETE', url);
  }

  /** Submit a draft for publication (draft|archived -> published). */
  async publish(id: number): Promise<LawyerTemplate> {
    const url = this.client.buildUrl(`/api/lawyer/templates/${id}/publish`);
    const data = await this.client.request<{ template: LawyerTemplate }>('POST', url);
    return data.template;
  }

  /** Pull a published template back to draft. */
  async unpublish(id: number): Promise<LawyerTemplate> {
    const url = this.client.buildUrl(`/api/lawyer/templates/${id}/unpublish`);
    const data = await this.client.request<{ template: LawyerTemplate }>('POST', url);
    return data.template;
  }

  dashboard(): Promise<LawyerDashboard> {
    const url = this.client.buildUrl('/api/lawyer/dashboard');
    return this.client.getJson<LawyerDashboard>(url);
  }
}

/**
 * `client.purchases.*` — authenticated buyer flow: start checkout for a
 * template, run its interview, and generate the completed document. Requires a
 * signed-in session (cookie) or partner credentials.
 */
export class PurchasesResource {
  constructor(private readonly client: DiscoverLegalClient) {}

  /** Begin checkout for a published template. Returns a Stripe client secret
   *  (or `free: true` for a $0 template, already paid). */
  create(templateId: number): Promise<CheckoutSession> {
    const url = this.client.buildUrl(`/api/marketplace/templates/${templateId}/purchase`);
    return this.client.request<CheckoutSession>('POST', url);
  }

  /** List the buyer's own purchases (newest first), cursor-paginated. */
  list(params: { cursor?: string; limit?: number } = {}): Promise<PurchaseListPage> {
    const url = this.client.buildUrl('/api/marketplace/purchases', {
      cursor: params.cursor,
      limit: params.limit,
    });
    return this.client.getJson<PurchaseListPage>(url);
  }

  /** Fetch one purchase + the template's interview config. */
  async get(id: number): Promise<PurchaseDetail> {
    const url = this.client.buildUrl(`/api/marketplace/purchases/${id}`);
    const data = await this.client.getJson<{ purchase: PurchaseDetail }>(url);
    return data.purchase;
  }

  /** Save (replace) the interview answers for a paid purchase. */
  async saveAnswers(id: number, answers: Record<string, unknown>): Promise<Purchase> {
    const url = this.client.buildUrl(`/api/marketplace/purchases/${id}/answers`);
    const data = await this.client.request<{ purchase: Purchase }>('PUT', url, { answers });
    return data.purchase;
  }

  /** Render + store the completed document from the saved answers. */
  async generate(id: number): Promise<PurchaseDetail> {
    const url = this.client.buildUrl(`/api/marketplace/purchases/${id}/generate`);
    const data = await this.client.request<{ purchase: PurchaseDetail }>('POST', url);
    return data.purchase;
  }
}

/**
 * `client.admin.*` — moderation + user/role management. Requires an admin
 * session; non-admins get a `MarketplaceApiError` with `status: 403`.
 */
export class AdminResource {
  constructor(private readonly client: DiscoverLegalClient) {}

  stats(): Promise<AdminStats> {
    return this.client.getJson<AdminStats>(this.client.buildUrl('/api/admin/stats'));
  }

  listUsers(
    params: { role?: UserRole; q?: string; cursor?: string; limit?: number } = {},
  ): Promise<AdminUserListPage> {
    const url = this.client.buildUrl('/api/admin/users', {
      role: params.role,
      q: params.q,
      cursor: params.cursor,
      limit: params.limit,
    });
    return this.client.getJson<AdminUserListPage>(url);
  }

  async setUserRole(userId: number, role: UserRole): Promise<AdminUser> {
    const url = this.client.buildUrl(`/api/admin/users/${userId}/role`);
    const data = await this.client.request<{ user: AdminUser }>('PUT', url, { role });
    return data.user;
  }

  listTemplates(
    params: { status?: TemplateStatus; cursor?: string; limit?: number } = {},
  ): Promise<AdminTemplateListPage> {
    const url = this.client.buildUrl('/api/admin/templates', {
      status: params.status,
      cursor: params.cursor,
      limit: params.limit,
    });
    return this.client.getJson<AdminTemplateListPage>(url);
  }

  async approveTemplate(id: number): Promise<AdminTemplate> {
    const url = this.client.buildUrl(`/api/admin/templates/${id}/approve`);
    const data = await this.client.request<{ template: AdminTemplate }>('POST', url);
    return data.template;
  }

  async suspendTemplate(id: number, reason: string): Promise<AdminTemplate> {
    const url = this.client.buildUrl(`/api/admin/templates/${id}/suspend`);
    const data = await this.client.request<{ template: AdminTemplate }>('POST', url, { reason });
    return data.template;
  }

  async reinstateTemplate(id: number): Promise<AdminTemplate> {
    const url = this.client.buildUrl(`/api/admin/templates/${id}/reinstate`);
    const data = await this.client.request<{ template: AdminTemplate }>('POST', url);
    return data.template;
  }
}
