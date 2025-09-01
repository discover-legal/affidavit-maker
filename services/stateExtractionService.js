// services/stateExtractionService.js - COMPLETE NEW FILE
const logger = require('./logger');

// Custom error for unsupported states
class UnsupportedStateError extends Error {
  constructor(message, detectedState) {
    super(message);
    this.name = 'UnsupportedStateError';
    this.detectedState = detectedState;
    this.isUnsupportedState = true;
  }
}

class StateExtractionService {
  constructor(openAIService) {
    this.openAIService = openAIService;
    this.coveredStates = ['TX', 'UT', 'AZ'];
    this.stateMap = {
      'TX': 'Texas',
      'UT': 'Utah', 
      'AZ': 'Arizona'
    };
    
    this.extractionCache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * ✅ MAIN METHOD: Extract both state and name from messy input
   * Example: "texas, my name my jones" → {state: "TX", name: "Jones"}
   */
  async extractFromMessage(message, conversationHistory = []) {
    try {
      const cacheKey = this.generateCacheKey(message);
      if (this.extractionCache.has(cacheKey)) {
        return this.extractionCache.get(cacheKey);
      }

      // Multi-layered extraction: LLM → Enhanced Regex → Keyword
      const result = await this.tryMultipleStrategies(message, conversationHistory);
      
      this.cacheResult(cacheKey, result);
      return result;
      
    } catch (error) {
      if (error instanceof UnsupportedStateError) {
        throw error; // Re-throw unsupported state errors
      }
      
      logger.warn('All extraction strategies failed', { error: error.message, message });
      // Return empty result instead of throwing - let chat continue
      return { state: null, name: null, facts: [] };
    }
  }

  async tryMultipleStrategies(message, context) {
    const strategies = [
      () => this.llmStrategy(message, context),
      () => this.regexStrategy(message),
      () => this.keywordStrategy(message)
    ];

    for (const [index, strategy] of strategies.entries()) {
      try {
        const result = await strategy();
        if (result && (result.state || result.name)) {
          result.extractionMethod = ['llm', 'regex', 'keyword'][index];
          return result;
        }
      } catch (error) {
        if (error instanceof UnsupportedStateError) {
          throw error; // Re-throw unsupported state errors
        }
        logger.debug(`Strategy ${index + 1} failed:`, error.message);
        continue;
      }
    }

    return { state: null, name: null, facts: [] };
  }

  /**
   * ✅ LLM Strategy: Robust prompt that doesn't require JSON
   */
  async llmStrategy(message, context) {
    try {
      const prompt = `Analyze this message from someone creating a legal affidavit:
"${message}"

CONTEXT: We only serve Texas (TX), Utah (UT), and Arizona (AZ).

Extract and respond with EXACTLY this format:
STATE: [TX or UT or AZ or NONE or UNSUPPORTED_statename]
NAME: [extracted full name or NONE]

Handle typos, informal language, missing punctuation. Examples:
- "texas, my name my jones" → STATE: TX, NAME: Jones
- "john smith from utah" → STATE: UT, NAME: John Smith  
- "california resident" → STATE: UNSUPPORTED_California, NAME: NONE
- "hello there" → STATE: NONE, NAME: NONE`;

      const completion = await this.openAIService.chat([
        {
          role: 'system',
          content: 'You extract location and name information for legal document preparation. Be precise and follow the format exactly.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        max_tokens: 100,
        temperature: 0.1
        // ✅ NO response_format - avoid JSON parsing issues
      });

      const response = completion.choices[0].message.content.trim();
      return this.parseLLMTextResponse(response);
      
    } catch (error) {
      logger.warn('LLM extraction failed:', error.message);
      throw error; // Let it try next strategy
    }
  }

  /**
   * ✅ Parse LLM text response (not JSON)
   */
  parseLLMTextResponse(response) {
    const result = { state: null, name: null, facts: [] };
    
    try {
      const lines = response.split('\n').map(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('STATE:')) {
          const stateValue = line.replace('STATE:', '').trim();
          
          if (['TX', 'UT', 'AZ'].includes(stateValue)) {
            result.state = stateValue;
          } else if (stateValue.startsWith('UNSUPPORTED_')) {
            const detectedState = stateValue.replace('UNSUPPORTED_', '');
            throw new UnsupportedStateError(
              `We currently only provide affidavit services for Texas, Utah, and Arizona. We detected you mentioned ${detectedState}.`,
              detectedState
            );
          }
        }
        
        if (line.startsWith('NAME:')) {
          const nameValue = line.replace('NAME:', '').trim();
          if (nameValue !== 'NONE' && nameValue.length > 1) {
            result.name = nameValue;
          }
        }
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof UnsupportedStateError) {
        throw error;
      }
      logger.warn('Failed to parse LLM response:', { response, error: error.message });
      throw new Error('LLM response parsing failed');
    }
  }

  /**
   * ✅ Enhanced Regex Strategy: Handles "texas, my name my jones"
   */
  regexStrategy(message) {
    const result = { state: null, name: null, facts: [] };
    const lowerMsg = message.toLowerCase();

    // Enhanced state patterns
    const statePatterns = [
      { regex: /\b(texas|tx|texan)\b/, state: 'TX' },
      { regex: /\b(utah|ut)\b/, state: 'UT' },
      { regex: /\b(arizona|az|ariz)\b/, state: 'AZ' }
    ];

    for (const { regex, state } of statePatterns) {
      if (regex.test(lowerMsg)) {
        result.state = state;
        break;
      }
    }

    // ✅ Enhanced name patterns for messy input like "my name my jones"
    const namePatterns = [
      // "my name my jones", "my name is john", "name my smith" 
      /(?:my )?name(?:\s+(?:is|my))?\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i,
      // "i'm john doe", "i am jane smith"
      /\bi(?:'m|am)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)+)/i,
      // "john smith from texas" (proper case sequence)
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:from|in|at)\b/i,
      // Just proper case names at start
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        const extractedName = match[1].trim();
        // Validate it looks like a real name (not random words)
        if (this.isValidName(extractedName)) {
          result.name = extractedName;
          break;
        }
      }
    }

    // Check for unsupported states
    const unsupportedPatterns = [
      { regex: /\b(california|calif|ca)\b/i, name: 'California' },
      { regex: /\b(florida|fl)\b/i, name: 'Florida' },
      { regex: /\b(new york|ny)\b/i, name: 'New York' },
      { regex: /\b(nevada|nv)\b/i, name: 'Nevada' },
      { regex: /\b(illinois|il)\b/i, name: 'Illinois' },
      { regex: /\b(michigan|mi)\b/i, name: 'Michigan' },
      { regex: /\b(ohio|oh)\b/i, name: 'Ohio' },
      { regex: /\b(georgia|ga)\b/i, name: 'Georgia' }
    ];
    
    for (const { regex, name } of unsupportedPatterns) {
      if (regex.test(lowerMsg)) {
        throw new UnsupportedStateError(
          `We currently only provide affidavit services for Texas, Utah, and Arizona. We detected you mentioned ${name}.`,
          name
        );
      }
    }

    return result;
  }

