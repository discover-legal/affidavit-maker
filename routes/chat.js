// routes/chat.js - Fixed streaming chat endpoint
const express = require('express');
const router = express.Router();
const { validationRules, validate } = require('../middleware/securityMiddleware');
const { asyncHandler, ExternalServiceError } = require('../middleware/errorMiddleware');
const logger = require('../services/logger');

// Chat endpoint with proper SSE streaming
router.post('/', validationRules.chat, validate, asyncHandler(async (req, res) => {
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

  // Set proper SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection confirmation
  res.write('data: {"type":"connected"}\n\n');

  try {
    // Process with streaming
    const result = await affidavitService.processMessageStream({
      message,
      conversationHistory,
      affidavitData: currentData,
      userId: user.id
    });

    if (!result) {
      // Fallback to non-streaming
      const fallbackResult = await affidavitService.processMessage({
        message,
        conversationHistory,
        affidavitData: currentData,
        userId: user.id
      });
      
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        content: fallbackResult.response,
        affidavitData: fallbackResult.affidavitData 
      })}\n\n`);
      res.end();
      return;
    }

    let fullResponse = '';
    const updatedAffidavitData = { ...currentData };

    // Process OpenAI stream
    for await (const chunk of result) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        // Send each token as SSE
        res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
      }
    }

    // Extract data from the full message
    const extractedData = await extractDataFromMessage(message, updatedAffidavitData, affidavitService);
    
    // Send extracted data
    if (extractedData && Object.keys(extractedData).length > 0) {
      Object.assign(updatedAffidavitData, extractedData);
      res.write(`data: ${JSON.stringify({ 
        type: 'data', 
        affidavitData: updatedAffidavitData 
      })}\n\n`);
    }

    // Send completion
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, 'chat_interaction', 'conversation', documentId, req.ip, req.get('user-agent'), 
       JSON.stringify({ requestId: req.id, messageLength: message.length })]
    );

  } catch (error) {
    logger.error('Chat streaming error:', {
      error: error.message,
      userId: user.id,
      requestId: req.id
    });

    // Send error via SSE
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error.message.includes('rate limit') ? 
        'AI service is busy. Please try again in a moment.' : 
        'An error occurred. Please try again.'
    })}\n\n`);
  }

  res.end();
}));

// Enhanced data extraction function
async function extractDataFromMessage(message, currentData, affidavitService) {
  const extractedData = {};
  const lowerMessage = message.toLowerCase();

  // Enhanced name extraction
  if (!currentData.affiantName && !['thats all', 'that is all', 'yes', 'no', 'ok', 'okay'].includes(lowerMessage)) {
    const namePatterns = [
      /(?:my name is|i am|i'm|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s|\.|\,|$)/,
      /(?:call me|known as)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 3) {
        const name = match[1].trim();
        if (name.split(' ').length >= 2) { // Ensure at least first and last name
          extractedData.affiantName = name;
          break;
        }
      }
    }
  }

  // State extraction
  if (!currentData.state) {
    const stateMap = {
      'texas': 'TX', 'tx': 'TX',
      'utah': 'UT', 'ut': 'UT', 
      'arizona': 'AZ', 'az': 'AZ'
    };
    
    for (const [key, value] of Object.entries(stateMap)) {
      if (lowerMessage.includes(key)) {
        extractedData.state = value;
        break;
      }
    }
  }

  // County extraction (improved)
  if (!currentData.county && extractedData.state) {
    const countyPatterns = [
      /(?:in|from|live in)\s+([A-Z][a-z]+)\s+county/i,
      /([A-Z][a-z]+)\s+county/i,
      /county\s+(?:of\s+)?([A-Z][a-z]+)/i
    ];
    
    for (const pattern of countyPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        extractedData.county = match[1];
        break;
      }
    }
  }

  // Case number extraction
  if (!currentData.caseNumber) {
    const casePatterns = [
      /case\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/i,
      /file\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/i,
      /cause\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/i
    ];
    
    for (const pattern of casePatterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        extractedData.caseNumber = match[1].toUpperCase();
        break;
      }
    }
  }

  // Enhanced fact extraction using AI
  if (message.length > 20 && affidavitService.openaiAvailable) {
    try {
      const factResult = await affidavitService.extractAndCategorizeFacts(
        message, 
        currentData.facts || []
      );
      
      if (factResult.newFacts.length > 0) {
        extractedData.facts = factResult.facts;
      }
    } catch (error) {
      logger.warn('AI fact extraction failed, using fallback:', error.message);
      // Fallback fact extraction
      const factKeywords = ['because', 'happened', 'witnessed', 'saw', 'incident', 'divorce', 'custody', 'support'];
      if (factKeywords.some(keyword => lowerMessage.includes(keyword)) && 
          !lowerMessage.includes('my name') && 
          !lowerMessage.includes('case number')) {
        
        const facts = currentData.facts || [];
        facts.push({
          content: message.trim(),
          category: 'general',
          relevance: 'medium'
        });
        extractedData.facts = facts;
      }
    }
  }

  return extractedData;
}

module.exports = router;