// routes/chat.js - Chat Routes with Stability Fixes and Debug Logging
const express = require('express');
const router = express.Router();
const timeout = require('connect-timeout');

const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { validateChatMessage } = require('../middleware/validation');
const { chatLimiter } = require('../middleware/rateLimiting');
const { isInternationalEnabled } = require('../config/jurisdictions');

// ─── Triage orchestrator ──────────────────────────────────────────────────────
// Entry point when no matter type is known. Classifies the user's need through
// conversation and sets affidavitData.matterTypeCode. Subsequent messages then
// route to the correct matter orchestrator automatically.

let triageOrchestrator = null;
try {
  triageOrchestrator = require('../services/agents/TriageOrchestrator');
  logger.info('TriageOrchestrator loaded');
} catch (err) {
  logger.warn('TriageOrchestrator not available', { error: err.message });
}

// ─── General affidavit orchestrator ──────────────────────────────────────────
// Handles all non-divorce affidavit types via a 4-phase interview engine.

let generalAffidavitOrchestrator = null;
try {
  generalAffidavitOrchestrator = require('../services/agents/GeneralAffidavitOrchestrator');
  logger.info('GeneralAffidavitOrchestrator loaded');
} catch (err) {
  logger.warn('GeneralAffidavitOrchestrator not available, will fall back', { error: err.message });
}

// Affidavit type IDs routed to GeneralAffidavitOrchestrator (all non-divorce types).
// Loaded from AffidavitTypeRegistry so the source of truth is one place.
let GENERAL_AFFIDAVIT_TYPES = new Set();
try {
  const registry = require('../services/affidavits/AffidavitTypeRegistry');
  GENERAL_AFFIDAVIT_TYPES = new Set(
    Object.values(registry.all)
      .filter(t => t.routesTo !== 'divorce_orchestrator')
      .map(t => t.id)
  );
} catch (err) {
  logger.warn('AffidavitTypeRegistry not available for type routing', { error: err.message });
}

// ─── Matter orchestrators (one per matter type, state-agnostic) ──────────────
// Each is a thin BaseMatterOrchestrator instance with matter-specific prompts.
// Graceful degradation: if any fails to load we skip routing to that matter.

const matterOrchestrators = {};

for (const [matterCode, modulePath] of [
  ['custody',            '../services/agents/CustodyOrchestrator'],
  ['child_support',      '../services/agents/ChildSupportOrchestrator'],
  ['dvro',               '../services/agents/DVROOrchestrator'],
  ['paternity',          '../services/agents/PaternityOrchestrator'],
  ['legal_separation',   '../services/agents/LegalSeparationOrchestrator'],
  ['annulment',          '../services/agents/AnnulmentOrchestrator'],
  ['guardianship_minor', '../services/agents/GuardianshipOrchestrator'],
  ['adoption',           '../services/agents/AdoptionOrchestrator'],
  ['emancipation',       '../services/agents/EmancipationOrchestrator'],
  ['small_claims',       '../services/agents/SmallClaimsOrchestrator'],
  ['name_change',        '../services/agents/NameChangeOrchestrator'],
  ['debt_defense',       '../services/agents/DebtDefenseOrchestrator'],
  ['landlord_tenant',    '../services/agents/LandlordTenantOrchestrator'],
  ['civil_harassment',   '../services/agents/CivilHarassmentOrchestrator'],
  ['general_civil',      '../services/agents/GeneralCivilOrchestrator'],
  ['probate',            '../services/agents/ProbateOrchestrator'],
]) {
  try {
    matterOrchestrators[matterCode] = require(modulePath);
    logger.info(`MatterOrchestrator loaded: ${matterCode}`);
  } catch (err) {
    logger.warn(`MatterOrchestrator not available for ${matterCode}, will fall back`, { error: err.message });
  }
}

/** The set of matter type codes that have a dedicated orchestrator. */
const ORCHESTRATED_MATTERS = new Set(Object.keys(matterOrchestrators));

/**
 * Return the appropriate matter orchestrator for this document, or null.
 * Routes by affidavitData.matterTypeCode (e.g. 'custody', 'small_claims').
 */
function getMatterOrchestrator(affidavitData) {
  const matterCode = (affidavitData.matterTypeCode || '').toLowerCase();
  if (!matterCode) return null;
  return matterOrchestrators[matterCode] || null;
}

