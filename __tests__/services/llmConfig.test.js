/** @jest-environment node */
// Tests for services/llmConfig.js — model classifiers used by the shared LLM
// client to decide which OpenAI endpoint (Chat Completions vs Responses) a
// given model must be routed through.

const {
  isReasoningModel,
  isResponsesOnlyModel,
  normalizeChatParams,
  DEFAULT_LLM_MODEL,
} = require('../../services/llmConfig');

describe('llmConfig classifiers', () => {
  test('isResponsesOnlyModel — Luna family only', () => {
    expect(isResponsesOnlyModel('gpt-5.6-luna')).toBe(true);
    expect(isResponsesOnlyModel('gpt-5.6-mini')).toBe(true);
    expect(isResponsesOnlyModel('GPT-5.6-LUNA')).toBe(true);

    expect(isResponsesOnlyModel('gpt-5-nano')).toBe(false);
    expect(isResponsesOnlyModel('gpt-5.5')).toBe(false);
    expect(isResponsesOnlyModel('gpt-4o')).toBe(false);
    expect(isResponsesOnlyModel('gpt-4')).toBe(false);
    expect(isResponsesOnlyModel('')).toBe(false);
    expect(isResponsesOnlyModel(undefined)).toBe(false);
  });

  test('isReasoningModel — every GPT-5 flavor incl. Luna', () => {
    // Luna is still a GPT-5-family reasoning model — normalizeChatParams
    // has to strip its sampling params, same as gpt-5-nano.
    expect(isReasoningModel('gpt-5.6-luna')).toBe(true);
    expect(isReasoningModel('gpt-5-nano')).toBe(true);
    expect(isReasoningModel('gpt-5.5')).toBe(true);
    expect(isReasoningModel('gpt-4o')).toBe(false);
  });

  test('normalizeChatParams still strips sampling params for Luna', () => {
    const out = normalizeChatParams({
      model: 'gpt-5.6-luna',
      messages: [],
      max_tokens: 500,
      temperature: 0.3,
      top_p: 0.9,
    });
    expect(out.max_tokens).toBeUndefined();
    expect(out.max_completion_tokens).toBe(500);
    expect(out.temperature).toBeUndefined();
    expect(out.top_p).toBeUndefined();
  });

  test('DEFAULT_LLM_MODEL resolves to a non-empty string', () => {
    expect(typeof DEFAULT_LLM_MODEL).toBe('string');
    expect(DEFAULT_LLM_MODEL.length).toBeGreaterThan(0);
  });
});
