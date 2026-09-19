/**
 * Factories shared by the core/profile behaviour tests.
 *
 * Everything here is structural: no prose is inspected, no pattern is
 * matched. Timestamps are fixed so provenance comparisons are exact.
 */

import type { Json, JsonSchema } from '@/core/intelligence';
import type { ScriptedCall, ScriptedIntelligence } from '@/core/intelligence/scripted';
import type { MatterDefinition } from '@/core/interview/types';
import { emptyCaseFile } from '@/core/model';
import type { CaseFile, Child, Fact, FactCategory, Field, Provenance, Source } from '@/core/model';
import type { LifeStory, TimelineEvent } from '@/core/profile';

export const USER_ID = 'user_1';
export const FILE_ID = 'file_1';
export const AT = '2026-09-01T00:00:00.000Z';
export const STORED_AT = '2026-08-01T00:00:00.000Z';

/** A provenance record with the fixed timestamp. */
export function prov(source: Source = 'stated', quote?: string, extra: Partial<Provenance> = {}): Provenance {
  const p: Provenance = { source, at: AT, ...extra };
  if (quote !== undefined) p.quote = quote;
  return p;
}

/** A Field with value + provenance. */
export function field<T extends Json>(value: T, source: Source = 'stated', quote?: string): Field<T> {
  return { value, provenance: prov(source, quote) };
}

let factSeq = 0;
/** A stated, active fact. `extra` overrides any part (id, status, provenance, values …). */
export function fact(statement: string, category: FactCategory, extra: Partial<Fact> = {}): Fact {
  factSeq += 1;
  return {
    id: `fact_${factSeq}`,
    statement,
    category,
    provenance: prov('stated', statement),
    status: 'active',
    ...extra,
  };
}

/** A retired fact (superseded by `retiredBy`). */
export function retiredFact(statement: string, category: FactCategory, retiredBy: string, extra: Partial<Fact> = {}): Fact {
  return fact(statement, category, { status: 'retired', retiredBy, ...extra });
}

let childSeq = 0;
/** A child record; every provided part becomes a stated Field. */
export function child(
  init: { id?: string; name?: string; dateOfBirth?: string; age?: number; residesWith?: 'self' | 'other' | 'shared' | 'third_party' },
  source: Source = 'stated',
): Child {
  childSeq += 1;
  const c: Child = { id: init.id ?? `child_${childSeq}` };
  if (init.name !== undefined) c.name = field(init.name, source);
  if (init.dateOfBirth !== undefined) c.dateOfBirth = field(init.dateOfBirth, source);
  if (init.age !== undefined) c.age = field(init.age, source);
  if (init.residesWith !== undefined) c.residesWith = field(init.residesWith, source);
  return c;
}

let eventSeq = 0;
export function event(init: { title: string; date?: string; detail?: string; documentId?: string }): TimelineEvent {
  eventSeq += 1;
  const e: TimelineEvent = {
    id: `event_${eventSeq}`,
    title: init.title,
    provenance: prov('ingested', undefined, init.documentId ? { documentId: init.documentId } : {}),
  };
  if (init.date !== undefined) e.date = init.date;
  if (init.detail !== undefined) e.detail = init.detail;
  return e;
}

/** An empty life story for USER_ID, with overrides. */
export function story(overrides: Partial<LifeStory> = {}): LifeStory {
  return {
    userId: USER_ID,
    self: {},
    people: {},
    children: [],
    fields: {},
    facts: [],
    confirmations: {},
    events: [],
    updatedAt: STORED_AT,
    ...overrides,
  };
}

/** A fresh CaseFile for USER_ID via emptyCaseFile, with overrides. */
export function file(overrides: Partial<CaseFile> = {}): CaseFile {
  return emptyCaseFile({ id: FILE_ID, userId: USER_ID, ...overrides });
}

/** A family-matter file (divorce) so 'family' hydration scope is meaningful. */
export function familyFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return file({ matter: 'divorce', ...overrides });
}

/** Structural deep clone so tests can check that pure functions did not mutate their input. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Matter definition ──────────────────────────────────────────────────────

export const GROUNDS_ENUM = ['insupportability', 'cruelty'] as const;

/** A tiny inline divorce definition. Only `fields` matters to promote(). */
export const DEFINITION: MatterDefinition = {
  code: 'divorce',
  practiceArea: 'family',
  displayName: 'Divorce',
  familyProfile: true,
  fields: [
    { key: 'petitioner_first_name', target: 'petitionerFirstName', schema: { type: 'string' }, binds: 'self.firstName' },
    { key: 'respondent_first_name', target: 'respondentFirstName', schema: { type: 'string' }, binds: 'other.firstName' },
    { key: 'respondent_address_unknown', target: 'respondentAddressUnknown', schema: { type: 'boolean' }, binds: 'other.whereaboutsUnknown' },
    { key: 'respondent_suspected_location', target: 'respondentSuspectedLocation', schema: { type: 'string' }, binds: 'other.suspectedLocation' },
    { key: 'number_of_children', target: 'numberOfChildren', schema: { type: 'integer', minimum: 0 } },
    { key: 'grounds', target: 'grounds', schema: { type: 'string', enum: [...GROUNDS_ENUM] } },
    { key: 'monthly_income', target: 'monthlyIncome', schema: { type: 'number' } },
    { key: 'has_property', target: 'hasProperty', schema: { type: 'boolean' } },
  ],
  phases: [],
};

export const ALL_FIELD_KEYS = DEFINITION.fields.map((f) => f.key);

// ─── Call inspection ────────────────────────────────────────────────────────

export type AskCall = Extract<ScriptedCall, { kind: 'ask' }>;
export type JudgeCall = Extract<ScriptedCall, { kind: 'judge' }>;

export function askCalls(intel: ScriptedIntelligence, purpose: string): AskCall[] {
  return intel.calls.filter((c): c is AskCall => c.kind === 'ask' && c.purpose === purpose);
}

export function judgeCalls(intel: ScriptedIntelligence, purpose: string): JudgeCall[] {
  return intel.calls.filter((c): c is JudgeCall => c.kind === 'judge' && c.purpose === purpose);
}

/** The keys of an object-typed JSON schema's `properties`, sorted. */
export function schemaPropertyKeys(schema: JsonSchema | undefined): string[] {
  const props = (schema?.properties ?? {}) as Record<string, unknown>;
  return Object.keys(props).sort();
}

/** `schema.required` as a string array (empty when absent). */
export function schemaRequired(schema: JsonSchema | undefined): string[] {
  const req = schema?.required;
  return Array.isArray(req) ? (req as string[]) : [];
}

/** Sub-schema under `properties.<key>` of an object schema. */
export function subSchema(schema: JsonSchema | undefined, key: string): JsonSchema | undefined {
  const props = (schema?.properties ?? {}) as Record<string, JsonSchema | undefined>;
  return props[key];
}

/** Reads a nested Json value by path (for judge `state` / ask `input` assertions). */
export function at(value: Json | undefined, ...path: string[]): Json | undefined {
  let cur: Json | undefined = value;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as { [k: string]: Json })[key];
  }
  return cur;
}
