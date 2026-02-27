'use strict';

/**
 * BaseMatterOrchestrator
 *
 * Generic phase-based interview engine for any civil or family law matter type.
 * Follows the same architecture as BaseDivorceOrchestrator but is matter-agnostic.
 *
 * Each matter type creates one instance:
 *
 *   module.exports = new BaseMatterOrchestrator({
 *     stateCode:    'TX',  // or '*' for state-agnostic
 *     stateName:    'Texas',
 *     matterTypeCode: 'custody',
 *     practiceArea:   'family',
 *     phases:         PHASES,
 *     phaseOrder:     PHASE_ORDER,
 *     fieldMap:       FIELD_MAP,
 *     buildTool:      () => ({ type: 'function', function: { ... } }),
 *   });
 *
 * State-specific orchestrators are thin wrappers that only differ in
 * the `phases` object (state-specific residency / legal requirements).
 */

const logger = require('../../utils/logger');
const { organizeFacts } = require('./FactOrganizer');
const documentSelectionAgent = require('./DocumentSelectionAgent');

// ─── Phase → default fact category ───────────────────────────────────────────
const DEFAULT_PHASE_CATEGORY = {
  // Universal phases
  INTAKE:               'general',
  HISTORY:              'relational',
  CHILDREN:             'children',
  CHILD_DETAILS:        'children',
  FINANCES:             'financial',
  PROPERTY:             'property',
  SAFETY:               'safety',
  SAFETY_CHECK:         'safety',
  INCIDENTS:            'injury',
  PATTERN:              'pattern',
  EVIDENCE:             'evidence',
  CLAIM:                'financial',
  CLAIM_DETAILS:        'financial',
  DEFENSES:             'exemption',
  COUNTERCLAIMS:        'exemption',
  PROPOSED_PLAN:        'general',
  RELIEF:               'general',
  REVIEW:               'general',
  // Family law phases
  ACTION_TYPE:          'general',
  GROUNDS:              'general',
  CHILDREN_AND_PROPERTY:'children',
  PARENTS:              'relational',
  CHILD_SITUATION:      'children',
  BIOLOGICAL_PARENTS:   'relational',
  ADOPTEE_BACKGROUND:   'relational',
  LEGAL_STATUS:         'general',
  INDEPENDENCE:         'financial',
  REASONS:              'general',
  AGREEMENT:            'general',
  // Civil law phases
  DEBT_DETAILS:         'financial',
  LEASE_DETAILS:        'property',
  DISPUTE_DETAILS:      'event',
  HARASSMENT_HISTORY:   'injury',
  CONTACT_ATTEMPTS:     'pattern',
  LEGAL_BASIS:          'general',
  BACKGROUND:           'identity',
  MINOR_DETAILS:        'identity',
  NOTICE:               'general',
  // Probate phases
  DECEDENT_INFO:        'heirship',
  ESTATE_ASSETS:        'heirship',
  WILL_AND_HEIRS:       'heirship',
};

class BaseMatterOrchestrator {
  /**
   * @param {Object} config
   * @param {string}   config.stateCode      - 2-letter code, e.g. 'TX', or '*' for state-agnostic
   * @param {string}   config.stateName      - Full state name or null
   * @param {string}   config.matterTypeCode - e.g. 'custody', 'small_claims'
   * @param {string}   config.practiceArea   - 'family' | 'civil'
   * @param {Object}   config.phases         - Phase definitions { PHASE_NAME: { prompt, displayName, optional } }
   * @param {string[]} config.phaseOrder     - Ordered phase names
   * @param {Object}   config.fieldMap       - snake_case → camelCase field mapping
   * @param {Function} config.buildTool      - () => OpenAI tool definition object
   */
  constructor({ stateCode, stateName, matterTypeCode, practiceArea, phases, phaseOrder, fieldMap, buildTool }) {
    this.stateCode      = stateCode     || '*';
    this.stateName      = stateName     || null;
    this.matterTypeCode = matterTypeCode;
    this.practiceArea   = practiceArea  || 'civil';
    this.phases         = phases;
    this.phaseOrder     = phaseOrder;
    this.fieldMap       = fieldMap      || {};
    this.tool           = buildTool ? buildTool() : this._defaultTool();
  }

  // ─── Main entry point ──────────────────────────────────────────────────────

  async processMessage(message, conversationHistory, matterData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) throw new Error('LLM service not available');

    const state = this._initState(matterData);

    if (!this.phases[state.currentPhase]) {
      logger.warn(`${this.matterTypeCode}Orchestrator: unknown phase, resetting to INTAKE`, { phase: state.currentPhase });
      state.currentPhase = 'INTAKE';
    }

    logger.info(`${this.matterTypeCode}Orchestrator: processing message`, {
      phase:           state.currentPhase,
      completedPhases: state.completedPhases?.length ?? 0,
      userId,
      sessionId
    });

