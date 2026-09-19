/**
 * The vocabulary of model calls the core makes. Tests script these names;
 * implementations must use exactly these names. Adding a call site means
 * adding it here first.
 *
 * ask(): purpose → shape of the answer.
 * judge(): purpose → question keys and the state each is asked about.
 *
 * Judgments are asked ONE PAIR AT A TIME where a comparison is involved
 * (correction × candidate fact, incoming child × existing child), so a
 * scripted handler can decide from `state` alone.
 */

export const ASK = {
  /** { say: string; clarifying_question: string | null } — the triage reply once the decision is made in code. */
  TRIAGE_REPLY: 'triage.reply',
  /** TurnProposal (core/interview/types.ts). */
  INTERVIEW_TURN: 'interview.turn',
  /** { say: string; questions_asked: string[] } — rewrite a reply that asked ≠ 1 question or was in the wrong language. */
  INTERVIEW_REFORMULATE: 'interview.reformulate',
  /** { fields: Record<string, Json> } — fill the matter's structured fields from active facts; omit anything not stated. */
  PROFILE_PROMOTE: 'profile.promote',
  /** IngestResult-shaped: { kind, events[], facts[], fields } from a court paper's text. */
  PROFILE_INGEST: 'profile.ingest',
  /** { first_name?, last_name?, middle_name? } — legal casing of a name as the user typed it (casing only). */
  PROFILE_NAME_CASE: 'profile.nameCase',
  /** { paragraphs: Array<{ text: string; supported_by: string[] }> } — narrative for one section from the record. */
  COMPOSE_NARRATIVE: 'compose.narrative',
} as const;

export const JUDGE = {
  /**
   * state: { message, history_summary?, country, matters: [{code, description, keywords}] }
   * questions:
   *   matter   — choice over every matter code + 'unclear' + 'out_of_scope'
   *   danger   — yesno: the person describes violence, threats or immediate danger
   *   scope    — choice: 'in_scope' | 'criminal' | 'immigration' | 'bankruptcy' | 'criminal_protective_order' | 'other'
   *   language — choice: 'en' | 'es'
   */
  TRIAGE_CLASSIFY: 'triage.classify',
  /** state: { message }  questions: language — choice 'en' | 'es' */
  INTERVIEW_LANGUAGE: 'interview.language',
  /** state: { say, language }  questions: in_language — yesno */
  INTERVIEW_REPLY_LANGUAGE: 'interview.replyLanguage',
  /**
   * state: { message, confirmation }  questions: affirmed — yesno:
   * the user explicitly and unambiguously stated the condition (e.g. that there is no property to divide).
   */
  INTERVIEW_AFFIRMATION: 'interview.affirmation',
  /** state: { earlier_statement, new_statement, because }  questions: supersedes — yesno */
  FACTS_CORRECTION: 'facts.correction',
  /** state: { a: statement, b: statement }  questions: duplicate — yesno: both statements assert the same fact */
  FACTS_DUPLICATE: 'facts.duplicate',
  /** state: { incoming: {name?, date_of_birth?, age?}, existing: {...} }  questions: same_child — yesno */
  FACTS_CHILD_IDENTITY: 'facts.childIdentity',
  /** state: { a: Party-like, b: Party-like }  questions: same_person — yesno */
  PROFILE_SAME_PERSON: 'profile.samePerson',
  /**
   * state: { paragraph, record: { fields, facts, confirmations } }
   * questions: supported — yesno: every claim in the paragraph is supported by the record
   */
  COMPOSE_VERIFY: 'compose.verify',
  /** state: { text, kind_options }  questions: kind — choice petition | response | notice | order | unknown */
  PROFILE_INGEST_KIND: 'profile.ingestKind',
} as const;

export type AskPurpose = (typeof ASK)[keyof typeof ASK];
export type JudgePurpose = (typeof JUDGE)[keyof typeof JUDGE];
