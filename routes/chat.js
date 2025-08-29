// routes/chat.js - Chat Routes with Stability Fixes and Debug Logging
const express = require('express');
const router = express.Router();
const timeout = require('connect-timeout');

const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { validateChatMessage } = require('../middleware/validation');
const { chatLimiter } = require('../middleware/rateLimiting');

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
 * Helper function to chunk conversation history when it gets too long
 */
const chunkConversation = (messages) => {
  if (!Array.isArray(messages)) return [];
  
  let totalTokens = 0;
  const chunkedMessages = [];
  
  // Keep system message if present
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (systemMessage) {
    chunkedMessages.push(systemMessage);
    totalTokens += estimateTokens(systemMessage.content);
  }
  
  // Process messages in reverse order (most recent first)
  const userMessages = messages.filter(msg => msg.role !== 'system').reverse();
  
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
  // Debug logging - request received
  (req, res, next) => {
    console.log('🔍 1. Chat request received:', {
      path: req.path,
      method: req.method,
      hasAuth: !!req.headers.authorization,
      bodySize: JSON.stringify(req.body || {}).length,
      timestamp: new Date().toISOString()
    });
    next();
  },

  // Apply chat-specific timeout (shorter than OpenAI timeout)
  timeout('45s'),
  
  // Debug logging - passed timeout
  (req, res, next) => {
    console.log('🔍 2. Passed timeout middleware');
    next();
  },
  
  // Rate limiting specific to chat
  chatLimiter,
  
  // Debug logging - passed rate limiting
  (req, res, next) => {
    console.log('🔍 3. Passed rate limiting');
    next();
  },
  
  // Authentication
  auth0Middleware,
  
  // Debug logging - passed auth
  (req, res, next) => {
    console.log('🔍 4. Passed auth, user:', req.user?.id || 'anonymous', 'email:', req.user?.email || 'none');
    next();
  },
  
  // Input validation
  validateChatMessage,
  
  // Debug logging - passed validation
  (req, res, next) => {
    console.log('🔍 5. Passed validation');
    next();
  },
  
  asyncHandler(async (req, res) => {
    console.log('🔍 6. Reached main handler - starting processing');
    const startTime = Date.now();
    const sessionContext = createSessionContext(req);
    
    console.log('🔍 7. Created session context');
    
    try {
      const { message, conversationHistory = [], affidavitData = {} } = req.body;
      
      console.log('🔍 8. Extracted request data:', {
        messageLength: message?.length || 0,
        historyLength: conversationHistory?.length || 0,
        hasAffidavitData: Object.keys(affidavitData).length > 0
      });
      
      // Create session ID for this chat if not exists
      req.sessionId = req.sessionId || `chat_${Date.now()}_${req.user.id}`;
      
      console.log('🔍 9. Created session ID:', req.sessionId);
      
      logger.logChat('message_received', req.sessionId, req.user.id, {
        messageLength: message.length,
        messageWords: message.trim().split(/\s+/).length,
        historyLength: conversationHistory.length,
        hasAffidavitData: Object.keys(affidavitData).length > 0
      });

      console.log('🔍 10. Logged chat event');

      // Chunk conversation history to prevent token overflow
      const chunkedHistory = chunkConversation(conversationHistory);
      
      console.log('🔍 11. Chunked conversation history');
      
      if (chunkedHistory.length !== conversationHistory.length) {
        logger.logChat('conversation_chunked', req.sessionId, req.user.id, {
          originalLength: conversationHistory.length,
          chunkedLength: chunkedHistory.length,
          estimatedTokens: chunkedHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
        });
      }

      // Check if affidavit service is available
      if (!req.app.locals.affidavitService) {
        console.log('🔍 12. Affidavit service not available');
        throw new Error('Affidavit service is not available. Please try again later.');
      }

      console.log('🔍 13. Affidavit service available, starting processing');

      // Process message with retry logic
      let result;
      let attempts = 0;
      
      while (attempts < CHAT_CONSTANTS.MAX_RETRIES) {
        attempts++;
        
        console.log(`🔍 14. Processing attempt ${attempts}/${CHAT_CONSTANTS.MAX_RETRIES}`);
        
        try {
          // Monitor memory usage before processing
          const memBefore = process.memoryUsage();
          
          console.log('🔍 15. About to call affidavitService.processMessage');
          
          result = await req.app.locals.affidavitService.processMessage(
            message,
            chunkedHistory,
            affidavitData,
            req.user.id,
            req.sessionId
          );
          
          console.log('🔍 16. Received result from affidavitService:', {
            success: result?.success,
            hasResponse: !!result?.response,
            responseLength: result?.response?.length || 0
          });
          
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
          
          console.log('🔍 17. Processing completed successfully');
          break; // Success, exit retry loop
          
        } catch (error) {
          console.log(`🔍 18. Error in attempt ${attempts}:`, error.message);
          
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
            console.log('🔍 19. Final attempt failed or non-retryable error');
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          console.log(`🔍 20. Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!result || !result.response) {
        console.log('🔍 21. No valid result received');
        throw new Error('No response received from AI service');
      }

      const processingTime = Date.now() - startTime;
      
      // Return successful response
      const responseData = {
        response: result.response,
        affidavitData: result.affidavitData || affidavitData,
        newFacts: result.newFacts || [],
        suggestions: result.suggestions || [],
        processingTime,
        sessionId: req.sessionId
      };

      console.log('🔍 22. About to send response to frontend:', {
        processingTime,
        attempts,
        responseLength: result.response?.length || 0,
        responsePreview: result.response?.substring(0, 100) + '...',
        affidavitDataUpdated: !!(result.affidavitData && Object.keys(result.affidavitData).length > 0),
        affidavitData: result.affidavitData,
        newFactsCount: result.newFacts?.length || 0
      });

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
              processingTime,
              sessionId: req.sessionId,
              timestamp: new Date().toISOString()
            });

      console.log('🔍 23. Response sent successfully');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.log('🔍 24. Caught error in main handler:', {
        error: error.message,
        processingTime
      });
      
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

      console.log('🔍 25. About to send error response:', userMessage);

      // Re-throw with user-friendly message
      const enhancedError = new Error(userMessage);
      enhancedError.originalError = error;
      enhancedError.statusCode = error.statusCode || 500;
      enhancedError.errorType = 'chat_error';
      
      throw enhancedError;
    } finally {
      console.log('🔍 26. Chat request completed (success or error)');
    }
  })
);

/**
 * Get chat session info
 */
router.get('/session/:sessionId', 
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    // In a real implementation, you'd fetch from database
    // For now, return basic session info
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
 */
router.delete('/session/:sessionId',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    logger.logChat('session_cleared', sessionId, req.user.id);
    
    // In a real implementation, you'd clear session data from database
    res.sendSuccess({
      message: 'Chat session cleared successfully',
      sessionId
    });
  })
);

/**
 * Get chat metrics (for monitoring/debugging)
 */
router.get('/metrics',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const metrics = {
      constants: CHAT_CONSTANTS,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
    
    res.sendSuccess(metrics);
  })
);

module.exports = router;