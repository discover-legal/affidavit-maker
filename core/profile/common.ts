/**
 * Shared vocabulary for the life-story module: which Party / Child members
 * are Fields, which stored field keys belong to which hydration group, and
 * the small merge helpers hydrate / absorb / promote / ingest share.
 *
 * Everything here is structural — identifiers and shapes — never a reading
 * of prose. Semantic questions (same child? duplicate fact? same person?)
 * are judgments made one pair at a time in absorb.ts.
 */

import { THRESHOLDS } from '../intelligence/types';
import type { Json, JsonObject } from '../intelligence/types';
import { now } from '../model/types';
import type { Field } from '../model/types';
import type { LifeStory } from './types';

/** The Party members that are Fields (`fullName` is a derived convenience string). */
export const PARTY_FIELD_KEYS = ['firstName', 'middleName', 'lastName', 'address', 'whereaboutsUnknown', 'suspectedLocation'] as const;

/** The Child members that are Fields. */
export const CHILD_FIELD_KEYS = ['name', 'dateOfBirth', 'age', 'residesWith'] as const;

export type FieldGroup = 'general' | 'family' | 'jurisdiction';

/**
 * Hydration groups (spec 02 §2.1 / §2.2). A schema over field identifiers,
 * not a heuristic over text: a stored field hydrates into a new file only
 * when its key is listed under a group the scope admits. `general` hydrates
 * into every matter, `family` only into family matters, `jurisdiction`
 * never (the next case may be filed somewhere else). Keys outside the table
 * are stored but never hydrated.
 */
export const FIELD_GROUPS: Readonly<Record<string, FieldGroup>> = {
  // General — the person's own circumstances.
  monthlyIncome: 'general',
  spouseMonthlyIncome: 'general',
  monthlyExpenses: 'general',
  incomeBreakdown: 'general',
  expenseBreakdown: 'general',
  assetsDescription: 'general',
  dependents: 'general',
  feeWaiverRequested: 'general',
  // Family — the marriage, the children, the other party, money between the parties.
  spouseName: 'family',
  petitionerName: 'family',
  respondentName: 'family',
  marriageDate: 'family',
  marriagePlace: 'family',
  separationDate: 'family',
  numberOfChildren: 'family',
  hasMinorChildren: 'family',
  custodyArrangement: 'family',
  childSupportRequested: 'family',
  childSupportAmount: 'family',
  mediatedChildSupport: 'family',
  childSupportImputationRequested: 'family',
  selfEmployedPayor: 'family',
  incomeUnderreporting: 'family',
  grounds: 'family',
  groundsForDivorce: 'family',
  spousalSupportRequested: 'family',
  spousalSupportWaived: 'family',
  hasProperty: 'family',
  noPropertyConfirmed: 'family',
  hasDebts: 'family',
  noDebtsConfirmed: 'family',
  hasAgreedPropertyDivision: 'family',
  petitionerProperty: 'family',
  respondentProperty: 'family',
  petitionerDebts: 'family',
  respondentDebts: 'family',
  settlementAgreement: 'family',
  mediation: 'family',
  prenupSigned: 'family',
  equalizationRequested: 'family',
  serviceMethod: 'family',
  serviceDate: 'family',
  protectiveOrder: 'family',
  respondentAddress: 'family',
  respondentAddressUnknown: 'family',
  respondentSuspectedLocation: 'family',
  isMilitary: 'family',
  respondentMilitary: 'family',
  // Jurisdiction — stored for display, never hydrated.
  jurisdiction: 'jurisdiction',
  state: 'jurisdiction',
  province: 'jurisdiction',
  country: 'jurisdiction',
  county: 'jurisdiction',
  court: 'jurisdiction',
  residencyMonths: 'jurisdiction',
  stateResidencyMonths: 'jurisdiction',
  countyResidencyMonths: 'jurisdiction',
  residencyBasis: 'jurisdiction',
  residencyDuration: 'jurisdiction',
};

