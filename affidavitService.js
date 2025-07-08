// affidavitService.js - Fixed version with proper OpenAI integration
const OpenAI = require('openai');
const { StateTemplateManager } = require('./templates/StateTemplateManager');

class AffidavitService {
  constructor(apiKey, options = {}) {
    // Initialize OpenAI with proper error handling
    if (!apiKey) {
      console.warn('OpenAI API key not provided - AI features will be limited');
      this.openai = this.createMockOpenAI();
    } else {
      try {
        this.openai = new OpenAI({ apiKey });
      } catch (error) {
        console.error('Failed to initialize OpenAI:', error);
        this.openai = this.createMockOpenAI();
      }
    }
    
    this.templateManager = new StateTemplateManager();
    this.model = options.model || 'gpt-4';
    this.temperature = options.temperature || 0.3;
    this.maxTokens = options.maxTokens || 2000;
    this.timeout = options.timeout || 30000;
    
    // AI strategies for content generation
    this.contentStrategies = {
      simple: this.generateSimpleContent.bind(this),
      detailed: this.generateDetailedContent.bind(this),
      persuasive: this.generatePersuasiveContent.bind(this),
      legal: this.generateLegalContent.bind(this)
    };
  }

  // Create mock OpenAI client for fallback
  createMockOpenAI() {
    return {
      chat: {
        completions: {
          create: async (params) => {
            console.warn('Using mock OpenAI response - AI features limited');
            
            // Extract user message for basic parsing
            const userMessage = params.messages?.[params.messages.length - 1]?.content || '';
            
            // Basic data extraction based on common patterns
            const extractedData = this.extractBasicData(userMessage);
            
            const response = {
              response: this.generateBasicResponse(userMessage, extractedData),
              extractedData,
              conversationComplete: this.isConversationComplete(extractedData),
              nextSteps: this.getNextSteps(extractedData)
            };
            
            return {
              choices: [{
                message: {
                  content: JSON.stringify(response)
                }
              }]
            };
          }
        }
      }
    };
  }

  // Basic data extraction for mock mode
  extractBasicData(message) {
    const data = {};
    const lowerMessage = message.toLowerCase();
    
    // Extract name patterns
    const namePatterns = [
      /my name is ([a-zA-Z\s]+)/i,
      /i am ([a-zA-Z\s]+)/i,
      /i'm ([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        data.affiantName = match[1].trim();
        break;
      }
    }
    
    // Extract state mentions
    const states = ['texas', 'utah', 'arizona', 'tx', 'ut', 'az'];
    for (const state of states) {
      if (lowerMessage.includes(state)) {
        data.state = state.toUpperCase().substring(0, 2);
        break;
      }
    }
    
    // Extract case numbers
    const caseMatch = message.match(/case\s*(?:number|#)?\s*:?\s*([a-zA-Z0-9\-]+)/i);
    if (caseMatch) {
      data.caseNumber = caseMatch[1];
    }
    
    // Extract facts (simple approach)
    if (lowerMessage.includes('fact') || lowerMessage.includes('happened') || lowerMessage.includes('occurred')) {
      const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        data.facts = [sentences[sentences.length - 1].trim()];
      }
    }
    
    return data;
  }

  generateBasicResponse(message, extractedData) {
    if (!extractedData.affiantName) {
      return "I'd be happy to help you create your affidavit! To get started, could you please tell me your full name?";
    }
    
    if (!extractedData.state) {
      return `Thank you, ${extractedData.affiantName}. Which state is your case in? I can help with Texas, Utah, or Arizona.`;
    }
    
    if (!extractedData.facts || extractedData.facts.length === 0) {
      return `Great! I have your name as ${extractedData.affiantName} and your state as ${extractedData.state}. Now, could you tell me the facts you need to include in your affidavit? Please describe what happened or what you need to attest to.`;
    }
    
    return `Perfect! I have all the basic information. Let me know if you have any additional facts to add, or we can proceed to generate your ${extractedData.state} affidavit.`;
  }

  isConversationComplete(extractedData) {
    return !!(extractedData.affiantName && extractedData.state && extractedData.facts?.length > 0);
  }

