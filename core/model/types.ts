/**
 * The domain model the whole core shares.
 *
 * Two rules run through everything here:
 *   1. Unknown is ABSENT. No sentinel strings ("unknown", "n/a", "other"),
 *      no nulls standing in for "not stated". A field either exists with a
 *      value and provenance, or it does not exist.
 *   2. Every value carries provenance: where it came from and, for anything
 *      the user said, their own words. Drafts are built only from values
 *      with provenance, and dispositive statements only from Confirmations.
 */

import type { Json } from '../intelligence/types';

export type MatterCode = string;
export type JurisdictionCode = string;
export type Language = 'en' | 'es';

/** Canonical roles. The jurisdiction lexicon renders them (Applicant, Plaintiff, …). */
export type PartyRole = 'petitioner' | 'respondent';

export type Source = 'stated' | 'ingested' | 'hydrated' | 'derived' | 'confirmed';

export interface Provenance {
  source: Source;
  /** The user's own words this value came from (stated / confirmed). */
  quote?: string;
  /** Interview turn that produced it. */
  turnId?: string;
  /** Ingested court paper this came from. */
  documentId?: string;
  /** For derived values: which fact / field ids it was derived from. */
  derivedFrom?: string[];
  at: string; // ISO timestamp
}

export interface Field<T extends Json = Json> {
  value: T;
  provenance: Provenance;
}

export type FactCategory =
  | 'identity'
  | 'relationship'
  | 'children'
  | 'residence'
  | 'finances'
  | 'property'
  | 'debts'
  | 'support'
  | 'safety'
  | 'events'
  | 'evidence'
  | 'procedure'
  | 'general';

export interface Fact {
  id: string;
  /** First-person statement in the user's meaning, cleaned of typos. */
  statement: string;
  category: FactCategory;
  subcategory?: string;
  provenance: Provenance;
  status: 'active' | 'retired';
  /** Fact id that superseded this one. */
  retiredBy?: string;
  /** Typed companions the model attached when the statement carries one. */
  values?: {
    number?: number;
    amount?: { value: number; currency: string; period?: 'week' | 'month' | 'year' | 'once' };
    place?: string;
    date?: string; // ISO date or partial YYYY / YYYY-MM
    ground?: string;
  };
}

export interface Party {
  firstName?: Field<string>;
  middleName?: Field<string>;
  lastName?: Field<string>;
  /** Convenience; derived from the name fields. */
  fullName?: string;
  address?: Field<string>;
  /** True only when the user affirmatively said they do not know where this party is. */
  whereaboutsUnknown?: Field<boolean>;
  suspectedLocation?: Field<string>;
}

export interface Child {
  id: string;
  name?: Field<string>;
  dateOfBirth?: Field<string>;
  age?: Field<number>;
  residesWith?: Field<'self' | 'other' | 'shared' | 'third_party'>;
}

/**
 * Things a draft may state dispositively ONLY because the user explicitly
 * affirmed them. Silence never produces one. Each carries the quote.
 */
export type ConfirmationKey =
  | 'no_children'
  | 'no_property'
  | 'no_debts'
  | 'support_waived'
  | 'no_safety_concerns'
  | 'not_military'
  | 'evidence_reviewed'
  | 'review_confirmed';

export type Confirmations = Partial<Record<ConfirmationKey, Provenance>>;

export interface InterviewState {
  phase: string;
  completed: string[];
  turns: number;
  /** Set when triage has finished and a matter is chosen. */
  triaged: boolean;
}

export interface CaseFile {
  id: string;
  userId: string;
  matter?: MatterCode;
  jurisdiction?: JurisdictionCode;
  role: PartyRole;
  language: Language;
  country?: string;
  caseNumber?: Field<string>;
  county?: Field<string>;
  parties: { self: Party; other: Party };
  children: Child[];
  /** Matter-specific structured fields, keyed by the matter definition's camelCase targets. */
  fields: Record<string, Field>;
  facts: Fact[];
  confirmations: Confirmations;
  interview: InterviewState;
}

export function emptyCaseFile(init: Pick<CaseFile, 'id' | 'userId'> & Partial<CaseFile>): CaseFile {
  return {
    role: 'petitioner',
    language: 'en',
    parties: { self: {}, other: {} },
    children: [],
    fields: {},
    facts: [],
    confirmations: {},
    interview: { phase: 'INTAKE', completed: [], turns: 0, triaged: false },
    ...init,
  };
}

export function activeFacts(file: CaseFile): Fact[] {
  return file.facts.filter((f) => f.status === 'active');
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
