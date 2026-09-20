/**
 * FakeIntelligence — a deterministic stand-in for demos and end-to-end runs
 * without a model (CORE_INTELLIGENCE=fake). It answers every call with a
 * plausible, schema-shaped value derived from the request and a fixed
 * persona table, so the whole UI can be driven: triage → interview → draft
 * → PDF.
 *
 * It has no semantics. Judgments are constant per question key (a
 * "danger" question is always no, "supported" is always yes); an interview
 * turn fills whatever fields the engine reports as missing from PERSONA.
 * That is exactly why it must never run in production: the factory only
 * builds it when CORE_INTELLIGENCE is literally "fake".
 */

import type { AskRequest, Answers, ChoiceAnswer, GradeAnswer, Intelligence, Json, JsonObject, JudgeRequest, Question, Questions, YesNoAnswer } from './types';
import { ASK } from './purposes';

/** Values the fake interview "hears" from the user, keyed by field key. */
const PERSONA: Record<string, Json> = {
  petitioner_first_name: 'Jordan',
  petitioner_last_name: 'Example',
  current_first_name: 'Jordan',
  current_last_name: 'Example',
  respondent_first_name: 'Alex',
  respondent_last_name: 'Example',
  county: 'Salt Lake',
  state: 'UT',
  who_filed: 'me',
  served_on_user: 'no',
  marriage_date: '2010-05-01',
  marriage_place: 'Salt Lake City, Utah',
  separation_date: '2024-11-15',
  residency_state_months: 72,
  residency_months: 72,
  grounds: 'irreconcilable_differences',
  has_minor_children: true,
  number_of_children: 2,
  has_property: true,
  has_debts: false,
  property_items: ['The family home at 12 Example Street', 'A 2019 Honda Civic'],
  debt_items: [],
  spousal_support_requested: false,
  service_method: 'waiver',
  indigency_requested: false,
  other_party_military: false,
  user_confirmed_review: true,
  new_first_name: 'Jordan',
  new_last_name: 'Sample',
  change_reason: 'Returning to my family name',
  is_for_minor: false,
  prior_names: 'None',
  criminal_history_confirmed: true,
  pending_proceedings: false,
  publication_waiver_requested: false,
  indigency_requested_name_change: false,
};

/** Constant judgment per question key; anything unlisted is a confident yes. */
const YESNO: Record<string, number> = {
  danger: 0.02,
  duplicate: 0.02,
  supersedes: 0.02,
  same_child: 0.02,
  same_person: 0.02,
  affirmed: 0.96,
  in_language: 0.99,
  supported: 0.97,
};

const CHOICE: Record<string, string> = {
  matter: 'divorce',
  scope: 'in_scope',
  language: 'en',
  kind: 'petition',
};

export class FakeIntelligence implements Intelligence {
  async ask<T extends Json>(req: AskRequest): Promise<T> {
    const input = (req.input ?? {}) as JsonObject;
    switch (req.purpose) {
      case ASK.TRIAGE_REPLY:
        return { say: 'It sounds like you need help with a divorce. I can guide you through it. Shall we start with your full legal name?', clarifying_question: null } as unknown as T;
      case ASK.INTERVIEW_TURN:
        return this.turn(req, input) as unknown as T;
      case ASK.INTERVIEW_REFORMULATE:
        return { say: 'Understood. What is the next detail I should record?', questions_asked: ['What is the next detail I should record?'] } as unknown as T;
      case ASK.PROFILE_PROMOTE:
        return { fields: {} } as unknown as T;
      case ASK.PROFILE_NAME_CASE:
        return input as unknown as T;
      case ASK.PROFILE_INGEST:
        return { kind: 'petition', events: [{ date: '2025-01-15', title: 'Petition filed', detail: 'Read from the pasted court paper.' }], facts: [], fields: {} } as unknown as T;
      case ASK.COMPOSE_NARRATIVE:
        return this.narrative(input) as unknown as T;
      default:
        return this.fromSchema(req.schema) as T;
    }
  }

