/**
 * TypeSafeIntelligence — judgments answered by a System One model (Jev),
 * everything generative delegated to another Intelligence.
 *
 * Jev returns typed answers with calibrated probabilities and never prose,
 * which is exactly what `judge()` needs. The mapping is one-to-one:
 *   yesno  → noul   (probability of yes)
 *   choice → choice (label + per-label probabilities)
 *   grade  → score  (expected level + per-level probabilities)
 */

import type { TypeSafeClient } from '@typesafe-ai/sdk';
import type { AskRequest, Answers, Intelligence, Json, JudgeRequest, Questions } from './types';

type SystemOneQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] };

export class TypeSafeIntelligence implements Intelligence {
  constructor(
    private readonly client: TypeSafeClient,
    private readonly generative: Intelligence,
  ) {}

  ask<T extends Json>(req: AskRequest): Promise<T> {
    return this.generative.ask<T>(req);
  }

  async judge<Q extends Questions>(req: JudgeRequest<Q>): Promise<Answers<Q>> {
    const questions: Record<string, SystemOneQuestion> = {};
    for (const [key, q] of Object.entries(req.questions)) {
      if (q.type === 'yesno') {
        questions[key] = { type: 'noul', instructions: q.question, criteria: { true: q.yes, false: q.no } };
      } else if (q.type === 'choice') {
        questions[key] = { type: 'choice', instructions: q.question, criteria: q.options };
      } else {
        questions[key] = { type: 'score', instructions: q.question, criteria: q.levels };
      }
    }
    // The SDK infers answer types from the literal question objects; we hold
    // a dynamic map, so the response is read through its wire shape.
    const result = (await this.client.systemOne({
      state: req.state as Parameters<TypeSafeClient['systemOne']>[0]['state'],
      questions: questions as never,
    })) as unknown as { answers: Record<string, WireAnswer> };

    const answers: Record<string, unknown> = {};
    for (const [key, q] of Object.entries(req.questions)) {
      const a = result.answers[key];
      if (q.type === 'yesno') answers[key] = { probability: a.noul ?? 0 };
      else if (q.type === 'choice') answers[key] = { choice: a.choice, confidence: a.confidence ?? 0, probabilities: a.probabilities ?? {} };
      else answers[key] = { score: a.score ?? 0, confidence: a.confidence ?? 0, probabilities: a.probabilities ?? {} };
    }
    return answers as Answers<Q>;
  }
}

type WireAnswer = {
  type: string;
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
};
