'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about dates, locations, and exact words/actions used
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Each incident should be documented separately

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone seek a civil harassment restraining order (CHRO).

Civil harassment restraining orders protect against harassment by someone who is NOT a close family member or intimate partner. Common respondents include:
- Neighbors
- Coworkers
- Acquaintances
- Strangers
- Extended family (cousins, aunts/uncles — varies by state)

(For domestic violence by a spouse, partner, or parent of your child, use the Domestic Violence Restraining Order process instead.)

COLLECT:
1. Your full legal name — you are the Petitioner
2. The harasser's full name — the Respondent
3. Your relationship to the respondent (neighbor, coworker, acquaintance, etc.)
4. What state and county?
5. Do you want an Emergency Protective Order TODAY (TRO) or just a permanent order? (TRO is usually granted same day without a hearing if you show immediate danger)

SAFETY FIRST: Are you in immediate danger right now? If yes, please call 911 before proceeding.

OPENING (first message): "I'm here to help you get a civil harassment restraining order. Let's start — what is your full legal name and how do you know the person harassing you?"

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_name, respondent_relationship, state, county, wants_tro

${SHARED_RULES}`;

const HARASSMENT_HISTORY = `You are a legal document assistant helping someone seek a civil harassment restraining order.

COLLECT the harassment history — be very specific:
1. "Describe the most serious or recent incident of harassment. What happened, when, and where?"
2. "How many total incidents have there been? When did this start?"
3. "What specific actions has the respondent taken?"
   Examples: threatening statements, following/stalking, unwanted contact, property damage, trespassing, cyberstalking, false police reports against you
4. "Has the respondent made any threats? What exactly did they say or write?"
5. "Have there been any prior confrontations or police reports?"

Document each incident with: Date | Location | Exact words/actions | Witnesses

REQUIRED FIELDS: harassment_description, incident_count, first_incident_date, most_recent_incident_date

${SHARED_RULES}`;

const CONTACT_ATTEMPTS = `You are a legal document assistant helping someone seek a civil harassment restraining order.

COLLECT contact and communication details:
1. "Has the respondent tried to contact you directly? By what means?" (phone, text, email, social media, in person)
2. "Have you told the respondent to stop? When and how?"
3. "Has the respondent contacted your family, employer, or others about you?"
4. "Has the respondent posted anything about you online or on social media?"
5. "Do you know the respondent's current address?" (needed for service)

REQUIRED FIELDS: contact_methods, respondent_address

${SHARED_RULES}`;

const RELIEF = `You are a legal document assistant helping someone seek a civil harassment restraining order.

