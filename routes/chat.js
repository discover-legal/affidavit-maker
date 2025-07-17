// routes/chat.js - Chat routes with proper error handling
const express = require('express');
const router = express.Router();
const { validationRules, validate } = require('../middleware/securityMiddleware');
const { asyncHandler, ExternalServiceError } = require('../middleware/errorMiddleware');
const logger = require('../services/logger');
const monitoringService = require('../services/monitoringService');

// Rate limiting specific to chat
const chatRateLimit = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many chat requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(chatRateLimit);

// Chat endpoint with OpenAI integration
router.post('/', validationRules.chat, validate, asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { message, conversationHistory, currentData, documentId } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;
  const affidavitService = req.app.locals.affidavitService;

  if (!message || !message.trim()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Message is required',
      requestId: req.id 
    });
  }

  // Validate current data if state is selected
  let validation = null;
  if (currentData?.state) {
    try {
      validation = affidavitService.validateAffidavitData(currentData, currentData.state);
    } catch (validationError) {
      logger.warn('Validation failed during chat:', {
        error: validationError.message,
        state: currentData.state,
        userId: user.id,
        requestId: req.id
      });
      // Continue without validation
    }
  }

  // Get template requirements
  let template = null;
  let requirements = {};
  
  if (currentData?.state && affidavitService.templateManager) {
    try {
      template = affidavitService.templateManager.getTemplate(currentData.state);
      requirements = template ? template.getRequirements() : {};
    } catch (templateError) {
      logger.warn('Template retrieval failed:', {
        error: templateError.message,
        state: currentData.state,
        requestId: req.id
      });
    }
  }

  // Build AI prompt with template context
  const systemPrompt = `You are a legal document assistant helping create affidavits. You have access to state-specific templates and requirements.

IMPORTANT: You MUST NOT provide legal advice. You can only provide information about the document creation process and gather facts. Always remind users to consult with an attorney for legal advice.

Current State: ${currentData?.state || 'Not selected'}
Document Type: ${currentData?.documentType || 'general'}
Template Requirements: ${JSON.stringify(requirements)}
Current Data: ${JSON.stringify(currentData)}
Validation: ${validation ? JSON.stringify(validation) : 'Not validated'}

Guide the user through collecting all necessary information for their ${currentData?.state || 'state'} affidavit. Focus on:
1. Required information for their state
2. Completeness of facts
3. Legal sufficiency
4. Proper formatting requirements

Always respond with a JSON object containing:
- response: Your helpful message to the user
- extractedData: Any new data to extract from their message
- conversationComplete: boolean indicating if enough info is collected
- nextSteps: array of suggested next steps

Be conversational but professional. Ask for one piece of information at a time. If asked for legal advice, politely explain that you can only help with document preparation, not legal guidance.`;

  // Prepare messages for AI
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: "user", content: message }
  ];

  // Add request timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    // Check if OpenAI is configured
    if (!affidavitService.openai) {
      throw new ExternalServiceError('AI service not configured', 'openai');
    }

    const completion = await affidavitService.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      signal: controller.signal
    });

    clearTimeout(timeout);

    let aiResponse;
    try {
      const content = completion.choices[0].message.content;
      
      // Try to parse as JSON
      if (content.trim().startsWith('{')) {
        aiResponse = JSON.parse(content);
      } else {
        // Fallback if response is not JSON
        aiResponse = {
          response: content,
          extractedData: {},
          conversationComplete: false,
          nextSteps: []
        };
      }
    } catch (parseError) {
      logger.warn('AI response parsing failed, using fallback:', {
        error: parseError.message,
        requestId: req.id
      });
      
      aiResponse = {
        response: completion.choices[0].message.content,
        extractedData: {},
        conversationComplete: false,
        nextSteps: []
      };
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'chat_interaction',
        'conversation',
        documentId,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ 
          requestId: req.id,
          messageLength: message.length,
          responseLength: aiResponse.response.length
        })
      ]
    );

    // Track metrics
    const duration = Date.now() - startTime;
    monitoringService.trackRequest('/api/chat', 'POST', 200, duration);
    
    // Log AI interaction
    logger.info('Chat interaction completed', {
      userId: user.id,
      documentId,
      duration: `${duration}ms`,
      hasExtractedData: !!aiResponse.extractedData && Object.keys(aiResponse.extractedData).length > 0,
      conversationComplete: aiResponse.conversationComplete,
      requestId: req.id
    });

    res.json({
      success: true,
      response: aiResponse.response,
      extractedData: aiResponse.extractedData || {},
      conversationComplete: aiResponse.conversationComplete || false,
      nextSteps: aiResponse.nextSteps || [],
      validation: validation,
      stateRequirements: requirements,
      requestId: req.id
    });

  } catch (error) {
    clearTimeout(timeout);
    
    const duration = Date.now() - startTime;
    monitoringService.trackRequest('/api/chat', 'POST', 500, duration);
    monitoringService.trackError(error, {
      endpoint: '/api/chat',
      userId: user.id,
      requestId: req.id
    });
    
    if (error.name === 'AbortError') {
      throw new ExternalServiceError('Request timed out. Please try again.', 'openai');
    }
    
    if (error.response?.status === 429) {
      throw new ExternalServiceError('AI service is currently busy. Please try again in a moment.', 'openai');
    }
    
    if (error.response?.status === 401) {
      logger.error('OpenAI authentication failed', {
        error: error.message,
        requestId: req.id
      });
      throw new ExternalServiceError('AI service configuration error', 'openai');
    }
    
    // For any other OpenAI errors
    if (error.response?.status || error.isAxiosError) {
      throw new ExternalServiceError('AI service temporarily unavailable', 'openai');
    }
    
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
}));

module.exports = router;