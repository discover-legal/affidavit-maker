// services/affidavitService.js - UPDATED WITH COUNTY & CASE CAPTION COLLECTION
const logger = require('../utils/logger');
const courtNameService = require('./courtNameService');

// Legal categories for LLM function calling
const LEGAL_CATEGORIES = {
  financial: {
    name: 'Financial',
    subcategories: ['income', 'assets', 'debts', 'payments', 'support', 'expenses'],
    description: 'Money, assets, income, debts, financial obligations',
    validation_focus: 'specificity, amounts, documentation'
  },
  property: {
    name: 'Property',
    subcategories: ['real_estate', 'personal_property', 'vehicles', 'intellectual_property'],
    description: 'Real estate, personal property, vehicles, ownership',
    validation_focus: 'ownership clarity, specific descriptions, legal interest'
  },
  relational: {
    name: 'Relationships',
    subcategories: ['family', 'custody', 'visitation', 'marriage', 'divorce'],
    description: 'Family relationships, custody, marriage, divorce',
    validation_focus: 'avoid hearsay, personal knowledge only, formal language'
  },
  temporal: {
    name: 'Chronological',
    subcategories: ['dates', 'timelines', 'sequences', 'duration'],
    description: 'Dates, times, chronological sequences',
    validation_focus: 'specific dates, avoid approximations'
  },
  witness: {
    name: 'Witness Testimony',
    subcategories: ['observations', 'conversations', 'events', 'actions'],
    description: 'Direct observations, witnessed events',
    validation_focus: 'first-person observations only, no hearsay'
  },
  communication: {
    name: 'Communications',
    subcategories: ['verbal', 'written', 'electronic', 'legal_notices'],
    description: 'Conversations, emails, texts, legal notices',
    validation_focus: 'direct participation, avoid "I heard" statements'
  },
  parental: {
    name: 'Parental Care',
    subcategories: ['childcare', 'education', 'health', 'environment', 'routines'],
    description: 'Child care, education, health, living environment',
    validation_focus: 'specific examples, avoid emotional language, factual observations'
  }
};

class AffidavitService {
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.openAIService = global.openAIService;
    this.processingQueue = new Map();
    
