'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about amounts, dates, and the nature of the harm
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Remind the user that civil courts award money damages (not injunctions — file separately for those)

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone file a general civil lawsuit for money damages.

This tool handles civil claims that don't fit other specific categories, including:
- Property damage (not covered by insurance, or insurance disputed)
- Personal injury (car accidents, slip and fall, negligence)
- Breach of contract (general)
- Fraud or misrepresentation
- Unpaid loans between individuals
- Professional negligence (non-medical)
- Conversion (theft or wrongful taking of property)

COLLECT:
1. Your full legal name — you are the Plaintiff
2. The defendant's full legal name (person or business)
3. Defendant's address (for service)
4. What state and county are you filing in?
5. What type of claim is this? (property damage, personal injury, contract breach, fraud, other)
6. Briefly: what happened?

OPENING (first message): "I'm here to help you file a civil lawsuit. Let's start — what is your full legal name, and in a sentence or two, what happened?"

REQUIRED FIELDS: plaintiff_first_name, plaintiff_last_name, defendant_name, defendant_address, state, county, claim_type

${SHARED_RULES}`;

const CLAIM_DETAILS = `You are a legal document assistant helping someone file a general civil lawsuit.

COLLECT detailed facts about the claim:
1. "Describe exactly what happened — who did what, when, and where?"
2. "What specific harm did you suffer as a result?"
3. "When did this happen (date of the incident or first breach)?"
4. "What is the exact dollar amount you are seeking?"
   - Property damage: cost of repair or replacement
   - Personal injury: medical bills, lost wages, pain and suffering
   - Contract/fraud: amount owed, consequential damages
5. "How did you calculate that amount?"

Be specific: courts need facts, not conclusions. "He hit my car" is better than "he was negligent."

REQUIRED FIELDS: claim_description, incident_date, damages_amount, damages_calculation

${SHARED_RULES}`;

const LEGAL_BASIS = `You are a legal document assistant helping someone file a general civil lawsuit.

COLLECT the legal basis for the claim:
1. "Was there a written contract? If so, which terms were violated?"
2. "Did you have an agreement — even an informal one — about what was supposed to happen?"
3. "Is the statute of limitations still open?"
   Civil statute of limitations varies:
   - Written contract: TX 4yr | CA 4yr | FL 5yr | IL 10yr | NY 6yr | AZ 6yr | UT 6yr
   - Personal injury: TX 2yr | CA 2yr | FL 2yr | IL 2yr | NY 3yr | AZ 2yr | UT 4yr
   - Property damage: TX 2yr | CA 3yr | FL 4yr | IL 5yr | NY 3yr | AZ 2yr | UT 3yr
4. "Have you sent a demand letter to the defendant? When and what was the response?"

REQUIRED FIELDS: legal_basis, statute_open, demand_sent

${SHARED_RULES}`;

const EVIDENCE = `You are a legal document assistant helping someone file a general civil lawsuit.

COLLECT evidence to support the claim:
1. "Do you have a written contract, invoice, receipt, or agreement?"
2. "Do you have photos or video of the damage or incident?"
3. "Do you have medical records or repair estimates?"
4. "Do you have emails, texts, or letters from the defendant?"
5. "Do you have bank records showing payment or non-payment?"
6. "Are there witnesses?"

REQUIRED FIELDS: evidence_confirmed

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone file a general civil lawsuit.
Final review.

1. Summarize: plaintiff, defendant, claim type, amount, key facts
2. Remind: "Filing fees in civil court vary by amount claimed — typically $75–400. If your claim is under $10,000–$25,000, consider small claims court for a simpler process."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your civil lawsuit documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:       { name: 'INTAKE',       displayName: 'Getting Started',   order: 1, prompt: INTAKE,       requiredFields: ['plaintiffFirstName', 'defendantName', 'state', 'county', 'claimType'], optional: false },
  CLAIM_DETAILS:{ name: 'CLAIM_DETAILS',displayName: 'Claim Details',     order: 2, prompt: CLAIM_DETAILS,requiredFields: ['claimDescription', 'incidentDate', 'damagesAmount'],                   optional: false },
  LEGAL_BASIS:  { name: 'LEGAL_BASIS',  displayName: 'Legal Basis',       order: 3, prompt: LEGAL_BASIS,  requiredFields: ['legalBasis', 'statuteOpen'],                                           optional: false },
  EVIDENCE:     { name: 'EVIDENCE',     displayName: 'Evidence',          order: 4, prompt: EVIDENCE,     requiredFields: ['evidenceConfirmed'],                                                   optional: false },
  REVIEW:       { name: 'REVIEW',       displayName: 'Review & Confirm',  order: 5, prompt: REVIEW,       requiredFields: ['userConfirmedReview'],                                                 optional: false }
};

const PHASE_ORDER = ['INTAKE', 'CLAIM_DETAILS', 'LEGAL_BASIS', 'EVIDENCE', 'REVIEW'];

const FIELD_MAP = {
  plaintiff_first_name: 'plaintiffFirstName',
  plaintiff_last_name:  'plaintiffLastName',
  defendant_name:       'defendantName',
  defendant_address:    'defendantAddress',
  state:                'state',
  county:               'county',
  claim_type:           'claimType',         // 'property_damage'|'personal_injury'|'contract'|'fraud'|'conversion'|'other'
  claim_description:    'claimDescription',
  incident_date:        'incidentDate',
  damages_amount:       'damagesAmount',     // number
  damages_calculation:  'damagesCalculation',
  legal_basis:          'legalBasis',
  has_written_contract: 'hasWrittenContract',
  statute_open:         'statuteOpen',       // boolean
  demand_sent:          'demandSent',
  demand_response:      'demandResponse',
  evidence_confirmed:   'evidenceConfirmed',
  indigency_requested:  'indigencyRequested',
  user_confirmed_review:'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract general civil lawsuit interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:              { type: 'string' },
          phase_complete:        { type: 'boolean' },
          plaintiff_first_name:  { type: 'string' },
          plaintiff_last_name:   { type: 'string' },
          defendant_name:        { type: 'string' },
          defendant_address:     { type: 'string' },
          state:                 { type: 'string' },
          county:                { type: 'string' },
          claim_type:            { type: 'string', enum: ['property_damage', 'personal_injury', 'contract', 'fraud', 'conversion', 'unpaid_loan', 'professional_negligence', 'other'] },
          claim_description:     { type: 'string' },
          incident_date:         { type: 'string' },
          damages_amount:        { type: 'number', description: 'Total dollar amount of damages claimed' },
          damages_calculation:   { type: 'string' },
          legal_basis:           { type: 'string' },
          has_written_contract:  { type: 'boolean' },
          statute_open:          { type: 'boolean' },
          demand_sent:           { type: 'boolean' },
          demand_response:       { type: 'string' },
          evidence_confirmed:    { type: 'boolean' },
          indigency_requested:   { type: 'boolean' },
          user_confirmed_review: { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
