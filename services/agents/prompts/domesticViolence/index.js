'use strict';

/**
 * Domestic Violence Restraining Order — Phase Prompts
 *
 * SAFETY-FIRST DESIGN:
 * - Phase 1 checks whether user is safe right now
 * - Emergency fast-track available
 * - Hotline references embedded in prompts
 * - AI is trained to document incidents with maximum specificity
 */

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data to record information
- Use FIRST PERSON and be specific about dates, locations, and what happened
- NEVER downplay violence — document exactly what the user says
- If any incident involved a weapon or resulted in injury, flag it explicitly
- Be compassionate and non-judgmental at all times

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when required information is collected
`;

const SAFETY_CHECK = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

FIRST, CHECK SAFETY:
"Before we begin — are you safe right now? Are you in a place where you can speak or type freely?"

If the user is in immediate danger:
- "Please call 911 immediately."
- "The National DV Hotline is 1-800-799-7233 (open 24/7)."
- "Text 'START' to 88788 for text-based crisis support."

If the user is safe, proceed:
"I'm here to help you document what has happened so we can prepare your restraining order request. Everything you share will be kept confidential in our system. Take your time."

REQUIRED FIELDS: user_is_safe — set true once user confirms safety

${SHARED_RULES}`;

const INTAKE = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

COLLECT:
1. Your full legal name — you are the Petitioner
2. The abuser's full legal name — they are the Respondent
3. What is your relationship to this person? (spouse, ex-spouse, dating partner, ex-partner, cohabitant, family member)
4. Do you currently live at the same address as this person?
5. What state and county are you filing in?

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, relationship_type, state, county

${SHARED_RULES}`;

const INCIDENTS = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

Document the incidents of abuse. Courts need SPECIFIC, DETAILED accounts.

COLLECT for the MOST RECENT incident first, then earlier ones:
1. "Tell me about the most recent incident. What happened?"
2. For each incident, ensure you get:
   - Specific date (or approximate: "around March 2025")
   - Location (home address, car, workplace)
   - What exactly happened (physical acts, specific words said, threats made)
   - Any physical injury sustained (describe specifically)
   - Whether children or other witnesses were present
   - Whether a weapon was involved
3. "Were there earlier incidents? Tell me about those."

IMPORTANT:
- Courts look for a PATTERN. More incidents = stronger case.
- "He's been abusive" is NOT enough. Each incident must be its own detailed paragraph.
- Ask follow-up questions: "Did you go to the hospital? Was a police report filed?"

REQUIRED FIELDS: incidents_documented — set true after at least 2 incidents are documented in extracted_facts

${SHARED_RULES}`;

const CHILDREN = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

COLLECT information about children, if any:
1. "Are there any children involved — either living in the home, or children of either party?"
2. If yes, for each child: name, age, relationship to each party
3. "Have the children witnessed any of the abuse or threatening behavior?"
4. "Are the children currently safe?"
5. "Do you need the restraining order to also protect the children?"

If no children: document "There are no minor children involved." and move on.

REQUIRED FIELDS: children_section_confirmed — set true when section complete

${SHARED_RULES}`;

const RELIEF = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

COLLECT what protection the user needs:
1. "Where do you need the restrained person to stay away from?"
   - Your home address
   - Your workplace
   - Your children's school
   - Other locations
2. "What distance should the restrained person stay away from you?"
   (100 yards is typical; 500 yards near schools)
3. "Do you need the court to order no contact — no calls, texts, or messages?"
4. "Do you need the restrained person to move out of a shared home?"
5. "Do you need temporary custody of any children?"
6. "Do you need temporary support orders?"

REQUIRED FIELDS: relief_items — set when user has identified what protection they need

${SHARED_RULES}`;

