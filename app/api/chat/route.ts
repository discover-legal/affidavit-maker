import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { isInternationalEnabled } from '@/lib/api/catalog-data';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Constants ────────────────────────────────────────────────────────────────
// Match the legacy chat.js stability tuning (see routes/chat.js#CHAT_CONSTANTS).
const CHAT_CONSTANTS = {
  MAX_CONVERSATION_TOKENS: 6000,
  MAX_CONVERSATION_MESSAGES: 20,
  MAX_RETRIES: 2,
} as const;

// ─── Lazy-loaded orchestrator singletons ─────────────────────────────────────
// The agents/ modules are CommonJS. We require() them lazily so a single missing
// orchestrator (or an env without OPENAI_API_KEY at import time) doesn't take
// down the whole route. Mirrors the try/catch loading from legacy chat.js.

type Orchestrator = {
  processMessage: (
    message: string,
    history: NormalizedMessage[],
    affidavitData: AffidavitData,
    userId: string,
    sessionId: string,
  ) => Promise<{
    response?: string;
    chatResponse?: string;
    affidavitData?: AffidavitData;
    newFacts?: unknown[];
    success?: boolean;
    error?: string;
  }>;
};

type AffidavitData = {
  countryCode?: string;
  state?: string;
  documentType?: string;
  document_type?: string;
  affidavitType?: string;
  matterTypeCode?: string;
  facts?: unknown[];
  orchestratorState?: { triageComplete?: boolean; currentPhase?: string } & Record<string, unknown>;
} & Record<string, unknown>;

type NormalizedMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type RawMessage = {
  role?: string;
  type?: string;
  content?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __chatOrchestrators: ChatOrchestratorRegistry | undefined;
}

type ChatOrchestratorRegistry = {
  triage: Orchestrator | null;
  general: Orchestrator | null;
  generalAffidavitTypes: Set<string>;
  matter: Record<string, Orchestrator>;
  divorce: Record<string, Orchestrator>;
  affidavitService: Orchestrator | null;
};

const MATTER_ORCHESTRATOR_MODULES: Array<[string, string]> = [
  ['custody',            '@/services/agents/CustodyOrchestrator'],
  ['child_support',      '@/services/agents/ChildSupportOrchestrator'],
  ['dvro',               '@/services/agents/DVROOrchestrator'],
  ['paternity',          '@/services/agents/PaternityOrchestrator'],
  ['legal_separation',   '@/services/agents/LegalSeparationOrchestrator'],
  ['annulment',          '@/services/agents/AnnulmentOrchestrator'],
  ['guardianship_minor', '@/services/agents/GuardianshipOrchestrator'],
  ['adoption',           '@/services/agents/AdoptionOrchestrator'],
  ['emancipation',       '@/services/agents/EmancipationOrchestrator'],
  ['small_claims',       '@/services/agents/SmallClaimsOrchestrator'],
  ['name_change',        '@/services/agents/NameChangeOrchestrator'],
  ['debt_defense',       '@/services/agents/DebtDefenseOrchestrator'],
  ['landlord_tenant',    '@/services/agents/LandlordTenantOrchestrator'],
  ['civil_harassment',   '@/services/agents/CivilHarassmentOrchestrator'],
  ['general_civil',      '@/services/agents/GeneralCivilOrchestrator'],
  ['probate',            '@/services/agents/ProbateOrchestrator'],
];

