import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { isInternationalEnabled } from '@/lib/api/catalog-data';
import { getUserProfile, hydrateAffidavitData, mergeUserProfileSafe } from '@/lib/api/profile';
import { logger } from '@/lib/logger';
import { readJsonBody } from '@/lib/api/requestBody';
import { isCoreEngineEnabled, runCoreChat } from '@/lib/api/coreChat';

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
  var __chatOrchestratorsPromise: Promise<ChatOrchestratorRegistry> | undefined;
}

type ChatOrchestratorRegistry = {
  triage: Orchestrator | null;
  general: Orchestrator | null;
  generalAffidavitTypes: Set<string>;
  matter: Record<string, Orchestrator>;
  divorce: Record<string, Orchestrator>;
  affidavitService: Orchestrator | null;
  /** Matter codes whose interviews may hydrate spouse/children facts from the life story. */
  familyMatterCodes: Set<string>;
};

// IMPORTANT: every require() below must take a string LITERAL. Webpack only
// bundles modules it can resolve statically — `require(someVariable)` is left
// as a runtime require, where the '@/' alias doesn't exist and every module
// fails with "Cannot find module". Each entry is a thunk so one broken module
// still only fails its own try/catch in loadOrchestrators().
const MATTER_ORCHESTRATOR_LOADERS: Array<[string, () => unknown]> = [
  ['custody',            () => require('@/services/agents/CustodyOrchestrator')],
  ['child_support',      () => require('@/services/agents/ChildSupportOrchestrator')],
  ['dvro',               () => require('@/services/agents/DVROOrchestrator')],
  ['paternity',          () => require('@/services/agents/PaternityOrchestrator')],
  ['legal_separation',   () => require('@/services/agents/LegalSeparationOrchestrator')],
  ['annulment',          () => require('@/services/agents/AnnulmentOrchestrator')],
  ['guardianship_minor', () => require('@/services/agents/GuardianshipOrchestrator')],
  ['adoption',           () => require('@/services/agents/AdoptionOrchestrator')],
  ['emancipation',       () => require('@/services/agents/EmancipationOrchestrator')],
  ['small_claims',       () => require('@/services/agents/SmallClaimsOrchestrator')],
  ['debt_defense',       () => require('@/services/agents/DebtDefenseOrchestrator')],
  ['landlord_tenant',    () => require('@/services/agents/LandlordTenantOrchestrator')],
  ['civil_harassment',   () => require('@/services/agents/CivilHarassmentOrchestrator')],
  ['general_civil',      () => require('@/services/agents/GeneralCivilOrchestrator')],
  ['probate',            () => require('@/services/agents/ProbateOrchestrator')],
];