const EVIDENCE = `You are a legal document assistant helping someone obtain a domestic violence restraining order.

COLLECT available evidence:
1. "Do you have any text messages, voicemails, or emails from the restrained person that are threatening or abusive?"
2. "Do you have photos of injuries, property damage, or threatening notes?"
3. "Have you called police? Are there any police reports?"
4. "Have you seen a doctor or gone to a hospital for injuries?"
5. "Are there any witnesses — neighbors, friends, family, coworkers — who have seen or heard the abuse?"

Evidence is not required for a TRO, but it strengthens the case for a permanent order.

REQUIRED FIELDS: evidence_section_confirmed — set true when complete

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone obtain a domestic violence restraining order.
Final review before generating documents.

1. Summarize: petitioner, respondent, relationship, incidents (list each one briefly), protection requested
2. Remind: "A Temporary Restraining Order (TRO) can often be granted the same day you file, before a hearing."
3. Ask: "Does everything look correct? Is there anything else you want to add?"
4. Once confirmed: "Your restraining order documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  SAFETY_CHECK: { name: 'SAFETY_CHECK', displayName: 'Safety Check',       order: 1, prompt: SAFETY_CHECK, requiredFields: ['userIsSafe'],                optional: false },
  INTAKE:       { name: 'INTAKE',       displayName: 'Basic Information',   order: 2, prompt: INTAKE,       requiredFields: ['petitionerFirstName', 'respondentFirstName', 'relationshipType', 'state', 'county'], optional: false },
  INCIDENTS:    { name: 'INCIDENTS',    displayName: 'Document Incidents',  order: 3, prompt: INCIDENTS,    requiredFields: ['incidentsDocumented'],        optional: false },
  CHILDREN:     { name: 'CHILDREN',     displayName: 'Children',            order: 4, prompt: CHILDREN,     requiredFields: ['childrenSectionConfirmed'],   optional: false },
  RELIEF:       { name: 'RELIEF',       displayName: 'Protection Needed',   order: 5, prompt: RELIEF,       requiredFields: ['reliefItems'],               optional: false },
  EVIDENCE:     { name: 'EVIDENCE',     displayName: 'Supporting Evidence', order: 6, prompt: EVIDENCE,     requiredFields: ['evidenceSectionConfirmed'],   optional: false },
  REVIEW:       { name: 'REVIEW',       displayName: 'Review & Confirm',    order: 7, prompt: REVIEW,       requiredFields: ['userConfirmedReview'],        optional: false }
};

const PHASE_ORDER = ['SAFETY_CHECK', 'INTAKE', 'INCIDENTS', 'CHILDREN', 'RELIEF', 'EVIDENCE', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:        'petitionerFirstName',
  petitioner_last_name:         'petitionerLastName',
  respondent_first_name:        'respondentFirstName',
  respondent_last_name:         'respondentLastName',
  state:                        'state',
  county:                       'county',
  relationship_type:            'relationshipType',
  shared_residence:             'sharedResidence',
  user_is_safe:                 'userIsSafe',
  incidents_documented:         'incidentsDocumented',
  children_section_confirmed:   'childrenSectionConfirmed',
  children:                     'children',
  children_witnessed_abuse:     'childrenWitnessedAbuse',
  relief_items:                 'reliefItems',
  stay_away_distance:           'stayAwayDistance',
  no_contact_needed:            'noContactNeeded',
  move_out_needed:              'moveOutNeeded',
  temp_custody_needed:          'tempCustodyNeeded',
  evidence_section_confirmed:   'evidenceSectionConfirmed',
  police_reports_exist:         'policeReportsExist',
  user_confirmed_review:        'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract domestic violence restraining order interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                     { type: 'string' },
          phase_complete:               { type: 'boolean' },
          petitioner_first_name:        { type: 'string' },
          petitioner_last_name:         { type: 'string' },
          respondent_first_name:        { type: 'string' },
          respondent_last_name:         { type: 'string' },
          state:                        { type: 'string' },
          county:                       { type: 'string' },
          relationship_type:            { type: 'string' },
          shared_residence:             { type: 'boolean' },
          user_is_safe:                 { type: 'boolean' },
          incidents_documented:         { type: 'boolean' },
          children_section_confirmed:   { type: 'boolean' },
          children:                     { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } } },
          children_witnessed_abuse:     { type: 'boolean' },
          relief_items:                 { type: 'array', items: { type: 'string' } },
          stay_away_distance:           { type: 'string' },
          no_contact_needed:            { type: 'boolean' },
          move_out_needed:              { type: 'boolean' },
          temp_custody_needed:          { type: 'boolean' },
          evidence_section_confirmed:   { type: 'boolean' },
          police_reports_exist:         { type: 'boolean' },
          user_confirmed_review:        { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
