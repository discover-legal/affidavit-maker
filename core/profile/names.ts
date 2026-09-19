/**
 * normalizeName(party) — legal casing of a name exactly as the user typed
 * it (spec 02 §2.6 "Name casing"). Casing belongs to the model, never a
 * deterministic transform. ONE ask(ASK.PROFILE_NAME_CASE) with the as-typed
 * parts; the answer's casing is applied to `value` only, every provenance
 * kept. Any failure — a throw, a count mismatch, a change that is more than
 * casing — leaves the part as typed.
 */

import type { Intelligence } from '../intelligence/types';
import { ASK } from '../intelligence/purposes';
import type { Field, Party } from '../model/types';
import { isObject } from './common';

const NAME_PARTS = [
  ['firstName', 'first_name'],
  ['middleName', 'middle_name'],
  ['lastName', 'last_name'],
] as const;

const INSTRUCTIONS =
  'Return each given name part with its proper legal capitalization and nothing else changed: ' +
  'the same letters in the same order, only the letter case corrected (McDonald, van der Berg, O\'Brien-Hatch, Smith Son-Wyatt). ' +
  'Return exactly the parts you were given, under the same keys. Never expand, shorten, translate or correct a name.';

export async function normalizeName(intel: Intelligence, party: Party): Promise<Party> {
  const typed = NAME_PARTS.flatMap(([key, wire]) => {
    const field = party[key];
    return field ? [{ key, wire, field }] : [];
  });
  if (typed.length === 0) return party;

  let answer: unknown;
  try {
    answer = await intel.ask({
      purpose: ASK.PROFILE_NAME_CASE,
      instructions: INSTRUCTIONS,
      input: Object.fromEntries(typed.map(({ wire, field }) => [wire, field.value])),
      schema: {
        type: 'object',
        additionalProperties: false,
        required: typed.map(({ wire }) => wire),
        properties: Object.fromEntries(typed.map(({ wire }) => [wire, { type: 'string' }])),
      },
    });
  } catch {
    return party;
  }
  if (!isObject(answer)) return party;

  // Count-in / count-out: every part given comes back as a string, and nothing else does.
  const returned = Object.values(answer).filter((v) => typeof v === 'string').length;
  if (returned !== typed.length || typed.some(({ wire }) => typeof answer[wire] !== 'string')) return party;

  const out: Party = { ...party };
  for (const { key, wire, field } of typed) {
    const cased = answer[wire] as string;
    // Syntactic guard: only a change of letter case is accepted — the same characters, case-insensitively.
    if (cased.toLowerCase() === field.value.toLowerCase()) out[key] = { ...field, value: cased };
  }
  if (out.fullName !== undefined) out.fullName = fullName(out);
  return out;
}

function fullName(party: Party): string {
  return [party.firstName, party.middleName, party.lastName]
    .filter((part): part is Field<string> => part !== undefined)
    .map((part) => part.value)
    .join(' ');
}