const DIVORCE_ORCHESTRATOR_MODULES: Array<[string, string]> = [
  // US states
  ['TX', '@/services/agents/TXDivorceOrchestrator'],
  ['AZ', '@/services/agents/AZDivorceOrchestrator'],
  ['CA', '@/services/agents/CADivorceOrchestrator'],
  ['FL', '@/services/agents/FLDivorceOrchestrator'],
  ['IL', '@/services/agents/ILDivorceOrchestrator'],
  ['NY', '@/services/agents/NYDivorceOrchestrator'],
  ['UT', '@/services/agents/UTDivorceOrchestrator'],
  ['CO', '@/services/agents/CODivorceOrchestrator'],
  ['GA', '@/services/agents/GADivorceOrchestrator'],
  ['MA', '@/services/agents/MADivorceOrchestrator'],
  ['MI', '@/services/agents/MIDivorceOrchestrator'],
  ['NC', '@/services/agents/NCDivorceOrchestrator'],
  ['NJ', '@/services/agents/NJDivorceOrchestrator'],
  ['OH', '@/services/agents/OHDivorceOrchestrator'],
  ['PA', '@/services/agents/PADivorceOrchestrator'],
  ['VA', '@/services/agents/VADivorceOrchestrator'],
  ['WA', '@/services/agents/WADivorceOrchestrator'],
  ['IN', '@/services/agents/INDivorceOrchestrator'],
  ['TN', '@/services/agents/TNDivorceOrchestrator'],
  ['MO', '@/services/agents/MODivorceOrchestrator'],
  ['MD', '@/services/agents/MDDivorceOrchestrator'],
  ['MN', '@/services/agents/MNDivorceOrchestrator'],
  ['KY', '@/services/agents/KYDivorceOrchestrator'],
  ['WI', '@/services/agents/WIDivorceOrchestrator'],
  ['SC', '@/services/agents/SCDivorceOrchestrator'],
  ['AL', '@/services/agents/ALDivorceOrchestrator'],
  ['OR', '@/services/agents/ORDivorceOrchestrator'],
  ['OK', '@/services/agents/OKDivorceOrchestrator'],
  ['LA', '@/services/agents/LADivorceOrchestrator'],
  ['CT', '@/services/agents/CTDivorceOrchestrator'],
  ['NV', '@/services/agents/NVDivorceOrchestrator'],
  ['NM', '@/services/agents/NMDivorceOrchestrator'],
  ['ID', '@/services/agents/IDDivorceOrchestrator'],
  ['IA', '@/services/agents/IADivorceOrchestrator'],
  ['AR', '@/services/agents/ARDivorceOrchestrator'],
  ['KS', '@/services/agents/KSDivorceOrchestrator'],
  ['MS', '@/services/agents/MSDivorceOrchestrator'],
  ['NE', '@/services/agents/NEDivorceOrchestrator'],
  ['WV', '@/services/agents/WVDivorceOrchestrator'],
  ['HI', '@/services/agents/HIDivorceOrchestrator'],
  ['ME', '@/services/agents/MEDivorceOrchestrator'],
  ['NH', '@/services/agents/NHDivorceOrchestrator'],
  ['RI', '@/services/agents/RIDivorceOrchestrator'],
  ['MT', '@/services/agents/MTDivorceOrchestrator'],
  ['DE', '@/services/agents/DEDivorceOrchestrator'],
  ['DC', '@/services/agents/DCDivorceOrchestrator'],
  ['AK', '@/services/agents/AKDivorceOrchestrator'],
  ['ND', '@/services/agents/NDDivorceOrchestrator'],
  ['SD', '@/services/agents/SDDivorceOrchestrator'],
  ['VT', '@/services/agents/VTDivorceOrchestrator'],
  ['WY', '@/services/agents/WYDivorceOrchestrator'],
  // Canadian provinces & territories — federal Divorce Act
  ['ON', '@/services/agents/ONDivorceOrchestrator'],
  ['BC', '@/services/agents/BCDivorceOrchestrator'],
  ['AB', '@/services/agents/ABDivorceOrchestrator'],
  ['QC', '@/services/agents/QCDivorceOrchestrator'],
  ['MB', '@/services/agents/MBDivorceOrchestrator'],
  ['NB', '@/services/agents/NBDivorceOrchestrator'],
  ['NL', '@/services/agents/NLDivorceOrchestrator'],
  ['NS', '@/services/agents/NSDivorceOrchestrator'],
  ['PE', '@/services/agents/PEDivorceOrchestrator'],
  ['SK', '@/services/agents/SKDivorceOrchestrator'],
  ['NT', '@/services/agents/NTDivorceOrchestrator'],
  ['YT', '@/services/agents/YTDivorceOrchestrator'],
  ['NU', '@/services/agents/NUDivorceOrchestrator'],
];

