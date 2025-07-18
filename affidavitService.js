// affidavitService.js - Fixed version with proper OpenAI integration
const { OpenAI } = require('openai');
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
    this.model = options.model || 'gpt-4-turbo';
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

// Create improved mock OpenAI client for fallback
createMockOpenAI() {
  return {
    chat: {
      completions: {
        create: async (params) => {
          console.warn('Using mock OpenAI response - AI features limited');
          
          // Extract user message for context-aware parsing
          const messages = params.messages || [];
          const userMessage = messages[messages.length - 1]?.content || '';
          const conversationHistory = messages.slice(0, -1);
          
          // Extract current data from system prompt if available
          const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
          const currentDataMatch = systemPrompt.match(/Current Data: ({.*?})/);
          let currentData = {};
          try {
            if (currentDataMatch) {
              currentData = JSON.parse(currentDataMatch[1]);
            }
          } catch (e) {
            // Ignore parsing errors
          }
          
          // Smart data extraction based on conversation context
          const extractedData = this.extractContextualData(userMessage, currentData, conversationHistory);
          
          // Generate contextual response
          const response = this.generateContextualResponse(userMessage, extractedData, currentData);
          
          // Determine if conversation is complete
          const conversationComplete = this.determineCompleteness(extractedData, currentData);
          
          // Generate helpful next steps
          const nextSteps = this.generateNextSteps(extractedData, currentData);
          
          const mockResponse = {
            response,
            extractedData,
            conversationComplete,
            nextSteps
          };
          
          return {
            choices: [{
              message: {
                content: JSON.stringify(mockResponse)
              }
            }]
          };
        }
      }
    }
  };
}

// Enhanced data extraction with context awareness
extractContextualData(message, currentData, conversationHistory) {
  const data = { ...currentData };
  const lowerMessage = message.toLowerCase();
  
  // Extract name with various patterns
  if (!data.affiantName) {
    const namePatterns = [
      /(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,50})/i,
      /^([a-zA-Z]+\s+[a-zA-Z]+)/i, // First two words if they look like names
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Basic validation - names should have at least first and last
        if (name.split(' ').length >= 2 && name.length <= 50) {
          data.affiantName = name;
          break;
        }
      }
    }
  }
  
  // Extract state with context
  if (!data.state) {
    const stateMap = {
      'texas': 'TX', 'tx': 'TX', 'lone star': 'TX',
      'utah': 'UT', 'ut': 'UT',
      'arizona': 'AZ', 'az': 'AZ'
    };
    
    for (const [keyword, stateCode] of Object.entries(stateMap)) {
      if (lowerMessage.includes(keyword)) {
        data.state = stateCode;
        break;
      }
    }
  }
  
  // Extract county information
  if (!data.county && data.state) {
    const countyPatterns = [
      /in\s+([a-zA-Z\s]+)\s+county/i,
      /([a-zA-Z\s]+)\s+county/i,
      /county\s+of\s+([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of countyPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        data.county = match[1].trim();
        break;
      }
    }
  }
  
  // Extract case number
  if (!data.caseNumber) {
    const casePatterns = [
      /case\s*(?:number|#|no\.?)\s*:?\s*([a-zA-Z0-9\-\/]+)/i,
      /cause\s*(?:number|#|no\.?)\s*:?\s*([a-zA-Z0-9\-\/]+)/i,
      /docket\s*(?:number|#|no\.?)\s*:?\s*([a-zA-Z0-9\-\/]+)/i
    ];
    
    for (const pattern of casePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        data.caseNumber = match[1].trim();
        break;
      }
    }
  }
  
  // Extract document type based on keywords
  if (!data.documentType || data.documentType === 'general') {
    const typeKeywords = {
      'divorce': ['divorce', 'dissolution', 'marriage', 'spouse'],
      'custody': ['custody', 'child', 'children', 'visitation', 'parenting'],
      'financial': ['income', 'support', 'money', 'financial', 'assets', 'debt']
    };
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        data.documentType = type;
        break;
      }
    }
  }
  
  // Extract facts - look for factual statements
  const factPatterns = [
    /(?:fact|happened|occurred|situation|circumstances?)[:\s]+(.+)/i,
    /(?:what happened|the situation|my situation)[:\s]+(.+)/i,
    /(?:i need to state|i want to say|i declare)[:\s]+(.+)/i
  ];
  
  for (const pattern of factPatterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].trim().length > 10) {
      const fact = match[1].trim();
      if (!data.facts) data.facts = [];
      if (!data.facts.includes(fact)) {
        data.facts.push(fact);
      }
      break;
    }
  }
  
  // If the entire message looks like a fact statement, add it
  if (!lowerMessage.includes('?') && message.length > 15 && message.length < 500) {
    const sentences = message.split(/[.!]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 1) {
      if (!data.facts) data.facts = [];
      const fact = sentences[0].trim();
      if (!data.facts.includes(fact)) {
        data.facts.push(fact);
      }
    }
  }
  
  return data;
}

