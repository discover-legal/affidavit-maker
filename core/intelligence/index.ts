/**
 * Intelligence factory.
 *
 *   CORE_INTELLIGENCE=scripted        → ScriptedIntelligence (tests only; throws on any unscripted call)
 *   CORE_INTELLIGENCE=openai          → OpenAIIntelligence for ask + judge
 *   CORE_INTELLIGENCE=typesafe        → Jev for judge, OpenAI for ask (default when TYPESAFE_API_KEY is set)
 *
 * Production code calls getIntelligence(); tests construct ScriptedIntelligence
 * directly and inject it.
 */

import type { Intelligence } from './types';

export * from './types';
export { ASK, JUDGE } from './purposes';
export type { AskPurpose, JudgePurpose } from './purposes';
export { ScriptedIntelligence, UnscriptedCallError, yes, no, pick, level } from './scripted';
export { OpenAIIntelligence } from './openai';
export { TypeSafeIntelligence } from './typesafe';

let cached: Intelligence | null = null;

export function getIntelligence(): Intelligence {
  if (cached) return cached;
  cached = build();
  return cached;
}

export function setIntelligence(intel: Intelligence | null): void {
  cached = intel;
}

function build(): Intelligence {
  const mode = (process.env.CORE_INTELLIGENCE || (process.env.TYPESAFE_API_KEY ? 'typesafe' : 'openai')).toLowerCase();

  if (mode === 'scripted') {
    const { ScriptedIntelligence } = require('./scripted') as typeof import('./scripted');
    return new ScriptedIntelligence();
  }

  const OpenAI = (require('openai') as typeof import('openai')).default;
  const { OpenAIIntelligence } = require('./openai') as typeof import('./openai');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('core intelligence: OPENAI_API_KEY is not set');
  // CORE_LLM_BASE_URL points the OpenAI SDK at any OpenAI-compatible
  // provider (e.g. DeepSeek); pair it with CORE_LLM_API=chat and CORE_LLM_MODEL.
  const baseURL = process.env.CORE_LLM_BASE_URL || undefined;
  const openai = new OpenAIIntelligence({ client: new OpenAI({ apiKey, baseURL, timeout: 90_000, maxRetries: 2 }) });

  if (mode === 'typesafe') {
    const { TypeSafeClient } = require('@typesafe-ai/sdk') as typeof import('@typesafe-ai/sdk');
    const { TypeSafeIntelligence } = require('./typesafe') as typeof import('./typesafe');
    return new TypeSafeIntelligence(new TypeSafeClient(), openai);
  }
  return openai;
}
