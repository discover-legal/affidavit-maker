// services/affidavitService.js - UPDATED WITH COUNTY & CASE CAPTION COLLECTION
const logger = require('../utils/logger');
const courtNameService = require('./courtNameService');
const { DEFAULT_LLM_MODEL } = require('./llmConfig');
const { mergeChildren } = require('../utils/childrenMerge');
const { randomUUID } = require('node:crypto');
const {
  EXTRACTION_QUALITY,
  FIRST_NAME_DESCRIPTION,
  LAST_NAME_DESCRIPTION,
  FACT_CONTENT_DESCRIPTION,
  SUPERSEDED_FACTS_DESCRIPTION,
} = require('./agents/extractionQuality');
const { retireFacts, sanitizeSupersededStatements } = require('./agents/factRetirement');

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

// Divorce-specific categories for divorce package documents
const DIVORCE_CATEGORIES = {
  marriage: {
    name: 'Marriage Information',
    subcategories: ['marriage_date', 'marriage_location', 'marriage_duration', 'separation'],
    description: 'Date and place of marriage, separation details',
    validation_focus: 'exact dates, official records'
  },
  grounds: {
    name: 'Grounds for Divorce',
    subcategories: ['irreconcilable_differences', 'incompatibility', 'no_fault', 'fault_based'],
    description: 'Legal grounds for dissolution of marriage',
    validation_focus: 'state-specific requirements, factual basis'
  },
  children: {
    name: 'Children',
    subcategories: ['minor_children', 'custody', 'visitation', 'child_support', 'special_needs'],
    description: 'Minor children of the marriage, custody arrangements',
    validation_focus: 'names, ages, custody preferences, best interests'
  },
  property_division: {
    name: 'Property Division',
    subcategories: ['marital_property', 'separate_property', 'real_estate', 'vehicles', 'retirement', 'debts'],
    description: 'Division of marital assets and debts',
    validation_focus: 'ownership, valuation, proposed division'
  },
  spousal_support: {
    name: 'Spousal Support',
    subcategories: ['alimony', 'maintenance', 'duration', 'amount'],
    description: 'Spousal support/alimony requests',
    validation_focus: 'income disparity, duration of marriage, need'
  },
  residence: {
    name: 'Residency',
    subcategories: ['current_residence', 'residency_requirements', 'jurisdiction'],
    description: 'Residency information for jurisdiction',
    validation_focus: 'state residency requirements, duration'
  }
};

class AffidavitService {
  constructor(templateManager) {
    this.templateManager = templateManager;
    // Read `global.openAIService` lazily — the chat route caches this
    // service singleton, so construction can race ahead of the LLM wiring
    // in `lib/api/services.ts`. A getter resolves the latest value each
    // call instead of caching `undefined` for the lifetime of the process.
    Object.defineProperty(this, 'openAIService', {
      get() { return global.openAIService; },
      configurable: true,
    });
    this.processingQueue = new Map();

    this.constants = {
      MAX_MESSAGE_LENGTH: 5000,
      MAX_COMPLETION_TOKENS: 2000,
      MAX_CONVERSATION_MESSAGES: 20,
      CHAT_TIMEOUT: 30000
    };

    // Get dynamically supported states from template manager
    this.supportedStates = this.getSupportedStatesList();
  }