const DIVORCE_ORCHESTRATOR_LOADERS: Array<[string, () => unknown]> = [
  // US states
  ['TX', () => require('@/services/agents/TXDivorceOrchestrator')],
  ['AZ', () => require('@/services/agents/AZDivorceOrchestrator')],
  ['CA', () => require('@/services/agents/CADivorceOrchestrator')],
  ['FL', () => require('@/services/agents/FLDivorceOrchestrator')],
  ['IL', () => require('@/services/agents/ILDivorceOrchestrator')],
  ['NY', () => require('@/services/agents/NYDivorceOrchestrator')],
  ['UT', () => require('@/services/agents/UTDivorceOrchestrator')],
  ['CO', () => require('@/services/agents/CODivorceOrchestrator')],
  ['GA', () => require('@/services/agents/GADivorceOrchestrator')],
  ['MA', () => require('@/services/agents/MADivorceOrchestrator')],
  ['MI', () => require('@/services/agents/MIDivorceOrchestrator')],
  ['NC', () => require('@/services/agents/NCDivorceOrchestrator')],
  ['NJ', () => require('@/services/agents/NJDivorceOrchestrator')],
  ['OH', () => require('@/services/agents/OHDivorceOrchestrator')],
  ['PA', () => require('@/services/agents/PADivorceOrchestrator')],
  ['VA', () => require('@/services/agents/VADivorceOrchestrator')],
  ['WA', () => require('@/services/agents/WADivorceOrchestrator')],
  ['IN', () => require('@/services/agents/INDivorceOrchestrator')],
  ['TN', () => require('@/services/agents/TNDivorceOrchestrator')],
  ['MO', () => require('@/services/agents/MODivorceOrchestrator')],
  ['MD', () => require('@/services/agents/MDDivorceOrchestrator')],
  ['MN', () => require('@/services/agents/MNDivorceOrchestrator')],
  ['KY', () => require('@/services/agents/KYDivorceOrchestrator')],
  ['WI', () => require('@/services/agents/WIDivorceOrchestrator')],
  ['SC', () => require('@/services/agents/SCDivorceOrchestrator')],
  ['AL', () => require('@/services/agents/ALDivorceOrchestrator')],
  ['OR', () => require('@/services/agents/ORDivorceOrchestrator')],
  ['OK', () => require('@/services/agents/OKDivorceOrchestrator')],
  ['LA', () => require('@/services/agents/LADivorceOrchestrator')],
  ['CT', () => require('@/services/agents/CTDivorceOrchestrator')],
  ['NV', () => require('@/services/agents/NVDivorceOrchestrator')],
  ['NM', () => require('@/services/agents/NMDivorceOrchestrator')],
  ['ID', () => require('@/services/agents/IDDivorceOrchestrator')],
  ['IA', () => require('@/services/agents/IADivorceOrchestrator')],
  ['AR', () => require('@/services/agents/ARDivorceOrchestrator')],
  ['KS', () => require('@/services/agents/KSDivorceOrchestrator')],
  ['MS', () => require('@/services/agents/MSDivorceOrchestrator')],
  ['NE', () => require('@/services/agents/NEDivorceOrchestrator')],
  ['WV', () => require('@/services/agents/WVDivorceOrchestrator')],
  ['HI', () => require('@/services/agents/HIDivorceOrchestrator')],
  ['ME', () => require('@/services/agents/MEDivorceOrchestrator')],
  ['NH', () => require('@/services/agents/NHDivorceOrchestrator')],
  ['RI', () => require('@/services/agents/RIDivorceOrchestrator')],
  ['MT', () => require('@/services/agents/MTDivorceOrchestrator')],
  ['DE', () => require('@/services/agents/DEDivorceOrchestrator')],
  ['DC', () => require('@/services/agents/DCDivorceOrchestrator')],
  ['AK', () => require('@/services/agents/AKDivorceOrchestrator')],
  ['ND', () => require('@/services/agents/NDDivorceOrchestrator')],
  ['SD', () => require('@/services/agents/SDDivorceOrchestrator')],
  ['VT', () => require('@/services/agents/VTDivorceOrchestrator')],
  ['WY', () => require('@/services/agents/WYDivorceOrchestrator')],
  // Canadian provinces & territories — federal Divorce Act
  ['ON', () => require('@/services/agents/ONDivorceOrchestrator')],
  ['BC', () => require('@/services/agents/BCDivorceOrchestrator')],
  ['AB', () => require('@/services/agents/ABDivorceOrchestrator')],
  ['QC', () => require('@/services/agents/QCDivorceOrchestrator')],
  ['MB', () => require('@/services/agents/MBDivorceOrchestrator')],
  ['NB', () => require('@/services/agents/NBDivorceOrchestrator')],
  ['NL', () => require('@/services/agents/NLDivorceOrchestrator')],
  ['NS', () => require('@/services/agents/NSDivorceOrchestrator')],
  ['PE', () => require('@/services/agents/PEDivorceOrchestrator')],
  ['SK', () => require('@/services/agents/SKDivorceOrchestrator')],
  ['NT', () => require('@/services/agents/NTDivorceOrchestrator')],
  ['YT', () => require('@/services/agents/YTDivorceOrchestrator')],
  ['NU', () => require('@/services/agents/NUDivorceOrchestrator')],
];

