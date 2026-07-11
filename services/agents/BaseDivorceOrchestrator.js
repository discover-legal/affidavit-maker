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
const { DEFAULT_LLM_MODEL } = require('../llmConfig');
const { mergeFacts } = require('./FactOrganizer');
const documentSelectionAgent = require('./DocumentSelectionAgent');
const { mergeChildren, removeChildrenByName, summarizeChildren, hasMinors } = require('../../utils/childrenMerge');
const { mergeLabeledAmounts, totalOf } = require('../../utils/labeledAmounts');

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
          residency_basis:        { type: 'string', description: 'NY only: which DRL § 230 jurisdictional basis applies (e.g., both_residents, married_in_ny_1yr, last_lived_together_1yr, grounds_arose_1yr, 2yr_residence)' },
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
            description: 'Children mentioned in THIS message only. Entries are MERGED into the already-collected list by name — previously recorded children are never removed by this field, so do not re-send them. To correct a child, re-send that child with the same name and the corrected details.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                dob:  { type: 'string' },
                age:  { type: 'number' }
              }
            }
          },
          remove_children: {
            type: 'array',
            description: 'Names of previously recorded children to remove, ONLY when the user says a recorded child should not be on the record.',
            items: { type: 'string' }
          },
          custody_arrangement: { type: 'string' },
          primary_custodian: { type: 'string', description: "Who has primary physical custody: 'petitioner', 'respondent', or the parent's name" },
          child_support_amount: { type: 'number', description: 'Monthly child support amount in dollars, if agreed or known' },
          child_support_payor: { type: 'string', description: "Who pays child support: 'petitioner' or 'respondent'" },

          // ── PROPERTY ──
          property_confirmed: { type: 'boolean' },
          property_agreement: { type: 'string', description: 'agreed | contested' },
          has_property: { type: 'boolean', description: 'true if the parties accumulated community/marital property during the marriage, false if none' },
          has_debts:    { type: 'boolean', description: 'true if the parties accumulated community/marital debts during the marriage, false if none' },
          petitioner_property: { type: 'string', description: "Assets the petitioner keeps, as a comma-separated description, in the user's words. Extract ONLY assets the user explicitly assigned to the petitioner." },
          respondent_property: { type: 'string', description: "Assets the respondent keeps, as a comma-separated description, in the user's words. Extract ONLY assets the user explicitly assigned to the respondent." },
          petitioner_debts: { type: 'string', description: "Debts the petitioner takes responsibility for, as a comma-separated description, in the user's words. Extract ONLY debts the user explicitly assigned to the petitioner." },
          respondent_debts: { type: 'string', description: "Debts the respondent takes responsibility for, as a comma-separated description, in the user's words. Extract ONLY debts the user explicitly assigned to the respondent." },

          // ── SPOUSAL SUPPORT ──
          spousal_support_confirmed: { type: 'boolean' },
          spousal_support_requested: { type: 'boolean' },
          support_amount:   { type: 'number' },
          support_duration: { type: 'string' },
          support_basis:    { type: 'string' },

          // ── SERVICE OF PROCESS ──
          service_method:     { type: 'string', description: 'waiver | formal' },
          respondent_address: { type: 'string' },

          // ── INDIGENCY / FEE WAIVER (all states) ──
          indigency_confirmed: { type: 'boolean' },
          indigency_requested: { type: 'boolean' },
          monthly_income:      { type: 'number' },
          monthly_expenses:    { type: 'number' },
          income_breakdown: {
            type: 'array',
            description: 'Itemized monthly income mentioned in THIS message. Entries MERGE into the already-collected list by label — never re-send prior items. label examples: "Your wages", "Child support received"; person: petitioner | respondent | joint | other.',
            items: {
              type: 'object',
              properties: {
                label:  { type: 'string' },
                amount: { type: 'number', description: 'Dollars per month' },
                person: { type: 'string', description: 'petitioner | respondent | joint | other' }
              },
              required: ['label', 'amount']
            }
          },
          expense_breakdown: {
            type: 'array',
            description: 'Itemized monthly expenses mentioned in THIS message. Entries MERGE by label — never re-send prior items. label examples: "Housing", "Utilities", "Food", "Childcare", "Transportation", "Medical", "Debt payments".',
            items: {
              type: 'object',
              properties: {
                label:  { type: 'string' },
                amount: { type: 'number', description: 'Dollars per month' }
              },
              required: ['label', 'amount']
            }
          },
          assets_description:  { type: 'string' },
          dependents_count:    { type: 'number' },

          // ── MILITARY STATUS ──
          military_status_confirmed:  { type: 'boolean' },
          respondent_military_status: { type: 'string', description: 'not_military | military | unknown' },
          military_search_date:       { type: 'string' },
          military_search_method:     { type: 'string' },

          // ── RECONCILIATION (Ghana — MCA s.2(3)) ──
          reconciliation_acknowledged: { type: 'boolean', description: 'true = user acknowledges mandatory reconciliation requirement' },

          // ── MARRIAGE TYPE (Ghana — ordinance/customary/Mohammedan) ──
          marriage_type: { type: 'string', description: 'Type of marriage: ordinance, customary, or mohammedan' },

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
  residency_basis:             'residencyBasis',
  has_protective_order:        'hasProtectiveOrder',
  marriage_date:               'marriageDate',
  marriage_city:               'marriageCity',
  marriage_state:              'marriageStateName',
  separation_date:             'separationDate',
  grounds:                     'groundsForDivorce',
  children_confirmed:          'childrenConfirmed',
  children:                    'children',
  custody_arrangement:         'custodyArrangement',
  primary_custodian:           'primaryCustodian',
  child_support_amount:        'childSupportAmount',
  child_support_payor:         'childSupportPayor',
  property_confirmed:          'propertyConfirmed',
  property_agreement:          'propertyAgreement',
  has_property:                'hasProperty',
  has_debts:                   'hasDebts',
  petitioner_property:         'petitionerProperty',
  respondent_property:         'respondentProperty',
  petitioner_debts:            'petitionerDebts',
  respondent_debts:            'respondentDebts',
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
  income_breakdown:            'incomeBreakdown',
  expense_breakdown:           'expenseBreakdown',
  assets_description:          'assetsDescription',
  dependents_count:            'dependentsCount',
  military_status_confirmed:   'militaryStatusConfirmed',
  respondent_military_status:  'respondentMilitaryStatus',
  military_search_date:        'militarySearchDate',
  military_search_method:      'militarySearchMethod',
  user_confirmed_review:       'userConfirmedReview',
  reconciliation_acknowledged: 'reconciliationAcknowledged',
  marriage_type:               'marriageType',
  // TX legacy compat
  residency_tx_months:         'residencyStateMonths',
};

