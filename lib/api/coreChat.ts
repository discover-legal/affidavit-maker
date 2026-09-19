/**
 * v2 chat turn — the CORE_ENGINE=v2 branch of POST /api/chat.
 *
 * Keeps the v1 request/response contract the client already speaks:
 * affidavitData in, affidavitData out. Internally: blob → CaseFile
 * (core/adapters/legacy) → engine.chat (triage or interview, with life-story
 * hydration and promotion) → absorb into the durable LifeStory → CaseFile →
 * blob. No prompt, rule or heuristic lives here.
 */

import type { Message } from '@/core/intelligence/types';
import { toAffidavitData, toCaseFile, type AffidavitData } from '@/core/adapters/legacy';
import { createEngine, type Engine } from '@/core/engine';
import { logger } from '@/lib/logger';
import { getLifeStory, saveLifeStory } from '@/lib/api/lifeStoryStore';

let engine: Engine | null = null;

export function getCoreEngine(): Engine {
  if (!engine) engine = createEngine();
  return engine;
}

/** Test seam. */
export function setCoreEngine(e: Engine | null): void {
  engine = e;
}

export function isCoreEngineEnabled(): boolean {
  return process.env.CORE_ENGINE === 'v2';
}

export interface CoreChatInput {
  userId: number;
  sessionId: string;
  message: string;
  history: Message[];
  affidavitData: AffidavitData;
}

export interface CoreChatOutput {
  response: string;
  affidavitData: AffidavitData;
  newFacts: unknown[];
  orchestratorState: unknown;
}

export async function runCoreChat(input: CoreChatInput): Promise<CoreChatOutput> {
  const eng = getCoreEngine();
  const file = toCaseFile(input.affidavitData, { id: input.sessionId, userId: String(input.userId) });

  // A profile read must never fail the turn.
  let story = null;
  try {
    story = await getLifeStory(input.userId);
  } catch (err) {
    logger.warn('life_story_read_failed', { userId: input.userId, error: (err as Error).message });
  }

  const outcome = await eng.chat({ file, history: input.history, message: input.message, story });

  let response: string;
  let newFacts: unknown[] = [];
  if (outcome.stage === 'triage') {
    response = outcome.result.outcome.reply;
    if (outcome.result.safety) {
      response = `${outcome.result.safety.hotline}\n\n${response}`;
    }
  } else {
    response = outcome.result.reply;
    newFacts = outcome.result.newFacts;
  }

  const affidavitData = toAffidavitData(outcome.file, input.affidavitData);

  if (outcome.stage === 'interview') {
    try {
      const updated = await eng.lifeStory.absorb(story, outcome.file);
      await saveLifeStory(input.userId, updated);
    } catch (err) {
      logger.warn('life_story_absorb_failed', { userId: input.userId, error: (err as Error).message });
    }
  }

  return {
    response,
    affidavitData,
    newFacts,
    orchestratorState: affidavitData.orchestratorState ?? null,
  };
}
