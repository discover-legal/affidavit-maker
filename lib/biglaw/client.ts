/**
 * BigLaw intake API client — the portal side of the contract in
 * docs/BIGLAW_INTEGRATION.md. Every request is signed with HMAC-SHA256
 * over (METHOD, PATH_WITH_QUERY, timestamp, sha256(body)) using
 * BIGLAW_INTAKE_SECRET. The secret never appears in logs, error messages,
 * or responses.
 *
 * Lazy module-scope singleton via getBigLawClient() (pattern:
 * lib/api/stripe.ts). Returns null when firm mode is not configured so
 * self-rep deployments never construct a client.
 */

import { createHash, createHmac } from 'node:crypto';
import { ExternalServiceError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import type {
  ClientProfileResponse,
  IntakeFact,
  IntakeFactInput,
  IntakeSubmission,
  IntakeSubmissionDetail,
  ProposalDecision,
  SubmitIntakeRequest,
} from './types';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Compute the v1 intake signature.
 *
 *   bodyHash  = hex sha256(rawBody)            // sha256("") for GET
 *   canonical = METHOD + "\n" + PATH_WITH_QUERY + "\n" + timestamp + "\n" + bodyHash
 *   signature = "v1=" + hex hmac_sha256(secret, canonical)
 *
 * Exported for the unit tests' known-vector checks.
 */
export function signIntakeRequest(
  secret: string,
  method: string,
  pathWithQuery: string,
  timestamp: string,
  rawBody: string,
): string {
  const bodyHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const canonical = `${method}\n${pathWithQuery}\n${timestamp}\n${bodyHash}`;
  return `v1=${createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')}`;
}

/**
 * ExternalServiceError subclass carrying the upstream HTTP status so
 * route handlers can translate specific upstream failures (e.g. a 403 on
 * a proposal decision → AuthorizationError) without string matching.
 */
export class BigLawRequestError extends ExternalServiceError {
  upstreamStatus: number;
  constructor(message: string, upstreamStatus: number) {
    super(message);
    this.upstreamStatus = upstreamStatus;
  }
}

type RequestOptions = {
  body?: unknown;
  timeoutMs?: number;
  /** Return null instead of throwing when upstream responds 404. */
  nullOn404?: boolean;
};

export class BigLawClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.secret = secret;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: RequestOptions = {},
  ): Promise<T | null> {
    const url = new URL(this.baseUrl + path);
    // Sign the path exactly as sent — pathname + search, no scheme/host.
    // Using the parsed URL keeps the signature correct when BIGLAW_API_URL
    // itself carries a path prefix (e.g. https://firm.example/biglaw).
    const pathWithQuery = url.pathname + url.search;
    const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signIntakeRequest(this.secret, method, pathWithQuery, timestamp, rawBody);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Intake-Timestamp': timestamp,
          'X-Intake-Signature': signature,
        },
        body: options.body !== undefined ? rawBody : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (err) {
      // Network / timeout failure. Log the shape of the failure, never the
      // secret or signed headers.
      logger.warn('biglaw_request_network_error', {
        method,
        path: pathWithQuery,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ExternalServiceError('The firm platform is unreachable');
    }

    if (!response.ok) {
      if (response.status === 404 && options.nullOn404) return null;
      let upstreamError = '';
      try {
        const parsed = (await response.json()) as { error?: unknown };
        if (typeof parsed?.error === 'string') upstreamError = parsed.error;
      } catch {
        // Non-JSON error body — keep the generic message.
      }
      logger.warn('biglaw_request_failed', {
        method,
        path: pathWithQuery,
        status: response.status,
        upstreamError,
      });
      throw new BigLawRequestError(
        `Firm platform request failed (${response.status})`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      logger.warn('biglaw_request_bad_json', { method, path: pathWithQuery });
      throw new ExternalServiceError('The firm platform returned an invalid response');
    }
  }

  /** POST /intake/submissions — submit a draft to the firm (§3.1). */
  async submitIntake(request: SubmitIntakeRequest): Promise<IntakeSubmission> {
    const data = await this.request<{ submission: IntakeSubmission }>(
      'POST',
      '/intake/submissions',
      { body: request },
    );
    if (!data?.submission?.id) {
      throw new ExternalServiceError('The firm platform returned an invalid submission');
    }
    return data.submission;
  }

  /** GET /intake/submissions/:id — one submission (§3.2). */
  async getSubmission(id: string): Promise<IntakeSubmissionDetail> {
    const data = await this.request<{ submission: IntakeSubmissionDetail }>(
      'GET',
      `/intake/submissions/${encodeURIComponent(id)}`,
    );
    if (!data?.submission?.id) {
      throw new ExternalServiceError('The firm platform returned an invalid submission');
    }
    return data.submission;
  }

  /** GET /intake/clients/:externalId/submissions — newest-first list (§3.3). */
  async getClientSubmissions(
    externalId: string,
    options: { timeoutMs?: number } = {},
  ): Promise<IntakeSubmissionDetail[]> {
    const data = await this.request<{ submissions: IntakeSubmissionDetail[] }>(
      'GET',
      `/intake/clients/${encodeURIComponent(externalId)}/submissions`,
      { timeoutMs: options.timeoutMs },
    );
    return Array.isArray(data?.submissions) ? data.submissions : [];
  }

  /**
   * GET /intake/clients/:externalId/profile — the client's CRM view (§3.4).
   * Returns null when the client has never contacted the firm (upstream 404).
   */
  async getClientProfile(externalId: string): Promise<ClientProfileResponse | null> {
    const data = await this.request<ClientProfileResponse>(
      'GET',
      `/intake/clients/${encodeURIComponent(externalId)}/profile`,
      { nullOn404: true },
    );
    if (data === null) return null;
    return {
      profile: data.profile,
      facts: Array.isArray(data.facts) ? data.facts : [],
      pendingYourApproval: Array.isArray(data.pendingYourApproval) ? data.pendingYourApproval : [],
      pendingLawyerApproval: Array.isArray(data.pendingLawyerApproval)
        ? data.pendingLawyerApproval
        : [],
    };
  }

  /** POST /intake/clients/:externalId/proposals — client proposes updates (§3.5). */
  async proposeFacts(
    externalId: string,
    client: { email: string; name: string },
    facts: IntakeFactInput[],
  ): Promise<IntakeFact[]> {
    const data = await this.request<{ proposals: IntakeFact[] }>(
      'POST',
      `/intake/clients/${encodeURIComponent(externalId)}/proposals`,
      { body: { client, facts } },
    );
    return Array.isArray(data?.proposals) ? data.proposals : [];
  }

  /** POST /intake/proposals/:id/decision — client decides a lawyer proposal (§3.6). */
  async decideProposal(
    proposalId: string,
    clientExternalId: string,
    decision: ProposalDecision,
    note = '',
  ): Promise<IntakeFact> {
    const data = await this.request<{ fact: IntakeFact }>(
      'POST',
      `/intake/proposals/${encodeURIComponent(proposalId)}/decision`,
      { body: { clientExternalId, decision, note } },
    );
    if (!data?.fact?.id) {
      throw new ExternalServiceError('The firm platform returned an invalid decision result');
    }
    return data.fact;
  }
}

let clientInstance: BigLawClient | null = null;

/**
 * Lazy singleton. Returns null when firm mode is not configured
 * (BIGLAW_API_URL / BIGLAW_INTAKE_SECRET unset) — callers must treat null
 * as "firm features disabled", never as an error in self-rep deployments.
 */
export function getBigLawClient(): BigLawClient | null {
  const baseUrl = process.env.BIGLAW_API_URL;
  const secret = process.env.BIGLAW_INTAKE_SECRET;
  if (!baseUrl || !secret) return null;
  if (!clientInstance) {
    clientInstance = new BigLawClient(baseUrl, secret);
  }
  return clientInstance;
}
