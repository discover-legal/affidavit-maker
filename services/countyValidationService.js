// services/countyValidationService.js - LLM-based county validation

const { OpenAI } = require('openai');
const logger = require('./logger');

class CountyValidationService {
  constructor(openaiApiKey) {
    this.openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    this.cache = new Map(); // Cache results to avoid repeated API calls
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Main validation function
  async validateCounty(county, state) {
    if (!county || !state) {
      return {
        isValid: true, // Allow empty counties
        county: county,
        normalizedCounty: county,
        confidence: 1.0,
        source: 'empty_allowed'
      };
    }

    // Check cache first
    const cacheKey = `${state.toUpperCase()}_${county.toLowerCase().trim()}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate using LLM
    const result = await this.validateWithLLM(county, state);
    
    // Cache the result
    this.setCachedResult(cacheKey, result);
    
    return result;
  }

  async validateWithLLM(county, state) {
    if (!this.openai) {
      // Fallback validation without LLM
      return this.fallbackValidation(county, state);
    }

    try {
      const prompt = this.buildValidationPrompt(county, state);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Low temperature for factual accuracy
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const response = JSON.parse(completion.choices[0].message.content);
      
      // Validate response structure
      if (!this.isValidResponse(response)) {
        logger.warn('Invalid LLM response for county validation', {
          county,
          state,
          response
        });
        return this.fallbackValidation(county, state);
      }

      return {
        isValid: response.isValid,
        county: county,
        normalizedCounty: response.correctName || county,
        confidence: response.confidence || 0.8,
        suggestions: response.suggestions || [],
        source: 'llm',
        reasoning: response.reasoning
      };

    } catch (error) {
      logger.error('LLM county validation failed:', {
        error: error.message,
        county,
        state
      });
      
      return this.fallbackValidation(county, state);
    }
  }

  buildValidationPrompt(county, state) {
    const stateNames = {
      'TX': 'Texas',
      'UT': 'Utah', 
      'AZ': 'Arizona'
    };

    const stateName = stateNames[state.toUpperCase()] || state;

    return `You are a geography expert. Validate if "${county}" is a real county in ${stateName}, United States.

Instructions:
1. Check if the county name is correct and exists in ${stateName}
2. If it's misspelled but close to a real county, provide the correct name
3. If it's completely invalid, suggest the closest real counties
4. Provide confidence level (0.0 to 1.0)

County to validate: "${county}"
State: ${stateName}

Return ONLY a JSON object with this exact structure:
{
  "isValid": boolean,
  "correctName": "exact official county name" or null,
  "confidence": number between 0.0 and 1.0,
  "suggestions": ["array", "of", "similar", "county", "names"],
  "reasoning": "brief explanation"
}

Examples:
- "Travis" in Texas → {"isValid": true, "correctName": "Travis", "confidence": 1.0, "suggestions": [], "reasoning": "Travis County is a real county in Texas"}
- "Travas" in Texas → {"isValid": false, "correctName": "Travis", "confidence": 0.9, "suggestions": ["Travis"], "reasoning": "Likely misspelling of Travis County"}
- "Manhattan" in Texas → {"isValid": false, "correctName": null, "confidence": 0.95, "suggestions": ["Harris", "Dallas", "Tarrant"], "reasoning": "Manhattan is not a county in Texas, suggested major counties"}`;
  }

  isValidResponse(response) {
    return (
      typeof response === 'object' &&
      typeof response.isValid === 'boolean' &&
      typeof response.confidence === 'number' &&
      response.confidence >= 0 && response.confidence <= 1 &&
      Array.isArray(response.suggestions)
    );
  }

  fallbackValidation(county, state) {
    // Basic validation without LLM - just check format and common counties
    const cleanCounty = county.trim();
    
    // Basic format validation
    if (!/^[a-zA-Z\s\-'.]+$/.test(cleanCounty)) {
      return {
        isValid: false,
        county: county,
        normalizedCounty: cleanCounty,
        confidence: 0.9,
        suggestions: this.getCommonCounties(state),
        source: 'fallback_format',
        reasoning: 'Invalid characters in county name'
      };
    }

    // Check against common counties
    const commonCounties = this.getCommonCounties(state);
    const lowerCounty = cleanCounty.toLowerCase();
    
    // Exact match
    if (commonCounties.some(c => c.toLowerCase() === lowerCounty)) {
      return {
        isValid: true,
        county: county,
        normalizedCounty: cleanCounty,
        confidence: 0.8,
        suggestions: [],
        source: 'fallback_exact',
        reasoning: 'Matches known county'
      };
    }

    // Fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(cleanCounty, commonCounties);
    if (fuzzyMatch) {
      return {
        isValid: false,
        county: county,
        normalizedCounty: fuzzyMatch,
        confidence: 0.7,
        suggestions: [fuzzyMatch],
        source: 'fallback_fuzzy',
        reasoning: `Possible misspelling of ${fuzzyMatch}`
      };
    }

    // No match found
    return {
      isValid: false,
      county: county,
      normalizedCounty: cleanCounty,
      confidence: 0.6,
      suggestions: commonCounties.slice(0, 3), // Top 3 suggestions
      source: 'fallback_unknown',
      reasoning: 'County not found in common list'
    };
  }

  getCommonCounties(state) {
    const counties = {
      'TX': [
        'Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin', 'Hidalgo',
        'Fort Bend', 'Montgomery', 'Williamson', 'Cameron', 'Nueces', 'Brazoria',
        'Galveston', 'Denton', 'Jefferson', 'McLennan', 'Bell', 'Brazos', 'Hays'
      ],
      'UT': [
        'Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington', 'Cache', 'Iron',
        'Tooele', 'Box Elder', 'Sanpete', 'Carbon', 'Uintah', 'Sevier', 'Juab',
        'Millard', 'Summit', 'Duchesne', 'Wasatch', 'Morgan', 'Kane'
      ],
      'AZ': [
        'Maricopa', 'Pima', 'Pinal', 'Yuma', 'Mohave', 'Coconino', 'Yavapai',
        'Cochise', 'Navajo', 'Apache', 'Gila', 'Santa Cruz', 'Graham', 'Greenlee',
        'La Paz'
      ]
    };

    return counties[state.toUpperCase()] || [];
  }

  findFuzzyMatch(input, candidates) {
    const inputLower = input.toLowerCase();
    
    // Look for partial matches or common misspellings
    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      
      // Check if input starts with candidate or vice versa
      if (inputLower.startsWith(candidateLower.substring(0, 3)) ||
          candidateLower.startsWith(inputLower.substring(0, 3))) {
        return candidate;
      }
      
      // Check edit distance for short names
      if (input.length <= 6 && this.editDistance(inputLower, candidateLower) <= 2) {
        return candidate;
      }
    }
    
    return null;
  }

  editDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Cache management
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.result;
    }
    return null;
  }

  setCachedResult(key, result) {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    // Clean old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanCache();
    }
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  // Batch validation for multiple counties
  async validateMultipleCounties(counties, state) {
    const results = [];
    
    for (const county of counties) {
      try {
        const result = await this.validateCounty(county, state);
        results.push({ county, ...result });
      } catch (error) {
        results.push({
          county,
          isValid: false,
          error: error.message,
          source: 'error'
        });
      }
    }
    
    return results;
  }
}

module.exports = CountyValidationService;