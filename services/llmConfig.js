'use strict';

/**
 * Central LLM model configuration.
 *
 * Every call site should take its default model from here instead of
 * hardcoding an ID, so a model upgrade is a one-line change (or just the
 * LLM_MODEL env var at deploy time).
 */

const DEFAULT_LLM_MODEL = process.env.LLM_MODEL || 'gpt-5.5';

/**
 * GPT-5-family models are reasoning models with a stricter Chat Completions
 * contract: `max_tokens` is rejected (use `max_completion_tokens`) and the
 * sampling parameters (`temperature`, `top_p`, `presence_penalty`,
 * `frequency_penalty`) are rejected unless left at their defaults.
 */
function isReasoningModel(model) {
  return /^gpt-5/i.test(model || '');
}

const SAMPLING_PARAMS = ['temperature', 'top_p', 'presence_penalty', 'frequency_penalty'];

/**
 * Normalize a Chat Completions request body for the target model. For
 * GPT-5-family models, renames max_tokens → max_completion_tokens and strips
 * unsupported sampling parameters; other models pass through untouched.
 *
 * @param {Object} params - Chat Completions request body (model, messages, ...)
 * @returns {Object} a normalized copy safe to send for params.model
 */
function normalizeChatParams(params) {
  const out = { ...params, model: params.model || DEFAULT_LLM_MODEL };
  if (!isReasoningModel(out.model)) return out;

  if (out.max_tokens !== undefined) {
    if (out.max_completion_tokens === undefined) {
      out.max_completion_tokens = out.max_tokens;
    }
    delete out.max_tokens;
  }
  // Drop them outright rather than checking for default values — some
  // GPT-5 snapshots reject the parameter even at its documented default.
  for (const key of SAMPLING_PARAMS) {
    delete out[key];
  }
  return out;
}

module.exports = { DEFAULT_LLM_MODEL, isReasoningModel, normalizeChatParams };