  getNextSteps(extractedData) {
    const steps = [];
    
    if (!extractedData.affiantName) {
      steps.push("Provide your full legal name");
    }
    if (!extractedData.state) {
      steps.push("Specify which state (Texas, Utah, or Arizona)");
    }
    if (!extractedData.facts?.length) {
      steps.push("Describe the facts for your affidavit");
    }
    if (this.isConversationComplete(extractedData)) {
      steps.push("Review and generate your affidavit");
    }
    
    return steps;
  }

  async processAffidavit(affidavitData, strategy = 'simple', options = {}) {
    try {
      // Validate data using template
      const template = this.templateManager.getTemplate(affidavitData.state);
      const validation = template.validateData(affidavitData);
      
      if (!validation.isValid) {
        throw new Error(`Invalid affidavit data: ${validation.errors.join(', ')}`);
      }

      // Generate AI content if needed
      let enhancedData = { ...affidavitData };
      if (strategy !== 'template_only') {
        try {
          const aiContent = await this.generateContent(affidavitData, strategy);
          enhancedData = this.mergeAIContent(affidavitData, aiContent);
        } catch (aiError) {
          console.warn('AI content generation failed, using template only:', aiError.message);
          // Continue with template-only generation
        }
      }

      // Generate final document using template
      const document = template.generateDocument(enhancedData, {
        documentId: options.documentId,
        includeMetadata: true
      });

      return {
        success: true,
        document,
        validation,
        metadata: {
          strategy,
          state: affidavitData.state,
          template: template.constructor.name,
          generatedAt: new Date().toISOString(),
          model: this.model,
          wordCount: document.fullText.split(' ').length
        }
      };

    } catch (error) {
      console.error('Affidavit processing error:', error);
      return this.handleError(error, affidavitData);
    }
  }

