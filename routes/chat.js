// routes/chat.js
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
      logger.warn('Validation failed during chat:', { error: validationError.message, userId: user.id });
    }
  }

  // Get template requirements
  let requirements = {};
  if (currentData?.state && affidavitService.templateManager) {
    try {
      const template = affidavitService.templateManager.getTemplate(currentData.state);
      requirements = template ? template.getRequirements() : {};
    } catch (templateError) {
      logger.warn('Template retrieval failed:', { error: templateError.message });
    }
  }

  // Build AI prompt
  const systemPrompt = `You are a legal document assistant. Your goal is to guide the user in creating a state-compliant affidavit. Always respond with a JSON object with the keys: "response", "extractedData", "conversationComplete", and "nextSteps".
  
  Current State: ${currentData?.state || 'Not selected'}
  Template Requirements: ${JSON.stringify(requirements)}
  Current Data: ${JSON.stringify(currentData)}
  Validation: ${validation ? JSON.stringify(validation) : 'Not validated'}
  
  When all required information for the selected state is gathered and validation is successful, set "conversationComplete" to true in your JSON response and make your "response" text a clear call to action, guiding the user to the preview panel to download their completed document. For example: "Great, I have everything I need to prepare your affidavit! You can now review the final document in the preview panel and proceed to finalize and download the official PDF."`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: "user", content: message }
  ];

  // --- CORRECTED TIMEOUT LOGIC ---
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('The request to the AI service timed out.')), 30000)
  );

  try {
    if (!affidavitService.openai) {
      throw new ExternalServiceError('AI service not configured', 'openai');
    }

    const apiCallPromise = affidavitService.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    // Race the API call against our timeout
    const completion = await Promise.race([apiCallPromise, timeoutPromise]);

    let aiResponse;
    try {
      const content = completion.choices[0].message.content;
      aiResponse = JSON.parse(content);
    } catch (parseError) {
      logger.warn('AI response parsing failed, using fallback:', { error: parseError.message, requestId: req.id });
      aiResponse = {
        response: completion.choices[0].message.content || "I'm sorry, I received an unusual response. Could you try rephrasing?",
        extractedData: {},
        conversationComplete: false,
        nextSteps: []
      };
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, 'chat_interaction', 'conversation', documentId, req.ip, req.get('user-agent'), JSON.stringify({ requestId: req.id })]
    );

    const duration = Date.now() - startTime;
    monitoringService.trackRequest('/api/chat', 'POST', 200, duration);
    
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
    const duration = Date.now() - startTime;
    monitoringService.trackRequest('/api/chat', 'POST', 500, duration);
    monitoringService.trackError(error, { endpoint: '/api/chat', userId: user.id, requestId: req.id });
    
    if (error.response?.status === 429) {
      throw new ExternalServiceError('AI service is currently busy. Please try again in a moment.', 'openai');
    }
    
    // Re-throw other errors to be handled by the main error middleware
    throw error;
  }
}));

module.exports = router;