async function loadOrchestrators(): Promise<ChatOrchestratorRegistry> {
  const registry: ChatOrchestratorRegistry = {
    triage: null,
    general: null,
    generalAffidavitTypes: new Set(),
    matter: {},
    divorce: {},
    affidavitService: null,
    familyMatterCodes: new Set(BUILTIN_FAMILY_MATTER_CODES),
  };

  // Wire `global.openAIService` FIRST, before any orchestrator selection runs.
  // Every services/agents/* orchestrator reads it lazily at processMessage
  // time, and AffidavitService caches it in its constructor — so the singleton
  // must exist before either path is exercised. Doing this in its own try/catch
  // (rather than only inside the affidavitService block below) keeps the LLM
  // available even when the legacy AffidavitService fails to instantiate.
  let templateManager: unknown = null;
  try {
    const { getServices } = require('@/lib/api/services') as {
      getServices: () => Promise<{ templateManager: unknown }>;
    };
    const services = await getServices();
    templateManager = services.templateManager;
  } catch (err) {
    logger.error('services_init_failed', { error: (err as Error).message });
  }

  try {
    registry.triage = require('@/services/agents/TriageOrchestrator') as Orchestrator;
  } catch (err) {
    logger.warn('triage_orchestrator_unavailable', { error: (err as Error).message });
  }

  try {
    registry.general = require('@/services/agents/GeneralAffidavitOrchestrator') as Orchestrator;
  } catch (err) {
    logger.warn('general_affidavit_orchestrator_unavailable', { error: (err as Error).message });
  }

  try {
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

  for (const [code, load] of MATTER_ORCHESTRATOR_LOADERS) {
    try {
      registry.matter[code] = load() as Orchestrator;
    } catch (err) {
      logger.warn('matter_orchestrator_unavailable', { code, error: (err as Error).message });
    }
  }

  for (const [code, load] of DIVORCE_ORCHESTRATOR_LOADERS) {
    try {
      registry.divorce[code] = load() as Orchestrator;
    } catch (err) {
      logger.warn('divorce_orchestrator_unavailable', { code, error: (err as Error).message });
    }
  }

  // YAML-defined matters (matters/*.yaml). Each becomes a BaseMatterOrchestrator
  // exactly like the JS packs above; a broken file is logged and skipped so
  // one bad definition never disables the rest of the chat.
  try {
    const matters = require('@/services/matters') as typeof import('@/services/matters');
    const matterRegistry = matters.getMatterRegistry();
    for (const problem of matterRegistry.errors) {
      logger.error('matter_definition_invalid', problem);
    }
    const selectionAgent = require('@/services/agents/DocumentSelectionAgent') as {
      registerHandler: (state: string, area: string, fn: (data: unknown) => unknown) => void;
    };
    for (const def of matterRegistry.list()) {
      try {
        registry.matter[def.code] = matters.createOrchestrator(def) as unknown as Orchestrator;
        matters.registerDocumentSelection(def, selectionAgent);
        if (def.familyProfile) registry.familyMatterCodes.add(def.code);
      } catch (err) {
        logger.warn('yaml_matter_orchestrator_unavailable', { code: def.code, error: (err as Error).message });
      }
    }
  } catch (err) {
    logger.warn('matter_registry_unavailable', { error: (err as Error).message });
  }

  // Legacy fallback: instantiate AffidavitService with the same templateManager
  // resolved above. Its constructor reads `global.openAIService` synchronously,
  // which is now guaranteed wired (or absent — in which case the service will
  // surface a clear "LLM service not available" error at request time instead
  // of caching `undefined`).
  if (templateManager) {
    try {
      const AffidavitServiceCtor = require('@/services/affidavitService') as new (
        tm: unknown,
      ) => Orchestrator;
      registry.affidavitService = new AffidavitServiceCtor(templateManager);
    } catch (err) {
      logger.warn('affidavit_service_unavailable', { error: (err as Error).message });
    }
  }

  return registry;
}

async function getOrchestrators(): Promise<ChatOrchestratorRegistry> {
  if (!global.__chatOrchestratorsPromise) {
    global.__chatOrchestratorsPromise = loadOrchestrators().catch((err) => {
      global.__chatOrchestratorsPromise = undefined;
      throw err;
    });
  }
  return global.__chatOrchestratorsPromise;
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

// Built-in matter types whose interviews involve spouse/children/marriage
// details — the only ones the life-story profile's family fields may hydrate
// into. YAML matters opt in with `family_profile: true` (merged into the
// registry's familyMatterCodes at load).
const BUILTIN_FAMILY_MATTER_CODES = [
  'custody', 'child_support', 'dvro', 'paternity', 'legal_separation',
  'annulment', 'guardianship_minor', 'adoption', 'emancipation',
];

function isFamilyMatter(affidavitData: AffidavitData, familyMatterCodes: Set<string>): boolean {
  // Deliberately NOT keyed on practiceArea — the client defaults every new
  // document to practiceArea 'family', which would leak divorce data into
  // general affidavits. Only explicit divorce docs / family matter codes.
  const docType = String(
    affidavitData.documentType || affidavitData.document_type || affidavitData.affidavitType || '',
  ).toLowerCase();
  if (docType.includes('divorce')) return true;
  return familyMatterCodes.has(String(affidavitData.matterTypeCode || '').toLowerCase());
}

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

// Tight bounds on each conversation message: caps both prompt-injection
// volume and OpenAI token spend per request.
const messageSchema = z
  .object({
    // System instructions are server-owned. Accepting them from the browser
    // lets a caller override the legal-document safety prompt.
    role: z.enum(['assistant', 'user']).optional(),
    type: z.string().max(32).optional(),
    content: z.string().max(6000).optional(),
  })
  .passthrough();

// SECURITY: the orchestrators run this blob through an LLM. Every field that
// reaches a prompt is bounded so a single request can't expand the context
// to an unbounded size. `affidavitData` keeps `.passthrough()` for editor
// compatibility but we cap the serialized form below.
const chatBodySchema = z
  .object({
    message: z.string().min(1, 'message is required').max(5000),
    sessionId: z.string().max(100).regex(/^[A-Za-z0-9_.-]+$/).optional(),
    conversationHistory: z.array(messageSchema).max(40).optional().default([]),
    affidavitData: z.record(z.unknown()).optional().default({}),
    skipExtraction: z.boolean().optional().default(false),
    documentType: z.string().max(64).optional(),
    state: z.string().max(8).optional(),
    country: z.string().max(8).optional(),
  })
  .passthrough();

/** Hard ceiling on the serialized affidavitData payload (in bytes). */
const MAX_AFFIDAVIT_DATA_BYTES = 256 * 1024;

// ─── POST /api/chat ──────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const startTime = Date.now();
  let sessionId = `chat_${Date.now()}_${user.id}`;

  try {
    const limit = await checkRateLimit('chat', user.id, RATE_LIMITS.chat);
    const dailyLimit = await checkRateLimit('chat-daily', user.id, RATE_LIMITS.chatDaily);
    if (!limit.ok || !dailyLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = await readJsonBody(req, 512 * 1024);
    const body = chatBodySchema.parse(json);

    // Enforce a byte cap on the unbounded `affidavitData` blob — a tightly
    // typed Zod schema would break the editor's evolving shape, but the
    // serialized size is a safe proxy for "is this request reasonable".
    const serializedSize = JSON.stringify(body.affidavitData ?? {}).length;
    if (serializedSize > MAX_AFFIDAVIT_DATA_BYTES) {
      throw new ValidationError('affidavitData payload too large');
    }

    const message = body.message;
    const conversationHistory = body.conversationHistory as RawMessage[];
    const skipExtraction = body.skipExtraction;
    let affidavitData: AffidavitData = {
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

    // v2 engine (core/): same request/response contract, new brain.
    if (isCoreEngineEnabled()) {
      const history = chunkConversation(conversationHistory)
        .filter((m): m is NormalizedMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
      const out = await runCoreChat({
        userId: user.id,
        sessionId,
        message,
        history,
        affidavitData: affidavitData as Record<string, unknown>,
      });
      const processingTime = Date.now() - startTime;
      logger.info('chat_completed', { sessionId, userId: user.id, processingTime, engine: 'v2' });
      return NextResponse.json({
        success: true,
        response: out.response,
        affidavitData: out.affidavitData,
        newFacts: out.newFacts,
        orchestratorState: out.orchestratorState,
        processingTime,
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Life-story hydration: fill gaps from the user's persistent profile so
    // returning users (new session, new document) never repeat themselves.
    // Gap-fill only — anything the current conversation/document already has
    // always wins. Scoped: spouse/children/marriage details flow only into
    // family-law matters, and jurisdiction fields never hydrate (each new
    // document confirms where it's filed — see lib/api/profile.ts).
    // Best-effort: a profile read must never fail the chat turn.
    const registry = await getOrchestrators();
    const hydrationScope = isFamilyMatter(affidavitData, registry.familyMatterCodes) ? 'family' : 'general';
    try {
      const storedProfile = await getUserProfile(user.id);
      affidavitData = hydrateAffidavitData(storedProfile, affidavitData, hydrationScope);
    } catch (err) {
      logger.warn('user_profile_hydration_failed', {
        userId: user.id,
        error: (err as Error).message,
      });
    }

    logger.info('chat_started', {
      sessionId,
      userId: user.id,
      messageLength: message.length,
      historyLength: conversationHistory.length,
      countryCode: affidavitData.countryCode,
    });

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
          }).processMessage(message, chunkedHistory, affidavitData, String(user.id), sessionId, skipExtraction);
        } else {
          result = await orchestrator.processMessage(message, chunkedHistory, affidavitData, String(user.id), sessionId);
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
      // The orchestrator handled the error internally — surface its message
      // and log loudly so production traces show the failing path (otherwise
      // the user sees "Sorry, I encountered an error…" with no breadcrumb).
      logger.error('chat_orchestrator_soft_failure', {
        sessionId,
        userId: user.id,
        orchestratorError: result.error,
      });
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

    // Merge this turn's extractions back into the durable life-story profile.
    // In family scope the conversation started from the profile's full
    // children list, so its post-turn list is authoritative — replacement
    // lets explicit removals propagate instead of resurrecting.
    await mergeUserProfileSafe(
      user.id,
      finalAffidavitData as Record<string, unknown>,
      (result.newFacts || []) as Array<Record<string, unknown>>,
      {
        replaceChildren:
          hydrationScope === 'family' && Array.isArray(finalAffidavitData.children),
      },
    );

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
