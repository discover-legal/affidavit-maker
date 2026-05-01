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

// ─── Orchestrator behavior rules ──────────────────────────────────────────────
// Injected into every system prompt to enforce consistent UX across all matter types.

const ORCHESTRATOR_BEHAVIOR = `
CONVERSATION RULES (you MUST follow these strictly):
1. Ask exactly ONE question per message. The COLLECT list above shows everything to gather in this phase, but you MUST ask them one at a time across multiple messages. Never combine two or more questions.
2. When you set phase_complete: true, your response MUST naturally transition to the next topic and ask the first relevant question about it. Never say "let's proceed" or "we're ready to move on" without immediately asking the next question. Never wait for the user to say "proceed."
3. Keep each response to 1-3 sentences. Acknowledge what the user said briefly, then ask the next question.
4. Never repeat information the user already provided.
`;

// The chat welcome message now includes a UPL disclaimer. The AI also
// disclaims at REVIEW completion (see REVIEW_COMPLETION below).

const REVIEW_COMPLETION = `
COMPLETION INSTRUCTIONS: When the user confirms all information is correct and you set phase_complete: true on the REVIEW phase, your response MUST:
1. Provide a brief summary confirmation (2-3 sentences)
2. Include this notice: "Important: These documents were generated with AI assistance and may contain errors, omissions, or information that does not apply to your specific situation. We strongly recommend having them reviewed by a licensed attorney in your jurisdiction before filing."
3. End with a clear call to action: "Your documents are ready! Click the Download or Purchase button below to get your completed package."
`;

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
    if (!matterTypeCode) {
      throw new Error('BaseMatterOrchestrator: matterTypeCode is required');
    }
    if (!phases || typeof phases !== 'object') {
      throw new Error(`BaseMatterOrchestrator(${matterTypeCode}): phases is required`);
    }
    if (!Array.isArray(phaseOrder) || phaseOrder.length === 0) {
      throw new Error(`BaseMatterOrchestrator(${matterTypeCode}): phaseOrder must be a non-empty array`);
    }
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

    const systemPrompt = this._buildSystemPrompt(state, matterData);
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

  /**
   * Build the enhanced system prompt with behavioral rules and phase context.
   */
  _buildSystemPrompt(state, matterData) {
    const parts = [this.phases[state.currentPhase].prompt];

    // Core behavior rules (one question at a time, auto-transition)
    parts.push(ORCHESTRATOR_BEHAVIOR);

    // Progress indicator
    const currentIdx = this.phaseOrder.indexOf(state.currentPhase);
    const totalPhases = this.phaseOrder.length;
    parts.push(`PROGRESS: Step ${currentIdx + 1} of ${totalPhases}.`);

    // Tell the LLM what the next phase is so it can transition naturally
    if (state.currentPhase !== 'REVIEW') {
      const nextPhase = this._getNextPhase(state.currentPhase, matterData);
      if (nextPhase && this.phases[nextPhase]) {
        parts.push(`WHEN PHASE IS COMPLETE: Transition to "${this.phases[nextPhase].displayName}" and immediately ask the first relevant question about that topic.`);
      }
    }

    // Review phase: CTA + AI disclaimer
    if (state.currentPhase === 'REVIEW') {
      parts.push(REVIEW_COMPLETION);
    }

    return parts.join('\n');
  }

  _initState(matterData) {
    if (matterData.orchestratorState?.currentPhase) {
      return { ...matterData.orchestratorState };
    }
    return {
      currentPhase:    this.phaseOrder[0] || 'INTAKE',
      completedPhases: [],
      phaseHistory:    [],
      caseId:          matterData.caseId || null,
      stateCode:       this.stateCode,
      matterTypeCode:  this.matterTypeCode
    };
  }

  _buildUserPrompt(message, matterData, state) {
    const collected = this._summarizeCollected(matterData);
    const currentIdx = this.phaseOrder.indexOf(state.currentPhase);
    const completedCount = state.completedPhases?.length || 0;
    return [
      `CURRENT PHASE: ${state.currentPhase} (${this.phases[state.currentPhase]?.displayName || state.currentPhase})`,
      `PROGRESS: Phase ${currentIdx + 1} of ${this.phaseOrder.length} | ${completedCount} completed`,
      collected ? `\nALREADY COLLECTED:\n${collected}` : '',
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('\n');
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

      // Skip phases not defined in this.phases (defensive guard for authoring errors)
      if (!phaseConf) {
        logger.warn(`${this.matterTypeCode}Orchestrator: phase "${candidate}" in phaseOrder is not defined in phases — skipping`);
        continue;
      }

      // Skip optional phases based on collected data
      if (phaseConf.optional && phaseConf.skipIf) {
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
