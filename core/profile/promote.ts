/**
 * promote(file, definition) — fill ABSENT structured fields from the file's
 * active facts with ONE ask(ASK.PROFILE_PROMOTE) against the definition's
 * field schema (spec 02 §2.4, §2.5). Replaces v1's rescue loops and the
 * whereabouts / children-count / grounds regexes.
 *
 *   - no active facts, or nothing absent → no ask, file returned as is
 *   - the schema names only the definition keys whose slot is still absent
 *   - an answer that does not fit its schema (enum miss, wrong type) is
 *     dropped: absence, never a sentinel
 *   - answers land with provenance 'derived' + derivedFrom = the active fact ids
 *   - present values are never overwritten; a throwing ask is fail-open
 *   - the 'children' bind is not promoted: children merge by identity
 *     judgment in the interview, not by a bulk extraction
 */

import type { Intelligence, Json, JsonObject } from '../intelligence/types';
import { ASK } from '../intelligence/purposes';
import type { FieldSpec, MatterDefinition } from '../interview/types';
import { activeFacts, now } from '../model/types';
import type { CaseFile, Fact, Field, Provenance } from '../model/types';
import { compact, conforms, isObject } from './common';

const INSTRUCTIONS =
  'You are filling a legal intake form from the facts a person stated in their own interview. ' +
  'Read the active facts and set only the fields the facts clearly establish, using the exact value shapes the schema allows. ' +
  'Omit any field the facts do not state. Never guess, never fill a placeholder, never use a value outside an enum. ' +
  'The fields already known are given for context and must not be repeated.';

export async function promote(intel: Intelligence, file: CaseFile, definition: MatterDefinition): Promise<CaseFile> {
  const facts = activeFacts(file);
  if (facts.length === 0) return file;

  const absent = definition.fields.filter((spec) => spec.binds !== 'children' && readSlot(file, spec) === undefined);
  if (absent.length === 0) return file;

  let answer: unknown;
  try {
    answer = await intel.ask({
      purpose: ASK.PROFILE_PROMOTE,
      instructions: INSTRUCTIONS,
      input: { facts: facts.map(factForModel), fields: knownValues(file, definition) },
      schema: {
        type: 'object',
        required: ['fields'],
        additionalProperties: false,
        properties: {
          fields: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(absent.map((spec) => [spec.key, spec.schema])),
          },
        },
      },
    });
  } catch {
    return file;
  }
  if (!isObject(answer) || !isObject(answer.fields)) return file;

  const provenance: Provenance = { source: 'derived', derivedFrom: facts.map((f) => f.id), at: now() };
  const out: CaseFile = { ...file, parties: { self: { ...file.parties.self }, other: { ...file.parties.other } }, fields: { ...file.fields } };
  for (const spec of absent) {
    const value = answer.fields[spec.key];
    if (conforms(value, spec.schema)) writeSlot(out, spec, { value, provenance });
  }
  return out;
}

function factForModel(fact: Fact): JsonObject {
  return compact({ id: fact.id, statement: fact.statement, category: fact.category, subcategory: fact.subcategory, values: fact.values && compact(fact.values) });
}

/** Values already on the file, keyed by the definition's own keys, for the model's context. */
function knownValues(file: CaseFile, definition: MatterDefinition): JsonObject {
  const known: Record<string, unknown> = {};
  for (const spec of definition.fields) {
    if (spec.binds === 'children') continue;
    const slot = readSlot(file, spec);
    if (slot !== undefined) known[spec.key] = typeof slot === 'string' ? slot : slot.value;
  }
  return compact(known);
}

function readSlot(file: CaseFile, spec: FieldSpec): Field | string | undefined {
  switch (spec.binds) {
    case 'self.firstName':
      return file.parties.self.firstName;
    case 'self.lastName':
      return file.parties.self.lastName;
    case 'other.firstName':
      return file.parties.other.firstName;
    case 'other.lastName':
      return file.parties.other.lastName;
    case 'other.whereaboutsUnknown':
      return file.parties.other.whereaboutsUnknown;
    case 'other.suspectedLocation':
      return file.parties.other.suspectedLocation;
    case 'county':
      return file.county;
    case 'caseNumber':
      return file.caseNumber;
    case 'jurisdiction':
      return file.jurisdiction;
    case 'children':
      return undefined;
    default:
      return file.fields[spec.target];
  }
}

function writeSlot(file: CaseFile, spec: FieldSpec, field: Field<Json>): void {
  switch (spec.binds) {
    case 'self.firstName':
      file.parties.self.firstName = field as Field<string>;
      return;
    case 'self.lastName':
      file.parties.self.lastName = field as Field<string>;
      return;
    case 'other.firstName':
      file.parties.other.firstName = field as Field<string>;
      return;
    case 'other.lastName':
      file.parties.other.lastName = field as Field<string>;
      return;
    case 'other.whereaboutsUnknown':
      file.parties.other.whereaboutsUnknown = field as Field<boolean>;
      return;
    case 'other.suspectedLocation':
      file.parties.other.suspectedLocation = field as Field<string>;
      return;
    case 'county':
      file.county = field as Field<string>;
      return;
    case 'caseNumber':
      file.caseNumber = field as Field<string>;
      return;
    case 'jurisdiction':
      file.jurisdiction = String(field.value);
      return;
    case 'children':
      return;
    default:
      file.fields[spec.target] = field;
  }
}