  /**
   * ✅ Validate extracted name looks real
   */
  isValidName(name) {
    // Filter out common false positives
    const invalidNames = ['texas', 'utah', 'arizona', 'hello', 'help', 'please', 'thank', 'you'];
    const words = name.toLowerCase().split(' ');
    
    // Must be 1-4 words, each word 2+ chars, no invalid words
    return words.length <= 4 && 
           words.every(word => word.length >= 2 && !invalidNames.includes(word)) &&
           name.length <= 50;
  }

  /**
   * ✅ Keyword Strategy: Last resort for basic detection
   */
  keywordStrategy(message) {
    const words = message.toLowerCase().split(/\s+/);
    const result = { state: null, name: null, facts: [] };

    // State detection
    if (words.some(w => ['texas', 'tx', 'texan'].includes(w))) result.state = 'TX';
    else if (words.some(w => ['utah', 'ut'].includes(w))) result.state = 'UT';
    else if (words.some(w => ['arizona', 'az'].includes(w))) result.state = 'AZ';

    // Basic name detection - look for capitalized sequences
    const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const matches = message.match(nameRegex);
    if (matches) {
      const potentialName = matches.find(match => this.isValidName(match));
      if (potentialName) {
        result.name = potentialName;
      }
    }

    return result;
  }

  /**
   * ✅ Pre-screening: Skip extraction for messages unlikely to contain info
   */
  shouldExtract(message) {
    const lowerMsg = message.toLowerCase();
    const triggerWords = [
      // State indicators
      'texas', 'utah', 'arizona', 'tx', 'ut', 'az', 'from', 'in', 'live', 'resident',
      // Name indicators  
      'name', 'called', 'i\'m', 'i am',
      // Address indicators
      'address', 'located', 'city', 'county'
    ];
    
    return triggerWords.some(word => lowerMsg.includes(word));
  }

  generateCacheKey(message) {
    return message.toLowerCase().trim().substring(0, 100);
  }

  cacheResult(key, result) {
    if (this.extractionCache.size >= this.maxCacheSize) {
      const firstKey = this.extractionCache.keys().next().value;
      this.extractionCache.delete(firstKey);
    }
    this.extractionCache.set(key, result);
  }

  getSupportedStatesInfo() {
    return {
      states: this.coveredStates.map(code => ({
        code,
        name: this.stateMap[code],
        supported: true
      })),
      message: "We currently provide affidavit services for Texas, Utah, and Arizona."
    };
  }
}

module.exports = { StateExtractionService, UnsupportedStateError };