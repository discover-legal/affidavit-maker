// affidavitService.js - Complete clean version with enhanced fact extraction
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class AffidavitService {
  constructor() {
    this.openaiAvailable = false;
    this.openai = null;
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('⚠️  OPENAI_API_KEY not found in environment variables');
      logger.warn('💡 AI features will be limited until you add your OpenAI API key');
      return;
    }

    // Try to initialize OpenAI
    try {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.openaiAvailable = true;
      logger.info('✅ OpenAI service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize OpenAI:', error.message);
      logger.warn('💡 Make sure you have installed the openai package: npm install openai');
      this.openaiAvailable = false;
    }
  }

  async processMessage({ message, conversationHistory = [], affidavitData = {}, userId }) {
    logger.info('Processing message', { userId, messageLength: message.length });

    if (!this.openaiAvailable) {
      return {
        success: true,
        response: "I'm currently running in limited mode. Please ensure your OpenAI API key is configured to enable AI features.",
        affidavitData: affidavitData,
        suggestions: ['Configure OpenAI API key', 'Check environment variables']
      };
    }

    try {
      // Properly format messages array for OpenAI
      const messages = [
        {
          role: 'system',
          content: `You are a helpful assistant for creating legal affidavits. Extract relevant information from user messages and update the document in real-time. 

Current document data: ${JSON.stringify(affidavitData)}

Your responses should be conversational and helpful, guiding the user through the process. Do NOT repeat back the entire affidavit content in your response - just have a natural conversation.

When you detect information like names, states, case numbers, or facts, extract them but keep your response conversational.`
        }
      ];

      // Add conversation history (ensure each message has proper role)
      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory) {
          if (msg.type === 'user') {
            messages.push({ role: 'user', content: msg.content });
          } else if (msg.type === 'bot' || msg.type === 'assistant') {
            messages.push({ role: 'assistant', content: msg.content });
          }
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: message
      });

      // Call OpenAI with streaming enabled
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.3,
        max_tokens: 1000,
        stream: true
      });

      let fullResponse = '';
      const updatedAffidavitData = { ...affidavitData };

      // Process streaming response
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
        }
      }

      // Extract information after getting full response
      const lowerMessage = message.toLowerCase();
      
      // Enhanced name extraction with better validation
      if (!updatedAffidavitData.affiantName || updatedAffidavitData.affiantName === 'thats all') {
        const namePatterns = [
          /(?:my name is|i am|i'm)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)+)/i,
          /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
          /(?:name|called)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
        ];
        
        for (const pattern of namePatterns) {
          const nameMatch = message.match(pattern);
          if (nameMatch && nameMatch[1] && nameMatch[1].length > 3) {
            const extractedName = nameMatch[1].trim();
            // Skip obvious non-names
            if (!['thats all', 'that is', 'yes', 'no', 'ok', 'okay'].includes(extractedName.toLowerCase())) {
              updatedAffidavitData.affiantName = extractedName;
              break;
            }
          }
        }
      }

      // Extract state
      if (!updatedAffidavitData.state) {
        if (lowerMessage.includes('texas') || lowerMessage.includes(' tx ') || lowerMessage.includes('tx,')) {
          updatedAffidavitData.state = 'TX';
        } else if (lowerMessage.includes('utah') || lowerMessage.includes(' ut ') || lowerMessage.includes('ut,')) {
          updatedAffidavitData.state = 'UT';
        } else if (lowerMessage.includes('arizona') || lowerMessage.includes(' az ') || lowerMessage.includes('az,')) {
          updatedAffidavitData.state = 'AZ';
        }
      }

      // Extract case number
      if (!updatedAffidavitData.caseNumber) {
        const caseNumberMatch = message.match(/case\s*(?:number|file|#)?\s*:?\s*([a-z0-9\-]+)/i);
        if (caseNumberMatch && caseNumberMatch[1]) {
          updatedAffidavitData.caseNumber = caseNumberMatch[1];
        }
      }

      // Enhanced fact extraction using LLM
      const factResult = await this.extractAndCategorizeFacts(
        message, 
        updatedAffidavitData.facts || []
      );
      
      if (factResult.newFacts.length > 0) {
        updatedAffidavitData.facts = factResult.facts;
        logger.info('New facts extracted', {
          userId,
          newFactsCount: factResult.newFacts.length,
          categories: factResult.newFacts.map(f => f.category)
        });
      }

      return {
        success: true,
        response: fullResponse,
        affidavitData: updatedAffidavitData,
        suggestions: ['Tell me your full name', 'What state is this for?', 'Describe the facts you want to include'],
        stream: false
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      
      if (error.status === 429) {
        throw new Error('rate limit');
      }
      
      throw error;
    }
  }

  // Streaming version for real-time responses
  async processMessageStream({ message, conversationHistory = [], affidavitData = {}, userId }) {
    logger.info('Processing streaming message', { userId, messageLength: message.length });

    if (!this.openaiAvailable) {
      return null;
    }

    try {
      // Properly format messages array for OpenAI
      const messages = [
        {
          role: 'system',
          content: `You are a helpful assistant for creating legal affidavits. Extract relevant information from user messages and update the document in real-time. 

Current document data: ${JSON.stringify(affidavitData)}

Your responses should be conversational and helpful, guiding the user through the process. Do NOT repeat back the entire affidavit content in your response - just have a natural conversation.

When you detect information like names, states, case numbers, or facts, extract them but keep your response conversational.`
        }
      ];

      // Add conversation history
      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory) {
          if (msg.type === 'user') {
            messages.push({ role: 'user', content: msg.content });
          } else if (msg.type === 'bot' || msg.type === 'assistant') {
            messages.push({ role: 'assistant', content: msg.content });
          }
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: message
      });

      // Return streaming response
      return await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.3,
        max_tokens: 1000,
        stream: true
      });

    } catch (error) {
      logger.error('Error in streaming message:', error);
      throw error;
    }
  }

  // Enhanced fact extraction using LLM
  async extractAndCategorizeFacts(message, existingFacts = []) {
    if (!this.openaiAvailable) {
      return { facts: existingFacts, newFacts: [] };
    }

    try {
      const prompt = `Analyze this message and extract any legal facts that would be relevant for an affidavit. 

Message: "${message}"

Existing facts: ${JSON.stringify(existingFacts)}

Extract ONLY new, distinct legal facts. Clean up grammar/spelling and categorize each fact.

Categories:
- financial: Money, assets, income, expenses, debts
- behavioral: Actions, conduct, behavior patterns  
- temporal: Dates, times, sequences of events
- relational: Relationships, custody, visitation
- property: Real estate, personal property, vehicles
- communication: Conversations, texts, emails, calls
- witness: What someone saw, heard, or observed
- general: Other relevant facts

Return JSON format:
{
  "newFacts": [
    {
      "content": "cleaned and grammatically correct fact statement", 
      "category": "category_name",
      "relevance": "high|medium|low"
    }
  ]
}

If no new legal facts found, return empty newFacts array.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return {
        facts: [...existingFacts, ...result.newFacts],
        newFacts: result.newFacts
      };

    } catch (error) {
      logger.error('Error extracting facts:', error);
      // Fallback to simple extraction
      return this.extractFactsSimple(message, existingFacts);
    }
  }

  // Fallback simple fact extraction
  extractFactsSimple(message, existingFacts = []) {
    const lowerMessage = message.toLowerCase();
    
    // Check if message contains factual content
    if (message.length > 20 && !lowerMessage.includes('my name') && !lowerMessage.includes('case number')) {
      const factIndicators = ['because', 'saw', 'witnessed', 'happened', 'incident', 'divorce', 'custody'];
      if (factIndicators.some(indicator => lowerMessage.includes(indicator))) {
        // Simple categorization based on keywords
        let category = 'general';
        if (lowerMessage.includes('money') || lowerMessage.includes('paid') || lowerMessage.includes('$')) category = 'financial';
        else if (lowerMessage.includes('saw') || lowerMessage.includes('witnessed')) category = 'witness';
        else if (lowerMessage.includes('divorce') || lowerMessage.includes('custody')) category = 'relational';
        else if (lowerMessage.includes('house') || lowerMessage.includes('property')) category = 'property';

        const newFact = {
          content: message.trim(),
          category: category,
          relevance: 'medium'
        };

        // Check for duplicates
        const isDuplicate = existingFacts.some(fact => 
          fact.content && fact.content.toLowerCase() === message.toLowerCase()
        );

        if (!isDuplicate) {
          return {
            facts: [...existingFacts, newFact],
            newFacts: [newFact]
          };
        }
      }
    }

    return { facts: existingFacts, newFacts: [] };
  }

  async generatePreview(affidavitData) {
    logger.info('Generating preview', { state: affidavitData.state });

    try {
      const preview = {
        sections: [
          {
            type: 'header',
            title: 'AFFIDAVIT',
            content: `State of ${this.getStateName(affidavitData.state)}`
          },
          {
            type: 'introduction',
            title: 'Introduction',
            content: `I, ${affidavitData.affiantName || '[Name]'}, being of legal age and competent to testify, do hereby swear and affirm under penalty of perjury that the following statements are true and correct to the best of my knowledge:`
          },
          {
            type: 'facts',
            title: 'Statement of Facts',
            content: affidavitData.facts || ['[Facts will be listed here]']
          },
          {
            type: 'signature',
            title: 'Signature',
            content: 'Signed under penalty of perjury.'
          },
          {
            type: 'notary',
            title: 'Notarization',
            content: 'Notary acknowledgment section'
          }
        ]
      };

      const validation = this.validateAffidavit(affidavitData);

      return {
        success: true,
        preview: preview,
        validation: validation,
        metadata: {
          state: affidavitData.state,
          stateName: this.getStateName(affidavitData.state),
          estimatedPages: 1
        }
      };

    } catch (error) {
      logger.error('Error generating preview:', error);
      return {
        success: false,
        error: 'Preview generation failed'
      };
    }
  }

  validateAffidavit(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.affiantName) {
      errors.push('Affiant name is required');
    }

    if (!affidavitData.state) {
      errors.push('State is required');
    }

    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts have been provided yet');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      completionPercentage: this.calculateCompletionPercentage(affidavitData)
    };
  }

  calculateCompletionPercentage(affidavitData) {
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : true);
    });
    
    return Math.round((completedFields.length / requiredFields.length) * 100);
  }

  getStateName(stateCode) {
    const stateNames = {
      'TX': 'Texas',
      'UT': 'Utah',
      'AZ': 'Arizona'
    };
    return stateNames[stateCode] || stateCode;
  }

  async generateFinalDocument(affidavitData, options = {}) {
    logger.info('Generating final document', { 
      userId: options.userId,
      documentId: options.documentId 
    });

    // This would integrate with your PDF service
    // For now, return a mock response
    return {
      success: true,
      documentUrl: '/api/download/mock-document.pdf',
      downloadToken: 'mock-token-' + Date.now()
    };
  }
}

module.exports = AffidavitService;