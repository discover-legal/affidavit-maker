// affidavitService.js - Enhanced implementation with proper OpenAI handling
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
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
          content: 'You are a helpful assistant for creating legal affidavits. Extract relevant information from user messages and provide helpful responses. Keep responses professional and helpful.'
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

      // Call OpenAI with properly formatted messages
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: 0.3,
        max_tokens: 1000
      });

      const response = completion.choices[0].message.content;

      // Basic fact extraction (you can enhance this)
      const updatedAffidavitData = { ...affidavitData };
      
      // Simple pattern matching for common information
      const lowerMessage = message.toLowerCase();
      
      // Extract name
      const namePatterns = [
        /my name is ([^,.\n]+)/i,
        /i am ([^,.\n]+)/i,
        /i'm ([^,.\n]+)/i,
        /^([a-z]+ [a-z]+)/i // First two words if they look like a name
      ];
      
      for (const pattern of namePatterns) {
        const nameMatch = message.match(pattern);
        if (nameMatch && !updatedAffidavitData.affiantName) {
          updatedAffidavitData.affiantName = nameMatch[1].trim();
          break;
        }
      }

      // Extract state
      if (lowerMessage.includes('texas') || lowerMessage.includes(' tx ') || lowerMessage.includes('tx,')) {
        updatedAffidavitData.state = 'TX';
      } else if (lowerMessage.includes('utah') || lowerMessage.includes(' ut ') || lowerMessage.includes('ut,')) {
        updatedAffidavitData.state = 'UT';
      } else if (lowerMessage.includes('arizona') || lowerMessage.includes(' az ') || lowerMessage.includes('az,')) {
        updatedAffidavitData.state = 'AZ';
      }

      // Extract case number
      const caseNumberMatch = message.match(/case\s*(?:number|file|#)?\s*:?\s*([a-z0-9\-]+)/i);
      if (caseNumberMatch && !updatedAffidavitData.caseNumber) {
        updatedAffidavitData.caseNumber = caseNumberMatch[1];
      }

      return {
        success: true,
        response: response,
        affidavitData: updatedAffidavitData,
        suggestions: ['Tell me your full name', 'What state is this for?', 'Describe the facts you want to include']
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      
      if (error.status === 429) {
        throw new Error('rate limit');
      }
      
      throw error;
    }
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