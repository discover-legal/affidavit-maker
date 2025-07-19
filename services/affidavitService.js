// affidavitService.js - Complete drop-in file with LLM name extraction
const OpenAI = require('openai');
const logger = require('./logger');

class AffidavitService {
  constructor() {
    this.openai = null;
    this.openaiAvailable = false;
    this.stateTemplates = new Map();
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        this.openaiAvailable = true;
        logger.info('OpenAI service initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize OpenAI:', error);
        this.openaiAvailable = false;
      }
    } else {
      logger.warn('OPENAI_API_KEY not found - AI features will be disabled');
    }

    // Initialize state templates
    this.initializeStateTemplates();
  }

  initializeStateTemplates() {
    // Basic state configurations
    this.stateTemplates.set('TX', {
      name: 'Texas',
      requirements: {
        venue: true,
        countyRequired: true,
        notaryRequired: true
      }
    });
    
    this.stateTemplates.set('UT', {
      name: 'Utah',
      requirements: {
        venue: true,
        countyRequired: true,
        notaryRequired: true
      }
    });
    
    this.stateTemplates.set('AZ', {
      name: 'Arizona',
      requirements: {
        venue: false,
        countyRequired: false,
        notaryRequired: true
      }
    });
  }

  // LLM-powered name extraction
  async extractNameFromMessage(message, existingName = null) {
    if (!this.openaiAvailable) {
      return null;
    }

    try {
      const prompt = `Extract the person's full legal name from this message. Return ONLY the name or null if no name is mentioned.

Rules:
- Look for introductions like "My name is...", "I'm...", "I am...", "This is...", "Call me..."
- Extract the FULL name (first and last name minimum)
- Handle nicknames appropriately (if someone says "I'm Mike" but their legal name context suggests "Michael", use the full form when possible)
- Ignore obviously false names or test data
- Return null if no clear name is provided
- Format: First Middle Last (proper capitalization)
- Handle international names appropriately

Current name in document: ${existingName || 'none'}

Message: "${message}"

Examples:
Input: "My name is john doe" → Output: John Doe
Input: "I'm Sarah Johnson" → Output: Sarah Johnson  
Input: "This is Mike Jones speaking" → Output: Mike Jones
Input: "Call me Dr. Patricia Williams" → Output: Patricia Williams
Input: "Hi there, I need help" → Output: null
Input: "My name is test test" → Output: null
Input: "I am the defendant" → Output: null

Output (name only or null):`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system', 
            content: 'You are a precise name extraction tool. Only return the extracted name or null. No explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 50
      });

      const extractedName = response.choices[0]?.message?.content?.trim();
      
      if (extractedName && 
          extractedName.toLowerCase() !== 'null' && 
          extractedName.length > 2 && 
          extractedName.includes(' ') && // Must have at least first and last name
          !/^(test|example|sample|demo|null|none|unknown)(\s|$)/i.test(extractedName)) {
        
        logger.info('Name extracted via LLM', {
          message: message.substring(0, 100),
          extractedName,
          existingName
        });
        
        return extractedName;
      }

      return null;

    } catch (error) {
      logger.warn('LLM name extraction failed:', error.message);
      return null;
    }
  }

  // LLM-powered state extraction
  async extractStateFromMessage(message, existingState = null) {
    if (!this.openaiAvailable) {
      return null;
    }

    try {
      const prompt = `Extract the US state from this message. Return only the 2-letter state code or null.

Supported states: Texas (TX), Utah (UT), Arizona (AZ)

Current state: ${existingState || 'none'}

Message: "${message}"

Examples:
"I live in Texas" → TX
"This is for Utah" → UT  
"Arizona case" → AZ
"I'm in Dallas" → TX
"Salt Lake City" → UT
"Phoenix court" → AZ
"California" → null (not supported)
"No state mentioned" → null

Output (TX, UT, AZ, or null):`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Extract state codes. Only return TX, UT, AZ, or null. No explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      const extractedState = response.choices[0]?.message?.content?.trim()?.toUpperCase();
      
      if (['TX', 'UT', 'AZ'].includes(extractedState)) {
        logger.info('State extracted via LLM', {
          message: message.substring(0, 100),
          extractedState,
          existingState
        });
        return extractedState;
      }

      return null;

    } catch (error) {
      logger.warn('LLM state extraction failed:', error.message);
      return null;
    }
  }

  // Process message with streaming support
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