function loadOrchestrators(): ChatOrchestratorRegistry {
  const registry: ChatOrchestratorRegistry = {
    triage: null,
    general: null,
    generalAffidavitTypes: new Set(),
    matter: {},
    divorce: {},
    affidavitService: null,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    registry.triage = require('@/services/agents/TriageOrchestrator') as Orchestrator;
  } catch (err) {
    logger.warn('triage_orchestrator_unavailable', { error: (err as Error).message });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    registry.general = require('@/services/agents/GeneralAffidavitOrchestrator') as Orchestrator;
  } catch (err) {
    logger.warn('general_affidavit_orchestrator_unavailable', { error: (err as Error).message });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const registryModule = require('@/services/affidavits/AffidavitTypeRegistry') as {
      all: Record<string, { id: string; routesTo?: string }>;
    };
    registry.generalAffidavitTypes = new Set(
      Object.values(registryModule.all)
        .filter((t) => t.routesTo !== 'divorce_orchestrator')
        .map((t) => t.id),
    );
  } catch (err) {
    logger.warn('affidavit_type_registry_unavailable', { error: (err as Error).message });
  }

  for (const [code, mod] of MATTER_ORCHESTRATOR_MODULES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      registry.matter[code] = require(mod) as Orchestrator;
    } catch (err) {
      logger.warn('matter_orchestrator_unavailable', { code, error: (err as Error).message });
    }
  }

  for (const [code, mod] of DIVORCE_ORCHESTRATOR_MODULES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      registry.divorce[code] = require(mod) as Orchestrator;
    } catch (err) {
      logger.warn('divorce_orchestrator_unavailable', { code, error: (err as Error).message });
    }
  }

  // Legacy fallback: instantiate AffidavitService with the same template manager
  // singleton used elsewhere (lib/api/services.ts). The class constructor takes
  // a templateManager and reads global.openAIService for chat completions.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AffidavitServiceCtor = require('@/services/affidavitService') as new (
      tm: unknown,
    ) => Orchestrator;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getServices } = require('@/lib/api/services') as {
      getServices: () => { templateManager: unknown };
    };
    const { templateManager } = getServices();
    registry.affidavitService = new AffidavitServiceCtor(templateManager);
  } catch (err) {
    logger.warn('affidavit_service_unavailable', { error: (err as Error).message });
  }

  return registry;
}

function getOrchestrators(): ChatOrchestratorRegistry {
  if (!global.__chatOrchestrators) {
    global.__chatOrchestrators = loadOrchestrators();
  }
  return global.__chatOrchestrators;
}

// ─── Country detection (mirrors legacy chat.js#detectCountry) ─────────────────

const JURISDICTION_COUNTRY: Record<string, string> = {
  ON: 'CA', BC: 'CA', AB: 'CA', QC: 'CA', MB: 'CA', NB: 'CA',
  NL: 'CA', NS: 'CA', PE: 'CA', SK: 'CA', NT: 'CA', YT: 'CA', NU: 'CA',
  ENG: 'UK', SCO: 'UK', NIR: 'UK',
  IRL: 'IE',
  NSW: 'AU', VIC: 'AU', QLD: 'AU', WA_AU: 'AU', SA_AU: 'AU',
  TAS: 'AU', ACT: 'AU', NT_AU: 'AU',
  NZ: 'NZ',
};

const SUBDOMAIN_COUNTRY: Record<string, string> = {
  ca: 'CA', canada: 'CA',
  uk: 'UK', ie: 'IE', au: 'AU', nz: 'NZ',
};

const DEFAULT_JURISDICTION: Record<string, string> = {
  US: 'TX', CA: 'ON', UK: 'ENG', IE: 'IRL', AU: 'NSW', NZ: 'NZ',
};

function detectCountry(req: NextRequest, affidavitData: AffidavitData): string {
  const NA_COUNTRIES = new Set(['US', 'CA']);

  if (affidavitData.countryCode) {
    const cc = affidavitData.countryCode.toUpperCase();
    if (!isInternationalEnabled() && !NA_COUNTRIES.has(cc)) return 'US';
    return cc;
  }

  const state = (affidavitData.state || '').toUpperCase();
  if (state && JURISDICTION_COUNTRY[state]) {
    const cc = JURISDICTION_COUNTRY[state];
    if (!isInternationalEnabled() && !NA_COUNTRIES.has(cc)) return 'US';
    return cc;
  }

  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  const subMatch = origin.match(/\b(\w+)\.discover\.legal\b/i);
  if (subMatch) {
    const sub = subMatch[1].toLowerCase();
    if (SUBDOMAIN_COUNTRY[sub]) {
      const cc = SUBDOMAIN_COUNTRY[sub];
      if (!isInternationalEnabled() && !NA_COUNTRIES.has(cc)) return 'US';
      return cc;
    }
  }

  return 'US';
}

