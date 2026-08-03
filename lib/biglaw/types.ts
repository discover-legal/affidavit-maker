/**
 * Types for the affidavit-maker ↔ BigLaw intake/CRM contract (v1).
 * Authoritative contract: docs/BIGLAW_INTEGRATION.md (mirrored from the
 * BigLaw repository's docs/integration/affidavit-intake.md).
 */

/** CRM fact category vocabulary (§5 of the contract). */
export const FACT_CATEGORIES = [
  'identity',
  'contact',
  'family',
  'financial',
  'employment',
  'matter',
  'adverse_party',
  'goal',
  'concern',
  'constraint',
  'preference',
  'history',
  'note',
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

/** Known submission statuses. Unknown values must be treated as `in_review`. */
export const SUBMISSION_STATUSES = [
  'received',
  'conflict_hold',
  'in_review',
  'ready',
  'rejected',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Coerce an upstream status into the known vocabulary (superset-safe). */
export function normalizeSubmissionStatus(status: unknown): SubmissionStatus {
  if (
    typeof status === 'string' &&
    (SUBMISSION_STATUSES as readonly string[]).includes(status)
  ) {
    return status as SubmissionStatus;
  }
  return 'in_review';
}

/** Fact shape, both directions (§3.4 of the contract). */
export interface IntakeFact {
  id: string;
  category: FactCategory | string;
  predicate: string;
  value: string;
  note: string;
  source: 'client' | 'lawyer' | 'intake' | 'system' | string;
  proposedBy: string;
  approverRole: 'lawyer' | 'client' | string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded' | string;
  decisionNote: string;
  createdAt: string;
  decidedAt: string;
}

/** Fact payload the portal sends when seeding or proposing facts. */
export interface IntakeFactInput {
  category: FactCategory;
  predicate: string;
  value: string;
  note?: string;
}

export interface IntakeClientIdentity {
  externalId: string;
  email: string;
  name: string;
}

/** POST /intake/submissions request body (§3.1). */
export interface SubmitIntakeRequest {
  externalId: string;
  client: IntakeClientIdentity;
  title: string;
  documentType: string;
  matterType?: string;
  jurisdiction?: string;
  summary?: string;
  content: string;
  facts?: IntakeFactInput[];
  metadata?: Record<string, unknown>;
}

export interface SubmissionConflict {
  hasConflict: boolean;
  [key: string]: unknown;
}

/** Submission record returned by POST /intake/submissions (§3.1). */
export interface IntakeSubmission {
  id: string;
  externalId: string;
  status: string;
  clientId: string;
  clientNumber: string;
  crmProfileId: string;
  documentId: string;
  conflict: SubmissionConflict;
  createdAt: string;
}

/** Submission shape from the GET endpoints (§3.2 / §3.3) — adds review fields. */
export interface IntakeSubmissionDetail extends IntakeSubmission {
  note?: string;
  assignedToName?: string;
  taskId?: string;
  updatedAt?: string;
}

export interface CrmProfile {
  id: string;
  clientId: string;
  clientNumber: string;
  name: string;
  email: string;
}

/** GET /intake/clients/:externalId/profile response (§3.4). */
export interface ClientProfileResponse {
  profile: CrmProfile;
  facts: IntakeFact[];
  pendingYourApproval: IntakeFact[];
  pendingLawyerApproval: IntakeFact[];
}

/** POST /intake/clients/:externalId/proposals body (§3.5). */
export interface ProposeFactsRequest {
  client: { email: string; name: string };
  facts: IntakeFactInput[];
}

export type ProposalDecision = 'approve' | 'reject';
