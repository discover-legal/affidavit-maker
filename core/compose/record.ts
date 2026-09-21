/**
 * The record as composition sees it: which ids a paragraph may cite, how a
 * value is read with its provenance, and the block builders every section
 * shares.
 *
 * Id scheme (shared with the tests, __tests__/core/compose/_helpers.ts):
 *   CaseFile.fields[key]  → key
 *   CaseFile.county       → 'county'
 *   CaseFile.caseNumber   → 'caseNumber'
 *   party sub-fields      → 'parties.<self|other>.<field>'
 *   children              → child.id
 *   facts                 → fact.id
 *   confirmations         → the ConfirmationKey itself
 */

import type { Json } from '../intelligence/types';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile, Child, ConfirmationKey, Field, Language, Party } from '../model/types';
import { activeFacts } from '../model/types';
import type { Block, Section } from './types';
import { isRenderableDate } from './dates';

// ─── Ids ────────────────────────────────────────────────────────────────────

export const COUNTY_ID = 'county';
export const CASE_NUMBER_ID = 'caseNumber';

export function partyId(side: 'self' | 'other', field: keyof Party): string {
  return `parties.${side}.${String(field)}`;
}

/**
 * Structured fields whose value must have a date shape to be citable. A
 * date-shaped field with any other value is treated as absent (I-5): it
 * renders a blank and no paragraph — not even a model paragraph — may cite it.
 */
export const DATE_FIELDS = new Set(['marriageDate', 'separationDate']);

/** Every id a paragraph may cite for this file. Anything else the model cites is dropped. */
export function citableIds(file: CaseFile): Set<string> {
  const ids = new Set<string>();
  for (const [key, field] of Object.entries(file.fields)) {
    if (DATE_FIELDS.has(key) && !isRenderableDate(field.value)) continue;
    ids.add(key);
  }
  if (file.county) ids.add(COUNTY_ID);
  if (file.caseNumber) ids.add(CASE_NUMBER_ID);
  for (const side of ['self', 'other'] as const) {
    const party = file.parties[side];
    for (const key of Object.keys(party) as Array<keyof Party>) {
      if (key === 'fullName') continue;
      if (party[key] !== undefined) ids.add(partyId(side, key));
    }
  }
  for (const child of file.children) ids.add(child.id);
  for (const fact of activeFacts(file)) ids.add(fact.id);
  for (const key of Object.keys(file.confirmations)) ids.add(key);
  return ids;
}

// ─── Reading values ─────────────────────────────────────────────────────────

export function field<T extends Json = Json>(file: CaseFile, key: string): Field<T> | undefined {
  const f = file.fields[key];
  return f as Field<T> | undefined;
}

export function stringField(file: CaseFile, key: string): string | undefined {
  const f = field(file, key);
  return f && typeof f.value === 'string' && f.value.length > 0 ? f.value : undefined;
}

export function numberField(file: CaseFile, key: string): number | undefined {
  const f = field(file, key);
  return f && typeof f.value === 'number' && Number.isFinite(f.value) ? f.value : undefined;
}

export function booleanField(file: CaseFile, key: string): boolean | undefined {
  const f = field(file, key);
  return f && typeof f.value === 'boolean' ? f.value : undefined;
}

/** A stated list with at least one entry. An empty list is not a statement about anything (unknown is absent). */
export function listField(file: CaseFile, key: string): string[] | undefined {
  const f = field(file, key);
  if (!f || !Array.isArray(f.value)) return undefined;
  const items = f.value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return items.length > 0 ? items : undefined;
}

/** A date-shaped field, or undefined when absent or not date-shaped (I-5). */
export function dateField(file: CaseFile, key: string): string | undefined {
  const value = stringField(file, key);
  return value !== undefined && isRenderableDate(value) ? value : undefined;
}

export function confirmed(file: CaseFile, key: ConfirmationKey): boolean {
  return file.confirmations[key] !== undefined;
}

/** A party's display name and the ids that support it. */
export function partyName(file: CaseFile, side: 'self' | 'other'): { name?: string; ids: string[] } {
  const party = file.parties[side];
  const ids: string[] = [];
  for (const key of ['firstName', 'middleName', 'lastName'] as const) if (party[key]) ids.push(partyId(side, key));
  const parts = [party.firstName?.value, party.middleName?.value, party.lastName?.value].filter((p): p is string => typeof p === 'string' && p.length > 0);
  const name = party.fullName ?? (parts.length > 0 ? parts.join(' ') : undefined);
  return { name, ids };
}

export function childName(child: Child): string | undefined {
  return child.name?.value;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export interface Labels {
  /** The filer's legal-role label (Applicant / Petitioner / Plaintiff, or Respondent / Defendant). */
  self: string;
  other: string;
  selfRepresented: string;
}

/** The record's "self" keeps their LEGAL role: a respondent's own documents label them by the lexicon's respondent word. */
export function labelsFor(file: CaseFile, jurisdiction: JurisdictionProfile): Labels {
  const { lexicon } = jurisdiction;
  const selfIsPetitioner = file.role === 'petitioner';
  return {
    self: selfIsPetitioner ? lexicon.petitioner : lexicon.respondent,
    other: selfIsPetitioner ? lexicon.respondent : lexicon.petitioner,
    selfRepresented: lexicon.selfRepresented,
  };
}

// ─── Block builders ─────────────────────────────────────────────────────────

export function heading(text: string, level: 1 | 2 | 3 = 2): Block {
  return { kind: 'heading', text, level };
}

export function paragraph(text: string, supportedBy: string[], numbered = true): Block {
  if (supportedBy.length === 0) throw new Error(`compose: paragraph without support: ${text}`);
  return { kind: 'paragraph', text, numbered, supportedBy: [...supportedBy] };
}

export function blank(fieldId: string, note: string, label?: string, sentence?: string): Block {
  const b: Extract<Block, { kind: 'blank' }> = { kind: 'blank', field: fieldId, note };
  if (label !== undefined) b.label = label;
  if (sentence !== undefined) b.sentence = sentence;
  return b;
}

export function note(text: string): Block {
  return { kind: 'note', text };
}

export function list(items: string[], ordered = false): Block {
  return { kind: 'list', items: [...items], ordered };
}

export function section(id: string, title: string | undefined, blocks: Block[]): Section {
  return title === undefined ? { id, blocks } : { id, title, blocks };
}

// ─── JSON views of the record ───────────────────────────────────────────────

/** Strip `undefined` so a model-bound value satisfies `Json`. */
export function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

/**
 * The record a narrative is drafted from and a paragraph is judged against:
 * structured fields, ACTIVE facts, confirmations, the parties and children.
 * Retired facts never reach the model.
 */
export function recordJson(file: CaseFile): Json {
  return toJson({
    fields: file.fields,
    facts: activeFacts(file),
    confirmations: file.confirmations,
    parties: file.parties,
    children: file.children,
    county: file.county,
    caseNumber: file.caseNumber,
  });
}

export function languageOf(file: CaseFile): Language {
  return file.language === 'es' ? 'es' : 'en';
}
