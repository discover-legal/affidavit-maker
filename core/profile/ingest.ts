/**
 * ingest(story, { text, documentId, kind? }) — read a court paper's text
 * into dated events, third-person facts and caption fields, every one
 * marked as coming from that document (spec 02 §2.7).
 *
 *   - text under 40 (or over 20,000) characters is rejected before any model call
 *   - the paper's kind is judged first (JUDGE.PROFILE_INGEST_KIND) unless the
 *     caller already knows it, then ONE ask(ASK.PROFILE_INGEST) extracts
 *   - undated events are never added; ≤40 events, ≤25 facts
 *   - only the caption fields the schema names land, camelCased, as Fields;
 *     served_on_user is a field — flipping the role is the caller's decision
 *
 * The result is returned, not merged: the caller decides what joins the story.
 */

import { choice } from '../intelligence/types';
import type { Intelligence, JsonObject, JsonSchema } from '../intelligence/types';
import { ASK, JUDGE } from '../intelligence/purposes';
import { newId, now } from '../model/types';
import type { Fact, FactCategory, Field, Provenance } from '../model/types';
import { camelCase, compact, conforms, isObject } from './common';
import type { IngestInput, IngestResult, LifeStory, TimelineEvent } from './types';

const MIN_TEXT = 40;
const MAX_TEXT = 20_000;
const MAX_FACTS = 25;
const MAX_EVENTS = 40;

type Kind = IngestResult['kind'];
const KINDS: readonly Kind[] = ['petition', 'response', 'notice', 'order', 'unknown'];

/** Mirrors the FactCategory union as a schema enum. */
const FACT_CATEGORIES: readonly FactCategory[] = [
  'identity', 'relationship', 'children', 'residence', 'finances', 'property', 'debts', 'support', 'safety', 'events', 'evidence', 'procedure', 'general',
];

/** The caption fields a court paper can supply. Only these keys land. */
const CAPTION_FIELDS: Readonly<Record<string, JsonSchema>> = {
  case_number: { type: 'string', description: 'The case / court file number exactly as printed' },
  court: { type: 'string', description: 'The court named in the caption' },
  petitioner_name: { type: 'string', description: 'Full name of the petitioner / applicant / plaintiff' },
  respondent_name: { type: 'string', description: 'Full name of the respondent / defendant' },
  filed_date: { type: 'string', format: 'date', description: 'ISO date the paper was filed, if printed' },
  hearing_date: { type: 'string', format: 'date', description: 'ISO date of a hearing the paper sets, if printed' },
  service_date: { type: 'string', format: 'date', description: 'ISO date of service, if printed' },
  served_on_user: { type: 'string', enum: ['yes', 'no'], description: 'yes only when the paper unambiguously shows the user was the one served; omit when unclear' },
};

const INGEST_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['events', 'facts', 'fields'],
  additionalProperties: false,
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'title'],
        properties: { date: { type: 'string', format: 'date' }, title: { type: 'string' }, detail: { type: 'string' } },
      },
    },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['statement', 'category'],
        properties: { statement: { type: 'string' }, category: { type: 'string', enum: [...FACT_CATEGORIES] }, subcategory: { type: 'string' } },
      },
    },
    fields: { type: 'object', properties: CAPTION_FIELDS },
  },
};

const INSTRUCTIONS =
  'Read the text of a court paper. Return only what is explicitly printed: ' +
  'events that carry an explicit date (as ISO dates), third-person factual statements the paper makes, ' +
  'and the caption fields. Omit anything undated, unstated or unclear; never infer.';

export async function ingest(intel: Intelligence, story: LifeStory | null, input: IngestInput): Promise<IngestResult> {
  const { text, documentId } = input;
  if (typeof text !== 'string' || text.length < MIN_TEXT) throw new Error(`core/profile ingest: text must be at least ${MIN_TEXT} characters`);
  if (text.length > MAX_TEXT) throw new Error(`core/profile ingest: text must be at most ${MAX_TEXT} characters`);

  const kind = input.kind !== undefined && input.kind !== 'unknown' ? input.kind : await judgeKind(intel, text);
  const raw = await intel.ask<JsonObject>({
    purpose: ASK.PROFILE_INGEST,
    instructions: INSTRUCTIONS,
    input: compact({ text, kind, user: story ? userName(story) : undefined }),
    schema: INGEST_SCHEMA,
  });

  const provenance: Provenance = { source: 'ingested', documentId, at: now() };
  return {
    kind,
    events: toEvents(raw.events, provenance),
    facts: toFacts(raw.facts, provenance),
    fields: toFields(raw.fields, provenance),
  };
}

async function judgeKind(intel: Intelligence, text: string): Promise<Kind> {
  const answers = await intel.judge({
    purpose: JUDGE.PROFILE_INGEST_KIND,
    state: { text, kind_options: [...KINDS] },
    questions: {
      kind: choice('What kind of court paper is this text?', {
        petition: 'an initial petition, application or complaint that opens a case',
        response: 'an answer or response to a petition',
        notice: 'a notice, summons, or scheduling document',
        order: 'an order, decree or judgment signed by the court',
        unknown: null,
      }),
    },
  });
  return KINDS.includes(answers.kind.choice) ? answers.kind.choice : 'unknown';
}

function userName(story: LifeStory): JsonObject {
  return compact({ first_name: story.self.firstName?.value, middle_name: story.self.middleName?.value, last_name: story.self.lastName?.value });
}

function toEvents(raw: unknown, provenance: Provenance): TimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: TimelineEvent[] = [];
  for (const item of raw) {
    if (!isObject(item) || !isText(item.date) || !isText(item.title)) continue;
    const event: TimelineEvent = { id: newId('event'), date: item.date, title: item.title, provenance };
    if (isText(item.detail)) event.detail = item.detail;
    events.push(event);
  }
  return events.slice(0, MAX_EVENTS);
}

/** Syntactic: a non-empty string. An event is "dated" when the model supplied a date at all; ISO or partial shapes are both allowed. */
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCategory(value: unknown): value is FactCategory {
  return typeof value === 'string' && (FACT_CATEGORIES as readonly string[]).includes(value);
}

function toFacts(raw: unknown, provenance: Provenance): Fact[] {
  if (!Array.isArray(raw)) return [];
  const facts: Fact[] = [];
  for (const item of raw) {
    if (!isObject(item) || !isText(item.statement)) continue;
    const category: FactCategory = isCategory(item.category) ? item.category : 'general';
    const fact: Fact = { id: newId('fact'), statement: item.statement, category, provenance, status: 'active' };
    if (isText(item.subcategory)) fact.subcategory = item.subcategory;
    facts.push(fact);
  }
  return facts.slice(0, MAX_FACTS);
}

function toFields(raw: unknown, provenance: Provenance): Record<string, Field> {
  const fields: Record<string, Field> = {};
  if (!isObject(raw)) return fields;
  for (const [key, schema] of Object.entries(CAPTION_FIELDS)) {
    const value = raw[key];
    if (conforms(value, schema)) fields[camelCase(key)] = { value, provenance };
  }
  return fields;
}