// ─── Divorce orchestrators (one per supported state) ──────────────────────────
// Each is a thin BaseDivorceOrchestrator instance with state-specific prompts.
// Graceful degradation: if any fails to load we fall back to affidavitService.

const divorceOrchestrators = {};

for (const [stateCode, modulePath] of [
  // US states
  ['TX', '../services/agents/TXDivorceOrchestrator'],
  ['AZ', '../services/agents/AZDivorceOrchestrator'],
  ['CA', '../services/agents/CADivorceOrchestrator'],
  ['FL', '../services/agents/FLDivorceOrchestrator'],
  ['IL', '../services/agents/ILDivorceOrchestrator'],
  ['NY', '../services/agents/NYDivorceOrchestrator'],
  ['UT', '../services/agents/UTDivorceOrchestrator'],
  ['CO', '../services/agents/CODivorceOrchestrator'],
  ['GA', '../services/agents/GADivorceOrchestrator'],
  ['MA', '../services/agents/MADivorceOrchestrator'],
  ['MI', '../services/agents/MIDivorceOrchestrator'],
  ['NC', '../services/agents/NCDivorceOrchestrator'],
  ['NJ', '../services/agents/NJDivorceOrchestrator'],
  ['OH', '../services/agents/OHDivorceOrchestrator'],
  ['PA', '../services/agents/PADivorceOrchestrator'],
  ['VA', '../services/agents/VADivorceOrchestrator'],
  ['WA', '../services/agents/WADivorceOrchestrator'],
  // Phase 1 expansion
  ['IN', '../services/agents/INDivorceOrchestrator'],
  ['TN', '../services/agents/TNDivorceOrchestrator'],
  ['MO', '../services/agents/MODivorceOrchestrator'],
  ['MD', '../services/agents/MDDivorceOrchestrator'],
  ['MN', '../services/agents/MNDivorceOrchestrator'],
  ['KY', '../services/agents/KYDivorceOrchestrator'],
  // Phase 2 expansion
  ['WI', '../services/agents/WIDivorceOrchestrator'],
  ['SC', '../services/agents/SCDivorceOrchestrator'],
  ['AL', '../services/agents/ALDivorceOrchestrator'],
  ['OR', '../services/agents/ORDivorceOrchestrator'],
  ['OK', '../services/agents/OKDivorceOrchestrator'],
  // Phase 3 expansion
  ['LA', '../services/agents/LADivorceOrchestrator'],
  ['CT', '../services/agents/CTDivorceOrchestrator'],
  ['NV', '../services/agents/NVDivorceOrchestrator'],
  ['NM', '../services/agents/NMDivorceOrchestrator'],
  ['ID', '../services/agents/IDDivorceOrchestrator'],
  // Phase 4 expansion (remaining US states + DC)
  ['IA', '../services/agents/IADivorceOrchestrator'],
  ['AR', '../services/agents/ARDivorceOrchestrator'],
  ['KS', '../services/agents/KSDivorceOrchestrator'],
  ['MS', '../services/agents/MSDivorceOrchestrator'],
  ['NE', '../services/agents/NEDivorceOrchestrator'],
  ['WV', '../services/agents/WVDivorceOrchestrator'],
  ['HI', '../services/agents/HIDivorceOrchestrator'],
  ['ME', '../services/agents/MEDivorceOrchestrator'],
  ['NH', '../services/agents/NHDivorceOrchestrator'],
  ['RI', '../services/agents/RIDivorceOrchestrator'],
  ['MT', '../services/agents/MTDivorceOrchestrator'],
  ['DE', '../services/agents/DEDivorceOrchestrator'],
  ['DC', '../services/agents/DCDivorceOrchestrator'],
  // Phase 5 expansion (final US states)
  ['AK', '../services/agents/AKDivorceOrchestrator'],
  ['ND', '../services/agents/NDDivorceOrchestrator'],
  ['SD', '../services/agents/SDDivorceOrchestrator'],
  ['VT', '../services/agents/VTDivorceOrchestrator'],
  ['WY', '../services/agents/WYDivorceOrchestrator'],
  // Canadian provinces — federal Divorce Act (RSC 1985, c. 3)
  ['ON', '../services/agents/ONDivorceOrchestrator'],
  ['BC', '../services/agents/BCDivorceOrchestrator'],
  ['AB', '../services/agents/ABDivorceOrchestrator'],
  ['QC', '../services/agents/QCDivorceOrchestrator'],
  ['MB', '../services/agents/MBDivorceOrchestrator'],
  ['NB', '../services/agents/NBDivorceOrchestrator'],
  ['NL', '../services/agents/NLDivorceOrchestrator'],
  ['NS', '../services/agents/NSDivorceOrchestrator'],
  ['PE', '../services/agents/PEDivorceOrchestrator'],
  ['SK', '../services/agents/SKDivorceOrchestrator'],
  // Canadian territories — federal Divorce Act (RSC 1985, c. 3)
  ['NT', '../services/agents/NTDivorceOrchestrator'],
  ['YT', '../services/agents/YTDivorceOrchestrator'],
  ['NU', '../services/agents/NUDivorceOrchestrator'],
]) {
  try {
    divorceOrchestrators[stateCode] = require(modulePath);
    logger.info(`DivorceOrchestrator loaded: ${stateCode}`);
  } catch (err) {
    logger.warn(`DivorceOrchestrator not available for ${stateCode}, will fall back`, { error: err.message });
  }
}

