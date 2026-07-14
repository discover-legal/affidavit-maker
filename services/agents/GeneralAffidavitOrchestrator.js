'use strict';

/**
 * GeneralAffidavitOrchestrator
 *
 * Phase-based interview engine for all non-divorce affidavit types:
 * general_affidavit, affidavit_of_residency, affidavit_of_identity,
 * financial_affidavit, affidavit_of_support, affidavit_of_heirship,
 * small_estate_affidavit, affidavit_of_domicile, affidavit_of_no_divorce,
 * affidavit_of_survivorship, affidavit_of_lost_document,
 * vehicle_transfer_affidavit, affidavit_of_no_lien.
 *
 * ── Phase flow ────────────────────────────────────────────────────────────────
 *   CLASSIFY → PARTIES → FACTS → REVIEW
 *
 * The CLASSIFY phase is skipped when the document type is already known
 * (e.g., user selected it from the type-picker in the UI).
 *
 * The FACTS phase prompt is built dynamically: AffidavitRequirementsChecker
 * evaluates the current data/facts state against the type's requirements spec
 * and injects only the still-missing topics into a generic template.
 * The checker also gates phase advancement — the LLM cannot mark FACTS complete
 * until all required topics are symbolically satisfied.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *   const orchestrator = require('./GeneralAffidavitOrchestrator');
 *   const result = await orchestrator.processMessage(message, history, data, userId, sessionId);
 */

const logger = require('../../utils/logger');
const { DEFAULT_LLM_MODEL } = require('../llmConfig');
const { mergeFacts } = require('./FactOrganizer');
const documentSelectionAgent = require('./DocumentSelectionAgent');
const { PHASES, PHASE_ORDER, buildFactsPrompt } = require('./prompts/generalAffidavit/index');
const requirementsChecker = require('./AffidavitRequirementsChecker');

// ─── LLM tool definition ──────────────────────────────────────────────────────

const AFFIDAVIT_TOOL = {
  type: 'function',
  function: {
    name: 'process_affidavit_data',
    description: 'Extract information from this affidavit interview and provide a conversational response.',
    parameters: {
      type: 'object',
      required: ['response', 'phase_complete'],
      properties: {

        // ── Response ──
        response: {
          type: 'string',
          description: 'Your conversational response to the user. Warm, professional, concise.'
        },
        phase_complete: {
          type: 'boolean',
          description: 'Set to true ONLY when all required fields for the current phase are collected.'
        },

        // ── CLASSIFY ──
        affidavit_type: {
          type: 'string',
          description: 'Affidavit type ID (e.g., general_affidavit, affidavit_of_residency, financial_affidavit)'
        },

        // ── PARTIES ──
        affiant_first_name: { type: 'string' },
        affiant_last_name:  { type: 'string' },
        affiant_address:    { type: 'string', description: 'Street address of affiant' },
        affiant_city:       { type: 'string' },
        affiant_state:      { type: 'string', description: 'Full state name of affiant residence' },
        affiant_zip:        { type: 'string' },
        state:              { type: 'string', description: '2-letter state code for filing/venue' },
        county:             { type: 'string', description: 'County for venue block' },

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
        },

        // ── REVIEW ──
        user_confirmed_review: { type: 'boolean' }
      }
    }
  }
};

// ─── Field mapping (snake_case → camelCase) ───────────────────────────────────

const FIELD_MAP = {
  affidavit_type:        'affidavitType',
  affiant_first_name:    'affiantFirstName',
  affiant_last_name:     'affiantLastName',
  affiant_address:       'affiantAddress',
  affiant_city:          'affiantCity',
  affiant_state:         'affiantStateName',
  affiant_zip:           'affiantZip',
  state:                 'state',
  county:                'county',
  user_confirmed_review: 'userConfirmedReview',
};

// ─── GeneralAffidavitOrchestrator ─────────────────────────────────────────────

class GeneralAffidavitOrchestrator {

  /**
   * Main entry point called by routes/chat.js.
   */
  async processMessage(message, conversationHistory, affidavitData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) throw new Error('LLM service not available');

