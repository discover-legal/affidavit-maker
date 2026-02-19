'use strict';

/**
 * TXDivorceOrchestrator
 *
 * Phase-driven interview agent for Texas divorce packages.
 * Replaces the monolithic divorce system prompt in affidavitService.js with a
 * state-machine approach where each phase has a specialized system prompt,
 * targeted questions, and completion criteria.
 *
 * Phase order:
 *   INTAKE → RESIDENCY → GROUNDS → CHILDREN → PROPERTY →
 *   SUPPORT → SERVICE → INDIGENCY → MILITARY → REVIEW
 *
 * State is stored in divorceData.orchestratorState and persisted to the database
 * via the normal document save flow. This means the next message in a new session
 * picks up exactly where the previous one left off.
 *
 * Usage:
 *   const orchestrator = new TXDivorceOrchestrator();
 *   const result = await orchestrator.processMessage(message, history, divorceData, userId);
 */

const logger = require('../../utils/logger');
const { organizeFacts } = require('./FactOrganizer');
const { PHASES, PHASE_ORDER } = require('./prompts/txDivorce/index');

// ─── Tool definition ──────────────────────────────────────────────────────────
// A single flexible tool used across all phases. The phase-specific system prompt
// instructs the LLM which fields to fill in.

function buildPhaseTool() {
  return {
    type: 'function',
    function: {
      name: 'process_phase_data',
      description: 'Extract any information collected during this interview phase and provide a conversational response to the user.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          // Conversational response shown to the user
          response: {
            type: 'string',
            description: 'Your conversational response to the user. Warm, professional, concise.'
          },

          // Phase completion signal
          phase_complete: {
            type: 'boolean',
            description: 'Set to true ONLY when all required fields for the current phase have been collected and confirmed.'
          },

          // ── INTAKE ──
          petitioner_first_name: { type: 'string' },
          petitioner_last_name:  { type: 'string' },
          respondent_first_name: { type: 'string' },
          respondent_last_name:  { type: 'string' },

          // ── RESIDENCY ──
          state:                 { type: 'string', description: '2-letter state code, e.g. TX' },
          county:                { type: 'string', description: 'County where petition is filed' },
          residency_tx_months:   { type: 'number', description: 'Months lived in Texas' },
          residency_county_days: { type: 'number', description: 'Days lived in filing county' },
          has_protective_order:  { type: 'boolean' },

          // ── GROUNDS & MARRIAGE ──
          marriage_date:  { type: 'string', description: 'Date of marriage (YYYY-MM-DD or natural language)' },
          marriage_city:  { type: 'string' },
          marriage_state: { type: 'string' },
          separation_date:{ type: 'string' },
          grounds:        { type: 'string', description: 'Grounds for divorce (e.g., insupportability)' },

          // ── CHILDREN ──
          children_confirmed: {
            type: 'boolean',
            description: 'true = no minor children; false = has minor children (see children array)'
          },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                dob:  { type: 'string' },
                age:  { type: 'number' }
              }
            }
          },
          custody_arrangement: { type: 'string' },

          // ── PROPERTY ──
          property_confirmed:  { type: 'boolean', description: 'true = property section complete' },
          property_agreement:  { type: 'string', description: 'agreed | contested' },

          // ── SPOUSAL SUPPORT ──
          spousal_support_confirmed: { type: 'boolean', description: 'true = support section complete' },
          spousal_support_requested: { type: 'boolean' },
          support_amount:   { type: 'number', description: 'Monthly support amount in dollars' },
          support_duration: { type: 'string', description: 'Duration of support (e.g., 36 months)' },
          support_basis:    { type: 'string' },

          // ── SERVICE OF PROCESS ──
          service_method:    { type: 'string', description: 'waiver | formal' },
          respondent_address:{ type: 'string', description: 'Full address for service or last known address' },

          // ── INDIGENCY ──
          indigency_confirmed:   { type: 'boolean', description: 'true = indigency section complete' },
          indigency_requested:   { type: 'boolean' },
          monthly_income:        { type: 'number' },
          monthly_expenses:      { type: 'number' },
          assets_description:    { type: 'string' },
          dependents_count:      { type: 'number' },

          // ── MILITARY STATUS ──
          military_status_confirmed:   { type: 'boolean', description: 'true = military section complete' },
          respondent_military_status:  { type: 'string', description: 'not_military | military | unknown' },
          military_search_date:        { type: 'string' },
          military_search_method:      { type: 'string' },

          // ── REVIEW ──
          user_confirmed_review: { type: 'boolean' },

          // General facts (can be captured in any phase)
          extracted_facts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content:     { type: 'string', description: 'First-person fact statement' },
                category:    { type: 'string', description: 'residency|marriage|children|property|grounds|support|service|indigency|military' },
                subcategory: { type: 'string' }
              },
              required: ['content', 'category']
            }
          }
        }
      }
    }
  };
}

// ─── Orchestrator class ───────────────────────────────────────────────────────

class TXDivorceOrchestrator {
  constructor() {
    this.tool = buildPhaseTool();
  }

