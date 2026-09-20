/**
 * The turn schema the engine hands the model, runtime mirrors of the model's
 * closed unions, and the few syntactic helpers a turn needs (schema
 * conformance of a proposed value, ISO date parsing for date arithmetic).
 *
 * Nothing in here decides meaning. Every check is about shape.
 */

import type { Json, JsonObject, JsonSchema } from '../intelligence/types';
import type { ConfirmationKey, FactCategory } from '../model/types';
import type { MatterDefinition, TurnProposal } from './types';

// ─── Runtime mirrors of core/model unions ───────────────────────────────────
// The Record types make the compiler reject a mirror that drifts from the union.

const FACT_CATEGORY_SET: Record<FactCategory, true> = {
  identity: true,
  relationship: true,
  children: true,
  residence: true,
  finances: true,
  property: true,
  debts: true,
  support: true,
  safety: true,
  events: true,
  evidence: true,
  procedure: true,
  general: true,
};
export const FACT_CATEGORIES = Object.keys(FACT_CATEGORY_SET) as FactCategory[];
export const isFactCategory = (v: unknown): v is FactCategory => typeof v === 'string' && v in FACT_CATEGORY_SET;

const CONFIRMATION_KEY_SET: Record<ConfirmationKey, true> = {
  no_children: true,
  no_property: true,
  no_debts: true,
  support_waived: true,
  no_safety_concerns: true,
  not_military: true,
  evidence_reviewed: true,
  review_confirmed: true,
};
export const CONFIRMATION_KEYS = Object.keys(CONFIRMATION_KEY_SET) as ConfirmationKey[];
export const isConfirmationKey = (v: unknown): v is ConfirmationKey => typeof v === 'string' && v in CONFIRMATION_KEY_SET;

const RESIDES_WITH = ['self', 'other', 'shared', 'third_party'] as const;

/** Every key of TurnProposal; all are required so the model never leaves a collection implicit. */
const TURN_PROPOSAL_KEYS: Record<keyof TurnProposal, true> = {
  say: true,
  questions_asked: true,
  phase_complete: true,
  fields: true,
  facts: true,
  corrections: true,
  affirmations: true,
  children: true,
};

// ─── Turn schema ────────────────────────────────────────────────────────────

/** Schema for a child as the model proposes it (also reused by matters whose `children` field binds to the file). */
export const CHILD_SCHEMA: JsonObject = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    date_of_birth: { type: 'string', description: 'ISO date YYYY-MM-DD, or partial YYYY-MM / YYYY' },
    age: { type: 'number' },
    resides_with: { type: 'string', enum: [...RESIDES_WITH] },
  },
  additionalProperties: false,
};

export function buildTurnSchema(definition: MatterDefinition): JsonSchema {
  const fieldProperties: JsonObject = {};
  for (const field of definition.fields) fieldProperties[field.key] = field.schema;

  return {
    type: 'object',
    required: Object.keys(TURN_PROPOSAL_KEYS),
    additionalProperties: false,
    properties: {
      say: { type: 'string', description: 'The reply to the person, in the requested language, asking exactly one question.' },
      questions_asked: { type: 'array', items: { type: 'string' }, description: 'Every question `say` asks, verbatim. Must contain exactly one.' },
      phase_complete: { type: 'boolean', description: 'True only when every field listed in input.missing has now been stated.' },
      fields: {
        type: 'object',
        description: 'Values the person stated this turn, keyed exactly as listed. Omit anything not stated; enum fields carry the code only.',
        properties: fieldProperties,
        additionalProperties: false,
      },
      facts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['statement', 'category', 'quote'],
          properties: {
            statement: { type: 'string', description: 'First-person, court-usable, cleaned of typos, in the person’s meaning.' },
            category: { type: 'string', enum: FACT_CATEGORIES },
            subcategory: { type: 'string' },
            quote: { type: 'string', description: 'The person’s own words this statement comes from.' },
            values: {
              type: 'object',
              properties: {
                number: { type: 'number' },
                amount: {
                  type: 'object',
                  required: ['value', 'currency'],
                  properties: {
                    value: { type: 'number' },
                    currency: { type: 'string' },
                    period: { type: 'string', enum: ['week', 'month', 'year', 'once'] },
                  },
                },
                place: { type: 'string' },
                date: { type: 'string', description: 'ISO date or partial YYYY / YYYY-MM' },
                ground: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      corrections: {
        type: 'array',
        description: 'Only when the person explicitly corrects something said earlier.',
        items: {
          type: 'object',
          required: ['earlier_statement', 'because'],
          properties: {
            earlier_statement: { type: 'string', description: 'The earlier fact statement being corrected, as recorded.' },
            because: { type: 'string', description: 'What the person said that corrects it.' },
          },
          additionalProperties: false,
        },
      },
      affirmations: {
        type: 'array',
        description: 'Conditions the person explicitly and unambiguously stated this turn. Never inferred from silence.',
        items: { type: 'string', enum: CONFIRMATION_KEYS },
      },
      children: {
        type: 'array',
        description: 'Only the child or children the person spoke about this turn.',
        items: CHILD_SCHEMA,
      },
    },
  };
}

// ─── Shape checks ───────────────────────────────────────────────────────────

/**
 * Does a proposed value fit a field's schema fragment? Type and enum only.
 * Empty strings and nulls are the model saying "nothing"; unknown is absent,
 * so they never become a value.
 */
export function conforms(value: Json | undefined, schema: Json): value is Json {
  if (value === undefined || value === null) return false;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return true;
  const allowed = schema.enum;
  if (Array.isArray(allowed) && !allowed.includes(value)) return false;
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0;
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Parse an ISO calendar date (YYYY, YYYY-MM or YYYY-MM-DD) for date
 * arithmetic. Syntactic by construction: the string must round-trip through
 * Date, so "a few months ago" or "March 2024" yield null and never reach the
 * arithmetic. Nothing about the date's meaning is decided here.
 */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const isoLengths = [4, 7, 10];
  if (!isoLengths.includes(value.length)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, value.length) === value ? parsed : null;
}

/** Whole calendar months elapsed from `from` to `to` (UTC). */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}