    const state = this._initState(affidavitData);

    if (!PHASES[state.currentPhase]) {
      logger.warn('GeneralAffidavitOrchestrator: unknown phase, resetting to start', { phase: state.currentPhase });
      state.currentPhase = this._determineStartingPhase(affidavitData);
    }

    logger.info('GeneralAffidavitOrchestrator: processing message', {
      phase:           state.currentPhase,
      affidavitType:   affidavitData.affidavitType || 'unknown',
      completedPhases: state.completedPhases?.length ?? 0,
      userId,
      sessionId
    });

    const systemPrompt = this._getSystemPrompt(state.currentPhase, affidavitData, affidavitData.facts || []);
    const userPrompt   = this._buildUserPrompt(message, affidavitData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16),
      { role: 'user', content: userPrompt }
    ];

    const completion = await openAIService.chat(messages, {
      model:       DEFAULT_LLM_MODEL,
      tools:       [AFFIDAVIT_TOOL],
      tool_choice: { type: 'function', function: { name: 'process_affidavit_data' } },
      temperature: 0.3,
      max_tokens:  1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) throw new Error('GeneralAffidavitOrchestrator: LLM did not call the required function');

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error(`GeneralAffidavitOrchestrator: Failed to parse function arguments: ${e.message}`);
    }

    const { response, phase_complete, extracted_facts, ...fieldUpdates } = extracted;

    const updatedData = this._applyFieldUpdates(affidavitData, fieldUpdates);

    // Accumulate facts
    const newFacts = this._buildFacts(extracted_facts || [], state.currentPhase, message);
    if (newFacts.length > 0) {
      // Upsert only — never re-sort. A wholesale organizeFacts() here would
      // silently undo the user's manual fact ordering on every chat turn.
      updatedData.facts = mergeFacts(updatedData.facts || [], newFacts);
    }

    // ── Symbolic phase-completion gate (FACTS phase only) ─────────────────────
    // The requirements checker has the final say on whether FACTS is complete.
    // This prevents the LLM from advancing past FACTS while required topics are
    // still outstanding, regardless of what it returns for phase_complete.
    let resolvedPhaseComplete = phase_complete;
    if (state.currentPhase === 'FACTS') {
      const typeId      = updatedData.affidavitType || 'general_affidavit';
      const checkResult = requirementsChecker.check(typeId, updatedData, updatedData.facts || []);

      if (phase_complete && !checkResult.isComplete) {
        // LLM tried to advance but requirements not met — block it
        resolvedPhaseComplete = false;
        logger.info('GeneralAffidavitOrchestrator: checker blocked premature phase_complete', {
          typeId,
          completeness:   checkResult.completeness,
          missingTopics:  checkResult.missingTopics.map(t => t.id),
          missingFields:  checkResult.missingFields,
          factCount:      checkResult.factCount,
          minimumFacts:   checkResult.minimumFacts,
        });
      } else if (!phase_complete && checkResult.isComplete) {
        // Checker says we're done even though LLM didn't flag it — advance anyway
        resolvedPhaseComplete = true;
        logger.info('GeneralAffidavitOrchestrator: checker promoted phase_complete', {
          typeId, completeness: checkResult.completeness
        });
      }
    }

    // Phase advancement
    if (resolvedPhaseComplete) {
      state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
      state.phaseHistory    = [
        ...(state.phaseHistory || []),
        { phase: state.currentPhase, completedAt: new Date().toISOString() }
      ];
      const nextPhase = this._getNextPhase(state.currentPhase);
      logger.info('GeneralAffidavitOrchestrator: phase advanced', {
        from: state.currentPhase, to: nextPhase
      });
      state.currentPhase = nextPhase;
    }

    updatedData.orchestratorState = state;

    // Document selection based on affidavit type
    const practiceArea = updatedData.affidavitType || 'general_affidavit';
    const { requiredDocuments, selectionReasons } = documentSelectionAgent.select(updatedData, practiceArea);
    updatedData.requiredDocuments = requiredDocuments;
    updatedData.selectionReasons  = selectionReasons;

    return { response, affidavitData: updatedData, newFacts, orchestratorState: state };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _initState(data) {
    if (data.orchestratorState?.currentPhase && PHASES[data.orchestratorState.currentPhase]) {
      return { ...data.orchestratorState };
    }
    return {
      currentPhase:    this._determineStartingPhase(data),
      completedPhases: [],
      phaseHistory:    [],
      orchestratorType: 'general'
    };
  }

  /**
   * Skip CLASSIFY if the affidavitType is already known (user selected it from the UI type-picker,
   * or documentType maps to a known registry type for documents created before affidavitType was set).
   * Skip PARTIES if affiant name (any format) and state are already set.
   */
  _determineStartingPhase(data) {
    // Accept affidavitType (set by AI) OR documentType (set by UI) to skip the type-selection phase
    if (!data.affidavitType && !data.documentType) return 'CLASSIFY';
    // Accept split fields (affiantFirstName, new format) OR combined name (affiantName, legacy format)
    const hasName = data.affiantFirstName || data.affiantName;
    if (!hasName || !data.state) return 'PARTIES';
    if (!data.facts?.length) return 'FACTS';
    return 'REVIEW';
  }

  /**
   * Get the system prompt for a given phase.
   * For FACTS, runs the requirements checker and injects missing/satisfied topics
   * into a generic template — no per-type prose prompts.
   */
  _getSystemPrompt(phaseName, data, facts = []) {
    if (phaseName === 'FACTS') {
      const typeId    = data.affidavitType || 'general_affidavit';
      const checkResult = requirementsChecker.check(typeId, data, facts);
      return buildFactsPrompt(
        checkResult.displayName,
        requirementsChecker.formatMissingForPrompt(checkResult),
        requirementsChecker.formatSatisfiedForPrompt(checkResult)
      );
    }
    return PHASES[phaseName]?.prompt || PHASES['CLASSIFY'].prompt;
  }

  _buildUserPrompt(message, data, state) {
    const collected = this._summarizeCollected(data);
    return [
      `CURRENT PHASE: ${state.currentPhase} (${PHASES[state.currentPhase]?.displayName || state.currentPhase})`,
      collected ? `\nALREADY COLLECTED:\n${collected}` : '',
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('');
  }

  _summarizeCollected(d) {
    const items = [];
    if (d.affidavitType)     items.push(`Affidavit type: ${d.affidavitType}`);
    if (d.affiantFirstName)  items.push(`Affiant: ${d.affiantFirstName} ${d.affiantLastName || ''}`);
    if (d.state)             items.push(`State: ${d.state}`);
    if (d.county)            items.push(`County: ${d.county}`);
    if (d.affiantAddress)    items.push(`Address: ${d.affiantAddress}, ${d.affiantCity || ''}`);
    if (d.facts?.length)     items.push(`Facts documented: ${d.facts.length}`);
    return items.join('\n');
  }

  _applyFieldUpdates(data, fields) {
    const updated = { ...data };
    for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
      if (fields[snakeKey] !== undefined && fields[snakeKey] !== null && fields[snakeKey] !== '') {
        updated[camelKey] = fields[snakeKey];
      }
    }
    // Derive full affiant name for template compatibility
    if (updated.affiantFirstName || updated.affiantLastName) {
      updated.affiantName = [updated.affiantFirstName, updated.affiantLastName].filter(Boolean).join(' ');
    }
    return updated;
  }

  _buildFacts(extractedFacts, currentPhase, sourceMessage) {
    const defaultCategory = currentPhase === 'FACTS' ? 'fact' : currentPhase.toLowerCase();
    const sourceQuote = typeof sourceMessage === 'string'
      ? sourceMessage.trim().slice(0, 280)
      : '';
    return extractedFacts.map(f => ({
      sourceQuote,
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

  _getNextPhase(currentPhase) {
    const idx = PHASE_ORDER.indexOf(currentPhase);
    if (idx === -1 || idx === PHASE_ORDER.length - 1) return 'REVIEW';
    return PHASE_ORDER[idx + 1];
  }
}

module.exports = new GeneralAffidavitOrchestrator();