  /**
   * Main entry point. Called by routes/chat.js for TX divorce_package documents.
   *
   * @param {string} message - User's message
   * @param {Array}  conversationHistory - Prior messages
   * @param {Object} divorceData - Current document data (includes orchestratorState)
   * @param {string} userId - Authenticated user ID
   * @param {string} sessionId - Chat session ID
   * @returns {Promise<Object>} { response, affidavitData, newFacts, orchestratorState }
   */
  async processMessage(message, conversationHistory, divorceData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) {
      throw new Error('LLM service not available');
    }

    // Initialize or restore orchestrator state
    const state = this._initState(divorceData);
    const currentPhase = PHASES[state.currentPhase];

    if (!currentPhase) {
      logger.warn('TXDivorceOrchestrator: unknown phase, resetting to INTAKE', { phase: state.currentPhase });
      state.currentPhase = 'INTAKE';
    }

    logger.info('TXDivorceOrchestrator: processing message', {
      phase: state.currentPhase,
      completedPhases: state.completedPhases,
      userId,
      sessionId
    });

    // Build prompt
    const systemPrompt = PHASES[state.currentPhase].prompt;
    const userPrompt = this._buildUserPrompt(message, divorceData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16), // Keep last 16 messages for context
      { role: 'user', content: userPrompt }
    ];

    // Call LLM with phase-specific tool
    const completion = await openAIService.chat(messages, {
      model: process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      tools: [this.tool],
      tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
      temperature: 0.3,
      max_tokens: 1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('TXDivorceOrchestrator: LLM did not call the required function');
    }

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      throw new Error(`TXDivorceOrchestrator: Failed to parse function arguments: ${parseError.message}`);
    }

    const { response, phase_complete, extracted_facts, ...fieldUpdates } = extracted;

    // Apply extracted fields to divorceData
    const updatedData = this._applyFieldUpdates(divorceData, fieldUpdates);

    // Merge new facts
    const newFacts = this._buildFacts(extracted_facts || [], fieldUpdates, state.currentPhase);
    if (newFacts.length > 0) {
      updatedData.facts = [...(updatedData.facts || []), ...newFacts];
    }

    // Reorder facts per TX section order
    if (updatedData.facts?.length > 0) {
      updatedData.facts = organizeFacts(updatedData.facts);
    }

    // Advance phase if complete
    if (phase_complete) {
      state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
      state.phaseHistory = [
        ...(state.phaseHistory || []),
        { phase: state.currentPhase, completedAt: new Date().toISOString() }
      ];
      const nextPhase = this._getNextPhase(state.currentPhase, updatedData);
      state.currentPhase = nextPhase;

      logger.info('TXDivorceOrchestrator: phase advanced', {
        from: state.completedPhases[state.completedPhases.length - 1],
        to: nextPhase
      });
    }

    // Persist orchestrator state in divorceData
    updatedData.orchestratorState = state;

    return {
      response,
      affidavitData: updatedData,
      newFacts,
      orchestratorState: state
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Initialize or restore orchestrator state from divorceData.
   */
  _initState(divorceData) {
    if (divorceData.orchestratorState?.currentPhase) {
      return { ...divorceData.orchestratorState };
    }

    // Fresh start — check if we can skip any phases from a linked case profile
    const initialPhase = this._determineStartingPhase(divorceData);

    return {
      currentPhase: initialPhase,
      completedPhases: [],
      phaseHistory: [],
      caseId: divorceData.caseId || null
    };
  }

  /**
   * If the document was created from a case profile, some phases may already have data.
   * Skip those phases so we don't re-interview the user.
   */
  _determineStartingPhase(divorceData) {
    // If petitioner and respondent names already exist, skip INTAKE
    if (divorceData.petitionerFirstName && divorceData.respondentFirstName) {
      if (divorceData.state && divorceData.county) {
        if (divorceData.marriageDate) {
          return 'CHILDREN'; // Skip INTAKE, RESIDENCY, GROUNDS
        }
        return 'GROUNDS';   // Skip INTAKE, RESIDENCY
      }
      return 'RESIDENCY';   // Skip INTAKE
    }
    return 'INTAKE';
  }

  /**
   * Build the user-facing prompt for the current phase.
   * Includes a summary of what's already been collected to prevent re-asking.
   */
  _buildUserPrompt(message, divorceData, state) {
    const collected = this._summarizeCollected(divorceData);
    return [
      `CURRENT PHASE: ${state.currentPhase} (${PHASES[state.currentPhase]?.displayName || state.currentPhase})`,
      collected ? `\nALREADY COLLECTED:\n${collected}` : '',
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('');
  }

  /**
   * Summarize what has already been collected to avoid re-asking.
   */
  _summarizeCollected(d) {
    const items = [];
    if (d.petitionerFirstName) items.push(`Petitioner: ${d.petitionerFirstName} ${d.petitionerLastName || ''}`);
    if (d.respondentFirstName)  items.push(`Respondent: ${d.respondentFirstName} ${d.respondentLastName || ''}`);
    if (d.state)    items.push(`State: ${d.state}`);
    if (d.county)   items.push(`County: ${d.county}`);
    if (d.marriageDate) items.push(`Marriage date: ${d.marriageDate}`);
    if (d.grounds)  items.push(`Grounds: ${d.grounds}`);
    if (typeof d.hasMinorChildren === 'boolean') {
      items.push(`Minor children: ${d.hasMinorChildren ? 'yes' : 'no'}`);
    }
    if (d.serviceMethod) items.push(`Service method: ${d.serviceMethod}`);
    if (d.facts?.length) items.push(`Facts documented: ${d.facts.length}`);
    return items.join('\n');
  }

  /**
   * Merge extracted field values into divorceData, mapping snake_case → camelCase.
   */
  _applyFieldUpdates(divorceData, fields) {
    const updated = { ...divorceData };

    const MAP = {
      petitioner_first_name:       'petitionerFirstName',
      petitioner_last_name:        'petitionerLastName',
      respondent_first_name:       'respondentFirstName',
      respondent_last_name:        'respondentLastName',
      state:                       'state',
      county:                      'county',
      residency_tx_months:         'residencyTxMonths',
      residency_county_days:       'residencyCountyDays',
      has_protective_order:        'hasProtectiveOrder',
      marriage_date:               'marriageDate',
      marriage_city:               'marriageCity',
      marriage_state:              'marriageStateName',
      separation_date:             'separationDate',
      grounds:                     'grounds',
      children_confirmed:          'childrenConfirmed',
      children:                    'children',
      custody_arrangement:         'custodyArrangement',
      property_confirmed:          'propertyConfirmed',
      property_agreement:          'propertyAgreement',
      spousal_support_confirmed:   'spousalSupportConfirmed',
      spousal_support_requested:   'spousalSupportRequested',
      support_amount:              'supportAmount',
      support_duration:            'supportDuration',
      support_basis:               'supportBasis',
      service_method:              'serviceMethod',
      respondent_address:          'respondentAddress',
      indigency_confirmed:         'indigencyConfirmed',
      indigency_requested:         'indigencyRequested',
      monthly_income:              'monthlyIncome',
      monthly_expenses:            'monthlyExpenses',
      assets_description:          'assetsDescription',
      dependents_count:            'dependentsCount',
      military_status_confirmed:   'militaryStatusConfirmed',
      respondent_military_status:  'respondentMilitaryStatus',
      military_search_date:        'militarySearchDate',
      military_search_method:      'militarySearchMethod',
      user_confirmed_review:       'userConfirmedReview'
    };

    for (const [snakeKey, camelKey] of Object.entries(MAP)) {
      if (fields[snakeKey] !== undefined && fields[snakeKey] !== null && fields[snakeKey] !== '') {
        updated[camelKey] = fields[snakeKey];
      }
    }

    // Derive full names for template compatibility
    if (updated.petitionerFirstName || updated.petitionerLastName) {
      updated.petitionerName = [updated.petitionerFirstName, updated.petitionerLastName].filter(Boolean).join(' ');
    }
    if (updated.respondentFirstName || updated.respondentLastName) {
      updated.respondentName = [updated.respondentFirstName, updated.respondentLastName].filter(Boolean).join(' ');
    }

    return updated;
  }

  /**
   * Convert extracted_facts + implicit phase data into fact objects.
   * Each fact gets a category based on its phase for deterministic ordering.
   */
  _buildFacts(extractedFacts, fieldUpdates, currentPhase) {
    const phaseCategoryMap = {
      INTAKE:    'general',
      RESIDENCY: 'residency',
      GROUNDS:   'grounds',
      CHILDREN:  'children',
      PROPERTY:  'property',
      SUPPORT:   'support',
      SERVICE:   'service',
      INDIGENCY: 'indigency',
      MILITARY:  'military',
      REVIEW:    'general'
    };

    const defaultCategory = phaseCategoryMap[currentPhase] || 'general';

    return extractedFacts.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: f.content,
      category: f.category || defaultCategory,
      subcategory: f.subcategory || '',
      type: 'fact',
      confidence: 0.9,
      severity: 'success',
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Advance to the next required phase, skipping optional phases if appropriate.
   */
  _getNextPhase(currentPhase, divorceData) {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
      return 'REVIEW'; // Already at end or unknown phase
    }

    for (let i = currentIndex + 1; i < PHASE_ORDER.length; i++) {
      const candidate = PHASE_ORDER[i];
      const phaseConfig = PHASES[candidate];

      // Skip optional phases where data already indicates we can skip
      if (phaseConfig.optional) {
        if (candidate === 'SUPPORT' && divorceData.spousalSupportConfirmed === true) continue;
        if (candidate === 'INDIGENCY' && divorceData.indigencyConfirmed === true && !divorceData.indigencyRequested) continue;
      }

      return candidate;
    }

    return 'REVIEW';
  }
}

// Export singleton
module.exports = new TXDivorceOrchestrator();
