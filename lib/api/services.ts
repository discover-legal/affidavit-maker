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
 * Construct an OpenAI client from `OPENAI_API_KEY` if available. Returns
 * `null` when the key is unset so the singleton itself doesn't crash at
 * import time in environments without the secret (CI, build phase, etc.).
 * The downstream validator surfaces a "service unavailable" message in
 * that case rather than throwing on `this.openai.chat.completions.create`.
 */
function buildOpenAIClient(): unknown {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openaiModule = require('openai');
  // The `openai` package has shipped under several export shapes across
  // versions: a default export, a named `OpenAI` export, and (older) a
  // direct `module.exports = OpenAI` form. Resolve any of them.
  const OpenAI =
    openaiModule.default ?? openaiModule.OpenAI ?? openaiModule;
  try {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
      maxRetries: 0,
    });
  } catch {
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

  const openaiClient = buildOpenAIClient();
  const language = process.env.LLM_LANGUAGE || 'en';

  return {
    factValidator: new EnhancedFactValidationService(openaiClient, language),
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