// ─── Phase → fact category ────────────────────────────────────────────────────
const PHASE_CATEGORY = {
  INTAKE:          'general',
  RESIDENCY:       'residency',
  GROUNDS:         'grounds',
  RECONCILIATION:  'grounds',
  CHILDREN:        'children',
  PROPERTY:        'property',
  SUPPORT:         'support',
  SERVICE:         'service',
  INDIGENCY:       'indigency',
  MILITARY:        'military',
  REVIEW:          'general',
};

// ─── Orchestrator behavior rules ──────────────────────────────────────────────
// Injected into every system prompt to enforce consistent UX across all states.

const ORCHESTRATOR_BEHAVIOR = `
CONVERSATION RULES (you MUST follow these strictly):
1. Ask exactly ONE question per message. The COLLECT list above shows everything to gather in this phase, but you MUST ask them one at a time across multiple messages. Never combine two or more questions.
2. When you set phase_complete: true, your response MUST naturally transition to the next topic and ask the first relevant question about it. Never say "let's proceed" or "we're ready to move on" without immediately asking the next question. Never wait for the user to say "proceed."
3. Keep each response to 1-3 sentences. Acknowledge what the user said briefly, then ask the next question.
4. Never repeat information the user already provided.
5. Extract ONLY information the user explicitly stated. Never guess, infer, or fill in a value the user did not provide — if something is unclear or missing, ask about it instead.
6. If the user indicates a contested issue (custody, property, support) or a safety risk, acknowledge once that advice from a lawyer is recommended for that issue, then continue helping.
7. Respond in the same language the user writes in. Keep extracted field VALUES in the user's words, but field names and dates in the structured formats requested.
`;

// No first-message disclaimer — the app UI already disclaims elsewhere.
// The AI disclaimer appears only at REVIEW completion (see REVIEW_COMPLETION).