Categories: financial, behavioral, temporal, relational, property, communication, witness, general

Return JSON format:
{
  "facts": [
    {
      "content": "cleaned fact statement",
      "category": "category_name",
      "confidence": 0.8
    }
  ]
}

Only extract factual statements, not questions or casual conversation.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Extract legal facts from messages. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      });

      const result = response.choices[0]?.message?.content?.trim();
      if (result) {
        try {
          const parsed = JSON.parse(result);
          if (parsed.facts && Array.isArray(parsed.facts)) {
            const newFacts = parsed.facts.filter(fact => {
              // Check for duplicates
              const isDuplicate = existingFacts.some(existing => 
                existing.content && fact.content && 
                existing.content.toLowerCase() === fact.content.toLowerCase()
              );
              return !isDuplicate && fact.content && fact.content.length > 10;
            });

            if (newFacts.length > 0) {
              return {
                facts: [...existingFacts, ...newFacts],
                newFacts: newFacts
              };
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse fact extraction result:', parseError);
        }
      }
    } catch (error) {
      logger.warn('Fact extraction failed:', error.message);
    }

    return { facts: existingFacts, newFacts: [] };
  }

  // Generate preview with proper formatting
  async generatePreview(affidavitData) {
    logger.info('Generating preview', { 
      state: affidavitData.state,
      factsCount: affidavitData.facts?.length || 0 
    });

    try {
      // Format facts properly for the frontend
      let formattedFacts = [];
      if (affidavitData.facts && Array.isArray(affidavitData.facts) && affidavitData.facts.length > 0) {
        formattedFacts = affidavitData.facts.map((fact, index) => {
          if (typeof fact === 'string') {
            return {
              number: index + 1,
              content: fact,
              category: 'general'
            };
          } else if (fact && typeof fact === 'object') {
            return {
              number: index + 1,
              content: fact.content || fact.text || String(fact),
              category: fact.category || 'general'
            };
          } else {
            return {
              number: index + 1,
              content: String(fact),
              category: 'general'
            };
          }
        });
      }

      const stateName = this.getStateName(affidavitData.state);
      
      const preview = {
        sections: {
          header: {
            type: 'header',
            title: 'AFFIDAVIT',
            content: affidavitData.state ? `State of ${stateName}` : 'State of [STATE]'
          },
          title: 'AFFIDAVIT',
          introduction: `I, ${affidavitData.affiantName || '[Name]'}, being of legal age and competent to testify, do hereby swear and affirm under penalty of perjury that the following statements are true and correct to the best of my knowledge:`,
          facts: formattedFacts, // This should be an array of objects with number and content
          conclusion: 'I declare under penalty of perjury that the foregoing is true and correct.',
          perjuryStatement: 'Executed under penalty of perjury under the laws of the State of ' + (stateName || '[STATE]') + '.',
          signature: {
            type: 'signature',
            affiantName: affidavitData.affiantName || '[Name]',
            date: new Date().toLocaleDateString()
          },
          notary: {
            type: 'notary',
            content: 'Notary acknowledgment section'
          }
        }
      };

      const validation = this.validateAffidavit(affidavitData);

      logger.info('Preview generated successfully', {
        factsCount: formattedFacts.length,
        hasName: !!affidavitData.affiantName,
        hasState: !!affidavitData.state
      });

      return {
        success: true,
        preview: preview,
        validation: validation,
        metadata: {
          state: affidavitData.state,
          stateName: stateName,
          estimatedPages: Math.ceil((formattedFacts.length * 50 + 500) / 1000) // Rough estimate
        }
      };

    } catch (error) {
      logger.error('Error generating preview:', error);
      return {
        success: false,
        error: 'Preview generation failed',
        preview: null
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
    const template = this.stateTemplates.get(stateCode);
    return template ? template.name : stateCode;
  }

  getSupportedStates() {
    return Array.from(this.stateTemplates.entries()).map(([code, template]) => ({
      code,
      name: template.name,
      requirements: template.requirements
    }));
  }

  getSupportedDocumentTypes() {
    return ['general', 'divorce', 'custody', 'financial', 'property', 'identity'];
  }
}

module.exports = AffidavitService;