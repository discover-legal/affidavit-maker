'use strict';

/**
 * BaseDivorceOrchestrator
 *
 * Shared orchestration engine for all state divorce interview agents.
 * Each state creates one instance:
 *
 *   module.exports = new BaseDivorceOrchestrator({
 *     stateCode:  'CA',
 *     stateName:  'California',
 *     phases:     PHASES,      // from prompts/caDivorce/index.js
 *     phaseOrder: PHASE_ORDER,
 *   });
 *
 * The state-specific prompt files are the ONLY thing that differs between
 * states. All interview mechanics (tool calling, field extraction, phase
 * advancement, fact organization, document selection) live here.
 */

const logger = require('../../utils/logger');
const { organizeFacts } = require('./FactOrganizer');
const documentSelectionAgent = require('./DocumentSelectionAgent');

// ─── Shared tool definition ───────────────────────────────────────────────────
// One flexible tool covers all phases across all states.
// Phase-specific system prompts tell the LLM which subset of fields to fill.

function buildPhaseTool(stateCode) {
  return {
    type: 'function',
    function: {
      name: 'process_phase_data',
      description: `Extract information collected during this ${stateCode} divorce interview phase and provide a conversational response to the user.`,
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          // ── Response shown to the user ──
          response: {
            type: 'string',
            description: 'Your conversational response to the user. Warm, professional, concise.'
          },
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
          state:                 { type: 'string', description: '2-letter state code' },
          county:                { type: 'string', description: 'County (or parish/district) where petition is filed' },
          residency_state_months: { type: 'number', description: 'Months lived in the state' },
          residency_county_days:  { type: 'number', description: 'Days lived in the filing county' },
          has_protective_order:   { type: 'boolean' },

          // ── GROUNDS & MARRIAGE ──
          marriage_date:   { type: 'string' },
          marriage_city:   { type: 'string' },
          marriage_state:  { type: 'string' },
          separation_date: { type: 'string' },
          grounds:         { type: 'string', description: 'Grounds for divorce / dissolution' },

          // ── CHILDREN ──
          children_confirmed: { type: 'boolean', description: 'true = section complete (no minor children or data collected)' },
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
          property_confirmed: { type: 'boolean' },
          property_agreement: { type: 'string', description: 'agreed | contested' },

          // ── SPOUSAL SUPPORT ──
          spousal_support_confirmed: { type: 'boolean' },
          spousal_support_requested: { type: 'boolean' },
          support_amount:   { type: 'number' },
          support_duration: { type: 'string' },
          support_basis:    { type: 'string' },

          // ── SERVICE OF PROCESS ──
          service_method:     { type: 'string', description: 'waiver | formal' },
          respondent_address: { type: 'string' },

          // ── INDIGENCY (TX/UT) ──
          indigency_confirmed: { type: 'boolean' },
          indigency_requested: { type: 'boolean' },
          monthly_income:      { type: 'number' },
          monthly_expenses:    { type: 'number' },
          assets_description:  { type: 'string' },
          dependents_count:    { type: 'number' },

          // ── MILITARY STATUS ──
          military_status_confirmed:  { type: 'boolean' },
          respondent_military_status: { type: 'string', description: 'not_military | military | unknown' },
          military_search_date:       { type: 'string' },
          military_search_method:     { type: 'string' },

          // ── REVIEW ──
          user_confirmed_review: { type: 'boolean' },

          // ── FACTS (any phase) ──
          extracted_facts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content:     { type: 'string', description: 'First-person fact statement' },
                category:    { type: 'string' },
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

// ─── Field mapping (snake_case → camelCase) ───────────────────────────────────
const FIELD_MAP = {
  petitioner_first_name:       'petitionerFirstName',
  petitioner_last_name:        'petitionerLastName',
  respondent_first_name:       'respondentFirstName',
  respondent_last_name:        'respondentLastName',
  state:                       'state',
  county:                      'county',
  residency_state_months:      'residencyStateMonths',
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
  user_confirmed_review:       'userConfirmedReview',
  // TX legacy compat
  residency_tx_months:         'residencyStateMonths',
};

// ─── Phase → fact category ────────────────────────────────────────────────────
const PHASE_CATEGORY = {
  INTAKE:    'general',
  RESIDENCY: 'residency',
  GROUNDS:   'grounds',
  CHILDREN:  'children',
  PROPERTY:  'property',
  SUPPORT:   'support',
  SERVICE:   'service',
  INDIGENCY: 'indigency',
  MILITARY:  'military',
  REVIEW:    'general',
};

// ─── BaseDivorceOrchestrator ─────────────────────────────────────────────────

class BaseDivorceOrchestrator {
  /**
   * @param {Object} config
   * @param {string}   config.stateCode  - 2-letter code, e.g. 'CA'
   * @param {string}   config.stateName  - Full name, e.g. 'California'
   * @param {Object}   config.phases     - Phase definitions (name → { prompt, optional, ... })
   * @param {string[]} config.phaseOrder - Ordered list of phase names
   */
  constructor({ stateCode, stateName, phases, phaseOrder }) {
    this.stateCode  = stateCode;
    this.stateName  = stateName;
    this.phases     = phases;
    this.phaseOrder = phaseOrder;
    this.tool       = buildPhaseTool(stateCode);
  }

  /**
   * Main entry point. Called by routes/chat.js for divorce_package documents.
   */
  async processMessage(message, conversationHistory, divorceData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) throw new Error('LLM service not available');

    const state = this._initState(divorceData);

    if (!this.phases[state.currentPhase]) {
      logger.warn(`${this.stateCode}DivorceOrchestrator: unknown phase, resetting to INTAKE`, { phase: state.currentPhase });
      state.currentPhase = 'INTAKE';
    }

    logger.info(`${this.stateCode}DivorceOrchestrator: processing message`, {
      phase: state.currentPhase,
      completedPhases: state.completedPhases?.length ?? 0,
      userId,
      sessionId
    });

    const systemPrompt = this.phases[state.currentPhase].prompt;
    const userPrompt   = this._buildUserPrompt(message, divorceData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16),
      { role: 'user', content: userPrompt }
    ];

    const completion = await openAIService.chat(messages, {
      model:       process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      tools:       [this.tool],
      tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
      temperature: 0.3,
      max_tokens:  1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) throw new Error(`${this.stateCode}DivorceOrchestrator: LLM did not call the required function`);

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error(`${this.stateCode}DivorceOrchestrator: Failed to parse function arguments: ${e.message}`);
    }

    const { response, phase_complete, extracted_facts, ...fieldUpdates } = extracted;

    const updatedData = this._applyFieldUpdates(divorceData, fieldUpdates);

    const newFacts = this._buildFacts(extracted_facts || [], fieldUpdates, state.currentPhase);
    if (newFacts.length > 0) {
      updatedData.facts = [...(updatedData.facts || []), ...newFacts];
    }
    if (updatedData.facts?.length > 0) {
      updatedData.facts = organizeFacts(updatedData.facts);
    }

    if (phase_complete) {
      state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
      state.phaseHistory    = [
        ...(state.phaseHistory || []),
        { phase: state.currentPhase, completedAt: new Date().toISOString() }
      ];
      const nextPhase = this._getNextPhase(state.currentPhase, updatedData);
      logger.info(`${this.stateCode}DivorceOrchestrator: phase advanced`, {
        from: state.currentPhase, to: nextPhase
      });
      state.currentPhase = nextPhase;
    }

    updatedData.orchestratorState = state;

    const { requiredDocuments, selectionReasons } = documentSelectionAgent.select(updatedData, 'family');
    updatedData.requiredDocuments = requiredDocuments;
    updatedData.selectionReasons  = selectionReasons;

    return { response, affidavitData: updatedData, newFacts, orchestratorState: state };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  _initState(divorceData) {
    if (divorceData.orchestratorState?.currentPhase) {
      return { ...divorceData.orchestratorState };
    }
    return {
      currentPhase:    this._determineStartingPhase(divorceData),
      completedPhases: [],
      phaseHistory:    [],
      caseId:          divorceData.caseId || null,
      stateCode:       this.stateCode
    };
  }

  _determineStartingPhase(divorceData) {
    if (divorceData.petitionerFirstName && divorceData.respondentFirstName) {
      if (divorceData.state && divorceData.county) {
        if (divorceData.marriageDate) return 'CHILDREN';
        return 'GROUNDS';
      }
      return 'RESIDENCY';
    }
    return 'INTAKE';
  }

  _buildUserPrompt(message, divorceData, state) {
    const collected = this._summarizeCollected(divorceData);
    return [
      `CURRENT PHASE: ${state.currentPhase} (${this.phases[state.currentPhase]?.displayName || state.currentPhase})`,
      collected ? `\nALREADY COLLECTED:\n${collected}` : '',
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('');
  }

  _summarizeCollected(d) {
    const items = [];
    if (d.petitionerFirstName) items.push(`Petitioner: ${d.petitionerFirstName} ${d.petitionerLastName || ''}`);
    if (d.respondentFirstName)  items.push(`Respondent: ${d.respondentFirstName} ${d.respondentLastName || ''}`);
    if (d.state)                items.push(`State: ${d.state}`);
    if (d.county)               items.push(`County: ${d.county}`);
    if (d.marriageDate)         items.push(`Marriage date: ${d.marriageDate}`);
    if (d.grounds)              items.push(`Grounds: ${d.grounds}`);
    if (typeof d.hasMinorChildren === 'boolean') {
      items.push(`Minor children: ${d.hasMinorChildren ? 'yes' : 'no'}`);
    }
    if (d.serviceMethod)        items.push(`Service method: ${d.serviceMethod}`);
    if (d.facts?.length)        items.push(`Facts documented: ${d.facts.length}`);
    return items.join('\n');
  }

  _applyFieldUpdates(divorceData, fields) {
    const updated = { ...divorceData };

    for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
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

  _buildFacts(extractedFacts, _fieldUpdates, currentPhase) {
    const defaultCategory = PHASE_CATEGORY[currentPhase] || 'general';
    return extractedFacts.map(f => ({
      id:          `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content:     f.content,
      category:    f.category || defaultCategory,
      subcategory: f.subcategory || '',
      type:        'fact',
      confidence:  0.9,
      severity:    'success',
      timestamp:   new Date().toISOString()
    }));
  }

  _getNextPhase(currentPhase, divorceData) {
    const idx = this.phaseOrder.indexOf(currentPhase);
    if (idx === -1 || idx === this.phaseOrder.length - 1) return 'REVIEW';

    for (let i = idx + 1; i < this.phaseOrder.length; i++) {
      const candidate = this.phaseOrder[i];
      const phaseConf = this.phases[candidate];

      if (phaseConf?.optional) {
        if (candidate === 'SUPPORT'   && divorceData.spousalSupportConfirmed === true) continue;
        if (candidate === 'INDIGENCY' && divorceData.indigencyConfirmed === true && !divorceData.indigencyRequested) continue;
      }
      return candidate;
    }
    return 'REVIEW';
  }
}

module.exports = BaseDivorceOrchestrator;