COLLECT what relief (protections) you want the court to order:
1. "What distance do you want the respondent to stay away from you?" (typical: 100 yards / 300 feet from you, your home, workplace, school, vehicle)
2. "Do you want the respondent to have NO contact with you (no calls, texts, emails, social media)?"
3. "Are there any places you especially need protection?" (your home address, workplace, child's school)
4. "Do you want the respondent ordered to not own or possess firearms?"
5. "Are there other people in your household who should also be protected (minor children, other family members)?"

REQUIRED FIELDS: stay_away_distance, no_contact_requested, protected_locations

${SHARED_RULES}`;

const EVIDENCE = `You are a legal document assistant helping someone seek a civil harassment restraining order.

COLLECT evidence:
1. "Do you have screenshots of texts, emails, or social media messages from the respondent?"
2. "Do you have voicemail recordings?"
3. "Do you have security camera footage?"
4. "Have you called the police? Do you have incident/report numbers?"
5. "Are there witnesses who saw the harassment?"
6. "Do you have medical records if you were injured?"

REQUIRED FIELDS: evidence_confirmed

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone seek a civil harassment restraining order.
Final review.

1. Summarize: petitioner, respondent, harassment history, relief requested
2. Remind: "For a Temporary Restraining Order (TRO), you can often get same-day protection without the respondent present. A hearing will then be scheduled (usually within 15–25 days) where the respondent can respond. There is no filing fee for protective orders in most states."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your civil harassment restraining order documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:              { name: 'INTAKE',              displayName: 'Getting Started',   order: 1, prompt: INTAKE,              requiredFields: ['petitionerFirstName', 'respondentName', 'respondentRelationship', 'state', 'county'],  optional: false },
  HARASSMENT_HISTORY:  { name: 'HARASSMENT_HISTORY',  displayName: 'Harassment History',order: 2, prompt: HARASSMENT_HISTORY,  requiredFields: ['harassmentDescription', 'firstIncidentDate', 'mostRecentIncidentDate'],              optional: false },
  CONTACT_ATTEMPTS:    { name: 'CONTACT_ATTEMPTS',    displayName: 'Contact & Communications',order: 3, prompt: CONTACT_ATTEMPTS, requiredFields: ['contactMethods'],                                                                 optional: false },
  RELIEF:              { name: 'RELIEF',              displayName: 'Relief Requested',  order: 4, prompt: RELIEF,              requiredFields: ['stayAwayDistance', 'noContactRequested'],                                          optional: false },
  EVIDENCE:            { name: 'EVIDENCE',            displayName: 'Evidence',          order: 5, prompt: EVIDENCE,            requiredFields: ['evidenceConfirmed'],                                                               optional: false },
  REVIEW:              { name: 'REVIEW',              displayName: 'Review & Confirm',  order: 6, prompt: REVIEW,              requiredFields: ['userConfirmedReview'],                                                             optional: false }
};

const PHASE_ORDER = ['INTAKE', 'HARASSMENT_HISTORY', 'CONTACT_ATTEMPTS', 'RELIEF', 'EVIDENCE', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:     'petitionerFirstName',
  petitioner_last_name:      'petitionerLastName',
  respondent_name:           'respondentName',
  respondent_relationship:   'respondentRelationship',
  respondent_address:        'respondentAddress',
  state:                     'state',
  county:                    'county',
  wants_tro:                 'wantsTro',               // boolean
  harassment_description:    'harassmentDescription',
  incident_count:            'incidentCount',          // number
  first_incident_date:       'firstIncidentDate',
  most_recent_incident_date: 'mostRecentIncidentDate',
  contact_methods:           'contactMethods',         // array: ['phone','text','email','in_person','social_media']
  protected_persons:         'protectedPersons',       // array of names
  stay_away_distance:        'stayAwayDistance',       // number in feet
  no_contact_requested:      'noContactRequested',     // boolean
  protected_locations:       'protectedLocations',     // array: ['home','work','school']
  firearm_restriction:       'firearmRestriction',     // boolean
  evidence_confirmed:        'evidenceConfirmed',
  police_reports:            'policeReports',          // boolean
  user_confirmed_review:     'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract civil harassment restraining order petition data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                  { type: 'string' },
          phase_complete:            { type: 'boolean' },
          petitioner_first_name:     { type: 'string' },
          petitioner_last_name:      { type: 'string' },
          respondent_name:           { type: 'string' },
          respondent_relationship:   { type: 'string' },
          respondent_address:        { type: 'string' },
          state:                     { type: 'string' },
          county:                    { type: 'string' },
          wants_tro:                 { type: 'boolean' },
          harassment_description:    { type: 'string' },
          incident_count:            { type: 'number' },
          first_incident_date:       { type: 'string' },
          most_recent_incident_date: { type: 'string' },
          contact_methods:           { type: 'array', items: { type: 'string' } },
          protected_persons:         { type: 'array', items: { type: 'string' } },
          stay_away_distance:        { type: 'number', description: 'Distance in feet (e.g. 300)' },
          no_contact_requested:      { type: 'boolean' },
          protected_locations:       { type: 'array', items: { type: 'string' } },
          firearm_restriction:       { type: 'boolean' },
          evidence_confirmed:        { type: 'boolean' },
          police_reports:            { type: 'boolean' },
          user_confirmed_review:     { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
