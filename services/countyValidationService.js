// services/countyValidationService.js
const { StateTemplateManager } = require('../templates/StateTemplateManager');

class CountyValidationService {
  constructor(openaiApiKey) {
    if (openaiApiKey) {
      this.openai = require('openai');
      this.client = new this.openai({ apiKey: openaiApiKey });
    }
    this.stateManager = new StateTemplateManager();
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  async validateCounty(county, state, useAI = true) {
    if (!county || !state) {
      return {
        isValid: false,
        reasoning: 'County and state are required',
        confidence: 0,
        suggestions: []
      };
    }

    // Get state-specific validation rules
    const template = this.stateManager.getTemplate(state);
    const validationRules = template.getCountyValidationRules();

    // If state doesn't require county, skip validation
    if (!validationRules.required) {
      return {
        isValid: true,
        reasoning: `County not required for ${validationRules.stateName} affidavits`,
        confidence: 1.0,
        suggestions: []
      };
    }

    const cleanCounty = county.trim();
    const cacheKey = `${state.toUpperCase()}-${cleanCounty.toUpperCase()}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
      this.cache.delete(cacheKey);
    }

    let result;

    // Try basic validation first (fast)
    const basicResult = this.basicValidation(cleanCounty, validationRules);
    if (basicResult.confidence > 0.8) {
      result = basicResult;
    } else if (useAI && this.client) {
      // Use AI for more complex validation
      try {
        result = await this.aiValidation(cleanCounty, validationRules);
      } catch (error) {
        console.error('AI validation failed, falling back to basic:', error);
        result = basicResult;
      }
    } else {
      result = basicResult;
    }

    // Cache the result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  basicValidation(county, validationRules) {
    const { commonCounties, stateName } = validationRules;
    
    // Basic format validation
    if (!/^[a-zA-Z\s\-'.]+$/.test(county)) {
      return {
        isValid: false,
        reasoning: 'County name contains invalid characters',
        confidence: 0.9,
        suggestions: []
      };
    }

    // Check exact match with common counties
    const exactMatch = commonCounties.find(c => 
      c.toLowerCase() === county.toLowerCase()
    );
    
    if (exactMatch) {
      return {
        isValid: true,
        correctName: exactMatch,
        reasoning: `${exactMatch} County is valid in ${stateName}`,
        confidence: 1.0,
        suggestions: []
      };
    }

    // Check for close matches
    const closeMatches = commonCounties.filter(c => {
      const distance = this.levenshteinDistance(
        county.toLowerCase(), 
        c.toLowerCase()
      );
      return distance <= 2 && distance > 0;
    });

    if (closeMatches.length > 0) {
      return {
        isValid: false,
        correctName: closeMatches[0],
        reasoning: `Possible misspelling of ${closeMatches[0]} County`,
        confidence: 0.8,
        suggestions: closeMatches
      };
    }

    // No close matches found
    return {
      isValid: false,
      reasoning: `County name not recognized in ${stateName}`,
      confidence: 0.7,
      suggestions: commonCounties.slice(0, 3) // Top 3 common counties
    };
  }

  async aiValidation(county, validationRules) {
    const { stateName, stateCode } = validationRules;
    
    const prompt = this.generateValidationPrompt(county, stateName);
    
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty AI response');
      }

      // Parse JSON response
      const result = JSON.parse(responseText);
      
      if (!this.isValidResponse(result)) {
        throw new Error('Invalid AI response format');
      }

      return result;
      
    } catch (error) {
      console.error('AI validation error:', error);
      // Fallback to basic validation
      return this.fallbackValidation(county, validationRules);
    }
  }

  generateValidationPrompt(county, stateName) {
    return `Validate if "${county}" is a real county in ${stateName}, United States.

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

  fallbackValidation(county, validationRules) {
    const cleanCounty = county.trim();
    
    // Basic format validation
    if (!/^[a-zA-Z\s\-'.]+$/.test(cleanCounty)) {
      return {
        isValid: false,
        reasoning: 'County name contains invalid characters',
        confidence: 0.9,
        suggestions: []
      };
    }

    // Length validation
    if (cleanCounty.length < 2 || cleanCounty.length > 50) {
      return {
        isValid: false,
        reasoning: 'County name length is invalid',
        confidence: 0.8,
        suggestions: []
      };
    }

    // Generic response for unrecognized counties
    return {
      isValid: false,
      reasoning: `Please verify "${cleanCounty}" is a valid county in ${validationRules.stateName}`,
      confidence: 0.6,
      suggestions: validationRules.commonCounties?.slice(0, 3) || []
    };
  }

  // Levenshtein distance for fuzzy matching
  levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
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

    return matrix[len2][len1];
  }
}

module.exports = CountyValidationService;