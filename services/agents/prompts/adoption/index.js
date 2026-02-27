'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Use FIRST PERSON for all facts
- Be specific about dates, relationships, and consent status
- Ask ONE clarifying question if unclear

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone complete an adoption.

Types of adoption this tool helps with:
- STEPPARENT ADOPTION: A stepparent adopts their spouse's child (most common SRL adoption)
- ADULT ADOPTION: Adopting someone 18 or older (no home study required in most states)
- RELATIVE ADOPTION: Grandparent, aunt/uncle, or other relative adopts a child

(Note: Agency adoptions and international adoptions require attorneys and are not covered here.)

COLLECT:
1. Your full legal name — you are the Petitioner/Adopting Parent
2. Your spouse or partner's name (if co-adopting or stepparent adoption)
3. The adoptee's full legal name and date of birth
4. What type of adoption is this? (stepparent, adult, or relative)
5. What state and county are you filing in?

OPENING (first message): "I'm here to help you with your adoption. Let's start — what is your full legal name, and what type of adoption are you completing?"

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, adoptee_name, adoptee_dob, adoption_type, state, county

${SHARED_RULES}`;

const BIOLOGICAL_PARENTS = `You are a legal document assistant helping someone complete an adoption.

COLLECT information about the biological parents:
1. "What is the biological mother's full name?"
2. "What is the biological father's full name?"
3. "Will the biological parent(s) consent to the adoption?"
   - STEPPARENT: Is the other biological parent alive? Do they consent, or has a court terminated their parental rights?
   - ADULT: Does the adult adoptee consent?
   - RELATIVE: Both biological parents must consent OR have their rights terminated
4. "Has parental rights been terminated for any parent? If so, by court order or voluntary relinquishment?"

REQUIRED FIELDS: bio_mother_name, bio_father_name, consent_status

${SHARED_RULES}`;

const ADOPTEE_BACKGROUND = `You are a legal document assistant helping someone complete an adoption.

COLLECT information about the person being adopted:
1. "How long has the adoptee been living with you?"
2. "Describe your relationship with the adoptee — how did it develop?"
3. "What is the adoptee's current living situation?"
4. For minors: "Is the child in school? Who provides their medical care currently?"
5. "Does the adoptee have any siblings? Will they also be adopted?"

REQUIRED FIELDS: relationship_duration, adoptee_living_situation

${SHARED_RULES}`;

const LEGAL_STATUS = `You are a legal document assistant helping someone complete an adoption.

COLLECT legal status details:
1. "Is there currently a pending guardianship or custody case involving this child?"
2. "Has there been any prior adoption proceedings?"
3. "For stepparent adoption: Is the biological parent whose rights are being terminated currently receiving notice? Do they agree?"
4. "Are you requesting a fee waiver based on financial hardship?"

REQUIRED FIELDS: prior_proceedings, indigency_requested

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone complete an adoption.
Final review.

1. Summarize: petitioner(s), adoptee, adoption type, consent status
2. Remind: "Most states require a hearing. Stepparent and adult adoptions are usually simpler — no home study required in most states. Filing fees are typically $100–400."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your adoption documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:             { name: 'INTAKE',             displayName: 'Getting Started',       order: 1, prompt: INTAKE,             requiredFields: ['petitionerFirstName', 'adopteeName', 'adoptionType', 'state', 'county'], optional: false },
  BIOLOGICAL_PARENTS: { name: 'BIOLOGICAL_PARENTS', displayName: 'Biological Parents',    order: 2, prompt: BIOLOGICAL_PARENTS, requiredFields: ['bioMotherName', 'consentStatus'],                                       optional: false },
  ADOPTEE_BACKGROUND: { name: 'ADOPTEE_BACKGROUND', displayName: 'Adoptee Background',    order: 3, prompt: ADOPTEE_BACKGROUND, requiredFields: ['relationshipDuration'],                                                  optional: false },
  LEGAL_STATUS:       { name: 'LEGAL_STATUS',       displayName: 'Legal Status',          order: 4, prompt: LEGAL_STATUS,       requiredFields: ['priorProceedings'],                                                      optional: false },
  REVIEW:             { name: 'REVIEW',             displayName: 'Review & Confirm',      order: 5, prompt: REVIEW,             requiredFields: ['userConfirmedReview'],                                                   optional: false }
};

const PHASE_ORDER = ['INTAKE', 'BIOLOGICAL_PARENTS', 'ADOPTEE_BACKGROUND', 'LEGAL_STATUS', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:  'petitionerFirstName',
  petitioner_last_name:   'petitionerLastName',
  co_petitioner_name:     'coPetitionerName',
  state:                  'state',
  county:                 'county',
  adoptee_name:           'adopteeName',
  adoptee_dob:            'adopteeDob',
  adoption_type:          'adoptionType',  // 'stepparent' | 'adult' | 'relative'
  bio_mother_name:        'bioMotherName',
  bio_father_name:        'bioFatherName',
  consent_status:         'consentStatus', // 'both_consent' | 'one_consent' | 'rights_terminated' | 'unknown'
  rights_terminated:      'rightsTerminated',
  relationship_duration:  'relationshipDuration',
  adoptee_living_situation:'adopteeLivingSituation',
  prior_proceedings:      'priorProceedings',
  indigency_requested:    'indigencyRequested',
  user_confirmed_review:  'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract adoption petition interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:               { type: 'string' },
          phase_complete:         { type: 'boolean' },
          petitioner_first_name:  { type: 'string' },
          petitioner_last_name:   { type: 'string' },
          co_petitioner_name:     { type: 'string' },
          state:                  { type: 'string' },
          county:                 { type: 'string' },
          adoptee_name:           { type: 'string' },
          adoptee_dob:            { type: 'string' },
          adoption_type:          { type: 'string', enum: ['stepparent', 'adult', 'relative'] },
          bio_mother_name:        { type: 'string' },
          bio_father_name:        { type: 'string' },
          consent_status:         { type: 'string', enum: ['both_consent', 'one_consent', 'rights_terminated', 'unknown'] },
          rights_terminated:      { type: 'boolean' },
          relationship_duration:  { type: 'string' },
          adoptee_living_situation:{ type: 'string' },
          prior_proceedings:      { type: 'boolean' },
          indigency_requested:    { type: 'boolean' },
          user_confirmed_review:  { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
