'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about the exact name change requested (spelling matters)
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone petition for a legal name change.

Name changes are available to:
- Adults wanting to change their name for any reason
- Parents changing a minor child's name
- Transgender/non-binary individuals changing their name to match their identity

COLLECT:
1. Your full current legal name (exactly as it appears on government ID)
2. The full name you want — the requested new name
3. What state and county are you filing in?
4. Are you changing your own name, or a minor child's name?
5. What is the reason for the name change?
   (Court may require a reason; never need to disclose gender identity if you don't want to)

OPENING (first message): "I'm here to help you petition for a legal name change. Let's start — what is your full current legal name exactly as it appears on your ID?"

REQUIRED FIELDS: current_first_name, current_last_name, new_first_name, new_last_name, state, county, change_reason, is_for_minor

${SHARED_RULES}`;

const BACKGROUND = `You are a legal document assistant helping someone petition for a legal name change.

COLLECT background information:
1. "Have you ever gone by any other names, including maiden names, aliases, or prior married names?"
2. "Have you been convicted of any felony in the last [varies by state, usually 5–10] years?"
   (Many states require a criminal history check or deny name changes for those on sex offender registries.)
3. "Are you currently involved in any bankruptcy, criminal, or other legal proceedings?"
4. "Have you previously petitioned for a name change? If so, when and what was the result?"

REQUIRED FIELDS: prior_names, criminal_history_confirmed, pending_proceedings

${SHARED_RULES}`;

const MINOR_DETAILS = `You are a legal document assistant helping someone petition for a minor's name change.

COLLECT information about the minor and the other parent:
1. "What is the child's full current legal name and date of birth?"
2. "What is the other parent's full name?"
3. "Does the other parent consent to this name change?"
4. "What is the reason for changing the child's name?"
   (Common: mother remarried and wants child to share new family name; father is absent/unknown; error on birth certificate)

Courts prioritize the child's best interest when parents disagree.

REQUIRED FIELDS: child_name, child_dob, other_parent_name, other_parent_consent

${SHARED_RULES}`;

const NOTICE = `You are a legal document assistant helping someone petition for a name change.

COLLECT publication and notice requirements:
1. "Are you comfortable with your name change being published in a local newspaper?" (most states require this for adults)
   (Exception: Courts can waive publication for domestic violence/safety reasons or gender identity)
2. "Are you seeking to waive the publication requirement? If so, on what grounds?"
3. "Are you requesting a fee waiver (indigency waiver) based on financial hardship?"

REQUIRED FIELDS: publication_waiver_requested, indigency_requested

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone petition for a name change.
Final review.

1. Summarize: current name → new name, state, reason, publication status
2. Remind: "After the court approves your name change, you'll need to update your Social Security card, driver's license, passport, bank accounts, etc. Keep certified copies of the court order."
3. Ask: "Does everything look correct, especially the spelling of the new name?"
4. Once confirmed: "Your name change petition is ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:         { name: 'INTAKE',         displayName: 'Getting Started',   order: 1, prompt: INTAKE,         requiredFields: ['currentFirstName', 'currentLastName', 'newFirstName', 'newLastName', 'state', 'county'], optional: false },
  BACKGROUND:     { name: 'BACKGROUND',     displayName: 'Background Check',  order: 2, prompt: BACKGROUND,     requiredFields: ['priorNames', 'criminalHistoryConfirmed'],                                               optional: false },
  MINOR_DETAILS:  { name: 'MINOR_DETAILS',  displayName: 'Minor\'s Details',  order: 3, prompt: MINOR_DETAILS,  requiredFields: ['childName', 'otherParentName'],                                                         optional: true, skipIf: (d) => !d.isForMinor },
  NOTICE:         { name: 'NOTICE',         displayName: 'Publication Notice',order: 4, prompt: NOTICE,         requiredFields: ['publicationWaiverRequested'],                                                           optional: false },
  REVIEW:         { name: 'REVIEW',         displayName: 'Review & Confirm',  order: 5, prompt: REVIEW,         requiredFields: ['userConfirmedReview'],                                                                  optional: false }
};

const PHASE_ORDER = ['INTAKE', 'BACKGROUND', 'MINOR_DETAILS', 'NOTICE', 'REVIEW'];

const FIELD_MAP = {
  current_first_name:          'currentFirstName',
  current_middle_name:         'currentMiddleName',
  current_last_name:           'currentLastName',
  new_first_name:              'newFirstName',
  new_middle_name:             'newMiddleName',
  new_last_name:               'newLastName',
  state:                       'state',
  county:                      'county',
  change_reason:               'changeReason',
  is_for_minor:                'isForMinor',
  prior_names:                 'priorNames',
  criminal_history_confirmed:  'criminalHistoryConfirmed',
  pending_proceedings:         'pendingProceedings',
  child_name:                  'childName',
  child_dob:                   'childDob',
  other_parent_name:           'otherParentName',
  other_parent_consent:        'otherParentConsent',
  publication_waiver_requested:'publicationWaiverRequested',
  publication_waiver_reason:   'publicationWaiverReason',
  indigency_requested:         'indigencyRequested',
  user_confirmed_review:       'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract name change petition interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                    { type: 'string' },
          phase_complete:              { type: 'boolean' },
          current_first_name:          { type: 'string' },
          current_middle_name:         { type: 'string' },
          current_last_name:           { type: 'string' },
          new_first_name:              { type: 'string' },
          new_middle_name:             { type: 'string' },
          new_last_name:               { type: 'string' },
          state:                       { type: 'string' },
          county:                      { type: 'string' },
          change_reason:               { type: 'string' },
          is_for_minor:                { type: 'boolean' },
          prior_names:                 { type: 'string' },
          criminal_history_confirmed:  { type: 'boolean', description: 'true = no disqualifying history' },
          pending_proceedings:         { type: 'boolean' },
          child_name:                  { type: 'string' },
          child_dob:                   { type: 'string' },
          other_parent_name:           { type: 'string' },
          other_parent_consent:        { type: 'boolean' },
          publication_waiver_requested:{ type: 'boolean' },
          publication_waiver_reason:   { type: 'string', enum: ['safety', 'gender_identity', 'financial_hardship', 'none'] },
          indigency_requested:         { type: 'boolean' },
          user_confirmed_review:       { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