  async judge<Q extends Questions>(req: JudgeRequest<Q>): Promise<Answers<Q>> {
    const answers: Record<string, unknown> = {};
    for (const [key, q] of Object.entries(req.questions)) answers[key] = answer(key, q);
    return answers as Answers<Q>;
  }

  private turn(req: AskRequest, input: JsonObject): JsonObject {
    const schema = req.schema as { properties?: { fields?: { properties?: Record<string, unknown> } } };
    const known = Object.keys(schema.properties?.fields?.properties ?? {});
    const fields: JsonObject = {};
    for (const key of known) if (key in PERSONA) fields[key] = PERSONA[key];
    const message = typeof input.message === 'string' ? input.message : '';
    // The engine passes phase as { id, name }; accept a bare string too.
    const rawPhase = input.phase;
    const phase =
      typeof rawPhase === 'string'
        ? rawPhase
        : rawPhase && typeof rawPhase === 'object' && typeof (rawPhase as JsonObject).id === 'string'
          ? ((rawPhase as JsonObject).id as string)
          : 'INTAKE';
    const children =
      phase === 'CHILDREN'
        ? [
            { name: 'Emma Example', date_of_birth: '2015-04-02', resides_with: 'shared' },
            { name: 'Liam Example', date_of_birth: '2017-06-15', resides_with: 'shared' },
          ]
        : [];
    const affirmations = phase === 'REVIEW' ? ['review_confirmed'] : phase === 'PROPERTY' ? ['no_debts'] : [];
    const question = `Thanks. What else should I know about the ${phase.toLowerCase().split('_').join(' ')} stage?`;
    return {
      say: question,
      questions_asked: [question],
      phase_complete: true,
      fields,
      facts: message ? [{ statement: `I told the assistant: ${message}`, category: 'general', quote: message }] : [],
      corrections: [],
      affirmations,
      children,
    };
  }

  private narrative(input: JsonObject): JsonObject {
    const record = (input.record ?? {}) as JsonObject;
    const fields = (record.fields ?? {}) as JsonObject;
    const ids = Object.keys(fields);
    const section = typeof input.section === 'string' ? input.section : 'section';
    if (ids.length === 0) return { paragraphs: [] };
    return {
      paragraphs: [
        {
          text: `The facts stated above concerning ${section.split('_').join(' ')} are true to the best of my knowledge.`,
          supported_by: ids.slice(0, 2),
        },
      ],
    };
  }

  /** Minimal object satisfying a JSON schema's required keys. */
  private fromSchema(schema: unknown): Json {
    const s = (schema ?? {}) as { type?: string; properties?: Record<string, unknown>; required?: string[]; items?: unknown; enum?: string[] };
    if (s.enum && s.enum.length) return s.enum[0];
    switch (s.type) {
      case 'string':
        return 'n/a';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object': {
        const out: JsonObject = {};
        for (const key of s.required ?? []) out[key] = this.fromSchema(s.properties?.[key]);
        return out;
      }
      default:
        return null;
    }
  }
}

function answer(key: string, q: Question): YesNoAnswer | ChoiceAnswer | GradeAnswer {
  if (q.type === 'yesno') return { probability: YESNO[key] ?? 0.95 };
  if (q.type === 'choice') {
    const labels = Object.keys(q.options);
    const preferred = CHOICE[key];
    const choice = preferred && labels.includes(preferred) ? preferred : labels[0];
    const probabilities = Object.fromEntries(labels.map((l) => [l, l === choice ? 0.94 : 0.06 / Math.max(labels.length - 1, 1)]));
    return { choice, confidence: 0.94, probabilities };
  }
  const mid = Math.floor(q.levels.length / 2);
  const probabilities = Object.fromEntries(q.levels.map((_, i) => [String(i), i === mid ? 0.9 : 0.1 / Math.max(q.levels.length - 1, 1)]));
  return { score: mid, confidence: 0.9, probabilities };
}
