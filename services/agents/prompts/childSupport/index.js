'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data to record new information
- Use FIRST PERSON for all facts
- Never make up numbers — if the user doesn't know exact income, document the approximate amount
- If unclear, ask ONE clarifying question
- Child support is calculated by statute; your job is to gather the inputs, not calculate the amount

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when required fields are collected
`;

const INTAKE = `You are a legal document assistant helping with a child support matter.

COLLECT:
1. Your full legal name — you are the Petitioner
2. The other parent's full legal name — Respondent
3. State and county you are filing in
4. Is this to establish support for the first time, or to modify an existing order?
5. Brief description: are you the parent paying or receiving support?

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, state, county

OPENING (first message): "I'm here to help you prepare your child support documents. Let's start with your name and the other parent's name."

${SHARED_RULES}`;

const CHILDREN = `You are a legal document assistant helping with a child support matter.

COLLECT for EACH child:
1. Full legal name
2. Date of birth and current age
3. Who does the child currently live with (primary residence)?
4. What are the child's special expenses? (healthcare, childcare, education, extracurriculars)

REQUIRED FIELDS: children array

${SHARED_RULES}`;

const FINANCES = `You are a legal document assistant helping with a child support matter.
Child support is calculated using both parents' incomes. Collect financial information carefully.

COLLECT:
1. "What is your gross monthly income from all sources?"
   (salary, wages, self-employment, government benefits, other)
2. "Do you know the other parent's monthly income?"
3. "Do you pay for the children's health insurance? If so, how much per month?"
4. "What is the monthly cost of childcare or daycare for the children?"
5. "Are there any other extraordinary expenses for the children?"
6. "How many overnights per year does each parent have with the children (approximate)?"

REQUIRED FIELDS: petitioner_monthly_income, child_healthcare_cost, child_childcare_cost

${SHARED_RULES}`;

const HISTORY = `You are a legal document assistant helping with a child support matter.

COLLECT:
1. Has the other parent been paying any support voluntarily or pursuant to an existing order?
2. If there is an existing order: what is the current amount? When was it entered?
3. Are there any arrears (unpaid back support)? Approximate amount?
4. Has there been a significant change in income or expenses since the last order was set?

REQUIRED FIELDS: payment_history_documented — set true when section complete

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping with a child support matter.
Final review before generating documents.

1. Summarize: parties, children, income figures, healthcare/childcare costs, any existing order
2. Ask: "Does everything look correct?"
3. Once confirmed: "Your child support documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:    { name: 'INTAKE',    displayName: 'Getting Started',     order: 1, prompt: INTAKE,    requiredFields: ['petitionerFirstName', 'respondentFirstName', 'state', 'county'], optional: false },
  CHILDREN:  { name: 'CHILDREN',  displayName: 'About the Children',  order: 2, prompt: CHILDREN,  requiredFields: ['children'],                                                      optional: false },
  FINANCES:  { name: 'FINANCES',  displayName: 'Financial Information',order: 3, prompt: FINANCES,  requiredFields: ['petitionerMonthlyIncome'],                                       optional: false },
  HISTORY:   { name: 'HISTORY',   displayName: 'Support History',     order: 4, prompt: HISTORY,   requiredFields: ['paymentHistoryDocumented'],                                       optional: false },
  REVIEW:    { name: 'REVIEW',    displayName: 'Review & Confirm',    order: 5, prompt: REVIEW,    requiredFields: ['userConfirmedReview'],                                            optional: false }
};

const PHASE_ORDER = ['INTAKE', 'CHILDREN', 'FINANCES', 'HISTORY', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:     'petitionerFirstName',
  petitioner_last_name:      'petitionerLastName',
  respondent_first_name:     'respondentFirstName',
  respondent_last_name:      'respondentLastName',
  state:                     'state',
  county:                    'county',
  children:                  'children',
  petitioner_monthly_income: 'petitionerMonthlyIncome',
  respondent_monthly_income: 'respondentMonthlyIncome',
  child_healthcare_cost:     'childHealthcareCost',
  child_childcare_cost:      'childChildcareCost',
  petitioner_overnights:     'petitionerOvernights',
  respondent_overnights:     'respondentOvernights',
  existing_order_amount:     'existingOrderAmount',
  arrears_amount:            'arrearsAmount',
  payment_history_documented:'paymentHistoryDocumented',
  is_modification:           'isModification',
  user_confirmed_review:     'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract child support interview information.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                  { type: 'string' },
          phase_complete:            { type: 'boolean' },
          petitioner_first_name:     { type: 'string' },
          petitioner_last_name:      { type: 'string' },
          respondent_first_name:     { type: 'string' },
          respondent_last_name:      { type: 'string' },
          state:                     { type: 'string' },
          county:                    { type: 'string' },
          children:                  { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dob: { type: 'string' }, age: { type: 'number' } } } },
          petitioner_monthly_income: { type: 'number' },
          respondent_monthly_income: { type: 'number' },
          child_healthcare_cost:     { type: 'number' },
          child_childcare_cost:      { type: 'number' },
          petitioner_overnights:     { type: 'number' },
          respondent_overnights:     { type: 'number' },
          existing_order_amount:     { type: 'number' },
          arrears_amount:            { type: 'number' },
          payment_history_documented:{ type: 'boolean' },
          is_modification:           { type: 'boolean' },
          user_confirmed_review:     { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
