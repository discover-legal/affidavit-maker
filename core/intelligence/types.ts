/**
 * The Intelligence boundary.
 *
 * Everything the core needs from a model goes through two operations:
 *
 *   ask()   — produce a structured object that conforms to a JSON schema
 *             (extraction, the interview's reply, narrative paragraphs).
 *   judge() — answer small typed questions about a piece of state with
 *             probabilities (is this a correction? same child? supported by
 *             the facts? which language?). This is the Jev / "System One"
 *             shape; an OpenAI fallback answers the same questions.
 *
 * Code owns the workflow, the invariants and the state. The model supplies
 * semantic understanding where code would otherwise resort to regexes and
 * keyword tables. No module in core/ may import a model SDK directly.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type JsonSchema = { [key: string]: unknown };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRequest {
  /** Stable identifier of the call site, e.g. "interview.turn". Scripts key on it. */
  purpose: string;
  /** What to do, written for the model. */
  instructions: string;
  /** The material to work from. Always structured; never string-interpolate user text into instructions. */
  input: Json;
  /** JSON schema the answer must satisfy. */
  schema: JsonSchema;
  /** Prior conversation, when the answer is a conversational reply. */
  history?: Message[];
  /** Language the free-text parts of the answer must be written in. */
  language?: string;
}

// ─── Judgments ──────────────────────────────────────────────────────────────

/** Probability that a condition holds. */
export interface YesNoQuestion {
  type: 'yesno';
  question: string;
  /** Optional descriptions of what a yes / no answer means. */
  yes?: string;
  no?: string;
}

/** One of a defined set of labels. `null` leaves a label undescribed. */
export interface ChoiceQuestion<L extends string = string> {
  type: 'choice';
  question: string;
  options: Record<L, string | null>;
}

/** Position on an ordered rubric; levels are described from lowest to highest. */
export interface GradeQuestion {
  type: 'grade';
  question: string;
  levels: string[];
}

export type Question = YesNoQuestion | ChoiceQuestion<string> | GradeQuestion;
export type Questions = Record<string, Question>;

export interface YesNoAnswer {
  probability: number;
}
export interface ChoiceAnswer<L extends string = string> {
  choice: L;
  confidence: number;
  probabilities: Record<L, number>;
}
export interface GradeAnswer {
  /** Expected level; may fall between integer levels. */
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
}

export type AnswerFor<Q extends Question> = Q extends YesNoQuestion
  ? YesNoAnswer
  : Q extends ChoiceQuestion<infer L>
    ? ChoiceAnswer<L>
    : GradeAnswer;

export type Answers<Q extends Questions> = { [K in keyof Q]: AnswerFor<Q[K]> };

export interface JudgeRequest<Q extends Questions> {
  /** Stable identifier of the call site, e.g. "facts.correction". */
  purpose: string;
  /** The state every question is asked about. Prefer named fields over prose. */
  state: Json;
  questions: Q;
}

export interface Intelligence {
  ask<T extends Json>(req: AskRequest): Promise<T>;
  judge<Q extends Questions>(req: JudgeRequest<Q>): Promise<Answers<Q>>;
}

/** Thresholds the core applies to judgments. Tune from measured data, not vibes. */
export const THRESHOLDS = {
  /** A yes/no must clear this to count as an affirmative statement by the user. */
  affirmation: 0.85,
  /** A correction supersedes an earlier fact above this. */
  supersedes: 0.75,
  /** Two child records refer to the same child above this. */
  sameChild: 0.8,
  /** A drafted paragraph is supported by the record above this; otherwise it becomes a blank. */
  supported: 0.8,
  /** Triage locks a matter type above this; otherwise it asks a clarifying question. */
  triage: 0.85,
} as const;

// ─── Question builders ──────────────────────────────────────────────────────

export const yesno = (question: string, yes?: string, no?: string): YesNoQuestion => ({ type: 'yesno', question, yes, no });
export const choice = <const L extends string>(question: string, options: Record<L, string | null>): ChoiceQuestion<L> => ({ type: 'choice', question, options });
export const grade = (question: string, levels: string[]): GradeQuestion => ({ type: 'grade', question, levels });
