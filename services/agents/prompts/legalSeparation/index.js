'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about assets, debts, and support amounts
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Note: Legal Separation keeps the marriage intact; the parties remain legally married

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone file for legal separation.

IMPORTANT: Legal separation is different from divorce. You remain legally married but live separately with court orders about property, support, and children. Some people choose separation for religious reasons, to keep health insurance benefits, or while waiting to meet residency requirements for divorce.

COLLECT:
1. Your full legal name — you are the Petitioner
2. Your spouse's full legal name — the Respondent
3. What state and county are you filing in?
4. How long have you been married?
5. Why are you choosing legal separation instead of divorce? (helps determine appropriate documents)

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, state, county, marriage_date

OPENING (first message): "I'm here to help you file for legal separation. This keeps your marriage legally intact while establishing separate living arrangements and court orders. Let's start — what is your full legal name?"

${SHARED_RULES}`;

const CHILDREN = `You are a legal document assistant helping someone file for legal separation.

COLLECT information about children:
1. "Do you have any minor children (under 18) together?"
2. If yes: For each child — name, date of birth, who they currently live with
3. "What custody and visitation arrangement are you proposing?"
4. "Will child support be part of this separation?"

REQUIRED FIELDS: children_confirmed, children (array if applicable)

${SHARED_RULES}`;

const FINANCES = `You are a legal document assistant helping someone file for legal separation.

COLLECT financial information:
1. "Will you be dividing property and debts as part of this separation?"
2. "Do you own real estate together? If so, what do you propose to do with it?"
3. "Are there significant debts — mortgages, car loans, credit cards?"
4. "Is either party requesting spousal support? If so, how much and for how long?"
5. "Are there retirement accounts or pensions to divide?"

REQUIRED FIELDS: property_division_agreed, spousal_support_requested

${SHARED_RULES}`;

const AGREEMENT = `You are a legal document assistant helping someone file for legal separation.

COLLECT agreement status:
1. "Does your spouse know about and agree to this separation?"
2. "Have you both agreed on all terms (children, property, support) — or are there contested issues?"
3. "How is your spouse being served with the separation papers?"

REQUIRED FIELDS: is_agreed, service_method

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone file for legal separation.
Final review.

1. Summarize: parties, state, children, key financial terms, whether agreed
2. Remind: "Filing fees vary by state ($100–400). If agreed, you may be able to finalize without a court appearance."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your legal separation documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:   { name: 'INTAKE',   displayName: 'Getting Started',  order: 1, prompt: INTAKE,   requiredFields: ['petitionerFirstName', 'respondentFirstName', 'state', 'county'], optional: false },
  CHILDREN: { name: 'CHILDREN', displayName: 'Children',         order: 2, prompt: CHILDREN, requiredFields: ['childrenConfirmed'],                                             optional: false },
  FINANCES: { name: 'FINANCES', displayName: 'Finances',         order: 3, prompt: FINANCES, requiredFields: ['propertyDivisionAgreed'],                                        optional: false },
  AGREEMENT:{ name: 'AGREEMENT',displayName: 'Agreement Status', order: 4, prompt: AGREEMENT,requiredFields: ['isAgreed', 'serviceMethod'],                                     optional: false },
  REVIEW:   { name: 'REVIEW',   displayName: 'Review & Confirm', order: 5, prompt: REVIEW,   requiredFields: ['userConfirmedReview'],                                           optional: false }
};

const PHASE_ORDER = ['INTAKE', 'CHILDREN', 'FINANCES', 'AGREEMENT', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:      'petitionerFirstName',
  petitioner_last_name:       'petitionerLastName',
  respondent_first_name:      'respondentFirstName',
  respondent_last_name:       'respondentLastName',
  state:                      'state',
  county:                     'county',
  marriage_date:              'marriageDate',
  separation_reason:          'separationReason',
  children_confirmed:         'childrenConfirmed',
  children:                   'children',
  property_division_agreed:   'propertyDivisionAgreed',
  spousal_support_requested:  'spousalSupportRequested',
  spousal_support_amount:     'spousalSupportAmount',
  real_estate:                'realEstate',
  retirement_accounts:        'retirementAccounts',
  is_agreed:                  'isAgreed',
  service_method:             'serviceMethod',
  user_confirmed_review:      'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract legal separation interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                   { type: 'string' },
          phase_complete:             { type: 'boolean' },
          petitioner_first_name:      { type: 'string' },
          petitioner_last_name:       { type: 'string' },
          respondent_first_name:      { type: 'string' },
          respondent_last_name:       { type: 'string' },
          state:                      { type: 'string' },
          county:                     { type: 'string' },
          marriage_date:              { type: 'string' },
          separation_reason:          { type: 'string' },
          children_confirmed:         { type: 'boolean', description: 'true = no minor children; false = children exist' },
          children:                   { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dob: { type: 'string' }, age: { type: 'number' } } } },
          property_division_agreed:   { type: 'boolean' },
          spousal_support_requested:  { type: 'boolean' },
          spousal_support_amount:     { type: 'number' },
          is_agreed:                  { type: 'boolean' },
          service_method:             { type: 'string', enum: ['waiver', 'process_server', 'certified_mail', 'publication'] },
          user_confirmed_review:      { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