/** States that have a phase-based divorce orchestrator. */
const ORCHESTRATED_STATES = new Set(Object.keys(divorceOrchestrators));

/** Jurisdiction-to-country mapping for universal country detection. */
const JURISDICTION_COUNTRY = {
  // Canadian provinces & territories
  ON: 'CA', BC: 'CA', AB: 'CA', QC: 'CA', MB: 'CA', NB: 'CA',
  NL: 'CA', NS: 'CA', PE: 'CA', SK: 'CA',
  // UK
  ENG: 'UK', SCO: 'UK', NIR: 'UK',
  // Ireland
  IRL: 'IE',
  // Australia (suffixed codes to avoid collision with US WA, US IN, CA NT)
  NSW: 'AU', VIC: 'AU', QLD: 'AU', WA_AU: 'AU', SA_AU: 'AU',
  TAS: 'AU', ACT: 'AU', NT_AU: 'AU',
  // New Zealand
  NZ: 'NZ',
  // India (prefixed to avoid collision with US IN, US DE, etc.)
  IN_DL: 'IN', IN_MH: 'IN', IN_KA: 'IN', IN_TN: 'IN', IN_GJ: 'IN',
  IN_UP: 'IN', IN_WB: 'IN', IN_TS: 'IN', IN_RJ: 'IN', IN_KL: 'IN',
  IN_PB: 'IN', IN_HR: 'IN', IN_MP: 'IN', IN_BR: 'IN', IN_OD: 'IN', IN_AP: 'IN',
  // Pakistan
  PK_PB: 'PK', PK_SD: 'PK', PK_KP: 'PK', PK_BA: 'PK', PK_IS: 'PK',
  // Bangladesh & Sri Lanka
  BD: 'BD', LK: 'LK',
  // South Africa
  ZA: 'ZA',
  // Nigeria (suffixed to avoid collision with US LA, etc.)
  LA_NG: 'NG', FC: 'NG', RV: 'NG', CR: 'NG', ED: 'NG', DT: 'NG',
  OY: 'NG', OG: 'NG', AN: 'NG', EN: 'NG', IM: 'NG', AB_NG: 'NG',
  // East/Southern Africa
  KE: 'KE', GH: 'GH', UG: 'UG', TZ: 'TZ', ZM: 'ZM',
  ZW: 'ZW', BW: 'BW', MW: 'MW', NA_NM: 'NA',
  // SE Asia
  SG: 'SG', HK: 'HK', MY: 'MY',
  // Caribbean
  JM: 'JM', TT: 'TT', BB: 'BB', BS: 'BS', BM: 'BM',
  GY: 'GY', BZ: 'BZ', AG: 'AG', DM: 'DM', GD: 'GD', KN: 'KN', VC: 'VC',
  // Pacific
  FJ: 'FJ', PG: 'PG',
  // Mediterranean
  CY: 'CY',
};