const REVIEW_COMPLETION = `
COMPLETION INSTRUCTIONS: When the user confirms all information is correct and you set user_confirmed_review: true, your response MUST:
1. Provide a brief summary confirmation (2-3 sentences)
2. Include this notice: "Important: These documents were generated with AI assistance. While we strive for accuracy, they may contain errors or omissions. We strongly recommend having them reviewed by a licensed attorney in your jurisdiction before filing."
3. End with a clear call to action: "Your divorce documents are ready! Click the Download or Purchase button below to get your completed package."
`;

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

    const systemPrompt = this._buildSystemPrompt(state, divorceData);
    const userPrompt   = this._buildUserPrompt(message, divorceData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16),
      { role: 'user', content: userPrompt }
    ];

    const completion = await openAIService.chat(messages, {
      model:       DEFAULT_LLM_MODEL,
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

    const newFacts = this._buildFacts(extracted_facts || [], fieldUpdates, state.currentPhase, message);
    if (newFacts.length > 0) {
      // Upsert only — never re-sort. A wholesale organizeFacts() here would
      // silently undo the user's manual fact ordering on every chat turn.
      updatedData.facts = mergeFacts(updatedData.facts || [], newFacts);
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

  /**
   * Build the enhanced system prompt with behavioral rules and phase context.
   */
  _buildSystemPrompt(state, divorceData) {
    const parts = [this.phases[state.currentPhase].prompt];

    // Core behavior rules (one question at a time, auto-transition)
    parts.push(ORCHESTRATOR_BEHAVIOR);

    // Progress indicator
    const currentIdx = this.phaseOrder.indexOf(state.currentPhase);
    const totalPhases = this.phaseOrder.length;
    parts.push(`PROGRESS: Step ${currentIdx + 1} of ${totalPhases}.`);

    // Tell the LLM what the next phase is so it can transition naturally
    if (state.currentPhase !== 'REVIEW') {
      const nextPhase = this._getNextPhase(state.currentPhase, divorceData);
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
    // Accept both split fields (new orchestrator) and combined name (legacy documents)
    const hasPetitioner = divorceData.petitionerFirstName || divorceData.petitionerName;
    const hasRespondent = divorceData.respondentFirstName || divorceData.respondentName;
    if (hasPetitioner && hasRespondent) {
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
    // States that use Plaintiff/Defendant in divorce complaints:
    //   NY, PA — traditional plaintiff/defendant style
    //   GA, MA, MI, NC, NJ, OH — also use Plaintiff/Defendant in divorce complaints
    // All other states (CO, WA, VA, TX, AZ, CA, FL, IL, UT, and Canadian provinces)
    //   use Petitioner/Respondent (or Complainant/Defendant for VA).
    const usesPlaintiff = ['NY', 'PA', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH'].includes(this.stateCode);
    const filingPartyLabel   = usesPlaintiff ? 'Plaintiff'  : 'Petitioner';
    const respondingPartyLabel = usesPlaintiff ? 'Defendant' : 'Respondent';

    // Canadian provinces use province-specific location terminology:
    // NB uses "Judicial District"; PE has a single court location (Charlottetown).
    // All other Canadian provinces and all US states use generic location labelling.
    const CANADIAN_PROVINCES = ['MB', 'SK', 'NB', 'NS', 'NL', 'PE', 'ON', 'BC', 'AB', 'QC', 'NT', 'YT', 'NU'];
    const isCanadian = CANADIAN_PROVINCES.includes(this.stateCode);
    let locationLabel;
    if (this.stateCode === 'NB') {
      locationLabel = 'Judicial District';
    } else if (isCanadian) {
      locationLabel = 'Court Location';
    } else {
      locationLabel = 'County';
    }

    const items = [];
    if (d.petitionerFirstName) items.push(`${filingPartyLabel}: ${d.petitionerFirstName} ${d.petitionerLastName || ''}`);
    if (d.respondentFirstName)  items.push(`${respondingPartyLabel}: ${d.respondentFirstName} ${d.respondentLastName || ''}`);
    if (d.state)                items.push(`Province/State: ${d.state}`);
    if (d.county)               items.push(`${locationLabel}: ${d.county}`);
    if (d.marriageDate)         items.push(`Marriage date: ${d.marriageDate}`);
    if (d.groundsForDivorce)    items.push(`Grounds: ${d.groundsForDivorce}`);
    if (Array.isArray(d.children) && d.children.length > 0) {
      items.push(`Children recorded (${d.children.length}):\n${summarizeChildren(d.children)}`);
    } else if (typeof d.hasMinorChildren === 'boolean') {
      items.push(`Minor children: ${d.hasMinorChildren ? 'yes' : 'no'}`);
    }
    if (d.custodyArrangement)   items.push(`Custody arrangement: ${d.custodyArrangement}`);
    if (d.serviceMethod)        items.push(`Service method: ${d.serviceMethod}`);
    if (d.facts?.length)        items.push(`Facts documented: ${d.facts.length}`);
    return items.join('\n');
  }

  _applyFieldUpdates(divorceData, fields) {
    const updated = { ...divorceData };

    for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
      if (fields[snakeKey] !== undefined && fields[snakeKey] !== null && fields[snakeKey] !== '') {
        // Structured lists accumulate across turns — the LLM usually emits
        // only the entry under discussion, so assignment would drop the rest.
        if (snakeKey === 'children') {
          updated.children = mergeChildren(divorceData.children, fields.children);
        } else if (snakeKey === 'income_breakdown' || snakeKey === 'expense_breakdown') {
          updated[camelKey] = mergeLabeledAmounts(divorceData[camelKey], fields[snakeKey]);
        } else if (
          snakeKey === 'petitioner_property' || snakeKey === 'respondent_property' ||
          snakeKey === 'petitioner_debts' || snakeKey === 'respondent_debts'
        ) {
          // The tool collects these as a comma-separated description, but
          // BaseDivorceDecreeTemplate iterates each of them (.forEach) to
          // print one line item per asset/debt — store them as arrays.
          updated[camelKey] = String(fields[snakeKey])
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        } else {
          updated[camelKey] = fields[snakeKey];
        }
      }
    }

    // Itemized money is the source of truth for the totals once present.
    if (Array.isArray(updated.incomeBreakdown) && updated.incomeBreakdown.length > 0) {
      updated.monthlyIncome = totalOf(updated.incomeBreakdown);
    }
    if (Array.isArray(updated.expenseBreakdown) && updated.expenseBreakdown.length > 0) {
      updated.monthlyExpenses = totalOf(updated.expenseBreakdown);
    }

    if (Array.isArray(fields.remove_children) && fields.remove_children.length > 0) {
      updated.children = removeChildrenByName(updated.children, fields.remove_children);
    }
    // Re-derive only on turns that touched the children list, from actual
    // ages — adult children must not flip the minor-children flag (it gates
    // custody/support document selection), and an explicit "no minors"
    // answer must not be overwritten on unrelated turns.
    if (fields.children !== undefined || fields.remove_children !== undefined) {
      updated.hasMinorChildren = hasMinors(updated.children);
    }

    // Derive full names for template compatibility
    if (updated.petitionerFirstName || updated.petitionerLastName) {
      updated.petitionerName = [updated.petitionerFirstName, updated.petitionerLastName].filter(Boolean).join(' ');
      // The petitioner IS the affiant on a divorce filing — the requirements
      // checker, document titles, and PDF filenames all read affiantName
      // (live E2E showed "Name provided" unchecked mid-interview without it).
      if (!updated.affiantName) {
        updated.affiantName = updated.petitionerName;
      }
    }
    if (updated.respondentFirstName || updated.respondentLastName) {
      updated.respondentName = [updated.respondentFirstName, updated.respondentLastName].filter(Boolean).join(' ');
    }

    // Derive marriageLocation from marriageCity + marriageStateName for template compatibility.
    // BaseDivorcePetitionTemplate reads divorceData.marriageLocation for the marriage paragraph.
    if (updated.marriageCity || updated.marriageStateName) {
      updated.marriageLocation = [updated.marriageCity, updated.marriageStateName].filter(Boolean).join(', ');
    }

    // Derive spousal-support decree fields from the orchestrator's support fields.
    // BaseDivorceDecreeTemplate (and all state subclasses) read:
    //   divorceData.spousalSupportAmount   — orchestrator stores supportAmount
    //   divorceData.spousalSupportDuration — orchestrator stores supportDuration
    //   divorceData.spousalSupportAwarded  — orchestrator stores spousalSupportRequested
    // Without these aliases the decree sections always render with '[AMOUNT]' / '[DURATION]'
    // placeholders and the spousal-support block is suppressed entirely.
    if (updated.supportAmount !== undefined) {
      updated.spousalSupportAmount = updated.supportAmount;
    }
    if (updated.supportDuration !== undefined) {
      updated.spousalSupportDuration = updated.supportDuration;
    }
    // Map the boolean intent flag to the decree gate field.
    // spousalSupportRequested=true  → spousalSupportAwarded=true
    // spousalSupportRequested=false → spousalSupportWaived=true
    if (updated.spousalSupportRequested === true) {
      updated.spousalSupportAwarded = true;
    } else if (updated.spousalSupportRequested === false) {
      updated.spousalSupportWaived = true;
    }
    // BaseDivorcePetitionTemplate gates the alimony relief item on
    // requestSpousalSupport — without this alias a user who asked for
    // spousal maintenance never gets it in the petition's prayer.
    if (updated.spousalSupportRequested !== undefined && updated.requestSpousalSupport === undefined) {
      updated.requestSpousalSupport = updated.spousalSupportRequested;
    }
    // BaseDivorceDecreeTemplate prints spousalSupportPayor / spousalSupportPayee
    // verbatim in the maintenance order. The interview never asks who pays whom:
    // the petitioner is the one who requests support (spousal_support_requested),
    // so the petitioner is the payee and the respondent the payor. Derive both
    // only when support is awarded and they are not already set.
    if (updated.spousalSupportRequested === true) {
      if (!updated.spousalSupportPayee && updated.petitionerName) {
        updated.spousalSupportPayee = updated.petitionerName;
      }
      if (!updated.spousalSupportPayor && updated.respondentName) {
        updated.spousalSupportPayor = updated.respondentName;
      }
    }

    // Derive custodyType from custodyArrangement for decree template compatibility.
    // BaseDivorceDecreeTemplate (and all state subclasses) gate joint-vs-sole custody
    // language on divorceData.custodyType. The orchestrator stores custodyArrangement
    // (from custody_arrangement). Without this alias the decree always defaults to 'joint'.
    if (updated.custodyArrangement !== undefined && updated.custodyType === undefined) {
      updated.custodyType = updated.custodyArrangement;
    }

    // The decree templates print these fields verbatim, so resolve
    // party-role answers ('petitioner' / 'respondent') to the actual names.
    const roleToName = (value) => {
      const s = String(value || '').trim();
      const role = s.toLowerCase();
      // Fall back to the capitalized role word — decrees print this field
      // verbatim, and a lowercase 'petitioner' mid-sentence reads broken.
      if (role === 'petitioner' || role === 'plaintiff') {
        return updated.petitionerName || (s.charAt(0).toUpperCase() + role.slice(1));
      }
      if (role === 'respondent' || role === 'defendant') {
        return updated.respondentName || (s.charAt(0).toUpperCase() + role.slice(1));
      }
      return s;
    };
    if (updated.primaryCustodian) {
      updated.primaryCustodian = roleToName(updated.primaryCustodian);
    }
    if (updated.childSupportPayor) {
      const role = String(updated.childSupportPayor).trim().toLowerCase();
      updated.childSupportObligor = roleToName(updated.childSupportPayor);
      if (role === 'petitioner' && updated.respondentName) {
        updated.childSupportObligee = updated.respondentName;
      } else if (role === 'respondent' && updated.petitionerName) {
        updated.childSupportObligee = updated.petitionerName;
      }
    }

    return updated;
  }

  _buildFacts(extractedFacts, _fieldUpdates, currentPhase, sourceMessage) {
    const defaultCategory = PHASE_CATEGORY[currentPhase] || 'general';
    // Provenance: keep the user's own words so the review UI can show
    // exactly where each sworn statement came from.
    const sourceQuote = typeof sourceMessage === 'string'
      ? sourceMessage.trim().slice(0, 280)
      : '';
    return extractedFacts.map(f => ({
      id:          `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content:     f.content,
      category:    f.category || defaultCategory,
      subcategory: f.subcategory || '',
      type:        'fact',
      confidence:  0.9,
      severity:    'success',
      sourceQuote,
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
        // Skip INDIGENCY only when confirmed AND the user did not request a fee waiver.
        // indigencyConfirmed=true merely means the section ran; indigencyRequested=true
        // means the user actually needs the waiver and the phase must NOT be skipped.
        if (candidate === 'INDIGENCY' && divorceData.indigencyConfirmed === true && !divorceData.indigencyRequested) continue;
      }
      return candidate;
    }
    return 'REVIEW';
  }
}

module.exports = BaseDivorceOrchestrator;
