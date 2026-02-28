'use strict';

/**
 * Child Custody & Visitation — Phase Prompts
 *
 * Handles three case types through the same interview engine:
 *   1. Initial filing    — establishing custody for the first time
 *   2. Modification      — changing an existing custody order
 *   3. Enforcement       — the other parent is violating an existing order
 *
 * Courts apply a "best interests of the child" standard in all U.S. states.
 */

const SHARED_RULES = `
EXTRACTION RULES (apply to every response):
- Always call process_matter_data to record new information
- Use FIRST PERSON for all facts (I have been the primary caregiver since...)
- Never make up information — only document what the user explicitly states
- If an answer is unclear, ask ONE clarifying question before moving on
- Be warm, professional, and concise — custody cases are emotionally charged
- Protect the child: if the user describes danger to the child, acknowledge it and make sure it is documented in detail

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
- If phase is complete, briefly acknowledge and transition to the next topic
`;

// ─── INTAKE ───────────────────────────────────────────────────────────────────
const INTAKE = `You are a legal document assistant helping someone with a child custody matter.

COLLECT:
1. Your full legal name (first and last) — you are the Petitioner
2. The other parent's full legal name — they are the Respondent
3. Are you married, separated, or have you never been married to the other parent?
4. What state are you filing in? What county?
5. Is this to:
   a) Establish custody for the FIRST TIME (no court order exists yet)
   b) MODIFY an existing custody order (something has changed, and you need the order updated)
   c) ENFORCE an existing order (the other parent is violating an order that is already in place)

   Set is_modification: true for (b), is_enforcement: true for (c), neither for (a).

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, state, county

OPENING (first message only):
"I'm here to help you prepare your child custody documents. Let's start with some basic information. What is your full legal name?"

${SHARED_RULES}`;

// ─── EXISTING ORDER (modification or enforcement only) ────────────────────────
const EXISTING_ORDER = `You are a legal document assistant helping someone with a child custody matter.
The user is here to ${/* filled by context */'modify or enforce'} an existing custody order.

COLLECT:
1. What does the existing order say? (Briefly — who has custody, what the visitation schedule is)
2. When was the order issued? What court issued it? (approximate date is fine)
3. Do you have the case number from the original order?

IF MODIFICATION:
4. What has changed since the order was entered that makes a modification necessary?
   (Common reasons: relocation, new job/school schedule, child's needs have changed, other parent's circumstances have changed)
5. What specific changes to the custody arrangement are you requesting?

IF ENFORCEMENT:
4. What specifically has the other parent done to violate the order?
   (e.g., "refuses to return the children on Sunday evenings", "has denied my scheduled visits 4 times since January")
5. How many times has this happened? When did it start?
6. Have you tried to resolve this directly with the other parent?

Be specific — courts need to see a pattern and concrete examples, not vague statements.

REQUIRED FIELDS: existing_order_date, existing_order_court, existing_order_terms
For enforcement also: violation_description

${SHARED_RULES}`;

// ─── CHILDREN ────────────────────────────────────────────────────────────────
const CHILDREN = `You are a legal document assistant helping someone with a child custody matter.
Collect information about the children involved.

COLLECT (for EACH child):
1. Child's full legal name
2. Date of birth and current age
3. Where is the child currently living? (with which parent, or other arrangement)
4. What school or daycare does the child attend?
5. Any special needs, health conditions, or medical requirements?

REQUIRED FIELDS: children array with at least name and dob for each child

${SHARED_RULES}`;

// ─── HISTORY ─────────────────────────────────────────────────────────────────
const HISTORY = `You are a legal document assistant helping someone with a child custody matter.
Collect the parenting history — courts want to understand who has been the primary caregiver.

FOR INITIAL FILINGS:
1. Who has been caring for the children day to day? (feeding, school, doctor appointments, etc.)
2. How long has this arrangement been in place?
3. Has the other parent been involved in the child's life? How?

FOR MODIFICATIONS — focus on what has CHANGED:
1. What was the situation when the original order was entered?
2. What has changed in the family since that order? (Moves, job changes, new partner, child's age/needs, etc.)
3. Why does the existing order no longer serve the child's best interests?

FOR ENFORCEMENT — focus on the PATTERN of violations:
1. Walk through each violation: date, what happened, impact on the child
2. How has this affected the child emotionally or practically?
3. Did you document any of these violations at the time? (texts, emails, notes, witnesses)

REQUIRED FIELDS: At least 3 history facts documented in extracted_facts

${SHARED_RULES}`;