    this.constants = {
      MAX_MESSAGE_LENGTH: 5000,
      MAX_COMPLETION_TOKENS: 2000,
      MAX_CONVERSATION_MESSAGES: 20,
      CHAT_TIMEOUT: 30000
    };
  }

  /**
   * ✅ UPDATED: Main processing with county & case caption collection
   */
  async processMessage(message, conversationHistory = [], affidavitData = {}, userId = null, sessionId = null, skipExtraction = false) {
    const processingKey = `${userId || 'anonymous'}_${sessionId || 'session'}_${Date.now()}`;

    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        return {
          success: false,
          error: "Please provide a message to process.",
          chatResponse: "I didn't receive a message. Could you please try again?"
        };
      }

      if (message.length > this.constants.MAX_MESSAGE_LENGTH) {
        return {
          success: false,
          error: "Message is too long. Please send shorter messages.",
          chatResponse: "That message is quite long. Could you break it into smaller parts?"
        };
      }

      // Clean up conversation history
      const recentHistory = this.convertConversationHistory(conversationHistory);

      // Include existing facts to prevent duplicates
      const existingFactsSummary = this.formatExistingFacts(affidavitData.facts || []);

      // Call consolidated LLM with existing facts context
      const result = await this.callConsolidatedLLM(
        message,
        recentHistory,
        affidavitData,
        existingFactsSummary,
        sessionId,
        skipExtraction
      );

      return {
        success: true,
        response: result.chatResponse,
        affidavitData: result.updatedAffidavitData,
        newFacts: result.extractedFacts,
        validation: result.validationSummary || {},
        categories: result.categories || [],
        suggestions: result.suggestions || []
      };

    } catch (error) {
      logger.error('AffidavitService.processMessage error:', {
        error: error.message,
        stack: error.stack,
        sessionId
      });

      return {
        success: false,
        error: this.getUserFriendlyError(error),
        chatResponse: this.getUserFriendlyError(error)
      };
    }
  }

  /**
   * ✅ Format existing facts for LLM to see
   */
  formatExistingFacts(facts) {
    if (!facts || facts.length === 0) {
      return "No facts have been added yet.";
    }

    return `EXISTING FACTS (${facts.length} total):
${facts.map((fact, index) => {
  const content = typeof fact === 'string' ? fact : (fact.content || '');
  return `${index + 1}. ${content}`;
}).join('\n')}

IMPORTANT: Do NOT extract facts that are already captured above. Only extract NEW information that hasn't been mentioned yet.`;
  }

  /**
   * ✅ UPDATED: System prompt with county & case caption collection
   */
  createConsolidatedSystemPrompt() {
    return `You are a legal assistant helping someone create an affidavit for family court. You MUST ALWAYS use the process_affidavit_message function to extract structured data while providing a conversational response.

CRITICAL RULES:
1. You must ALWAYS call the process_affidavit_message function with every response
2. ONLY extract NEW facts - the user will provide you with existing facts
3. If information is already captured, acknowledge it but DON'T extract it again
4. Ask follow-up questions to get missing details (dates, amounts, specifics)
5. Be warm and conversational while silently extracting data

YOUR DUAL ROLE:
1. EXTRACT structured legal data (names, states, county, case info, NEW facts only) via function calling
2. PROVIDE a warm, conversational response to keep them sharing

SUPPORTED JURISDICTIONS: Check template registry for current coverage (US states and Canadian provinces)

EXTRACTION RULES:
- ALWAYS ask for BOTH legal first name AND legal last name separately
  * Ask: "What is your legal first name?" then "What is your legal last name?"
  * Extract first name and last name as separate fields
  * If user provides full name (e.g., "Mike Jones"), split it into firstName: "Mike" and lastName: "Jones"
  * Never proceed with just a first name - always ask for the last name too
- ALWAYS look for states, even informal mentions (texas = extract as "TX")
- ONLY extract NEW facts that aren't already in the existing facts list
- Extract EVERYTHING relevant that's NEW
- ALWAYS extract facts in FIRST PERSON from the affiant's perspective, regardless of how the user phrases their input
  * User says: "Mike Smith contributed to the business" → Extract: "I contributed to the business"
  * User says: "He paid $500" → Extract: "I paid $500"
  * User says: "The affiant witnessed the incident" → Extract: "I witnessed the incident"
  * Format as direct first-person statements: "I am...", "I reside...", "I witnessed...", "I was informed by..."
  * Write as if the affiant is speaking directly under oath

EVIDENCE DETECTION - CRITICAL:
When the user mentions documents or attachable evidence, you MUST:
1. CREATE a SEPARATE evidence item for EACH document mentioned (one file per evidence item)
2. EXTRACT each with is_evidence: true
3. PROVIDE a specific description for each document
4. RESPOND acknowledging ALL evidence items and offering upload buttons for each

**ONE FILE PER EVIDENCE ITEM - CRITICAL:**
- If user says "I have a bank statement and a pay stub" → Create TWO evidence items
- If user says "I have 3 receipts" → Create THREE evidence items
- If user says "2 letters" → Create TWO evidence items
- If user says "a couple of documents" → Create TWO evidence items
- Each evidence item = exactly ONE file upload
- NEVER combine multiple documents into one evidence item

**WHEN USER MENTIONS A NUMBER:**
- "2 documents" = 2 separate evidence items (Letter #1, Letter #2)
- "3 photos" = 3 separate evidence items (Photo #1, Photo #2, Photo #3)
- "a few emails" = 2-3 separate evidence items (be conservative, ask if unclear)
- COUNT the number mentioned and create EXACTLY that many evidence items

Examples of evidence mentions:
- "I have a bank statement showing..." → 1 evidence item
- "The email from my lawyer proves..." → 1 evidence item
- "I have a bank statement and pay stub" → 2 evidence items
- "I can provide 3 photos of the damage" → 3 evidence items
- "I have tax returns from 2023 and 2024" → 2 evidence items
- "The receipt and invoice prove..." → 2 evidence items
- "I want to add 2 letters I got" → 2 evidence items (Letter #1, Letter #2)
- "I have 2 documents to upload" → 2 evidence items (Document #1, Document #2)

Evidence response pattern (single):
"I've created a placeholder for [description]. You can upload that document now using the button below, or add it later through the validation pane on the right."

Evidence response pattern (multiple):
"I've created placeholders for:
1. [description 1]
2. [description 2]
You can upload each document using the buttons below, or add them later through the validation pane on the right."

IMPORTANT: Do NOT provide legal advice about what evidence is admissible or how it should be used. Simply acknowledge the evidence and facilitate the upload.

COUNTY COLLECTION - CRITICAL:
- When state is extracted, IMMEDIATELY ask for the county
- Example: "Great! I see you're in Texas. Which county are you in?"
- If user provides address, extract county from it
- Priority order: (1) Explicit mention, (2) Infer from address, (3) Ask directly
- County is REQUIRED for all affidavits - do not proceed without it

ADDRESS TO COUNTY INFERENCE EXAMPLES:
- "Austin" → Travis County (Texas)
- "Dallas" → Dallas County (Texas)
- "Houston" → Harris County (Texas)
- "Salt Lake City" → Salt Lake County (Utah)
- "Phoenix" → Maricopa County (Arizona)
- Always confirm inferred county: "I see you're in Austin - is that Travis County?"

CASE CAPTION COLLECTION - FAMILY LAW FOCUS:
These affidavits are for family law court cases. You MUST collect case caption information:

1. **Case Number** - Ask: "Do you have a case number for this matter?"
   - Examples: "2024-12345", "No. 2024-01234"
   - If user doesn't have one yet: "That's okay - you can add it later when you file."

2. **Court Name** - Ask: "Which court is handling your case?"
   - Examples: "250th District Court", "Family Court"
   - If user doesn't know: Offer to help based on their county

3. **Parties** - Ask: "Who are the parties in this case?"
   - Format: "Petitioner/Plaintiff vs Respondent/Defendant"
   - Examples: "John Smith vs Jane Smith", "In re: Marriage of Smith"

COLLECTION ORDER:
1. First Name → 2. Last Name → 3. State → 4. County → 5. Case Caption Info → 6. Facts

NAME COLLECTION - CRITICAL:
- ALWAYS collect first name and last name as separate fields
- Ask: "What is your legal first name?" (wait for response)
- Then ask: "And what is your legal last name?"
- If user gives full name at once (e.g., "John Smith"), extract both parts
- Never move forward without both first AND last name

COURT NAME FORMATS BY STATE:
**Texas**: "[XXX]th District Court, [County] County, Texas"
  Examples: 
  - "250th District Court, Travis County, Texas"
  - "255th District Court, Dallas County, Texas"

**Utah**: "District Court, [Judicial District] District, [County] County, State of Utah"
  Examples:
  - "District Court, Third District, Salt Lake County, State of Utah"
  - "District Court, Fourth District, Utah County, State of Utah"

**Arizona**: "Superior Court of Arizona in and for the County of [County]"
  Examples:
  - "Superior Court of Arizona in and for the County of Maricopa"
  - "Superior Court of Arizona in and for the County of Pima"

CONVERSATION STYLE:
- Warm, supportive, professional
- Ask follow-up questions: "Can you tell me more about..." "What happened next?"
- Acknowledge their story: "I understand that must have been difficult"
- Guide toward specifics: "Can you be more specific about the date/location/amount?"
- Normalize asking for case info: "This helps ensure your affidavit is properly formatted for court"

LEGAL CATEGORIES for extraction:
${Object.entries(LEGAL_CATEGORIES).map(([key, cat]) => 
  `• ${key}: ${cat.description}`
).join('\n')}

Remember: Only extract NEW information. Existing facts will be shown to you.`;
  }

  /**
   * ✅ UPDATED: Create user prompt with current status
   */
  createUserPrompt(message, affidavitData, existingFactsSummary) {
    return `USER MESSAGE: "${message}"

CURRENT AFFIDAVIT STATUS:
- First Name: ${affidavitData.firstName || (affidavitData.affiantName ? affidavitData.affiantName.split(' ')[0] : '❌ NOT PROVIDED - ASK FOR IT!')}
- Last Name: ${affidavitData.lastName || (affidavitData.affiantName ? affidavitData.affiantName.split(' ').slice(1).join(' ') : '❌ NOT PROVIDED - ASK FOR IT!')}
- State: ${affidavitData.state || 'Not selected'}
- County: ${affidavitData.county || '❌ NOT PROVIDED - ASK FOR IT!'}
- Case Number: ${affidavitData.caseNumber || 'Not provided'}
- Court Name: ${affidavitData.courtName || 'Not provided'}
- Parties: ${affidavitData.plaintiff && affidavitData.defendant ? `${affidavitData.plaintiff} vs ${affidavitData.defendant}` : 'Not provided'}

${existingFactsSummary}

CRITICAL INSTRUCTION: Only extract NEW facts that are NOT already in the existing facts list above. If the user is clarifying or expanding on an existing fact, include the additional detail as a new fact with context.`;
  }

  /**
   * ✅ UPDATED: Affidavit processing tool with county & case caption fields
   */
  createAffidavitProcessingTool() {
    return {
      type: "function",
      function: {
        name: "process_affidavit_message",
        description: "MANDATORY: Process every user message to extract legal data and provide conversational response. Always call this function.",
        parameters: {
          type: "object",
          properties: {
            chat_response: {
              type: "string",
              description: "REQUIRED: Conversational response to keep user engaged. Always provide this."
            },
            extracted_first_name: {
              type: "string",
              description: "First name mentioned or extracted. If user gives full name, split it. Use null if not mentioned."
            },
            extracted_last_name: {
              type: "string",
              description: "Last name mentioned or extracted. If user gives full name, split it. Use null if not mentioned."
            },
            extracted_state: {
              type: "string",
              enum: ["TX", "UT", "AZ", "UNSUPPORTED", "NONE"],
              description: "State mentioned: TX=Texas, UT=Utah, AZ=Arizona, UNSUPPORTED=other states, NONE=not mentioned"
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_county: {
              type: "string",
              description: "County name if mentioned or inferred from address. Use null if not mentioned."
            },
            case_number: {
              type: "string",
              description: "Case number if mentioned (e.g., '2024-12345', 'No. 2024-01234'). Use null if not mentioned."
            },
            court_name: {
              type: "string",
              description: "Court name if mentioned (e.g., '250th District Court', 'Family Court'). Use null if not mentioned."
            },
            plaintiff: {
              type: "string",
              description: "Plaintiff/Petitioner name if mentioned. Use null if not mentioned."
            },
            defendant: {
              type: "string",
              description: "Defendant/Respondent name if mentioned. Use null if not mentioned."
            },
            extracted_facts: {
              type: "array",
              description: "ONLY NEW legal facts not in the existing facts list",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Original fact as user stated it"
                  },
                  category: {
                    type: "string",
                    enum: Object.keys(LEGAL_CATEGORIES),
                    description: "Legal category that best fits this fact"
                  },
                  subcategory: {
                    type: "string",
                    description: "More specific subcategory"
                  },
                  validation_issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Potential issues (hearsay, vague, needs dates)"
                  },
                  severity: {
                    type: "string",
                    enum: ["success", "info", "warning", "critical"],
                    description: "Severity of any issues"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence in extraction (0.0-1.0)"
                  },
                  is_evidence: {
                    type: "boolean",
                    description: "TRUE if this is evidence/document that user mentioned and needs to upload (e.g., bank statement, email, photo). Use null or false for regular facts."
                  },
                  evidence_description: {
                    type: "string",
                    description: "Brief description of the evidence if is_evidence=true (e.g., 'Bank statement from January 2025', 'Email from attorney'). Use null if not evidence."
                  },
                  evidence_mentioned_as: {
                    type: "string",
                    description: "How user referred to the evidence (e.g., 'bank statement', 'email', 'photo', 'receipt'). Use null if not evidence."
                  }
                },
                required: ["content", "category"]
              }
            },
            validation_summary: {
              type: "object",
              description: "Overall validation summary",
              properties: {
                has_critical_issues: { type: "boolean" },
                total_issues: { type: "number" },
                completeness_score: { type: "number" }
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for the user"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }

  /**
   * ✅ UPDATED: Consolidated LLM call
   */
  async callConsolidatedLLM(message, conversationHistory, affidavitData, existingFactsSummary, sessionId, skipExtraction = false) {
    // If skipExtraction is true, use simple chat without function calling
    if (skipExtraction) {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant that provides concise, narrative summaries.' },
        { role: 'user', content: message }
      ];

      try {
        const completion = await this.openAIService.chat(messages, {
          model: 'gpt-4o-2024-08-06',
          temperature: 0.5,
          max_tokens: 500
        });

        const response = completion.choices[0].message.content;

        return {
          chatResponse: response,
          updatedAffidavitData: affidavitData,
          extractedFacts: [],
          hasNewData: false
        };
      } catch (error) {
        logger.error('Simple LLM call failed:', error);
        throw error;
      }
    }

    // Standard function calling flow
    const systemPrompt = this.createConsolidatedSystemPrompt();
    const userPrompt = this.createUserPrompt(message, affidavitData, existingFactsSummary);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userPrompt }
    ];

    const tools = [this.createAffidavitProcessingTool()];

    try {
      const completion = await this.openAIService.chat(messages, {
        model: 'gpt-4o-2024-08-06',
        tools,
        tool_choice: { type: "function", function: { name: "process_affidavit_message" } },
        temperature: 0.3,
        max_tokens: this.constants.MAX_COMPLETION_TOKENS
      });

      const toolCall = completion.choices[0].message.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('LLM did not call the required function');
      }

      const functionResult = JSON.parse(toolCall.function.arguments);

      logger.info('Function call extraction', {
        hasFirstName: !!functionResult.extracted_first_name,
        hasLastName: !!functionResult.extracted_last_name,
        hasState: !!functionResult.extracted_state,
        hasCounty: !!functionResult.extracted_county,
        hasCaseNumber: !!functionResult.case_number,
        factsCount: functionResult.extracted_facts?.length || 0,
        sessionId
      });

      return this.processToolCall(functionResult, affidavitData);

    } catch (error) {
      logger.error('LLM call failed:', error);
      throw error;
    }
  }

  /**
   * ✅ UPDATED: Process tool call with county & case caption
   */
  processToolCall(args, currentData) {
    const newData = { ...currentData };
    let hasNewData = false;

    // Extract first name
    if (args.extracted_first_name && args.extracted_first_name !== 'NONE') {
      newData.firstName = String(args.extracted_first_name).trim();
      hasNewData = true;
      // Also update affiantName for backward compatibility
      if (args.extracted_last_name && args.extracted_last_name !== 'NONE') {
        newData.affiantName = `${newData.firstName} ${String(args.extracted_last_name).trim()}`;
      } else {
        newData.affiantName = newData.firstName;
      }
    }

    // Extract last name
    if (args.extracted_last_name && args.extracted_last_name !== 'NONE') {
      newData.lastName = String(args.extracted_last_name).trim();
      hasNewData = true;
      // Also update affiantName for backward compatibility
      if (newData.firstName) {
        newData.affiantName = `${newData.firstName} ${newData.lastName}`;
      } else {
        newData.affiantName = newData.lastName;
      }
    }

    // Extract state
    if (args.extracted_state && args.extracted_state !== 'NONE') {
      if (args.extracted_state === 'UNSUPPORTED') {
        throw new Error(`State "${args.detected_unsupported_state}" is not currently supported. Please visit our website to see currently supported jurisdictions.`);
      }
      newData.state = args.extracted_state;
      hasNewData = true;
    }

    // ✅ Extract county
    if (args.extracted_county) {
      newData.county = String(args.extracted_county).trim();
      hasNewData = true;
    }

    // ✅ Auto-generate court name from county and state if not manually provided
    if (newData.county && newData.state && !args.court_name && !currentData.courtName) {
      const autoCourtName = courtNameService.getDefaultCourtName(
        newData.state,
        newData.county
      );
      if (autoCourtName) {
        newData.courtName = autoCourtName;
        hasNewData = true;
      }
    }

    // ✅ Extract case caption fields
    if (args.case_number) {
      newData.caseNumber = String(args.case_number).trim();
      hasNewData = true;
    }
    if (args.court_name) {
      newData.courtName = String(args.court_name).trim();
      hasNewData = true;
    }
    if (args.plaintiff) {
      newData.plaintiff = String(args.plaintiff).trim();
      hasNewData = true;
    }
    if (args.defendant) {
      newData.defendant = String(args.defendant).trim();
      hasNewData = true;
    }

    // Extract facts - preserve full fact objects with metadata (category, subcategory, etc.)
    const extractedFacts = Array.isArray(args.extracted_facts) ? args.extracted_facts : [];
    let processedFacts = []; // Declare outside if block so we can return it

    if (extractedFacts.length > 0) {
      const existingFacts = currentData.facts || [];
      const { v4: uuidv4 } = require('uuid');

      // Convert evidence facts to proper format
      processedFacts = extractedFacts.map(fact => {
        if (fact.is_evidence) {
          // Convert to evidence type with evidenceData
          const evidenceItem = {
            ...fact,
            id: uuidv4(), // Add unique ID for evidence tracking
            type: 'evidence',
            category: 'evidence',
            evidenceData: {
              exhibitLabel: '', // Will be calculated based on position
              description: fact.evidence_description || fact.evidence_mentioned_as || '',
              fileName: null,
              fileKey: null,
              fileType: null,
              fileSizeBytes: 0,
              filePages: 1,
              uploadedAt: null,
              thumbnailKey: null,
              requiresUpload: true
            }
          };

          logger.info('🔍 Evidence item created:', {
            id: evidenceItem.id,
            description: evidenceItem.evidenceData.description,
            content: fact.content
          });

          return evidenceItem;
        }
        // Regular fact - ensure it has type: 'fact'
        return {
          ...fact,
          id: fact.id || uuidv4(),
          type: fact.type || 'fact'
        };
      });

      // Store full fact objects to preserve category, subcategory, severity, confidence, etc.
      newData.facts = [...existingFacts, ...processedFacts];
      hasNewData = true;
    }

    return {
      chatResponse: args.chat_response || "I understand. Please continue.",
      updatedAffidavitData: newData,
      extractedFacts: processedFacts, // ✅ FIX: Return processedFacts with type field, not raw extractedFacts
      validationSummary: args.validation_summary || {},
      suggestions: args.suggestions || [],
      hasNewData
    };
  }

  /**
   * ✅ Convert conversation history
   */
  convertConversationHistory(history) {
    if (!Array.isArray(history)) return [];
    
    return history.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content || ''
    })).slice(-10);
  }

  /**
   * ✅ User-friendly error messages
   */
  getUserFriendlyError(error) {
    if (error.message?.includes('timeout')) {
      return 'Your request timed out. Please try sending a shorter message.';
    }
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return 'The AI service is currently busy. Please wait a moment and try again.';
    }
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      return 'There\'s a temporary service issue. Please try again in a few minutes.';
    }
    return 'Sorry, I encountered an error processing your message. Please try again.';
  }
}

module.exports = AffidavitService;