  async generateContent(affidavitData, strategy) {
    if (!this.contentStrategies[strategy]) {
      throw new Error(`Unknown content strategy: ${strategy}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const content = await this.contentStrategies[strategy](affidavitData, controller.signal);
      clearTimeout(timeout);
      return content;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Content generation timeout - please try again');
      }
      throw error;
    }
  }

  async generateSimpleContent(affidavitData, signal) {
    const template = this.templateManager.getTemplate(affidavitData.state);
    const requirements = template.getRequirements();

    const prompt = `Enhance the following affidavit facts for ${template.stateName} legal requirements:

Current Facts:
${affidavitData.facts ? affidavitData.facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n') : 'No facts provided'}

Requirements:
${JSON.stringify(requirements, null, 2)}

Instructions:
- Keep facts clear and concise
- Ensure first-person perspective
- Add specific details where helpful
- Maintain truthful tone
- Follow ${template.stateName} legal standards

Return ONLY a JSON object with this structure:
{
  "enhancedFacts": ["fact1", "fact2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      signal,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generateDetailedContent(affidavitData, signal) {
    const template = this.templateManager.getTemplate(affidavitData.state);
    
    const prompt = `Create detailed, legally sound affidavit content for ${template.stateName}:

Case Information:
- Type: ${affidavitData.documentType || 'general'}
- Affiant: ${affidavitData.affiantName}
- Basic Facts: ${JSON.stringify(affidavitData.facts)}

Requirements:
- Expand on provided facts with relevant detail
- Add chronological structure where appropriate
- Include specific dates, times, locations when helpful
- Maintain first-person perspective
- Ensure legal sufficiency for ${template.stateName}

Return JSON with:
{
  "enhancedFacts": ["detailed fact statements"],
  "timeline": [{"date": "YYYY-MM-DD", "event": "description"}],
  "legalElements": ["key legal points to emphasize"],
  "suggestions": ["additional recommendations"]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      signal,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generatePersuasiveContent(affidavitData, signal) {
    const template = this.templateManager.getTemplate(affidavitData.state);
    
    const prompt = `Create persuasive affidavit content for ${template.stateName} that presents facts in the most compelling legal order:

Case Context:
- Document Type: ${affidavitData.documentType}
- Legal Matter: ${affidavitData.caseType || 'General civil matter'}
- Current Facts: ${JSON.stringify(affidavitData.facts)}

Strategy:
- Organize facts for maximum legal impact
- Lead with strongest evidence
- Build logical narrative flow
- Address potential counterarguments
- Emphasize credibility factors

Return JSON structure:
{
  "strategicFacts": ["facts ordered for maximum impact"],
  "narrative": "overall story structure",
  "strengthPoints": ["strongest legal arguments"],
  "credibilityFactors": ["elements that enhance believability"],
  "suggestions": ["strategic recommendations"]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: this.maxTokens,
      signal,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generateLegalContent(affidavitData, signal) {
    const template = this.templateManager.getTemplate(affidavitData.state);
    
    const prompt = `Generate legally precise affidavit content for ${template.stateName} court proceedings:

Legal Context:
- Document Type: ${affidavitData.documentType}
- Court: ${affidavitData.court || 'District Court'}
- Case Type: ${affidavitData.caseType}
- Facts: ${JSON.stringify(affidavitData.facts)}

Legal Standards:
- Use precise legal terminology
- Ensure evidentiary sufficiency
- Address all required elements
- Include foundation statements
- Follow ${template.stateName} procedural rules

Return JSON:
{
  "legalFacts": ["precisely worded fact statements"],
  "foundationStatements": ["personal knowledge foundations"],
  "proceduralElements": ["required legal elements"],
  "citations": ["relevant legal standards"],
  "recommendations": ["legal strategy suggestions"]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: this.maxTokens,
      signal
    });

    try {
      return JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        legalFacts: affidavitData.facts || [],
        foundationStatements: [],
        proceduralElements: [],
        citations: [],
        recommendations: []
      };
    }
  }

  mergeAIContent(originalData, aiContent) {
    const enhanced = { ...originalData };

    // Merge facts - prioritize AI enhanced facts if available
    if (aiContent.enhancedFacts) {
      enhanced.facts = aiContent.enhancedFacts;
    } else if (aiContent.strategicFacts) {
      enhanced.facts = aiContent.strategicFacts;
    } else if (aiContent.legalFacts) {
      enhanced.facts = aiContent.legalFacts;
    }

    // Add timeline information if available
    if (aiContent.timeline) {
      enhanced.timeline = aiContent.timeline;
    }

    // Add AI insights as metadata
    enhanced.aiInsights = {
      suggestions: aiContent.suggestions || [],
      strengthPoints: aiContent.strengthPoints || [],
      recommendations: aiContent.recommendations || [],
      narrative: aiContent.narrative || null
    };

    return enhanced;
  }

  handleError(error, affidavitData) {
    console.error('Affidavit service error:', error);
    
    // Generate fallback document using template only
    try {
      const template = this.templateManager.getTemplate(affidavitData.state);
      const fallbackDocument = template.generateDocument(affidavitData, {
        includeMetadata: true
      });

      return {
        success: true,
        document: fallbackDocument,
        fallback: true,
        error: error.message,
        metadata: {
          strategy: 'fallback',
          state: affidavitData.state,
          template: template.constructor.name,
          generatedAt: new Date().toISOString(),
          fallbackReason: error.message
        }
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: `Failed to generate affidavit: ${error.message}`,
        fallbackError: fallbackError.message
      };
    }
  }

  // Public utility methods
  getSupportedStates() {
    return this.templateManager.getSupportedStates();
  }

  getSupportedDocumentTypes() {
    return this.templateManager.getSupportedDocumentTypes();
  }

  validateAffidavitData(data, state) {
    return this.templateManager.validateAffidavitData(data, state);
  }

  // Configuration methods
  setModel(model) {
    this.model = model;
  }

  setTemperature(temperature) {
    this.temperature = temperature;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
  }

  // Add custom content strategies
  addContentStrategy(name, strategyFunction) {
    this.contentStrategies[name] = strategyFunction.bind(this);
  }

  // Preview generation for frontend
  generatePreview(affidavitData, includeWatermark = true) {
    try {
      const template = this.templateManager.getTemplate(affidavitData.state);
      const document = template.generateDocument(affidavitData, {
        preview: true,
        includeWatermark
      });

      return {
        success: true,
        preview: {
          sections: document.sections,
          html: document.htmlContent,
          text: document.fullText,
          validation: document.validation
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackPreview(affidavitData)
      };
    }
  }

  generateFallbackPreview(affidavitData) {
    return {
      sections: {
        header: `THE STATE OF ${(affidavitData.state || 'TEXAS').toUpperCase()}`,
        title: 'AFFIDAVIT',
        introduction: `BEFORE ME, the undersigned Notary Public, personally appeared ${affidavitData.affiantName || '[AFFIANT NAME]'}.`,
        facts: (affidavitData.facts || []).map((fact, index) => ({
          number: index + 1,
          content: fact,
          type: 'fact'
        })),
        conclusion: 'Further, affiant sayeth not.',
        signatureBlock: {
          line: '_'.repeat(40),
          name: affidavitData.affiantName || '[AFFIANT NAME]',
          title: 'Affiant'
        }
      }
    };
  }

  // Document generation with different output formats
  async generateDocument(affidavitData, strategy = 'simple', format = 'pdf') {
    const result = await this.processAffidavit(affidavitData, strategy);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    switch (format.toLowerCase()) {
      case 'html':
        return {
          content: result.document.htmlContent,
          filename: `affidavit-${result.document.id}.html`,
          mimeType: 'text/html'
        };
      
      case 'text':
        return {
          content: result.document.fullText,
          filename: `affidavit-${result.document.id}.txt`,
          mimeType: 'text/plain'
        };
      
      case 'json':
        return {
          content: JSON.stringify(result.document, null, 2),
          filename: `affidavit-${result.document.id}.json`,
          mimeType: 'application/json'
        };
      
      case 'pdf':
      default:
        // PDF generation will be handled by the PDF service
        return {
          document: result.document,
          format: 'pdf',
          filename: `affidavit-${result.document.id}.pdf`
        };
    }
  }

  // Batch processing for multiple affidavits
  async processMultipleAffidavits(affidavitDataArray, strategy = 'simple') {
    const results = [];
    
    for (const data of affidavitDataArray) {
      try {
        const result = await this.processAffidavit(data, strategy);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          inputData: data
        });
      }
    }
    
    return {
      success: true,
      results,
      summary: {
        total: affidavitDataArray.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }

  // Analysis methods for existing documents
  analyzeDocument(documentText, state) {
    const template = this.templateManager.getTemplate(state);
    
    return {
      stateCompliance: this.checkStateCompliance(documentText, template),
      completeness: this.checkCompleteness(documentText, template),
      suggestions: this.generateImprovementSuggestions(documentText, template)
    };
  }

  checkStateCompliance(documentText, template) {
    const requirements = template.getRequirements();
    const compliance = {};
    
    // Check for required elements
    compliance.hasHeader = documentText.includes(template.getStateHeaderName());
    compliance.hasVenue = !requirements.venue || documentText.includes(template.getCountyFormat());
    compliance.hasNotaryBlock = documentText.includes('Notary Public');
    compliance.hasPerjuryStatement = documentText.includes('PENALTY OF PERJURY');
    
    compliance.score = Object.values(compliance).filter(Boolean).length / Object.keys(compliance).length;
    compliance.isCompliant = compliance.score >= 0.8;
    
    return compliance;
  }

  checkCompleteness(documentText, template) {
    const completeness = {};
    
    completeness.hasIntroduction = documentText.includes('personally appeared');
    completeness.hasFacts = /\d+\.\s/.test(documentText);
    completeness.hasConclusion = documentText.includes('Further, affiant sayeth not');
    completeness.hasSignature = documentText.includes('_______');
    
    completeness.score = Object.values(completeness).filter(Boolean).length / Object.keys(completeness).length;
    completeness.isComplete = completeness.score >= 0.75;
    
    return completeness;
  }

  generateImprovementSuggestions(documentText, template) {
    const suggestions = [];
    const requirements = template.getRequirements();
    
    if (!documentText.includes(template.getStateHeaderName())) {
      suggestions.push(`Add proper ${template.stateName} header: "${template.getStateHeaderName()}"`);
    }
    
    if (requirements.venue && !documentText.includes(template.getCountyFormat())) {
      suggestions.push(`Include venue section with county information`);
    }
    
    if (!documentText.includes('personally appeared')) {
      suggestions.push('Include proper notarial introduction');
    }
    
    if (!/\d+\.\s/.test(documentText)) {
      suggestions.push('Format facts as numbered paragraphs');
    }
    
    if (!documentText.includes('PENALTY OF PERJURY')) {
      suggestions.push('Include penalty of perjury statement');
    }
    
    return suggestions;
  }
}

module.exports = AffidavitService;