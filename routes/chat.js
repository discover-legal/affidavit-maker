// routes/chat.js - Chat Routes with Stability Fixes and Debug Logging
const express = require('express');
const router = express.Router();
const timeout = require('connect-timeout');

const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { validateChatMessage } = require('../middleware/validation');
const { chatLimiter } = require('../middleware/rateLimiting');

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

// ─── Divorce orchestrators (one per supported state) ──────────────────────────
// Each is a thin BaseDivorceOrchestrator instance with state-specific prompts.
// Graceful degradation: if any fails to load we fall back to affidavitService.

const divorceOrchestrators = {};

for (const [stateCode, modulePath] of [
  ['TX', '../services/agents/TXDivorceOrchestrator'],
  ['AZ', '../services/agents/AZDivorceOrchestrator'],
  ['CA', '../services/agents/CADivorceOrchestrator'],
  ['FL', '../services/agents/FLDivorceOrchestrator'],
  ['IL', '../services/agents/ILDivorceOrchestrator'],
  ['NY', '../services/agents/NYDivorceOrchestrator'],
  ['UT', '../services/agents/UTDivorceOrchestrator'],
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

/**
 * Return the appropriate divorce orchestrator for this document, or null.
 * Returns null if the document type is not a divorce_package, or if no
 * orchestrator is registered for the state.
 *
 * When state is not yet set (INTAKE phase), we default to TX — the INTAKE
 * prompt confirms the state and the orchestratorState.stateCode is set when
 * the user confirms their state.
 */
function getOrchestrator(affidavitData) {
  const docType = (affidavitData.documentType || affidavitData.document_type || '').toLowerCase();
  if (docType !== 'divorce_package') return null;

  const state = (affidavitData.state || '').toUpperCase();

  if (state && ORCHESTRATED_STATES.has(state)) return divorceOrchestrators[state];

  // State not yet set (beginning of INTAKE) — use TX as initial entry point
  if (!state && divorceOrchestrators['TX']) return divorceOrchestrators['TX'];

  return null; // Unsupported state → fall through to affidavitService
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

          const divorceOrchestrator = getOrchestrator(affidavitData);
          const generalOrchestrator = !divorceOrchestrator ? getGeneralOrchestrator(affidavitData) : null;

          if (divorceOrchestrator) {
            // Divorce package: route to the state-specific phase-based orchestrator
            const state = (affidavitData.state || 'TX').toUpperCase();
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