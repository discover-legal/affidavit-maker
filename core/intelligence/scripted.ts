/**
 * ScriptedIntelligence — the test double.
 *
 * Tests drive the core through the same Intelligence interface production
 * uses, with every model answer declared up front. There is no pattern
 * matching inside: an `ask` is answered by the handler registered for its
 * `purpose`; a `judge` question is answered by the handler registered for
 * its question key (optionally scoped by purpose). Anything unscripted
 * throws, so a test can never pass on an answer it did not declare.
 *
 *   const intel = new ScriptedIntelligence()
 *     .onAsk('interview.turn', ({ input }) => ({ say: '…', questions_asked: ['…'], … }))
 *     .onJudge('supersedes', () => yes())
 *     .onJudge('language', () => pick('en'));
 *
 * Handlers may be a queue (`[a, b, c]`): each call consumes the next entry.
 * `intel.calls` records every call for structural assertions.
 */

import type {
  AskRequest,
  Answers,
  ChoiceAnswer,
  GradeAnswer,
  Intelligence,
  Json,
  JudgeRequest,
  Question,
  Questions,
  YesNoAnswer,
} from './types';

type AskHandler = (req: AskRequest) => Json | Promise<Json>;
type JudgeHandler = (question: Question, state: Json, req: JudgeRequest<Questions>) => YesNoAnswer | ChoiceAnswer | GradeAnswer;

export type ScriptedCall =
  | { kind: 'ask'; purpose: string; request: AskRequest; answer: Json }
  | { kind: 'judge'; purpose: string; request: JudgeRequest<Questions>; answers: Record<string, unknown> };

export class UnscriptedCallError extends Error {}

export class ScriptedIntelligence implements Intelligence {
  private asks = new Map<string, AskHandler | AskHandler[]>();
  private judges = new Map<string, JudgeHandler | JudgeHandler[]>();
  readonly calls: ScriptedCall[] = [];

  /** Script an `ask` by purpose. A queue answers successive calls in order. */
  onAsk(purpose: string, handler: AskHandler | Json | Array<AskHandler | Json>): this {
    this.asks.set(purpose, toHandlers(handler));
    return this;
  }

  /**
   * Script a judgment. `key` is the question key (e.g. "supersedes") or
   * "purpose:key" to scope it to one call site.
   */
  onJudge(key: string, handler: JudgeHandler | YesNoAnswer | ChoiceAnswer | GradeAnswer | Array<JudgeHandler | YesNoAnswer | ChoiceAnswer | GradeAnswer>): this {
    this.judges.set(key, toJudgeHandlers(handler));
    return this;
  }

  async ask<T extends Json>(req: AskRequest): Promise<T> {
    const handler = takeNext(this.asks, req.purpose);
    if (!handler) throw new UnscriptedCallError(`No scripted answer for ask("${req.purpose}")`);
    const answer = await handler(req);
    this.calls.push({ kind: 'ask', purpose: req.purpose, request: req, answer });
    return answer as T;
  }

  async judge<Q extends Questions>(req: JudgeRequest<Q>): Promise<Answers<Q>> {
    const answers: Record<string, unknown> = {};
    for (const [key, question] of Object.entries(req.questions)) {
      const handler = takeNext(this.judges, `${req.purpose}:${key}`) ?? takeNext(this.judges, key);
      if (!handler) throw new UnscriptedCallError(`No scripted answer for judge("${req.purpose}", "${key}")`);
      answers[key] = handler(question, req.state, req as JudgeRequest<Questions>);
    }
    this.calls.push({ kind: 'judge', purpose: req.purpose, request: req as JudgeRequest<Questions>, answers });
    return answers as Answers<Q>;
  }

  /** Calls made to a given purpose, oldest first. */
  callsTo(purpose: string): ScriptedCall[] {
    return this.calls.filter((c) => c.purpose === purpose);
  }
}

// ─── Answer helpers ─────────────────────────────────────────────────────────

export const yes = (probability = 0.97): YesNoAnswer => ({ probability });
export const no = (probability = 0.03): YesNoAnswer => ({ probability });
export const pick = <L extends string>(choice: L, confidence = 0.95, others: L[] = []): ChoiceAnswer<L> => {
  const probabilities = { [choice]: confidence } as Record<L, number>;
  const rest = others.filter((o) => o !== choice);
  for (const o of rest) probabilities[o] = (1 - confidence) / Math.max(rest.length, 1);
  return { choice, confidence, probabilities };
};
export const level = (score: number, confidence = 0.9): GradeAnswer => ({
  score,
  confidence,
  probabilities: { [String(Math.round(score))]: confidence },
});

// ─── internals ──────────────────────────────────────────────────────────────

function toHandlers(h: AskHandler | Json | Array<AskHandler | Json>): AskHandler | AskHandler[] {
  const wrap = (x: AskHandler | Json): AskHandler => (typeof x === 'function' ? (x as AskHandler) : () => x as Json);
  return Array.isArray(h) && h.every((x) => typeof x === 'function' || typeof x === 'object')
    ? (h as Array<AskHandler | Json>).map(wrap)
    : wrap(h as AskHandler | Json);
}

function toJudgeHandlers(
  h: JudgeHandler | YesNoAnswer | ChoiceAnswer | GradeAnswer | Array<JudgeHandler | YesNoAnswer | ChoiceAnswer | GradeAnswer>,
): JudgeHandler | JudgeHandler[] {
  const wrap = (x: JudgeHandler | YesNoAnswer | ChoiceAnswer | GradeAnswer): JudgeHandler =>
    typeof x === 'function' ? x : () => x;
  return Array.isArray(h) ? h.map(wrap) : wrap(h);
}

function takeNext<H>(map: Map<string, H | H[]>, key: string): H | undefined {
  const entry = map.get(key);
  if (entry === undefined) return undefined;
  if (Array.isArray(entry)) {
    if (entry.length === 0) return undefined;
    return entry.length === 1 ? entry[0] : entry.shift();
  }
  return entry;
}
