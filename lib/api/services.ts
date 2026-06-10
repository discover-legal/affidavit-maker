/**
 * Lazy-loaded singletons of the legacy CommonJS services. Route Handlers do
 * `const { templateManager } = await getServices()` instead of having to
 * construct the right OpenAI client, template registry, etc. each time.
 *
 * Initialisation is async (templates/initialize.js loads ~110 jurisdictions
 * via dynamic require) and idempotent — concurrent first-time callers all
 * await the same promise, so we only pay the cost once per process.
 */

import type { Pool as _Pool } from 'pg';
import { logger } from '@/lib/logger';

declare global {
  // eslint-disable-next-line no-var
  var __appServicesPromise: Promise<AppServices> | undefined;
}

export type AppServices = {
  factValidator: unknown;
  templateManager: unknown;
  affidavitService: unknown;
};

/**
 * Build an OpenAI SDK client from `OPENAI_API_KEY`. Returns `null` when
 * the key is unset so the singleton itself doesn't crash at import time
 * in environments without the secret (CI, build phase, etc.). Legacy
 * orchestrators and the fact validator surface a "service unavailable"
 * message in that case rather than throwing on `.chat.completions.create`.
 *
 * We deliberately skip MultiProviderLLM here even though it's the more
 * featureful wrapper: it pulls in `@anthropic-ai/sdk` and
 * `@google/generative-ai` via top-level requires, which Webpack tries to
 * resolve statically at build time and which aren't in package.json. The
 * raw OpenAI client is OpenAI-compatible (same `.chat.completions.create`
 * shape) and is what production has been running with.
 */
function buildLLMClient(): unknown {
  if (!process.env.OPENAI_API_KEY) {
    // Every chat / validation / rewrite request will fail downstream with an
    // opaque "reading 'chat'" error, so make the root cause unmissable here.
    logger.error('llm_client_unconfigured', {
      reason: 'OPENAI_API_KEY is not set; chat, validation, and rewrite endpoints will fail',
    });
    return null;
  }
  try {
    const openaiModule = require('openai');
    const OpenAI =
      openaiModule.default ?? openaiModule.OpenAI ?? openaiModule;
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
      maxRetries: 0,
    });
  } catch (err) {
    logger.error('llm_client_init_failed', { error: (err as Error).message });
    return null;
  }
}

/**
 * Wrap the raw LLM client in the resilient circuit-breaker / retry layer
 * the legacy orchestrators expect at `global.openAIService.chat(...)`.
 * Pre-Next-migration, server.js performed this wiring; in the Next.js
 * service we have to do it from the services singleton so route handlers
 * that fall back to the legacy AffidavitService and the per-jurisdiction
 * orchestrators (services/agents/*) can find the client.
 */
function buildResilientLLMService(llmClient: unknown): unknown {
  if (!llmClient) return null;
  try {
    const { ResilientOpenAIService } = require('@/services/ResilientOpenAIService');
    return new ResilientOpenAIService(llmClient, {
      maxRetries: 3,
      initialRetryDelay: 1000,
      chatTimeout: 45000,
      chatThreshold: 5,
      resetTimeout: 120000,
    });
  } catch (err) {
    logger.error('llm_resilient_wrapper_init_failed', { error: (err as Error).message });
    return null;
  }
}

async function buildServices(): Promise<AppServices> {
  const EnhancedFactValidationService = require('@/services/enhancedFactValidationService');
  const { StateTemplateManager } = require('@/templates/StateTemplateManager');
  const { initializeTemplates } = require('@/templates/initialize');

  // initializeTemplates is async and returns the populated TemplateRegistry.
  // StateTemplateManager's constructor REQUIRES { registry } — passing nothing
  // throws. Both legacy fact-checks live in templates/initialize.js.
  const registry = await initializeTemplates();
  const templateManager = new StateTemplateManager({ registry });

  const llmClient = buildLLMClient();
  const resilientLLM = buildResilientLLMService(llmClient);

  // Legacy AffidavitService + every services/agents/* orchestrator reads
  // the resilient client off `global.openAIService` at request time (this
  // was previously initialised in server.js before the Next.js migration).
  // Set it once per process — the services singleton is itself cached on
  // globalThis, so this assignment runs at most once.
  if (resilientLLM) {
    (global as unknown as { openAIService?: unknown }).openAIService = resilientLLM;
    logger.info('llm_service_wired');
  }

  const language = process.env.LLM_LANGUAGE || 'en';

  return {
    // EnhancedFactValidationService expects the raw multi-provider client
    // (uses `.chat.completions.create` directly), NOT the resilient wrapper
    // (which exposes `.chat(messages, options)`).
    factValidator: new EnhancedFactValidationService(llmClient, language),
    templateManager,
    affidavitService: null,
  };
}

/**
 * Returns the (cached) AppServices promise. First call triggers the build;
 * concurrent callers share the same in-flight promise.
 *
 * Callers MUST await this — the templates registry takes ~50–200ms to
 * populate from disk on cold start, and we don't want to do that work on
 * every request.
 */
export function getServices(): Promise<AppServices> {
  if (!global.__appServicesPromise) {
    global.__appServicesPromise = buildServices().catch((err) => {
      // If the build fails, clear the cache so the next request retries
      // (e.g. transient FS error during cold-start template load).
      global.__appServicesPromise = undefined;
      throw err;
    });
  }
  return global.__appServicesPromise;
}