// Generate contextual responses based on current state
generateContextualResponse(message, extractedData, currentData) {
  const lowerMessage = message.toLowerCase();
  
  // Greeting responses
  if (lowerMessage.match(/^(hi|hello|hey|good)/)) {
    return "Hello! I'm here to help you create a professional affidavit. To get started, which state is your case in? I can help with Texas, Utah, or Arizona.";
  }
  
  // Help or confused responses
  if (lowerMessage.includes('help') || lowerMessage.includes('confused') || lowerMessage.includes('don\'t know')) {
    if (!currentData.state) {
      return "No problem! Let's start simple. Which state is your legal matter in? I can help with affidavits for Texas, Utah, or Arizona.";
    } else {
      return `I'm here to help! For your ${currentData.state} affidavit, I need some basic information. ${!currentData.affiantName ? 'What is your full legal name?' : !currentData.facts || currentData.facts.length === 0 ? 'Can you tell me what facts you need to include in your affidavit?' : 'What other information would you like to add?'}`;
    }
  }
  
  // State selection responses
  if (extractedData.state && !currentData.state) {
    const stateNames = { 'TX': 'Texas', 'UT': 'Utah', 'AZ': 'Arizona' };
    return `Great! I'll help you create a ${stateNames[extractedData.state]} affidavit. What is your full legal name?`;
  }
  
  // Name confirmation
  if (extractedData.affiantName && !currentData.affiantName) {
    return `Thank you, ${extractedData.affiantName}. Now, can you tell me what facts or information you need to include in your affidavit? For example, what happened or what do you need to declare under oath?`;
  }
  
  // Facts acknowledgment
  if (extractedData.facts && extractedData.facts.length > 0) {
    const newFacts = extractedData.facts.filter(fact => 
      !currentData.facts || !currentData.facts.includes(fact)
    );
    
    if (newFacts.length > 0) {
      return `I've noted that information. ${this.needsMoreInfo(extractedData, currentData) ? 'Is there anything else you need to include in your affidavit?' : 'Based on what you\'ve told me, I have enough information to prepare your affidavit. You can review it in the preview panel and proceed to download when ready.'}`;
    }
  }
  
  // County information for states that require it
  if (currentData.state && ['TX', 'UT'].includes(currentData.state) && !currentData.county && !extractedData.county) {
    return `For ${currentData.state === 'TX' ? 'Texas' : 'Utah'} affidavits, I also need to know which county your case is in. What county are you filing in?`;
  }
  
  // General progress update
  const progress = this.calculateProgress(extractedData, currentData);
  if (progress < 70) {
    return `I'm gathering the information for your affidavit. ${this.getNextPrompt(extractedData, currentData)}`;
  } else {
    return "Great! I have most of the information I need. You can review the document preview and let me know if you'd like to add anything else, or proceed to finalize your affidavit.";
  }
}

// Determine if conversation is complete
determineCompleteness(extractedData, currentData) {
  const mergedData = { ...currentData, ...extractedData };
  
  // Required fields
  const hasName = !!mergedData.affiantName;
  const hasState = !!mergedData.state;
  const hasFacts = mergedData.facts && mergedData.facts.length > 0;
  
  // State-specific requirements
  let hasRequiredFields = hasName && hasState && hasFacts;
  
  if (mergedData.state === 'TX' || mergedData.state === 'UT') {
    hasRequiredFields = hasRequiredFields && !!mergedData.county;
  }
  
  return hasRequiredFields;
}

// Generate helpful next steps
generateNextSteps(extractedData, currentData) {
  const mergedData = { ...currentData, ...extractedData };
  const steps = [];
  
  if (!mergedData.affiantName) {
    steps.push("Provide your full legal name");
  }
  if (!mergedData.state) {
    steps.push("Specify which state (Texas, Utah, or Arizona)");
  }
  if (!mergedData.county && (mergedData.state === 'TX' || mergedData.state === 'UT')) {
    steps.push(`Specify the county in ${mergedData.state === 'TX' ? 'Texas' : 'Utah'}`);
  }
  if (!mergedData.facts || mergedData.facts.length === 0) {
    steps.push("Describe the facts for your affidavit");
  }
  
  if (steps.length === 0) {
    steps.push("Review and finalize your affidavit");
  }
  
  return steps;
}

// Helper methods
needsMoreInfo(extractedData, currentData) {
  return !this.determineCompleteness(extractedData, currentData);
}

calculateProgress(extractedData, currentData) {
  const mergedData = { ...currentData, ...extractedData };
  let completed = 0;
  let total = 3; // name, state, facts
  
  if (mergedData.affiantName) completed++;
  if (mergedData.state) completed++;
  if (mergedData.facts && mergedData.facts.length > 0) completed++;
  
  // Add county requirement for TX/UT
  if (mergedData.state === 'TX' || mergedData.state === 'UT') {
    total++;
    if (mergedData.county) completed++;
  }
  
  return Math.round((completed / total) * 100);
}

getNextPrompt(extractedData, currentData) {
  const mergedData = { ...currentData, ...extractedData };
  
  if (!mergedData.affiantName) {
    return "What is your full legal name?";
  }
  if (!mergedData.state) {
    return "Which state is your case in? (Texas, Utah, or Arizona)";
  }
  if (!mergedData.county && (mergedData.state === 'TX' || mergedData.state === 'UT')) {
    return "Which county is your case in?";
  }
  if (!mergedData.facts || mergedData.facts.length === 0) {
    return "What facts or information do you need to include in your affidavit?";
  }
  
  return "Is there anything else you'd like to add to your affidavit?";
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
      const content = await this.contentStrategies[strategy](affidavitData);
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

  async generateSimpleContent(affidavitData) {
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
      response_format: "json"
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generateDetailedContent(affidavitData) {
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
      response_format: "json"
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generatePersuasiveContent(affidavitData) {
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
      response_format: "json"
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async generateLegalContent(affidavitData) {
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
      max_tokens: this.maxTokens
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