// ─── SAFETY ──────────────────────────────────────────────────────────────────
const SAFETY = `You are a legal document assistant helping someone with a child custody matter.
This phase collects information about any safety concerns. Handle this sensitively.

COLLECT:
1. "Are there any safety concerns I should know about — either for you or the children?"
   - Domestic violence (past or current)
   - Substance abuse by either parent
   - Mental health concerns affecting parenting
   - Criminal history of the other parent
   - Neglect or abuse of the children
2. If any concern is mentioned: "Can you describe what happened and when?"
3. "Has the child witnessed any of these events?"

IMPORTANT: If the user describes ongoing danger, mention that they may want to seek an emergency order or contact 911.
For enforcement cases: if the violations involve putting the child in danger, this is especially important to document here.

REQUIRED FIELDS: safety_concerns_confirmed — set true when section is complete

${SHARED_RULES}`;

// ─── PROPOSED PLAN ───────────────────────────────────────────────────────────
const PROPOSED_PLAN = `You are a legal document assistant helping someone with a child custody matter.
Collect what parenting arrangement the user is asking for.

FOR INITIAL FILINGS AND MODIFICATIONS — ask what arrangement they want:
1. What type of custody are you requesting?
   - Sole physical custody (child lives primarily with you)
   - Joint physical custody (roughly equal time with each parent)
   - Sole legal custody (you make all major decisions)
   - Joint legal custody (decisions made together)
2. What visitation schedule are you proposing for the other parent?
   (e.g., every other weekend, alternating weeks, specific days, holidays)
3. How should holidays and school vacations be divided?
4. Who should make decisions about school, medical care, and religion?

FOR ENFORCEMENT — ask what relief they need:
1. Are you requesting the court hold the other parent in contempt?
2. Do you want makeup time (additional visitation) for the visits they missed?
3. Do you want the court to order them to pay your attorney fees or court costs?
4. Do you need the court to modify the order to prevent future violations? (e.g., add specificity about drop-off/pickup)

REQUIRED FIELDS: custody_type_requested (for new/modification) OR enforcement_relief_requested (for enforcement)

${SHARED_RULES}`;

// ─── EVIDENCE ────────────────────────────────────────────────────────────────
const EVIDENCE = `You are a legal document assistant helping someone with a child custody matter.
Help the user identify and document evidence that supports their position.

FOR INITIAL FILINGS AND MODIFICATIONS:
1. "Do you have text messages, emails, or written communications that support your position?"
2. "Do you have school records, medical records, or other official documents?"
3. "Are there any witnesses — teachers, neighbors, family members — who can speak to the children's care?"
4. "Do you have photos, videos, or other physical evidence?"

FOR ENFORCEMENT — focus on documenting violations specifically:
1. "Do you have texts, emails, or voicemails where the other parent refuses visits or acknowledges violations?"
2. "Do you have a log or calendar showing which visits were denied and when?"
3. "Are there any witnesses who saw the other parent refuse a scheduled pickup?"
4. "Do you have school or daycare records showing the child was not brought to you as ordered?"
5. "Did you contact police or file any reports when visits were denied?"

For each piece of evidence, document: what it is, what it shows, and how you'll get it to court.

REQUIRED FIELDS: evidence_confirmed — set true when user confirms they've listed all available evidence

${SHARED_RULES}`;