/** Subdomain-to-country mapping. */
const SUBDOMAIN_COUNTRY = {
  ca: 'CA', canada: 'CA',
  uk: 'UK', ie: 'IE', au: 'AU', nz: 'NZ',
  in: 'IN', pk: 'PK', bd: 'BD', lk: 'LK',
  sa: 'ZA', ng: 'NG', ke: 'KE', gh: 'GH',
  ug: 'UG', tz: 'TZ', zm: 'ZM', zw: 'ZW', bw: 'BW', mw: 'MW', na: 'NA',
  sg: 'SG', hk: 'HK', my: 'MY',
  jm: 'JM', tt: 'TT', bb: 'BB', bs: 'BS', bm: 'BM',
  gy: 'GY', bz: 'BZ', ag: 'AG', dm: 'DM', gd: 'GD', kn: 'KN', vc: 'VC',
  fj: 'FJ', pg: 'PG', cy: 'CY',
};

/** Default jurisdiction per country (used when state not yet selected). */
const DEFAULT_JURISDICTION = {
  US: 'TX', CA: 'ON', UK: 'ENG', IE: 'IRL', AU: 'NSW', NZ: 'NZ',
  IN: 'IN_DL', PK: 'PK_IS', BD: 'BD', LK: 'LK',
  ZA: 'ZA', NG: 'LA_NG', KE: 'KE', GH: 'GH',
  UG: 'UG', TZ: 'TZ', ZM: 'ZM', ZW: 'ZW', BW: 'BW', MW: 'MW', NA: 'NA_NM',
  SG: 'SG', HK: 'HK', MY: 'MY',
  JM: 'JM', TT: 'TT', BB: 'BB', BS: 'BS', BM: 'BM',
  FJ: 'FJ', PG: 'PG', CY: 'CY',
};

/**
 * Detect the user's country from request origin or affidavitData.
 *
 * Detection order:
 *   1. affidavitData.countryCode (already set by a previous interaction)
 *   2. affidavitData.state is a known jurisdiction code
 *   3. Request origin/referer subdomain (e.g. uk.discover.legal)
 *   4. Default: 'US'
 */
