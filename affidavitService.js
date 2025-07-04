// affidavitService.js - Modular LLM-based affidavit generation

const OpenAI = require('openai');

class AffidavitService {
  constructor(openaiApiKey) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Different processing strategies
    this.strategies = {
      simple: this.simpleStrategy.bind(this),
      structured: this.structuredStrategy.bind(this),
      advanced: this.advancedStrategy.bind(this)
    };
  }

  // Main entry point - uses strategy pattern
  async processAffidavit(affidavitData, strategy = 'simple') {
    const processingStrategy = this.strategies[strategy] || this.strategies.simple;
    return await processingStrategy(affidavitData);
  }

  // STRATEGY 1: Simple single-shot generation (current approach)
  async simpleStrategy(affidavitData) {
    const prompt = this.buildSimplePrompt(affidavitData);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: 'You are a legal document specialist creating formal affidavits. Focus on clear, persuasive legal language.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });

    return {
      content: completion.choices[0].message.content,
      metadata: {
        strategy: 'simple',
        model: 'gpt-4',
        timestamp: new Date().toISOString()
      }
    };
  }

  // STRATEGY 2: Structured multi-step approach
  async structuredStrategy(affidavitData) {
    // Step 1: Break down and outline the story
    const outline = await this.generateOutline(affidavitData);
    
    // Step 2: Organize based on legal issues
    const organized = await this.organizeByLegalIssues(outline, affidavitData);
    
    // Step 3: Generate final affidavit
    const final = await this.generateFromOrganizedContent(organized, affidavitData);
    
    return {
      content: final,
      metadata: {
        strategy: 'structured',
        outline,
        organized,
        model: 'gpt-4',
        timestamp: new Date().toISOString()
      }
    };
  }

  // STRATEGY 3: Advanced iterative approach
  async advancedStrategy(affidavitData) {
    // Step 1: Extract key facts and timeline
    const analysis = await this.analyzeFactsAndTimeline(affidavitData);
    
    // Step 2: Identify legal issues and relevant points
    const legalFramework = await this.identifyLegalFramework(analysis, affidavitData);
    
    // Step 3: Create persuasive narrative structure
    const narrative = await this.createPersuasiveNarrative(legalFramework, analysis);
    
    // Step 4: Generate draft
    const draft = await this.generateDraft(narrative, affidavitData);
    
    // Step 5: Review and refine for legal compliance
    const refined = await this.refineForCompliance(draft, affidavitData);
    
    return {
      content: refined,
      metadata: {
        strategy: 'advanced',
        analysis,
        legalFramework,
        narrative,
        draft,
        model: 'gpt-4',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Helper methods for structured approach
  async generateOutline(affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Create a structured outline of facts for a legal affidavit. Group related facts and identify key themes.'
        },
        {
          role: 'user',
          content: `Create an outline for an affidavit with these facts: ${JSON.stringify(affidavitData.facts)}`
        }
      ],
      temperature: 0.5,
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async organizeByLegalIssues(outline, affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a legal strategist organizing facts for maximum persuasive impact in ${affidavitData.caseType} cases.`
        },
        {
          role: 'user',
          content: `Reorganize this outline for maximum legal impact in a ${affidavitData.state} ${affidavitData.caseType} case: ${JSON.stringify(outline)}`
        }
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content;
  }

  async generateFromOrganizedContent(organized, affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: this.getStateSpecificInstructions(affidavitData.state)
        },
        {
          role: 'user',
          content: `Generate a formal affidavit based on this organized content: ${organized}`
        }
      ],
      temperature: 0.2,
    });

    return completion.choices[0].message.content;
  }

  // Helper methods for advanced approach
  async analyzeFactsAndTimeline(affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Analyze facts to extract timeline, key events, parties involved, and critical details.'
        },
        {
          role: 'user',
          content: `Analyze these facts for timeline and key elements: ${JSON.stringify(affidavitData)}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async identifyLegalFramework(analysis, affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Identify legal issues and relevant legal standards for ${affidavitData.caseType} in ${affidavitData.state}.`
        },
        {
          role: 'user',
          content: `Based on this analysis, identify legal issues and how to frame them: ${JSON.stringify(analysis)}`
        }
      ],
      temperature: 0.4,
    });

    return completion.choices[0].message.content;
  }

  async createPersuasiveNarrative(legalFramework, analysis) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Create a persuasive narrative structure that presents facts in the most compelling legal order.'
        },
        {
          role: 'user',
          content: `Create narrative structure using this legal framework: ${legalFramework} and analysis: ${JSON.stringify(analysis)}`
        }
      ],
      temperature: 0.4,
    });

    return completion.choices[0].message.content;
  }

  async generateDraft(narrative, affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Generate a formal legal affidavit following the provided narrative structure.'
        },
        {
          role: 'user',
          content: `Generate affidavit following this narrative: ${narrative} for ${affidavitData.affiantName}`
        }
      ],
      temperature: 0.2,
    });

    return completion.choices[0].message.content;
  }

  async refineForCompliance(draft, affidavitData) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Review and refine this affidavit for ${affidavitData.state} legal compliance and maximum clarity.`
        },
        {
          role: 'user',
          content: `Refine this draft for legal compliance: ${draft}`
        }
      ],
      temperature: 0.1,
    });

    return completion.choices[0].message.content;
  }

  // Utility methods
  buildSimplePrompt(affidavitData) {
    return `Generate a formal legal affidavit with the following information:
    
State: ${affidavitData.state}
Case Type: ${affidavitData.caseType}
Affiant: ${affidavitData.affiantName}
Case Number: ${affidavitData.caseNumber}

Facts to include:
${affidavitData.facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Format the affidavit with:
1. Proper heading with state and county
2. Case caption with case number
3. Title "AFFIDAVIT OF [NAME]"
4. Opening statement (I, [name], being duly sworn...)
5. Numbered facts in first person
6. Closing statement under penalty of perjury
7. Signature and notary blocks

Make it formal and legally appropriate for ${affidavitData.state}.`;
  }

  getStateSpecificInstructions(state) {
    const instructions = {
      'TX': 'Generate a Texas-compliant affidavit with "THE STATE OF TEXAS" header, proper venue section, and Texas notary language.',
      'UT': 'Generate a Utah-compliant affidavit with "STATE OF UTAH" header and Utah-specific notary requirements.',
      'AZ': 'Generate an Arizona-compliant affidavit with simplified format and Arizona notary block.'
    };
    
    return instructions[state] || instructions['TX'];
  }

  // Configuration methods
  setModel(model) {
    this.model = model;
  }

  setTemperature(temperature) {
    this.temperature = temperature;
  }

  // Add custom strategies
  addStrategy(name, strategyFunction) {
    this.strategies[name] = strategyFunction.bind(this);
  }
}