// ─── Orchestrator selection helpers (mirror legacy chat.js getters) ──────────

function getDivorceOrchestrator(
  registry: ChatOrchestratorRegistry,
  affidavitData: AffidavitData,
  req: NextRequest,
): Orchestrator | null {
  const docType = (affidavitData.documentType || affidavitData.document_type || '').toLowerCase();
  if (docType !== 'divorce_package') return null;

  const state = (affidavitData.state || '').toUpperCase();
  if (state && registry.divorce[state]) return registry.divorce[state];

  if (!state) {
    const country = detectCountry(req, affidavitData);
    const defaultState = DEFAULT_JURISDICTION[country] || 'TX';
    if (registry.divorce[defaultState]) return registry.divorce[defaultState];
  }
  return null;
}

function getMatterOrchestrator(
  registry: ChatOrchestratorRegistry,
  affidavitData: AffidavitData,
): Orchestrator | null {
  const matterCode = (affidavitData.matterTypeCode || '').toLowerCase();
  if (!matterCode) return null;
  return registry.matter[matterCode] || null;
}

function getTriageOrchestrator(
  registry: ChatOrchestratorRegistry,
  affidavitData: AffidavitData,
): Orchestrator | null {
  if (!registry.triage) return null;
  const matterCode = (affidavitData.matterTypeCode || '').trim();
  const docType = (
    affidavitData.documentType ||
    affidavitData.document_type ||
    affidavitData.affidavitType ||
    ''
  ).trim();
  if (matterCode || docType) return null;
  if (affidavitData.orchestratorState?.triageComplete) return null;
  return registry.triage;
}

function getGeneralOrchestrator(
  registry: ChatOrchestratorRegistry,
  affidavitData: AffidavitData,
): Orchestrator | null {
  if (!registry.general) return null;
  const docType = (
    affidavitData.documentType ||
    affidavitData.document_type ||
    affidavitData.affidavitType ||
    ''
  ).toLowerCase();
  if (!docType) return null;
  if (docType === 'divorce_package') return null;
  return registry.generalAffidavitTypes.has(docType) ? registry.general : null;
}

// ─── Conversation chunking (legacy chat.js#chunkConversation) ────────────────