    const systemPrompt = this.phases[state.currentPhase].prompt;
    const userPrompt   = this._buildUserPrompt(message, matterData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16),
      { role: 'user', content: userPrompt }
    ];

    const completion = await openAIService.chat(messages, {
      model:       process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      tools:       [this.tool],
      tool_choice: { type: 'function', function: { name: 'process_matter_data' } },
      temperature: 0.3,
      max_tokens:  1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) throw new Error(`${this.matterTypeCode}Orchestrator: LLM did not call the required function`);

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error(`${this.matterTypeCode}Orchestrator: Failed to parse function arguments: ${e.message}`);
    }

    const { response, phase_complete, extracted_facts, ...fieldUpdates } = extracted;

    const updatedData = this._applyFieldUpdates(matterData, fieldUpdates);

    const newFacts = this._buildFacts(extracted_facts || [], state.currentPhase);
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
      logger.info(`${this.matterTypeCode}Orchestrator: phase advanced`, {
        from: state.currentPhase, to: nextPhase
      });
      state.currentPhase = nextPhase;
    }

    updatedData.orchestratorState = state;

    // Document selection uses matterTypeCode as the practice area key
    const { requiredDocuments, selectionReasons } = documentSelectionAgent.select(
      updatedData,
      this.matterTypeCode
    );
    updatedData.requiredDocuments = requiredDocuments;
    updatedData.selectionReasons  = selectionReasons;

    return { response, affidavitData: updatedData, newFacts, orchestratorState: state };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  _initState(matterData) {
    if (matterData.orchestratorState?.currentPhase) {
      return { ...matterData.orchestratorState };
    }
    return {
      currentPhase:    'INTAKE',
      completedPhases: [],
      phaseHistory:    [],
      caseId:          matterData.caseId || null,
      stateCode:       this.stateCode,
      matterTypeCode:  this.matterTypeCode
    };
  }

  _buildUserPrompt(message, matterData, state) {
    const collected = this._summarizeCollected(matterData);
    return [
      `CURRENT PHASE: ${state.currentPhase} (${this.phases[state.currentPhase]?.displayName || state.currentPhase})`,
      collected ? `\nALREADY COLLECTED:\n${collected}` : '',
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('');
  }

  _summarizeCollected(d) {
    const items = [];
    if (d.petitionerName || d.petitionerFirstName)
      items.push(`Petitioner: ${d.petitionerName || [d.petitionerFirstName, d.petitionerLastName].filter(Boolean).join(' ')}`);
    if (d.respondentName || d.respondentFirstName)
      items.push(`Respondent: ${d.respondentName || [d.respondentFirstName, d.respondentLastName].filter(Boolean).join(' ')}`);
    if (d.plaintiffName)    items.push(`Plaintiff: ${d.plaintiffName}`);
    if (d.defendantName)    items.push(`Defendant: ${d.defendantName}`);
    if (d.state)            items.push(`State: ${d.state}`);
    if (d.county)           items.push(`County: ${d.county}`);
    if (d.children?.length) items.push(`Children: ${d.children.map(c => c.name || c).join(', ')}`);
    if (d.facts?.length)    items.push(`Facts documented: ${d.facts.length}`);
    return items.join('\n');
  }

  _applyFieldUpdates(matterData, fields) {
    const updated = { ...matterData };

    for (const [snakeKey, camelKey] of Object.entries(this.fieldMap)) {
      if (fields[snakeKey] !== undefined && fields[snakeKey] !== null && fields[snakeKey] !== '') {
        updated[camelKey] = fields[snakeKey];
      }
    }

    // Derive combined name fields for template compatibility
    if (updated.petitionerFirstName || updated.petitionerLastName) {
      updated.petitionerName = [updated.petitionerFirstName, updated.petitionerLastName].filter(Boolean).join(' ');
    }
    if (updated.respondentFirstName || updated.respondentLastName) {
      updated.respondentName = [updated.respondentFirstName, updated.respondentLastName].filter(Boolean).join(' ');
    }
    if (updated.plaintiffFirstName || updated.plaintiffLastName) {
      updated.plaintiffName = [updated.plaintiffFirstName, updated.plaintiffLastName].filter(Boolean).join(' ');
    }
    if (updated.defendantFirstName || updated.defendantLastName) {
      updated.defendantName = [updated.defendantFirstName, updated.defendantLastName].filter(Boolean).join(' ');
    }

    return updated;
  }

  _buildFacts(extractedFacts, currentPhase) {
    const defaultCategory = DEFAULT_PHASE_CATEGORY[currentPhase] || 'general';
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

  _getNextPhase(currentPhase, matterData) {
    const idx = this.phaseOrder.indexOf(currentPhase);
    if (idx === -1 || idx === this.phaseOrder.length - 1) return 'REVIEW';

    for (let i = idx + 1; i < this.phaseOrder.length; i++) {
      const candidate  = this.phaseOrder[i];
      const phaseConf  = this.phases[candidate];

      // Skip optional phases based on collected data
      if (phaseConf?.optional && phaseConf?.skipIf) {
        if (phaseConf.skipIf(matterData)) continue;
      }

      return candidate;
    }
    return 'REVIEW';
  }

  // Minimal default tool for testing / fallback
  _defaultTool() {
    return {
      type: 'function',
      function: {
        name: 'process_matter_data',
        description: `Extract information from this ${this.matterTypeCode} interview phase.`,
        parameters: {
          type: 'object',
          required: ['response', 'phase_complete'],
          properties: {
            response:        { type: 'string' },
            phase_complete:  { type: 'boolean' },
            extracted_facts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content:     { type: 'string' },
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
}

module.exports = BaseMatterOrchestrator;
