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

function buildServices(): AppServices {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EnhancedFactValidationService = require('@/services/enhancedFactValidationService');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const StateTemplateManager = require('@/templates/StateTemplateManager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initialize = require('@/templates/initialize');

  const templateManager = new StateTemplateManager();
  if (typeof initialize === 'function') initialize(templateManager);

  return {
    factValidator: new EnhancedFactValidationService(),
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