function estimateTokens(text: string | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function normalizeMessage(msg: RawMessage): NormalizedMessage {
  if (msg.role) {
    const role = (msg.role === 'system' || msg.role === 'assistant' || msg.role === 'user')
      ? msg.role
      : 'user';
    return { role, content: msg.content || '' };
  }
  const role: NormalizedMessage['role'] = msg.type === 'user' ? 'user' : 'assistant';
  return { role, content: msg.content || '' };
}

function chunkConversation(messages: RawMessage[]): NormalizedMessage[] {
  if (!Array.isArray(messages)) return [];

  const normalized = messages.map(normalizeMessage);

  let totalTokens = 0;
  const chunkedMessages: NormalizedMessage[] = [];

  const systemMessage = normalized.find((m) => m.role === 'system');
  if (systemMessage) {
    chunkedMessages.push(systemMessage);
    totalTokens += estimateTokens(systemMessage.content);
  }

  const userMessages = normalized.filter((m) => m.role !== 'system').reverse();

  for (const message of userMessages) {
    const messageTokens = estimateTokens(message.content);
    if (totalTokens + messageTokens > CHAT_CONSTANTS.MAX_CONVERSATION_TOKENS) break;
    chunkedMessages.unshift(message);
    totalTokens += messageTokens;
    if (chunkedMessages.length >= CHAT_CONSTANTS.MAX_CONVERSATION_MESSAGES) break;
  }

  return chunkedMessages;
}

// ─── Request body schema ─────────────────────────────────────────────────────

const messageSchema = z
  .object({
    role: z.string().optional(),
    type: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough();

const chatBodySchema = z
  .object({
    message: z.string().min(1, 'message is required').max(5000),
    sessionId: z.string().max(100).optional(),
    conversationHistory: z.array(messageSchema).optional().default([]),
    affidavitData: z.record(z.unknown()).optional().default({}),
    skipExtraction: z.boolean().optional().default(false),
    documentType: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  })
  .passthrough();

// ─── POST /api/chat ──────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const startTime = Date.now();
  let sessionId = `chat_${Date.now()}_${user.id}`;

  try {
    const limit = checkRateLimit('chat', user.id, RATE_LIMITS.chat);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = chatBodySchema.parse(json);

    const message = body.message;
    const conversationHistory = body.conversationHistory as RawMessage[];
    const skipExtraction = body.skipExtraction;
    const affidavitData: AffidavitData = {
      ...(body.affidavitData as AffidavitData),
    };
    if (body.documentType && !affidavitData.documentType) {
      affidavitData.documentType = body.documentType;
    }
    if (body.state && !affidavitData.state) {
      affidavitData.state = body.state;
    }
    if (body.country && !affidavitData.countryCode) {
      affidavitData.countryCode = body.country;
    }

    if (!affidavitData.countryCode) {
      affidavitData.countryCode = detectCountry(req, affidavitData);
    }

    if (body.sessionId) sessionId = body.sessionId;

    logger.info('chat_started', {
      sessionId,
      userId: user.id,
      messageLength: message.length,
      historyLength: conversationHistory.length,
      countryCode: affidavitData.countryCode,
    });

    const registry = getOrchestrators();
    const chunkedHistory = chunkConversation(conversationHistory);

    const triageOrch = getTriageOrchestrator(registry, affidavitData);
    const divorceOrch = !triageOrch ? getDivorceOrchestrator(registry, affidavitData, req) : null;
    const matterOrch = !triageOrch && !divorceOrch ? getMatterOrchestrator(registry, affidavitData) : null;
    const generalOrch =
      !triageOrch && !divorceOrch && !matterOrch ? getGeneralOrchestrator(registry, affidavitData) : null;

    const orchestrator: Orchestrator | null =
      triageOrch || divorceOrch || matterOrch || generalOrch || registry.affidavitService;

    if (!orchestrator) {
      throw new ValidationError('No orchestrator available to handle this request.');
    }

    let result: Awaited<ReturnType<Orchestrator['processMessage']>> | undefined;
    let attempts = 0;
    let lastError: unknown = null;

    while (attempts < CHAT_CONSTANTS.MAX_RETRIES) {
      attempts++;
      try {
        if (orchestrator === registry.affidavitService) {
          // Legacy AffidavitService takes an extra skipExtraction arg.
          result = await (orchestrator as Orchestrator & {
            processMessage: (
              m: string,
              h: NormalizedMessage[],
              a: AffidavitData,
              u: string,
              s: string,
              skip?: boolean,
            ) => Promise<ReturnType<Orchestrator['processMessage']> extends Promise<infer R> ? R : never>;
          }).processMessage(message, chunkedHistory, affidavitData, user.id, sessionId, skipExtraction);
        } else {
          result = await orchestrator.processMessage(message, chunkedHistory, affidavitData, user.id, sessionId);
        }
        break;
      } catch (err) {
        lastError = err;
        const status = (err as { statusCode?: number }).statusCode;
        if (
          attempts >= CHAT_CONSTANTS.MAX_RETRIES ||
          status === 400 ||
          status === 401 ||
          status === 403
        ) {
          throw err;
        }
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (!result) {
      throw (lastError ?? new Error('No response received from AI service'));
    }

    // Coerce legacy `chatResponse` to `response` for a uniform shape.
    if (!result.response && result.chatResponse) {
      result.response = result.chatResponse;
    }
    if (result.success === false) {
      result.response =
        result.response ||
        result.chatResponse ||
        result.error ||
        'Sorry, I encountered an error processing your message. Please try again.';
    }
    if (!result.response) {
      throw new Error('No response received from AI service');
    }

    const processingTime = Date.now() - startTime;
    logger.info('chat_completed', {
      sessionId,
      userId: user.id,
      processingTime,
      attempts,
      responseLength: result.response.length,
      hasNewFacts: (result.newFacts?.length ?? 0) > 0,
    });

    const finalAffidavitData = result.affidavitData || affidavitData;

    return NextResponse.json({
      success: true,
      response: result.response,
      affidavitData: finalAffidavitData,
      newFacts: result.newFacts || [],
      orchestratorState: finalAffidavitData.orchestratorState || null,
      processingTime,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('chat_failed', {
      sessionId,
      userId: user.id,
      processingTime: Date.now() - startTime,
      error: (err as Error).message,
    });
    return toErrorResponse(err);
  }
});