/**
 * THRESHOLDS carries no entry for the two profile-side comparisons yet; each
 * borrows the nearest measured level until there is data of its own.
 */
export const DUPLICATE_FACT = THRESHOLDS.supersedes;
export const SAME_PERSON = THRESHOLDS.sameChild;

export function emptyLifeStory(userId: string): LifeStory {
  return { userId, self: {}, people: {}, children: [], fields: {}, facts: [], confirmations: {}, events: [], updatedAt: now() };
}

/** A copy of a stored Field marked as hydrated; the quote and the rest of its provenance travel with it. */
export function hydratedCopy<T extends Json>(stored: Field<T>): Field<T> {
  return { value: stored.value, provenance: { ...stored.provenance, source: 'hydrated' } };
}

/** Copy `stored[key]` into `target` for every listed key the target lacks, marked hydrated. */
export function gapFill<T extends object>(target: T, stored: Partial<T> | undefined, keys: readonly (keyof T)[]): T {
  const out = { ...target };
  if (!stored) return out;
  for (const key of keys) {
    const current = out[key] as Field | undefined;
    const from = stored[key] as Field | undefined;
    if (current === undefined && from !== undefined) out[key] = hydratedCopy(from) as T[keyof T];
  }
  return out;
}

/**
 * The absorb rule for one Field: an absent incoming value never erases a
 * stored one; a present one replaces it — unless the incoming value is
 * itself a hydrated copy of the store, which carries nothing new.
 */
export function absorbField<F extends Field>(stored: F | undefined, incoming: F | undefined): F | undefined {
  if (incoming === undefined) return stored;
  if (stored !== undefined && incoming.provenance.source === 'hydrated') return stored;
  return incoming;
}

/** Overlay `incoming` on `stored` for every listed key under the absorb rule. */
export function overlay<T extends object>(stored: T, incoming: Partial<T>, keys: readonly (keyof T)[]): T {
  const out = { ...stored };
  for (const key of keys) {
    const merged = absorbField(stored[key] as Field | undefined, incoming[key] as Field | undefined);
    if (merged !== undefined) out[key] = merged as T[keyof T];
  }
  return out;
}

/** True when the object has at least one listed Field present. */
export function hasAny<T extends object>(o: T, keys: readonly (keyof T)[]): boolean {
  return keys.some((key) => o[key] !== undefined);
}

/** An object without its undefined members, typed as Json for a model request. */
export function compact(o: Record<string, unknown>): JsonObject {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(o)) if (value !== undefined) out[key] = value;
  return out as JsonObject;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Syntactic: snake_case identifier → camelCase identifier. A transform on an
 * API key the model emitted, not a reading of text.
 */
export function camelCase(key: string): string {
  const [head, ...rest] = key.split('_').filter((part) => part.length > 0);
  return (head ?? '') + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Does a model-supplied value fit a JSON-schema fragment? A structural check
 * of type, enum and numeric bounds — the code's guard against a sentinel or
 * a wrongly typed answer landing on the record. Anything that does not fit
 * is treated as absent.
 */
export function conforms(value: unknown, schema: Json): value is Json {
  if (value === undefined || value === null) return false;
  if (!isObject(schema)) return true;
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => option === value)) return false;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  return types.some((type) => fitsType(value, type, schema));
}

function fitsType(value: unknown, type: unknown, schema: Record<string, unknown>): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0;
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (type === 'number' || Number.isInteger(value)) &&
        (typeof schema.minimum !== 'number' || value >= schema.minimum) &&
        (typeof schema.maximum !== 'number' || value <= schema.maximum)
      );
    case 'array':
      return Array.isArray(value) && (schema.items === undefined || value.every((item) => conforms(item, schema.items as Json)));
    case 'object':
      return isObject(value);
    case 'null':
      return false;
    default:
      return true;
  }
}
