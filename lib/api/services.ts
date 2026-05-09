/**
 * Lazy-loaded singletons of the legacy CommonJS services. These wrap the
 * existing service classes so Route Handlers can `import { foo } from
 * '@/lib/api/services'` instead of having to construct the right LLM client,
 * template manager, etc. Each is initialized once per process.
 */

declare global {
  // eslint-disable-next-line no-var
  var __appServices: AppServices | undefined;
}

type AppServices = {
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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

function buildServices(): AppServices {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EnhancedFactValidationService = require('@/services/enhancedFactValidationService');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { StateTemplateManager } = require('@/templates/StateTemplateManager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeTemplates } = require('@/templates/initialize');

  const templateManager = new StateTemplateManager();
  if (typeof initializeTemplates === 'function') {
    initializeTemplates(templateManager);
  }

  const openaiClient = buildOpenAIClient();
  const language = process.env.LLM_LANGUAGE || 'en';

  return {
    factValidator: new EnhancedFactValidationService(openaiClient, language),
    templateManager,
    affidavitService: null,
  };
}

export function getServices(): AppServices {
  if (!global.__appServices) {
    global.__appServices = buildServices();
  }
  return global.__appServices;
}