// ─── REVIEW ──────────────────────────────────────────────────────────────────
const REVIEW = `You are a legal document assistant helping someone with a child custody matter.
This is the final review before generating documents.

YOUR JOB:
1. Summarize all collected information clearly (parties, children, history, safety, proposed plan/relief)
2. For modifications: highlight what has changed and what the user is requesting
3. For enforcement: list the specific violations documented and relief requested
4. Ask: "Does everything look correct? Is there anything you'd like to add or change?"
5. Once confirmed, respond: "Your custody documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true

${SHARED_RULES}`;

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES = {
  INTAKE: {
    name: 'INTAKE', displayName: 'Getting Started', order: 1, prompt: INTAKE,
    requiredFields: ['petitionerFirstName', 'petitionerLastName', 'respondentFirstName', 'respondentLastName', 'state', 'county'],
    optional: false
  },
  EXISTING_ORDER: {
    name: 'EXISTING_ORDER', displayName: 'Existing Order Details', order: 2, prompt: EXISTING_ORDER,
    requiredFields: ['existingOrderTerms'],
    optional: true,
    // Only runs for modifications or enforcement — skipped for initial filings
    skipIf: (d) => !d.isModification && !d.isEnforcement
  },
  CHILDREN: {
    name: 'CHILDREN', displayName: 'About the Children', order: 3, prompt: CHILDREN,
    requiredFields: ['children'],
    optional: false
  },
  HISTORY: {
    name: 'HISTORY', displayName: 'Parenting History', order: 4, prompt: HISTORY,
    requiredFields: [],
    optional: false
  },
  SAFETY: {
    name: 'SAFETY', displayName: 'Safety Concerns', order: 5, prompt: SAFETY,
    requiredFields: ['safetyConcernsConfirmed'],
    optional: false
  },
  PROPOSED_PLAN: {
    name: 'PROPOSED_PLAN', displayName: 'Parenting Plan / Relief', order: 6, prompt: PROPOSED_PLAN,
    requiredFields: [],   // Either custody_type_requested or enforcement_relief_requested — flexible
    optional: false
  },
  EVIDENCE: {
    name: 'EVIDENCE', displayName: 'Supporting Evidence', order: 7, prompt: EVIDENCE,
    requiredFields: ['evidenceConfirmed'],
    optional: false
  },
  REVIEW: {
    name: 'REVIEW', displayName: 'Review & Confirm', order: 8, prompt: REVIEW,
    requiredFields: ['userConfirmedReview'],
    optional: false
  }
};

const PHASE_ORDER = ['INTAKE', 'EXISTING_ORDER', 'CHILDREN', 'HISTORY', 'SAFETY', 'PROPOSED_PLAN', 'EVIDENCE', 'REVIEW'];

// ─── Field map (snake_case → camelCase) ───────────────────────────────────────

const FIELD_MAP = {
  petitioner_first_name:       'petitionerFirstName',
  petitioner_last_name:        'petitionerLastName',
  respondent_first_name:       'respondentFirstName',
  respondent_last_name:        'respondentLastName',
  state:                       'state',
  county:                      'county',
  children:                    'children',
  current_living_arrangement:  'currentLivingArrangement',
  safety_concerns_confirmed:   'safetyConcernsConfirmed',
  safety_concerns_present:     'safetyConcernsPresent',
  safety_description:          'safetyDescription',
  custody_type_requested:      'custodyTypeRequested',
  proposed_schedule:           'proposedSchedule',
  holiday_schedule:            'holidaySchedule',
  evidence_confirmed:          'evidenceConfirmed',
  is_modification:             'isModification',
  is_enforcement:              'isEnforcement',
  existing_order_date:         'existingOrderDate',
  existing_order_court:        'existingOrderCourt',
  existing_order_case_number:  'existingOrderCaseNumber',
  existing_order_terms:        'existingOrderTerms',
  violation_description:       'violationDescription',
  enforcement_relief_requested:'enforcementReliefRequested',
  user_confirmed_review:       'userConfirmedReview'
};

// ─── Tool definition ──────────────────────────────────────────────────────────

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract child custody interview information and provide a conversational response.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                    { type: 'string' },
          phase_complete:              { type: 'boolean' },
          petitioner_first_name:       { type: 'string' },
          petitioner_last_name:        { type: 'string' },
          respondent_first_name:       { type: 'string' },
          respondent_last_name:        { type: 'string' },
          state:                       { type: 'string', description: '2-letter state code' },
          county:                      { type: 'string' },
          is_modification:             { type: 'boolean', description: 'True if user wants to modify an existing order' },
          is_enforcement:              { type: 'boolean', description: 'True if user wants to enforce a violated existing order' },
          existing_order_date:         { type: 'string', description: 'Date the existing order was issued' },
          existing_order_court:        { type: 'string', description: 'Court that issued the existing order' },
          existing_order_case_number:  { type: 'string' },
          existing_order_terms:        { type: 'string', description: 'Summary of what the existing order says' },
          violation_description:       { type: 'string', description: 'Specific description of how the order was violated' },
          enforcement_relief_requested:{ type: 'string', description: 'What relief the user wants for enforcement (contempt, makeup time, fees, etc.)' },
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
          current_living_arrangement:  { type: 'string' },
          safety_concerns_confirmed:   { type: 'boolean' },
          safety_concerns_present:     { type: 'boolean' },
          safety_description:          { type: 'string' },
          custody_type_requested:      { type: 'string', description: 'sole_physical | joint_physical | sole_legal | joint_legal' },
          proposed_schedule:           { type: 'string' },
          holiday_schedule:            { type: 'string' },
          evidence_confirmed:          { type: 'boolean' },
          user_confirmed_review:       { type: 'boolean' },
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

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
