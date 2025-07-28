// services/llmFactsValidationService.js
class LLMFactsValidationService {
  constructor(openaiClient, language = 'en') {
    this.openai = openaiClient;
    this.language = language;
    this.validCategories = [
      'financial', 'behavioral', 'temporal', 'relational', 
      'property', 'communication', 'witness', 'general'
    ];
  }

  /**
   * Validate a single fact using LLM
   */
  async validateFact(fact, existingFacts = [], context = {}) {
    try {
      const prompt = this.buildValidationPrompt(fact, existingFacts, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent validation
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        isValid: result.isValid,
        errors: result.errors || [],
        warnings: result.warnings || [],
        suggestions: result.suggestions || [],
        sanitizedFact: {
          content: result.sanitizedContent || fact.content,
          category: result.category || 'general',
          confidence: result.confidence || 0.8,
          timestamp: new Date().toISOString()
        },
        duplicateIndex: result.duplicateIndex || null
      };
      
    } catch (error) {
      console.error('LLM fact validation failed:', error);
      
      // Fallback to basic validation
      return this.fallbackValidation(fact, existingFacts);
    }
  }

  /**
   * Validate multiple facts in batch for efficiency
   */
  async validateFactsBatch(facts, context = {}) {
    if (!Array.isArray(facts) || facts.length === 0) {
      return {
        isValid: false,
        errors: ['No facts provided'],
        warnings: [],
        validFacts: [],
        results: []
      };
    }

    try {
      const prompt = this.buildBatchValidationPrompt(facts, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system", 
            content: this.getBatchSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const batchResult = JSON.parse(response.choices[0].message.content);
      
      const results = batchResult.facts.map((factResult, index) => ({
        index,
        originalFact: facts[index],
        ...factResult
      }));

      const validFacts = results
        .filter(result => result.isValid)
        .map(result => result.sanitizedFact);

      return {
        isValid: batchResult.overallValid,
        errors: batchResult.globalErrors || [],
        warnings: batchResult.globalWarnings || [],
        validFacts,
        results,
        summary: batchResult.summary
      };
      
    } catch (error) {
      console.error('LLM batch validation failed:', error);
      
      // Fallback to individual validation
      const results = await Promise.all(
        facts.map((fact, index) => this.validateFact(fact, facts))
      );
      
      return this.compileBatchResults(results, facts);
    }
  }

  /**
   * Get system prompt for fact validation (localizable)
   */
  getSystemPrompt() {
    const prompts = {
      en: `You are a legal document fact validator. Your job is to validate facts for affidavits.

VALIDATION CRITERIA:
1. CLARITY: Facts must be specific, clear, and objective
2. RELEVANCE: Facts should be legally relevant to an affidavit
3. COMPLETENESS: Facts should contain sufficient detail
4. OBJECTIVITY: Facts should avoid emotional or subjective language
5. DUPLICATES: Check for similar or duplicate facts

CATEGORIES:
- financial: Money, payments, debts, income, costs
- property: Real estate, vehicles, owned items, addresses
- temporal: Dates, times, sequences of events
- relational: Family, relationships, personal connections
- communication: Conversations, emails, calls, messages
- witness: Observations, things seen or witnessed
- behavioral: Actions, behaviors, conduct
- general: Other factual statements

RESPONSE FORMAT (JSON only):
{
  "isValid": boolean,
  "errors": ["list of serious issues that make fact invalid"],
  "warnings": ["list of minor issues or suggestions"],
  "suggestions": ["specific improvements"],
  "sanitizedContent": "improved version of the fact",
  "category": "most appropriate category",
  "confidence": 0.0-1.0,
  "duplicateIndex": null or index of similar fact
}`,

      es: `Eres un validador de hechos para documentos legales. Tu trabajo es validar hechos para declaraciones juradas.

CRITERIOS DE VALIDACIÓN:
1. CLARIDAD: Los hechos deben ser específicos, claros y objetivos
2. RELEVANCIA: Los hechos deben ser legalmente relevantes para una declaración jurada
3. COMPLETITUD: Los hechos deben contener suficiente detalle
4. OBJETIVIDAD: Los hechos deben evitar lenguaje emocional o subjetivo
5. DUPLICADOS: Verificar hechos similares o duplicados

CATEGORÍAS:
- financial: Dinero, pagos, deudas, ingresos, costos
- property: Bienes raíces, vehículos, artículos poseídos, direcciones
- temporal: Fechas, horas, secuencias de eventos
- relational: Familia, relaciones, conexiones personales
- communication: Conversaciones, correos, llamadas, mensajes
- witness: Observaciones, cosas vistas o presenciadas
- behavioral: Acciones, comportamientos, conducta
- general: Otras declaraciones factuales

FORMATO DE RESPUESTA (solo JSON):
{
  "isValid": boolean,
  "errors": ["lista de problemas serios que invalidan el hecho"],
  "warnings": ["lista de problemas menores o sugerencias"],
  "suggestions": ["mejoras específicas"],
  "sanitizedContent": "versión mejorada del hecho",
  "category": "categoría más apropiada",
  "confidence": 0.0-1.0,
  "duplicateIndex": null o índice de hecho similar
}`
    };

    return prompts[this.language] || prompts.en;
  }

  /**
   * Get system prompt for batch validation
   */
  getBatchSystemPrompt() {
    const prompts = {
      en: `You are validating multiple facts for a legal affidavit. Check each fact individually and also look for patterns, duplicates, and overall coherence.

ADDITIONAL BATCH CONSIDERATIONS:
- Check for contradictions between facts
- Identify narrative flow and logical sequence
- Flag potential inconsistencies
- Suggest grouping related facts

RESPONSE FORMAT (JSON only):
{
  "overallValid": boolean,
  "globalErrors": ["issues affecting the entire set"],
  "globalWarnings": ["overall suggestions"],
  "summary": "brief assessment of the fact set",
  "facts": [
    {
      "isValid": boolean,
      "errors": [],
      "warnings": [],
      "suggestions": [],
      "sanitizedFact": {
        "content": "cleaned fact text",
        "category": "category",
        "confidence": 0.0-1.0
      },
      "duplicateIndex": null
    }
  ]
}`,

      es: `Estás validando múltiples hechos para una declaración jurada legal. Revisa cada hecho individualmente y también busca patrones, duplicados y coherencia general.

CONSIDERACIONES ADICIONALES PARA LOTES:
- Verificar contradicciones entre hechos
- Identificar flujo narrativo y secuencia lógica
- Marcar posibles inconsistencias
- Sugerir agrupación de hechos relacionados

FORMATO DE RESPUESTA (solo JSON):
{
  "overallValid": boolean,
  "globalErrors": ["problemas que afectan todo el conjunto"],
  "globalWarnings": ["sugerencias generales"],
  "summary": "evaluación breve del conjunto de hechos",
  "facts": [
    {
      "isValid": boolean,
      "errors": [],
      "warnings": [],
      "suggestions": [],
      "sanitizedFact": {
        "content": "texto del hecho limpiado",
        "category": "categoría",
        "confidence": 0.0-1.0
      },
      "duplicateIndex": null
    }
  ]
}`
    };

    return prompts[this.language] || prompts.en;
  }

  /**
   * Build validation prompt for single fact
   */
  buildValidationPrompt(fact, existingFacts, context) {
    const factText = fact.content || fact;
    const state = context.state || 'general';
    const documentType = context.documentType || 'affidavit';
    
    let prompt = `FACT TO VALIDATE: "${factText}"
    
CONTEXT:
- Document type: ${documentType}
- State: ${state}
- Affiant: ${context.affiantName || 'Not specified'}`;

    if (existingFacts.length > 0) {
      prompt += `\n\nEXISTING FACTS TO CHECK FOR DUPLICATES:`;
      existingFacts.forEach((existing, index) => {
        const existingText = existing.content || existing;
        prompt += `\n${index}: "${existingText}"`;
      });
    }

    prompt += '\n\nValidate this fact and respond in JSON format only.';
    
    return prompt;
  }

  /**
   * Build batch validation prompt
   */
  buildBatchValidationPrompt(facts, context) {
    const state = context.state || 'general';
    const documentType = context.documentType || 'affidavit';
    
    let prompt = `FACTS TO VALIDATE:
`;
    
    facts.forEach((fact, index) => {
      const factText = fact.content || fact;
      prompt += `${index}: "${factText}"\n`;
    });

    prompt += `
CONTEXT:
- Document type: ${documentType}
- State: ${state}
- Affiant: ${context.affiantName || 'Not specified'}

Validate all facts, check for duplicates and contradictions, and respond in JSON format only.`;
    
    return prompt;
  }

  /**
   * Fallback validation when LLM fails
   */
  fallbackValidation(fact, existingFacts = []) {
    const content = fact.content || fact;
    const errors = [];
    const warnings = [];

    // Basic validation
    if (!content || content.trim().length < 10) {
      errors.push('Fact too short');
    }
    
    if (content.length > 500) {
      errors.push('Fact too long');
    }

    // Simple duplicate check
    const duplicateIndex = existingFacts.findIndex(existing => {
      const existingContent = existing.content || existing;
      return this.simpleTextSimilarity(content, existingContent) > 0.8;
    });

    if (duplicateIndex !== -1) {
      warnings.push('Possible duplicate fact detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: ['Consider reviewing for clarity and completeness'],
      sanitizedFact: {
        content: content.trim(),
        category: 'general',
        confidence: 0.5,
        timestamp: new Date().toISOString()
      },
      duplicateIndex: duplicateIndex !== -1 ? duplicateIndex : null
    };
  }

  /**
   * Simple text similarity for fallback
   */
  simpleTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Compile individual results into batch format
   */
  compileBatchResults(results, originalFacts) {
    const validFacts = results
      .filter(result => result.isValid)
      .map(result => result.sanitizedFact);

    const allErrors = results.flatMap((result, index) => 
      result.errors.map(error => `Fact ${index + 1}: ${error}`)
    );

    const allWarnings = results.flatMap((result, index) => 
      result.warnings.map(warning => `Fact ${index + 1}: ${warning}`)
    );

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      validFacts,
      results: results.map((result, index) => ({
        index,
        originalFact: originalFacts[index],
        ...result
      })),
      summary: `${validFacts.length}/${originalFacts.length} facts valid`
    };
  }

  /**
   * Set language for prompts
   */
  setLanguage(language) {
    this.language = language;
  }

  /**
   * Quick validation for real-time feedback
   */
  async quickValidate(fact, existingFacts = []) {
    // For real-time validation, do basic checks first
    if (!fact || !fact.content || fact.content.trim().length < 5) {
      return {
        isValid: false,
        errors: ['Fact too short'],
        warnings: [],
        severity: 'error'
      };
    }

    // Check for duplicates quickly
    const duplicate = existingFacts.find(existing => 
      this.simpleTextSimilarity(fact.content, existing.content || existing) > 0.7
    );

    if (duplicate) {
      return {
        isValid: true,
        errors: [],
        warnings: ['Similar fact may already exist'],
        severity: 'warning'
      };
    }

    return {
      isValid: true,
      errors: [],
      warnings: [],
      severity: 'success'
    };
  }
}

export default LLMFactsValidationService;