function detectCountry(req, affidavitData) {
  // Allowed country codes when international is disabled
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

  const origin = req.get('origin') || req.get('referer') || '';
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

/**
 * Return the appropriate divorce orchestrator for this document, or null.
 * Returns null if the document type is not a divorce_package, or if no
 * orchestrator is registered for the state.
 *
 * When state is not yet set (INTAKE phase), defaults to:
 *   - ON (Ontario) for Canadian users (detected via subdomain or countryCode)
 *   - TX (Texas) for US users
 * The INTAKE prompt confirms the actual state and updates orchestratorState.stateCode.
 */
function getOrchestrator(affidavitData, req) {
  const docType = (affidavitData.documentType || affidavitData.document_type || '').toLowerCase();
  if (docType !== 'divorce_package') return null;

  const state = (affidavitData.state || '').toUpperCase();

  if (state && ORCHESTRATED_STATES.has(state)) return divorceOrchestrators[state];

  // State not yet set (beginning of INTAKE) — pick country-appropriate default
  if (!state) {
    const country = detectCountry(req, affidavitData);
    const defaultState = DEFAULT_JURISDICTION[country] || 'TX';
    if (divorceOrchestrators[defaultState]) return divorceOrchestrators[defaultState];
  }

  return null; // Unsupported state → fall through to affidavitService
}

/**
 * Return the TriageOrchestrator when no matter type or document type has been
 * established yet and triage has not already completed.
 *
 * Conditions that bypass triage:
 *   - A matterTypeCode is already set
 *   - A documentType (divorce_package, affidavit, etc.) is already set
 *   - Triage already ran and classified (orchestratorState.triageComplete)
 */
function getTriageOrchestrator(affidavitData) {
  if (!triageOrchestrator) return null;

  // Already routed by explicit matter or document type
  const matterCode = (affidavitData.matterTypeCode || '').trim();
  const docType    = (affidavitData.documentType || affidavitData.document_type || affidavitData.affidavitType || '').trim();
  if (matterCode || docType) return null;

  // Triage already completed
  if (affidavitData.orchestratorState?.triageComplete) return null;

  return triageOrchestrator;
}

/**
 * Return the GeneralAffidavitOrchestrator when the document type is a recognized
 * non-divorce affidavit type. Returns null otherwise.
 */
function getGeneralOrchestrator(affidavitData) {
  if (!generalAffidavitOrchestrator) return null;
  const docType = (affidavitData.documentType || affidavitData.document_type || affidavitData.affidavitType || '').toLowerCase();
  if (!docType) return null;
  if (docType === 'divorce_package') return null; // handled by divorce orchestrators
  return GENERAL_AFFIDAVIT_TYPES.has(docType) ? generalAffidavitOrchestrator : null;
}

/**
 * Constants for chat stability
 */
const CHAT_CONSTANTS = {
  MAX_CONVERSATION_TOKENS: 6000, // ~4500 words
  MAX_CONVERSATION_MESSAGES: 20,
  REQUEST_TIMEOUT: 60000, // 60 seconds
  MAX_RETRIES: 2,
  CHUNK_SIZE: 2000 // tokens per chunk
};

/**
 * Helper function to estimate token count (rough approximation)
 */
const estimateTokens = (text) => {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 0.75 words ≈ 4 characters
  return Math.ceil(text.length / 4);
};

/**
 * Helper: normalize a single message to OpenAI { role, content } format.
 * The client sends { type: 'user'|'bot', content } while the backend
 * expects { role: 'user'|'assistant'|'system', content }.
 */
const normalizeMessage = (msg) => {
  if (msg.role) return { role: msg.role, content: msg.content || '' };
  // Client ChatInterface uses `type` instead of `role`
  const role = msg.type === 'user' ? 'user' : 'assistant';
  return { role, content: msg.content || '' };
};

/**
 * Helper function to chunk conversation history when it gets too long.
 * Also normalizes message format from client (type → role).
 */
const chunkConversation = (messages) => {
  if (!Array.isArray(messages)) return [];

  // Normalize all messages to { role, content } first
  const normalized = messages.map(normalizeMessage);

  let totalTokens = 0;
  const chunkedMessages = [];

  // Keep system message if present
  const systemMessage = normalized.find(msg => msg.role === 'system');
  if (systemMessage) {
    chunkedMessages.push(systemMessage);
    totalTokens += estimateTokens(systemMessage.content);
  }

  // Process messages in reverse order (most recent first)
  const userMessages = normalized.filter(msg => msg.role !== 'system').reverse();

  for (const message of userMessages) {
    const messageTokens = estimateTokens(message.content);

    if (totalTokens + messageTokens > CHAT_CONSTANTS.MAX_CONVERSATION_TOKENS) {
      break;
    }

    chunkedMessages.unshift(message);
    totalTokens += messageTokens;

    if (chunkedMessages.length >= CHAT_CONSTANTS.MAX_CONVERSATION_MESSAGES) {
      break;
    }
  }

  return chunkedMessages;
};

/**
 * Helper function to create session context for logging
 */
const createSessionContext = (req) => {
  return {
    sessionId: req.sessionId || req.id,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
};

/**
 * Chat endpoint with comprehensive error handling and stability features
 */
router.post('/',
  // Apply chat-specific timeout (allows headroom for LLM function-calling requests)
  timeout('60s'),

  // Rate limiting specific to chat
  chatLimiter,

  // Authentication
  auth0Middleware,

  // Input validation
  validateChatMessage,

  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const sessionContext = createSessionContext(req);

    try {
      const { message, conversationHistory = [], affidavitData = {}, skipExtraction = false } = req.body;

      // Detect and persist country code (US vs CA) for routing defaults
      if (!affidavitData.countryCode) {
        affidavitData.countryCode = detectCountry(req, affidavitData);
      }

      // Create session ID for this chat if not exists
      req.sessionId = req.sessionId || `chat_${Date.now()}_${req.user.id}`;

      logger.logChat('message_received', req.sessionId, req.user.id, {
        messageLength: message.length,
        messageWords: message.trim().split(/\s+/).length,
        historyLength: conversationHistory.length,
        hasAffidavitData: Object.keys(affidavitData).length > 0
      });

      // Chunk conversation history to prevent token overflow
      const chunkedHistory = chunkConversation(conversationHistory);

      if (chunkedHistory.length !== conversationHistory.length) {
        logger.logChat('conversation_chunked', req.sessionId, req.user.id, {
          originalLength: conversationHistory.length,
          chunkedLength: chunkedHistory.length,
          estimatedTokens: chunkedHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
        });
      }

      // Check if affidavit service is available
      if (!req.app.locals.affidavitService) {
        throw new Error('Affidavit service is not available. Please try again later.');
      }

      // Process message with retry logic
      let result;
      let attempts = 0;

      while (attempts < CHAT_CONSTANTS.MAX_RETRIES) {
        attempts++;

        try {
          // Monitor memory usage before processing
          const memBefore = process.memoryUsage();

          const triageOrch          = getTriageOrchestrator(affidavitData);
          const divorceOrchestrator = !triageOrch ? getOrchestrator(affidavitData, req) : null;
          const matterOrchestrator  = !triageOrch && !divorceOrchestrator ? getMatterOrchestrator(affidavitData) : null;
          const generalOrchestrator = !triageOrch && !divorceOrchestrator && !matterOrchestrator ? getGeneralOrchestrator(affidavitData) : null;

          if (triageOrch) {
            // No matter type known yet — triage to figure out what the person needs
            logger.info('Routing to TriageOrchestrator', { sessionId: req.sessionId });
            const orchResult = await triageOrch.processMessage(
              message,
              chunkedHistory,
              affidavitData,
              req.user.id,
              req.sessionId
            );
            result = {
              response:      orchResult.response,
              affidavitData: orchResult.affidavitData,
              newFacts:      orchResult.newFacts || []
            };
          } else if (divorceOrchestrator) {
            // Divorce package: route to the state-specific phase-based orchestrator
            const defaultState = affidavitData.countryCode === 'CA' ? 'ON' : 'TX';
            const state = (affidavitData.state || defaultState).toUpperCase();
            logger.info('Routing to DivorceOrchestrator', {
              state,
              phase: affidavitData.orchestratorState?.currentPhase || 'INTAKE',
              sessionId: req.sessionId
            });
            const orchResult = await divorceOrchestrator.processMessage(
              message,
              chunkedHistory,
              affidavitData,
              req.user.id,
              req.sessionId
            );
            result = {
              response: orchResult.response,
              affidavitData: orchResult.affidavitData,
              newFacts: orchResult.newFacts || []
            };
          } else if (matterOrchestrator) {
            // Matter type with a dedicated orchestrator (custody, small_claims, etc.)
            const matterCode = affidavitData.matterTypeCode;
            logger.info('Routing to MatterOrchestrator', {
              matterCode,
              phase: affidavitData.orchestratorState?.currentPhase || 'INTAKE',
              sessionId: req.sessionId
            });
            const orchResult = await matterOrchestrator.processMessage(
              message,
              chunkedHistory,
              affidavitData,
              req.user.id,
              req.sessionId
            );
            result = {
              response: orchResult.response,
              affidavitData: orchResult.affidavitData,
              newFacts: orchResult.newFacts || []
            };
          } else if (generalOrchestrator) {
            // Recognized non-divorce affidavit type: route to GeneralAffidavitOrchestrator
            const docType = affidavitData.documentType || affidavitData.affidavitType || '';
            logger.info('Routing to GeneralAffidavitOrchestrator', {
              docType,
              phase: affidavitData.orchestratorState?.currentPhase || 'CLASSIFY',
              sessionId: req.sessionId
            });
            const orchResult = await generalOrchestrator.processMessage(
              message,
              chunkedHistory,
              affidavitData,
              req.user.id,
              req.sessionId
            );
            result = {
              response: orchResult.response,
              affidavitData: orchResult.affidavitData,
              newFacts: orchResult.newFacts || []
            };
          } else {
            // Unrecognized type or no type set: use legacy affidavitService
            result = await req.app.locals.affidavitService.processMessage(
              message,
              chunkedHistory,
              affidavitData,
              req.user.id,
              req.sessionId,
              skipExtraction
            );
          }

          // Monitor memory usage after processing
          const memAfter = process.memoryUsage();
          const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;

          if (memoryDelta > 50 * 1024 * 1024) { // 50MB increase
            logger.logPerformance('high_memory_usage_chat', memoryDelta, {
              sessionId: req.sessionId,
              userId: req.user.id,
              messageLength: message.length
            });
          }

          break; // Success, exit retry loop

        } catch (error) {
          logger.logError(error, {
            type: 'chat_processing_error',
            attempt: attempts,
            sessionId: req.sessionId,
            userId: req.user.id,
            messageLength: message.length
          }, req.id);

          // If it's the last attempt or a non-retryable error, throw
          if (attempts >= CHAT_CONSTANTS.MAX_RETRIES ||
              error.statusCode === 400 ||
              error.statusCode === 401 ||
              error.statusCode === 403) {
            throw error;
          }

          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Handle both orchestrator format { response } and legacy format { chatResponse }
      if (result && !result.response && result.chatResponse) {
        result.response = result.chatResponse;
      }

      // If the service returned a structured error (success: false), surface its message
      if (result && result.success === false) {
        result.response = result.response || result.chatResponse || result.error ||
          'Sorry, I encountered an error processing your message. Please try again.';
      }

      if (!result || !result.response) {
        throw new Error('No response received from AI service');
      }

      const processingTime = Date.now() - startTime;

      logger.logChat('message_processed', req.sessionId, req.user.id, {
        processingTime,
        attempts,
        responseLength: result.response?.length || 0,
        hasNewFacts: result.newFacts?.length > 0,
        affidavitUpdated: !!result.affidavitData
      });

      // Warn about slow responses
      if (processingTime > 10000) { // 10 seconds
        logger.warn('Slow chat response', {
          processingTime,
          sessionId: req.sessionId,
          userId: req.user.id,
          messageLength: message.length
        });
      }

      res.json({
        success: true,
        response: result.response,
        affidavitData: result.affidavitData || affidavitData,
        newFacts: result.newFacts || [],
        orchestratorState: (result.affidavitData || affidavitData).orchestratorState || null,
        processingTime,
        sessionId: req.sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Enhanced error logging for chat failures
      logger.logError(error, {
        type: 'chat_endpoint_error',
        sessionId: req.sessionId,
        userId: req.user.id,
        processingTime,
        messageLength: req.body.message?.length || 0,
        historyLength: req.body.conversationHistory?.length || 0,
        ...sessionContext
      }, req.id);

      // Provide user-friendly error messages
      let userMessage = 'Sorry, I encountered an error processing your message. Please try again.';

      if (error.message?.includes('timeout')) {
        userMessage = 'Your request timed out. Please try sending a shorter message or try again.';
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        userMessage = 'The AI service is currently busy. Please wait a moment and try again.';
      } else if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        userMessage = 'There\'s a temporary service issue. Please try again in a few minutes.';
      }

      // Re-throw with user-friendly message
      const enhancedError = new Error(userMessage);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.statusCode || 500;
      enhancedError.errorType = 'chat_error';

      throw enhancedError;
    }
  })
);

/**
 * Get chat session info
 * SECURITY (MED-01): Added session ownership verification
 * SECURITY (HIGH-03): Added rate limiting
 */
router.get('/session/:sessionId',
  chatLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    // SECURITY: Validate session ID format and ownership
    // Session IDs are formatted as: chat_{timestamp}_{userId}
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    // Verify session belongs to this user (session IDs contain user ID)
    const expectedSuffix = `_${req.user.id}`;
    if (!sessionId.endsWith(expectedSuffix) && !sessionId.includes(`_${req.user.id}_`)) {
      logger.logSecurity('session_ownership_violation', {
        sessionId: sessionId.substring(0, 50),
        userId: req.user.id
      });
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.sendSuccess({
      sessionId,
      userId: req.user.id,
      status: 'active',
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * Clear chat session (reset conversation)
 * SECURITY (MED-01): Added session ownership verification
 * SECURITY (HIGH-03): Added rate limiting
 */
router.delete('/session/:sessionId',
  chatLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    // SECURITY: Validate session ID format and ownership
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    // Verify session belongs to this user
    const expectedSuffix = `_${req.user.id}`;
    if (!sessionId.endsWith(expectedSuffix) && !sessionId.includes(`_${req.user.id}_`)) {
      logger.logSecurity('session_delete_ownership_violation', {
        sessionId: sessionId.substring(0, 50),
        userId: req.user.id
      });
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    logger.logChat('session_cleared', sessionId, req.user.id);

    res.sendSuccess({
      message: 'Chat session cleared successfully',
      sessionId
    });
  })
);

/**
 * Get chat metrics (for monitoring/debugging)
 * SECURITY (MED-13): Removed sensitive system info, added rate limiting
 */
router.get('/metrics',
  chatLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    // SECURITY: Only return non-sensitive configuration, not system metrics
    const metrics = {
      limits: {
        maxConversationMessages: CHAT_CONSTANTS.MAX_CONVERSATION_MESSAGES,
        requestTimeout: CHAT_CONSTANTS.REQUEST_TIMEOUT
      },
      timestamp: new Date().toISOString()
    };

    res.sendSuccess(metrics);
  })
);

module.exports = router;