  /**
   * Get list of supported states from template manager
   * @returns {Array} Array of {code, name} objects
   */
  getSupportedStatesList() {
    try {
      const states = this.templateManager.getSupportedStates();
      return states.map(s => ({ code: s.code, name: s.name }));
    } catch (error) {
      logger.error('Failed to get supported states, using fallback:', error);
      // Fallback to default states
      return [
        { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' },
        { code: 'AZ', name: 'Arizona' }
      ];
    }
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

SUPPORTED JURISDICTIONS: Currently available - ${this.supportedStates.map(s => `${s.name} (${s.code})`).join(', ')}
- If user mentions these states → Extract normally
- If user mentions OTHER states → Set extracted_state to "UNSUPPORTED" and inform them politely
- Response for unsupported states: "I appreciate you sharing that information! Unfortunately, we don't currently support [State Name] yet, but we're working on expanding. We currently serve ${this.supportedStates.map(s => s.name).join(', ')}. Is there anything else I can help you with?"

EXTRACTION RULES:
- Collect the affiant's FULL legal name (first and last fields)
  * If only part of the name was given, ask for the missing part — never proceed with just a first name
  * If the user provides a full name at once (e.g., "Mike Jones"), split it: firstName holds ALL given and middle names, lastName holds the COMPLETE surname including hyphenated/compound parts
  * "Ellis Jane Smith Son-Wyatt" → firstName: "Ellis Jane", lastName: "Smith Son-Wyatt" — NEVER truncate to "Ellis Smith"
  * Normalize to proper name case ("mike smith" → "Mike Smith") while preserving internal capitals the user typed (McDonald, van der Berg)
  * NEVER re-ask for a name (or any value) the user already provided anywhere in the conversation — acknowledge it instead
- ALWAYS look for states, even informal mentions (texas = extract as "TX")
- ONLY extract NEW facts that aren't already in the existing facts list
- Extract EVERYTHING relevant that's NEW
- ALWAYS extract facts in FIRST PERSON from the affiant's perspective when the affiant is describing their own actions or knowledge
  * User says: "I paid $500" → Extract: "I paid $500"
  * User says: "The affiant witnessed the incident" → Extract: "I witnessed the incident"
  * Format as direct first-person statements: "I am...", "I reside...", "I witnessed...", "I was informed by..."
  * Write as if the affiant is speaking directly under oath
- DISAMBIGUATION (CRITICAL): When the user mentions OTHER people using pronouns ("she", "he", "they"), ALWAYS use the person's actual name or role instead of the pronoun
  * User says: "She moved out" (talking about their spouse Jane Smith) → Extract: "Jane Smith vacated the marital residence" or "My spouse, Jane Smith, vacated the marital residence"
  * User says: "He earns $5000" (talking about someone else) → Extract: "[Person's name] earns approximately $5,000 per month"
  * Each fact must be self-contained and understandable without conversational context
  * If you don't know the person's name yet, use their role: "my spouse", "the respondent", "my former partner"

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
${EXTRACTION_QUALITY}

Remember: Only extract NEW information. Existing facts will be shown to you.`;
  }

  /**
   * ✅ DIVORCE PACKAGE: System prompt for divorce petition/decree documents
   */
  createDivorceSystemPrompt() {
    return `You are a legal assistant helping someone create divorce documents (petition and decree) for family court. You MUST ALWAYS use the process_divorce_message function to extract structured data while providing a conversational response.

CRITICAL RULES:
1. You must ALWAYS call the process_divorce_message function with every response
2. ONLY extract NEW information - the user will provide you with existing data
3. If information is already captured, acknowledge it but DON'T extract it again
4. Ask follow-up questions to get missing details (dates, names, specifics)
5. Be warm, empathetic, and professional - divorce is emotionally difficult

YOUR DUAL ROLE:
1. EXTRACT structured divorce data (names, dates, children, property) via function calling
2. PROVIDE a warm, supportive response to guide them through the process

SUPPORTED JURISDICTIONS: Currently available - ${this.supportedStates.map(s => `${s.name} (${s.code})`).join(', ')}
- If user mentions these states → Extract normally
- If user mentions OTHER states → Set extracted_state to "UNSUPPORTED" and inform them politely
- Response for unsupported states: "I understand this is a difficult time. Unfortunately, we don't currently support [State Name] yet, but we're working on expanding. We currently serve ${this.supportedStates.map(s => s.name).join(', ')}. Is there anything else I can help you with?"

DIVORCE DOCUMENT COLLECTION ORDER:
1. **Petitioner Information** (the person filing)
   - First Name, Last Name
   - Current Address
   - How long at current address (for residency requirements)

2. **Respondent Information** (the spouse)
   - First Name, Last Name
   - Current Address (if known)

3. **State & County** - Essential for jurisdiction
   - Which state are you filing in?
   - Which county do you reside in?

4. **Marriage Information**
   - Date of marriage (month/day/year)
   - Place of marriage (city, state, or country)
   - Date of separation (if applicable)

5. **Children** - CRITICAL
   - Are there minor children from this marriage?
   - If yes: names, dates of birth, current living arrangements
   - Custody preferences (joint, sole, etc.)
   - Child support considerations

6. **Property & Debts**
   - Do you own any real estate together?
   - Vehicles, bank accounts, retirement accounts?
   - Outstanding debts (mortgage, loans, credit cards)?
   - Proposed division (if known)

7. **Spousal Support**
   - Is either party requesting spousal support/alimony?
   - Duration and amount considerations

8. **Grounds for Divorce**
   - Most states: No-fault (irreconcilable differences)
   - Ask: "What are the grounds for this divorce?"

RESIDENCY REQUIREMENTS BY STATE:
**Texas**: 6 months state, 90 days county
**Utah**: 90 days residency
**Arizona**: 90 days residency
**California**: 6 months state, 3 months county
**Florida**: 6 months residency
**Illinois**: 90 days residency
**New York**: 1 year residency (varies by grounds)

COLLECTION QUESTIONS TO ASK:
- "When were you and your spouse married?"
- "When did you separate, if you've already separated?"
- "Do you have any children together under 18?"
- "What property or assets do you share?"
- "Are there any debts from the marriage?"
- "How long have you lived in [state]?"
- "What county do you currently reside in?"

CONVERSATION STYLE:
- Warm, empathetic, professional
- Acknowledge emotions: "I understand this is a difficult decision"
- Be encouraging: "You're taking an important step"
- Guide toward specifics without being pushy
- Normalize the process: "These are standard questions for divorce filings"

FACT EXTRACTION - DISAMBIGUATION (CRITICAL):
When extracting facts into the extracted_facts array, you MUST disambiguate all pronoun references and relative references:
- NEVER use "she", "he", "they", "her", "his", "their" without identifying the person by name or role
- ALWAYS use the person's full name or role (Petitioner/Respondent) so each fact is self-contained and understandable on its own
- Each extracted fact must make sense in isolation - a reader should understand who is being referenced without needing context from the conversation

Examples:
- User says: "She moved out last year" → Extract: "[Respondent Name] vacated the marital residence in [year]" (use actual name if known)
- User says: "He earns $5000 a month" → Extract: "[Name] earns approximately $5,000 per month in gross income"
- User says: "They have two kids" → Extract: "The parties have two minor children of the marriage"
- User says: "She took the car" → Extract: "[Respondent Name] took possession of the [vehicle description]"
- If names are not yet known, use "Petitioner" or "Respondent" as placeholders

ALSO: Write facts in formal legal language suitable for a court filing, not conversational language.

EVIDENCE DETECTION - Same as affidavit:
When user mentions documents (marriage certificate, property deeds, financial statements):
- Create evidence items with is_evidence: true
- One file per evidence item
- Acknowledge and offer upload buttons

DIVORCE CATEGORIES for extraction:
${Object.entries(DIVORCE_CATEGORIES).map(([key, cat]) =>
  `• ${key}: ${cat.description}`
).join('\n')}
${EXTRACTION_QUALITY}

Remember: Only extract NEW information. Existing data will be shown to you. Be sensitive to the emotional nature of divorce proceedings.`;
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
   * ✅ DIVORCE PACKAGE: Create user prompt for divorce documents
   */
  createDivorceUserPrompt(message, divorceData, existingFactsSummary) {
    return `USER MESSAGE: "${message}"

CURRENT DIVORCE DOCUMENT STATUS:
**PETITIONER (Person Filing):**
- First Name: ${divorceData.petitionerFirstName || '❌ NOT PROVIDED - ASK FOR IT!'}
- Last Name: ${divorceData.petitionerLastName || '❌ NOT PROVIDED - ASK FOR IT!'}
- Address: ${divorceData.petitionerAddress || 'Not provided'}

**RESPONDENT (Spouse):**
- First Name: ${divorceData.respondentFirstName || '❌ NOT PROVIDED - ASK FOR IT!'}
- Last Name: ${divorceData.respondentLastName || '❌ NOT PROVIDED - ASK FOR IT!'}
- Address: ${divorceData.respondentAddress || 'Not provided'}

**JURISDICTION:**
- State: ${divorceData.state || 'Not selected'}
- County: ${divorceData.county || '❌ NOT PROVIDED - ASK FOR IT!'}
- Residency Duration: ${divorceData.residencyDuration || 'Not provided'}

**MARRIAGE INFORMATION:**
- Date of Marriage: ${divorceData.marriageDate || '❌ NOT PROVIDED - ASK FOR IT!'}
- Place of Marriage: ${divorceData.marriagePlace || 'Not provided'}
- Date of Separation: ${divorceData.separationDate || 'Not provided'}

**CHILDREN:**
- Has Minor Children: ${divorceData.hasMinorChildren !== undefined ? (divorceData.hasMinorChildren ? 'Yes' : 'No') : '❌ NOT PROVIDED - ASK!'}
- Number of Children: ${divorceData.numberOfChildren || 'Not specified'}
- Children Details: ${divorceData.children && divorceData.children.length > 0 ? divorceData.children.map(c => `${c.name} (${c.age})`).join(', ') : 'Not provided'}
- Custody Preference: ${divorceData.custodyPreference || 'Not specified'}

**PROPERTY & DEBTS:**
- Real Estate: ${divorceData.realEstate || 'Not specified'}
- Vehicles: ${divorceData.vehicles || 'Not specified'}
- Has Debts: ${divorceData.hasDebts !== undefined ? (divorceData.hasDebts ? 'Yes' : 'No') : 'Not specified'}

**SPOUSAL SUPPORT:**
- Requesting Support: ${divorceData.requestingSpousalSupport !== undefined ? (divorceData.requestingSpousalSupport ? 'Yes' : 'No') : 'Not specified'}

**GROUNDS:**
- Grounds for Divorce: ${divorceData.groundsForDivorce || 'Not specified (usually irreconcilable differences)'}

**CASE INFO (if already filed):**
- Case Number: ${divorceData.caseNumber || 'Not filed yet'}
- Court Name: ${divorceData.courtName || 'Not specified'}

${existingFactsSummary}

CRITICAL INSTRUCTION: Only extract NEW information that is NOT already captured above. Focus on completing the missing fields marked with ❌.`;
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
              description: `Affiant: ${FIRST_NAME_DESCRIPTION} Use null if not mentioned.`
            },
            extracted_last_name: {
              type: "string",
              description: `Affiant: ${LAST_NAME_DESCRIPTION} Use null if not mentioned.`
            },
            extracted_state: {
              type: "string",
              enum: [...this.supportedStates.map(s => s.code), "UNSUPPORTED", "NONE"],
              description: `State mentioned: ${this.supportedStates.map(s => `${s.code}=${s.name}`).join(', ')}, UNSUPPORTED=other states, NONE=not mentioned`
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_county: {
              type: "string",
              description: "County name if mentioned or inferred from address, in proper name case with obvious typos corrected (e.g. 'simcoe county' → 'Simcoe'). Use null if not mentioned."
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
            superseded_facts: {
              type: "array",
              items: { type: "string" },
              description: SUPERSEDED_FACTS_DESCRIPTION
            },
            extracted_facts: {
              type: "array",
              description: "ONLY NEW legal facts not in the existing facts list",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: FACT_CONTENT_DESCRIPTION
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
   * ✅ DIVORCE PACKAGE: Processing tool for divorce documents
   */
  createDivorceProcessingTool() {
    return {
      type: "function",
      function: {
        name: "process_divorce_message",
        description: "MANDATORY: Process every user message to extract divorce-related data and provide conversational response. Always call this function.",
        parameters: {
          type: "object",
          properties: {
            chat_response: {
              type: "string",
              description: "REQUIRED: Conversational response to guide user through divorce document creation."
            },
            // Petitioner (person filing)
            petitioner_first_name: {
              type: "string",
              description: `Petitioner: ${FIRST_NAME_DESCRIPTION} Use null if not mentioned.`
            },
            petitioner_last_name: {
              type: "string",
              description: `Petitioner: ${LAST_NAME_DESCRIPTION} Use null if not mentioned.`
            },
            petitioner_address: {
              type: "string",
              description: "Petitioner's current address. Use null if not mentioned."
            },
            // Respondent (spouse)
            respondent_first_name: {
              type: "string",
              description: `Respondent (spouse): ${FIRST_NAME_DESCRIPTION} Extract from ANY mention of the spouse, even mid-sentence. Use null if not mentioned.`
            },
            respondent_last_name: {
              type: "string",
              description: `Respondent (spouse): ${LAST_NAME_DESCRIPTION} Use null if not mentioned.`
            },
            respondent_address: {
              type: "string",
              description: "Respondent's current address. Use null if not mentioned."
            },
            // Jurisdiction
            extracted_state: {
              type: "string",
              enum: [...this.supportedStates.map(s => s.code), "UNSUPPORTED", "NONE"],
              description: `State for filing: ${this.supportedStates.map(s => `${s.code}=${s.name}`).join(', ')}, UNSUPPORTED=other states, NONE=not mentioned`
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_county: {
              type: "string",
              description: "County name if mentioned, in proper name case with obvious typos corrected (e.g. 'simcoe county' → 'Simcoe'). Use null if not mentioned."
            },
            residency_duration: {
              type: "string",
              description: "How long petitioner has lived in the state, with typos normalized and the unit spelled out (e.g., '35 yeRs' → '35 years'; '2928 days' → '2928 days (approximately 8 years)'). Use null if not mentioned."
            },
            // Marriage Information
            marriage_date: {
              type: "string",
              description: "Date of marriage (format: YYYY-MM-DD or as provided). Use null if not mentioned."
            },
            marriage_place: {
              type: "string",
              description: "City/State/Country where marriage took place. Use null if not mentioned."
            },
            separation_date: {
              type: "string",
              description: "Date of separation (format: YYYY-MM-DD or as provided). Use null if not mentioned."
            },
            // Children
            has_minor_children: {
              type: "boolean",
              description: "True if there are minor children from the marriage, false if none, null if not discussed."
            },
            number_of_children: {
              type: "number",
              description: "Number of minor children. Use null if not mentioned."
            },
            children: {
              type: "array",
              description: "Details of minor children",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Child's full name" },
                  date_of_birth: { type: "string", description: "Child's date of birth" },
                  age: { type: "number", description: "Child's current age" },
                  lives_with: { type: "string", description: "Who the child currently lives with" }
                }
              }
            },
            custody_preference: {
              type: "string",
              enum: ["joint_legal_physical", "joint_legal_sole_physical", "sole", "other", null],
              description: "Preferred custody arrangement. Use null if not mentioned."
            },
            custody_details: {
              type: "string",
              description: "Additional custody arrangement details. Use null if not mentioned."
            },
            // Property & Debts
            real_estate: {
              type: "string",
              description: "Description of real estate owned (address, estimated value), in neutral third-person court language using the parties' names or roles — never \"my\"/\"me\"/\"I\". Keep values intact (\"approximately $62,000\" stays with its asset). Use null if not mentioned."
            },
            vehicles: {
              type: "string",
              description: "Description of vehicles owned. Use null if not mentioned."
            },
            bank_accounts: {
              type: "string",
              description: "Description of bank accounts. Use null if not mentioned."
            },
            retirement_accounts: {
              type: "string",
              description: "Description of retirement/pension accounts. Use null if not mentioned."
            },
            other_assets: {
              type: "string",
              description: "Description of other significant assets. Use null if not mentioned."
            },
            has_debts: {
              type: "boolean",
              description: "True if there are marital debts, false if none, null if not discussed."
            },
            debts_description: {
              type: "string",
              description: "Description of debts (mortgage, loans, credit cards), in neutral third-person court language using the parties' names or roles — \"to be refinanced into the petitioner's name\", never \"my\"/\"me\"/\"I\". Keep each debt's amount intact. Use null if not mentioned."
            },
            property_division_preference: {
              type: "string",
              description: "How petitioner wants to divide property, in neutral third-person court language using the parties' names or roles — never \"my\"/\"me\"/\"I\". Use null if not mentioned."
            },
            // Spousal Support
            requesting_spousal_support: {
              type: "boolean",
              description: "True if requesting spousal support, false if not, null if not discussed."
            },
            spousal_support_details: {
              type: "string",
              description: "Details about spousal support request (amount, duration). Use null if not mentioned."
            },
            // Grounds
            grounds_for_divorce: {
              type: "string",
              enum: ["irreconcilable_differences", "incompatibility", "living_separate", "other", null],
              description: "Legal grounds for divorce. Use null if not mentioned."
            },
            grounds_details: {
              type: "string",
              description: "Additional details about grounds. Use null if not mentioned."
            },
            // Case Info (if already filed)
            case_number: {
              type: "string",
              description: "Case number if case has been filed. Use null if not mentioned."
            },
            court_name: {
              type: "string",
              description: "Name of the court. Use null if not mentioned."
            },
            // Corrections (any phase)
            superseded_facts: {
              type: "array",
              items: { type: "string" },
              description: SUPERSEDED_FACTS_DESCRIPTION
            },
            // Additional facts (same structure as affidavit)
            extracted_facts: {
              type: "array",
              description: "Additional legal facts not covered by specific fields above. MUST use full names or roles (Petitioner/Respondent) instead of pronouns. Each fact must be self-contained.",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: `Formal legal language, understandable in isolation. ${FACT_CONTENT_DESCRIPTION}`
                  },
                  category: {
                    type: "string",
                    enum: [...Object.keys(DIVORCE_CATEGORIES), ...Object.keys(LEGAL_CATEGORIES)],
                    description: "Category that best fits this fact"
                  },
                  subcategory: {
                    type: "string",
                    description: "More specific subcategory"
                  },
                  is_evidence: {
                    type: "boolean",
                    description: "TRUE if this is evidence/document that needs to be uploaded"
                  },
                  evidence_description: {
                    type: "string",
                    description: "Description of evidence if is_evidence=true"
                  }
                },
                required: ["content", "category"]
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for completing the divorce documents"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }

  /**
   * ✅ UPDATED: Consolidated LLM call - now supports both affidavit and divorce documents
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
          model: DEFAULT_LLM_MODEL,
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

    // Detect document type - check for divorce_petition, divorce_decree, or divorce_package
    const documentType = affidavitData.documentType || affidavitData.document_type || 'general';
    const isDivorceDocument = documentType === 'divorce_petition' ||
                              documentType === 'divorce_decree' ||
                              documentType === 'divorce_package';

    // Select appropriate prompts and tools based on document type
    let systemPrompt, userPrompt, tools, functionName;

    if (isDivorceDocument) {
      systemPrompt = this.createDivorceSystemPrompt();
      userPrompt = this.createDivorceUserPrompt(message, affidavitData, existingFactsSummary);
      tools = [this.createDivorceProcessingTool()];
      functionName = 'process_divorce_message';

      logger.info('Using divorce document processing', { documentType, sessionId });
    } else {
      systemPrompt = this.createConsolidatedSystemPrompt();
      userPrompt = this.createUserPrompt(message, affidavitData, existingFactsSummary);
      tools = [this.createAffidavitProcessingTool()];
      functionName = 'process_affidavit_message';

      logger.info('Using affidavit document processing', { documentType, sessionId });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userPrompt }
    ];

    try {
      const completion = await this.openAIService.chat(messages, {
        model: DEFAULT_LLM_MODEL,
        tools,
        tool_choice: { type: "function", function: { name: functionName } },
        temperature: 0.3,
        max_tokens: this.constants.MAX_COMPLETION_TOKENS
      });

      const toolCall = completion.choices[0].message.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('LLM did not call the required function');
      }

      const functionResult = JSON.parse(toolCall.function.arguments);

      // Log extraction results based on document type
      if (isDivorceDocument) {
        logger.info('Divorce function call extraction', {
          hasPetitionerFirstName: !!functionResult.petitioner_first_name,
          hasPetitionerLastName: !!functionResult.petitioner_last_name,
          hasRespondentFirstName: !!functionResult.respondent_first_name,
          hasState: !!functionResult.extracted_state,
          hasCounty: !!functionResult.extracted_county,
          hasMarriageDate: !!functionResult.marriage_date,
          hasChildren: !!functionResult.has_minor_children,
          factsCount: functionResult.extracted_facts?.length || 0,
          sessionId
        });

        return this.processDivorceToolCall(functionResult, affidavitData, message);
      } else {
        logger.info('Affidavit function call extraction', {
          hasFirstName: !!functionResult.extracted_first_name,
          hasLastName: !!functionResult.extracted_last_name,
          hasState: !!functionResult.extracted_state,
          hasCounty: !!functionResult.extracted_county,
          hasCaseNumber: !!functionResult.case_number,
          factsCount: functionResult.extracted_facts?.length || 0,
          sessionId
        });

        return this.processToolCall(functionResult, affidavitData, message);
      }

    } catch (error) {
      logger.error('LLM call failed:', error);
      throw error;
    }
  }

  /**
   * ✅ UPDATED: Process tool call with county & case caption
   */
  processToolCall(args, currentData, sourceMessage = '') {
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
        // Don't throw - instead, mark state as unsupported and let the response inform the user
        logger.warn('Unsupported state detected', {
          detectedState: args.detected_unsupported_state
        });
        // Set a flag for unsupported state (don't actually set the state field)
        newData.unsupportedState = args.detected_unsupported_state;
        hasNewData = true;
      } else {
        newData.state = args.extracted_state;
        hasNewData = true;
      }
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

    // Corrections retire superseded fact cards (LLM decides WHAT was
    // corrected via superseded_facts; retireFacts is array plumbing only).
    // retiredFactStatements is rewritten/cleared each call so stale
    // retirements never re-apply; the profile merge reads it downstream.
    delete newData.retiredFactStatements;
    const supersededStatements = sanitizeSupersededStatements(args.superseded_facts);
    if (supersededStatements.length > 0) {
      const { kept, retired } = retireFacts(currentData.facts, supersededStatements);
      if (retired.length > 0) {
        newData.facts = kept;
        hasNewData = true;
      }
      newData.retiredFactStatements = supersededStatements;
    }

    // Extract facts - preserve full fact objects with metadata (category, subcategory, etc.)
    const extractedFacts = Array.isArray(args.extracted_facts) ? args.extracted_facts : [];
    let processedFacts = []; // Declare outside if block so we can return it

    if (extractedFacts.length > 0) {
      const existingFacts = newData.facts || currentData.facts || [];
      // Provenance: the user's verbatim words (shown as "You said: …" in the
      // review UI) — fact.content stays the cleaned, court-usable statement.
      const sourceQuote = typeof sourceMessage === 'string'
        ? sourceMessage.trim().slice(0, 280)
        : '';

      // Convert evidence facts to proper format
      processedFacts = extractedFacts.map(fact => {
        if (fact.is_evidence) {
          // Convert to evidence type with evidenceData
          const evidenceItem = {
            ...fact,
            sourceQuote,
            id: randomUUID(), // Add unique ID for evidence tracking
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
          sourceQuote,
          id: fact.id || randomUUID(),
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
   * ✅ DIVORCE PACKAGE: Process divorce-specific tool call
   */
  processDivorceToolCall(args, currentData, sourceMessage = '') {
    const newData = { ...currentData };
    let hasNewData = false;

    // The affiant is the USER, on whichever side of the caption they sit —
    // when role === 'respondent' the petitioner caption is the SPOUSE, so the
    // firstName/lastName/affiantName mirrors (preview/PDF backward compat)
    // must come from the user's own side (mirrors lifeStory.fullName():
    // missing role means petitioner).
    const userIsRespondent = String(newData.role || '').toLowerCase() === 'respondent';

    // Extract Petitioner Information
    if (args.petitioner_first_name) {
      newData.petitionerFirstName = String(args.petitioner_first_name).trim();
      if (!userIsRespondent) {
        // Also set firstName for backward compatibility with preview/PDF generation
        newData.firstName = newData.petitionerFirstName;
      }
      hasNewData = true;
    }
    if (args.petitioner_last_name) {
      newData.petitionerLastName = String(args.petitioner_last_name).trim();
      if (!userIsRespondent) {
        newData.lastName = newData.petitionerLastName;
        // Update affiantName for backward compatibility
        if (newData.petitionerFirstName) {
          newData.affiantName = `${newData.petitionerFirstName} ${newData.petitionerLastName}`;
        }
      }
      hasNewData = true;
    }
    if (args.petitioner_address) {
      newData.petitionerAddress = String(args.petitioner_address).trim();
      hasNewData = true;
    }

    // Extract Respondent Information
    if (args.respondent_first_name) {
      newData.respondentFirstName = String(args.respondent_first_name).trim();
      if (userIsRespondent) {
        // Respondent-role user: the respondent side IS the user (see above).
        newData.firstName = newData.respondentFirstName;
      }
      hasNewData = true;
    }
    if (args.respondent_last_name) {
      newData.respondentLastName = String(args.respondent_last_name).trim();
      if (userIsRespondent) {
        newData.lastName = newData.respondentLastName;
        if (newData.respondentFirstName) {
          newData.affiantName = `${newData.respondentFirstName} ${newData.respondentLastName}`;
        }
      }
      hasNewData = true;
    }
    if (args.respondent_address) {
      newData.respondentAddress = String(args.respondent_address).trim();
      hasNewData = true;
    }

    // Extract Jurisdiction (State & County)
    if (args.extracted_state && args.extracted_state !== 'NONE') {
      if (args.extracted_state === 'UNSUPPORTED') {
        logger.warn('Unsupported state detected for divorce', {
          detectedState: args.detected_unsupported_state
        });
        newData.unsupportedState = args.detected_unsupported_state;
        hasNewData = true;
      } else {
        newData.state = args.extracted_state;
        hasNewData = true;
      }
    }
    if (args.extracted_county) {
      newData.county = String(args.extracted_county).trim();
      hasNewData = true;
    }
    if (args.residency_duration) {
      newData.residencyDuration = String(args.residency_duration).trim();
      hasNewData = true;
    }

    // Auto-generate court name from county and state if not manually provided
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

    // Extract Marriage Information
    if (args.marriage_date) {
      newData.marriageDate = String(args.marriage_date).trim();
      hasNewData = true;
    }
    if (args.marriage_place) {
      newData.marriagePlace = String(args.marriage_place).trim();
      hasNewData = true;
    }
    if (args.separation_date) {
      newData.separationDate = String(args.separation_date).trim();
      hasNewData = true;
    }

    // Extract Children Information
    if (args.has_minor_children !== null && args.has_minor_children !== undefined) {
      newData.hasMinorChildren = Boolean(args.has_minor_children);
      hasNewData = true;
    }
    if (args.number_of_children) {
      newData.numberOfChildren = Number(args.number_of_children);
      hasNewData = true;
    }
    if (args.children && Array.isArray(args.children) && args.children.length > 0) {
      // Merge with existing children by identity — the LLM typically sends
      // only the child under discussion, so assignment would drop the rest.
      const incoming = args.children.map(child => ({
        name: child.name,
        dateOfBirth: child.date_of_birth,
        age: child.age,
        livesWith: child.lives_with
      }));
      newData.children = mergeChildren(currentData.children, incoming);
      hasNewData = true;
    }
    if (args.custody_preference) {
      newData.custodyPreference = String(args.custody_preference).trim();
      hasNewData = true;
    }
    if (args.custody_details) {
      newData.custodyDetails = String(args.custody_details).trim();
      hasNewData = true;
    }

    // Extract Property & Debts
    if (args.real_estate) {
      newData.realEstate = String(args.real_estate).trim();
      hasNewData = true;
    }
    if (args.vehicles) {
      newData.vehicles = String(args.vehicles).trim();
      hasNewData = true;
    }
    if (args.bank_accounts) {
      newData.bankAccounts = String(args.bank_accounts).trim();
      hasNewData = true;
    }
    if (args.retirement_accounts) {
      newData.retirementAccounts = String(args.retirement_accounts).trim();
      hasNewData = true;
    }
    if (args.other_assets) {
      newData.otherAssets = String(args.other_assets).trim();
      hasNewData = true;
    }
    if (args.has_debts !== null && args.has_debts !== undefined) {
      newData.hasDebts = Boolean(args.has_debts);
      hasNewData = true;
    }
    if (args.debts_description) {
      newData.debtsDescription = String(args.debts_description).trim();
      hasNewData = true;
    }
    if (args.property_division_preference) {
      newData.propertyDivisionPreference = String(args.property_division_preference).trim();
      hasNewData = true;
    }

    // Extract Spousal Support
    if (args.requesting_spousal_support !== null && args.requesting_spousal_support !== undefined) {
      newData.requestingSpousalSupport = Boolean(args.requesting_spousal_support);
      hasNewData = true;
    }
    if (args.spousal_support_details) {
      newData.spousalSupportDetails = String(args.spousal_support_details).trim();
      hasNewData = true;
    }

    // Extract Grounds for Divorce
    if (args.grounds_for_divorce) {
      newData.groundsForDivorce = String(args.grounds_for_divorce).trim();
      hasNewData = true;
    }
    if (args.grounds_details) {
      newData.groundsDetails = String(args.grounds_details).trim();
      hasNewData = true;
    }

    // Extract Case Info (if already filed)
    if (args.case_number) {
      newData.caseNumber = String(args.case_number).trim();
      hasNewData = true;
    }
    if (args.court_name) {
      newData.courtName = String(args.court_name).trim();
      hasNewData = true;
    }

    // Corrections retire superseded fact cards (same plumbing as the
    // affidavit path — see processToolCall).
    delete newData.retiredFactStatements;
    const supersededStatements = sanitizeSupersededStatements(args.superseded_facts);
    if (supersededStatements.length > 0) {
      const { kept, retired } = retireFacts(currentData.facts, supersededStatements);
      if (retired.length > 0) {
        newData.facts = kept;
        hasNewData = true;
      }
      newData.retiredFactStatements = supersededStatements;
    }

    // Extract additional facts (same as affidavit)
    const extractedFacts = Array.isArray(args.extracted_facts) ? args.extracted_facts : [];
    let processedFacts = [];

    if (extractedFacts.length > 0) {
      const existingFacts = newData.facts || currentData.facts || [];
      // Provenance: the user's verbatim words (shown as "You said: …" in the
      // review UI) — fact.content stays the cleaned, court-usable statement.
      const sourceQuote = typeof sourceMessage === 'string'
        ? sourceMessage.trim().slice(0, 280)
        : '';

      processedFacts = extractedFacts.map(fact => {
        if (fact.is_evidence) {
          const evidenceItem = {
            ...fact,
            sourceQuote,
            id: randomUUID(),
            type: 'evidence',
            category: 'evidence',
            evidenceData: {
              exhibitLabel: '',
              description: fact.evidence_description || '',
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

          logger.info('Divorce evidence item created:', {
            id: evidenceItem.id,
            description: evidenceItem.evidenceData.description
          });

          return evidenceItem;
        }
        return {
          ...fact,
          sourceQuote,
          id: fact.id || randomUUID(),
          type: fact.type || 'fact'
        };
      });

      newData.facts = [...existingFacts, ...processedFacts];
      hasNewData = true;
    }

    return {
      chatResponse: args.chat_response || "I understand. Please continue sharing the details.",
      updatedAffidavitData: newData,
      extractedFacts: processedFacts,
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
