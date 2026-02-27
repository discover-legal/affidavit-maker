'use strict';

/**
 * Child Custody & Visitation — Phase Prompts
 *
 * Applies to unmarried parents establishing custody for the first time,
 * or post-divorce custody modification motions.
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
5. Are you filing to establish custody for the first time, or to modify an existing order?

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, state, county

OPENING (first message only):
"I'm here to help you prepare your child custody documents. Let's start with some basic information. What is your full legal name?"

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

COLLECT:
1. Who has been caring for the children day to day? (feeding, school, doctor appointments, etc.)
2. How long has this arrangement been in place?
3. Are there any existing court orders for custody or visitation?
4. Has the other parent been involved in the child's life? How?
5. Have there been any significant changes in the family recently (moves, new relationships, job changes)?

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

REQUIRED FIELDS: safety_concerns_confirmed — set true when section is complete

${SHARED_RULES}`;

// ─── PROPOSED PLAN ───────────────────────────────────────────────────────────
const PROPOSED_PLAN = `You are a legal document assistant helping someone with a child custody matter.
Collect what parenting arrangement the user is asking for.

COLLECT:
1. What type of custody are you requesting?
   - Sole physical custody (child lives primarily with you)
   - Joint physical custody (roughly equal time with each parent)
   - Sole legal custody (you make all major decisions)
   - Joint legal custody (decisions made together)

2. What visitation schedule are you proposing for the other parent?
   (e.g., every other weekend, alternating weeks, specific days, holidays)

3. How should holidays and school vacations be divided?

4. Who should make decisions about school, medical care, and religion?

REQUIRED FIELDS: custody_type_requested, proposed_schedule

${SHARED_RULES}`;

// ─── EVIDENCE ────────────────────────────────────────────────────────────────
const EVIDENCE = `You are a legal document assistant helping someone with a child custody matter.
Help the user identify and document evidence that supports their position.

COLLECT:
1. "Do you have text messages, emails, or written communications that support your position?"
2. "Do you have school records, medical records, or other official documents?"
3. "Are there any witnesses — teachers, neighbors, family members — who can speak to the children's care?"
4. "Do you have photos, videos, or other physical evidence?"

For each piece of evidence, document: what it is, what it shows, and how you'll get it to court.

REQUIRED FIELDS: evidence_confirmed — set true when user confirms they've listed all available evidence

${SHARED_RULES}`;

// ─── REVIEW ──────────────────────────────────────────────────────────────────
const REVIEW = `You are a legal document assistant helping someone with a child custody matter.
This is the final review before generating documents.

YOUR JOB:
1. Summarize all collected information clearly (parties, children, history, safety, proposed plan)
2. Ask: "Does everything look correct? Is there anything you'd like to add or change?"
3. Once confirmed, respond: "Your custody documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true

${SHARED_RULES}`;

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES = {
  INTAKE: {
    name: 'INTAKE', displayName: 'Getting Started', order: 1, prompt: INTAKE,
    requiredFields: ['petitionerFirstName', 'petitionerLastName', 'respondentFirstName', 'respondentLastName', 'state', 'county'],
    optional: false
  },
  CHILDREN: {
    name: 'CHILDREN', displayName: 'About the Children', order: 2, prompt: CHILDREN,
    requiredFields: ['children'],
    optional: false
  },
  HISTORY: {
    name: 'HISTORY', displayName: 'Parenting History', order: 3, prompt: HISTORY,
    requiredFields: [],
    optional: false
  },
  SAFETY: {
    name: 'SAFETY', displayName: 'Safety Concerns', order: 4, prompt: SAFETY,
    requiredFields: ['safetyConcernsConfirmed'],
    optional: false
  },
  PROPOSED_PLAN: {
    name: 'PROPOSED_PLAN', displayName: 'Proposed Parenting Plan', order: 5, prompt: PROPOSED_PLAN,
    requiredFields: ['custodyTypeRequested'],
    optional: false
  },
  EVIDENCE: {
    name: 'EVIDENCE', displayName: 'Supporting Evidence', order: 6, prompt: EVIDENCE,
    requiredFields: ['evidenceConfirmed'],
    optional: false
  },
  REVIEW: {
    name: 'REVIEW', displayName: 'Review & Confirm', order: 7, prompt: REVIEW,
    requiredFields: ['userConfirmedReview'],
    optional: false
  }
};

const PHASE_ORDER = ['INTAKE', 'CHILDREN', 'HISTORY', 'SAFETY', 'PROPOSED_PLAN', 'EVIDENCE', 'REVIEW'];

// ─── Field map (snake_case → camelCase) ───────────────────────────────────────

const FIELD_MAP = {
  petitioner_first_name:    'petitionerFirstName',
  petitioner_last_name:     'petitionerLastName',
  respondent_first_name:    'respondentFirstName',
  respondent_last_name:     'respondentLastName',
  state:                    'state',
  county:                   'county',
  children:                 'children',
  current_living_arrangement: 'currentLivingArrangement',
  safety_concerns_confirmed: 'safetyConcernsConfirmed',
  safety_concerns_present:   'safetyConcernsPresent',
  safety_description:        'safetyDescription',
  custody_type_requested:    'custodyTypeRequested',
  proposed_schedule:         'proposedSchedule',
  holiday_schedule:          'holidaySchedule',
  evidence_confirmed:        'evidenceConfirmed',
  is_modification:           'isModification',
  user_confirmed_review:     'userConfirmedReview'
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
          response:                 { type: 'string' },
          phase_complete:           { type: 'boolean' },
          petitioner_first_name:    { type: 'string' },
          petitioner_last_name:     { type: 'string' },
          respondent_first_name:    { type: 'string' },
          respondent_last_name:     { type: 'string' },
          state:                    { type: 'string', description: '2-letter state code' },
          county:                   { type: 'string' },
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
          current_living_arrangement: { type: 'string' },
          safety_concerns_confirmed:  { type: 'boolean' },
          safety_concerns_present:    { type: 'boolean' },
          safety_description:         { type: 'string' },
          custody_type_requested:     { type: 'string', description: 'sole_physical | joint_physical | sole_legal | joint_legal' },
          proposed_schedule:          { type: 'string' },
          holiday_schedule:           { type: 'string' },
          evidence_confirmed:         { type: 'boolean' },
          is_modification:            { type: 'boolean' },
          user_confirmed_review:      { type: 'boolean' },
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
