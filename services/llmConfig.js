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

/**
 * Luna-family models (gpt-5.6-*) are cheap Anthropic-tier reasoning models on
 * OpenAI that ONLY expose function-tool calling via the Responses API
 * (`POST /v1/responses`). Chat Completions with `tools` + `tool_choice`
 * returns:
 *   "Function tools with reasoning_effort are not supported for gpt-5.6-luna
 *    in /v1/chat/completions."
 *
 * The shared LLM client (services/ResilientOpenAIService.js) uses this
 * predicate to transparently route Luna requests through the Responses API
 * and shape the response back into the Chat Completions envelope every caller
 * already expects (`choices[0].message.tool_calls[0].function.arguments`).
 */
function isResponsesOnlyModel(model) {
  return /^gpt-5\.6/i.test(model || '');
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

module.exports = {
  DEFAULT_LLM_MODEL,
  isReasoningModel,
  isResponsesOnlyModel,
  normalizeChatParams,
};