// Usage in server.js
const affidavitService = new AffidavitService(process.env.OPENAI_API_KEY);

// Simple endpoint modification
app.post('/api/generate-affidavit', requiresAuth(), async (req, res) => {
  try {
    const { affidavitData, strategy = 'simple' } = req.body;
    
    // Use the modular service
    const result = await affidavitService.processAffidavit(affidavitData, strategy);
    
    // Save to database with metadata
    const document = await pool.query(
      `UPDATE documents 
       SET generated_text = $1, 
           generation_metadata = $2,
           status = 'completed',
           completed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [result.content, JSON.stringify(result.metadata), affidavitData.documentId]
    );
    
    // Generate PDF
    const pdfPath = await generatePDF(result.content, affidavitData);
    
    res.json({
      success: true,
      content: result.content,
      downloadUrl: `/api/download/${document.rows[0].id}`,
      metadata: result.metadata
    });
    
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate affidavit' });
  }
});

// Example: Adding a custom strategy
affidavitService.addStrategy('persuasive_divorce', async function(affidavitData) {
  // Custom logic for divorce cases
  const childrenInvolved = affidavitData.facts.some(f => 
    f.toLowerCase().includes('child') || f.toLowerCase().includes('custody')
  );
  
  if (childrenInvolved) {
    // Special handling for custody matters
    const bestInterests = await this.analyzeBestInterestsFactors(affidavitData);
    const parentingPlan = await this.structureParentingNarrative(bestInterests, affidavitData);
    return await this.generateFromParentingPlan(parentingPlan, affidavitData);
  } else {
    // Property division focus
    const assets = await this.identifyAssets(affidavitData);
    const equitableNarrative = await this.createEquitableDistributionNarrative(assets, affidavitData);
    return await this.generateFromPropertyNarrative(equitableNarrative, affidavitData);
  }
});

module.exports = AffidavitService;