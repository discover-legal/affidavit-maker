'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Use FIRST PERSON for all facts (the minor is the petitioner)
- Be specific about financial independence and living situation
- Ask ONE clarifying question if unclear

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping a minor petition for emancipation.

Emancipation frees a minor (usually 14–17) from their parents' legal control and gives them adult legal rights — to sign contracts, make medical decisions, sue and be sued, and live independently. Courts grant emancipation when it is in the minor's best interest AND the minor can demonstrate financial self-sufficiency.

States that allow emancipation by court order: TX, CA, FL, IL, NY, AZ, UT, CO, MI, WA, OR, and others.
Minimum age varies: 14 in CA, 16 in TX, 14–16 in most states.

COLLECT:
1. The minor's full legal name — the minor is the Petitioner
2. The minor's date of birth and current age
3. What state and county are you filing in?
4. Parents' or legal guardians' names
5. Why are you seeking emancipation?

OPENING (first message): "I'm here to help you petition for emancipation. This is a legal process that will give you adult rights before you turn 18. Let's start — what is your full legal name and how old are you?"

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, petitioner_dob, state, county, parent_names

${SHARED_RULES}`;

const INDEPENDENCE = `You are a legal document assistant helping a minor petition for emancipation.

COLLECT evidence of financial independence and self-sufficiency:
1. "Where do you currently live, and how long have you lived there?"
2. "Do you have a job? What is your monthly income?"
3. "How do you pay for your housing, food, and other living expenses?"
4. "Do you have a bank account? How much do you typically have saved?"
5. "Are you currently in school? If not, do you have a high school diploma or GED?"

Courts require the minor to demonstrate they can support themselves financially.

REQUIRED FIELDS: monthly_income, living_situation, financial_self_sufficient

${SHARED_RULES}`;

const REASONS = `You are a legal document assistant helping a minor petition for emancipation.

COLLECT the specific reasons for seeking emancipation:
1. "Describe your family situation — why is it best for you to be legally independent from your parents?"
   Common reasons: abusive home, parents unable to care for minor, minor has professional career (acting/athletics), minor is married or has a child, parents are unavailable (incarcerated, deceased)
2. "Do your parents know about this petition? Do they support it or oppose it?"
3. "Have you been living independently from your parents? For how long?"
4. "Are there any pending court cases involving you (delinquency, dependency, CPS)?"

REQUIRED FIELDS: emancipation_reason, parental_stance

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping a minor petition for emancipation.
Final review.

1. Summarize: petitioner's name, age, financial situation, reason for emancipation, parental position
2. Remind: "The court will hold a hearing. A judge will consider your best interests, your financial situation, and your maturity. Your parents will be notified and can object. If under 16, emancipation is harder to obtain. Consider consulting with a free legal aid attorney."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your emancipation petition is ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:       { name: 'INTAKE',       displayName: 'Getting Started',    order: 1, prompt: INTAKE,       requiredFields: ['petitionerFirstName', 'petitionerDob', 'state', 'county', 'parentNames'], optional: false },
  INDEPENDENCE: { name: 'INDEPENDENCE', displayName: 'Financial Independence',order: 2,prompt: INDEPENDENCE, requiredFields: ['monthlyIncome', 'livingSituation'],                                  optional: false },
  REASONS:      { name: 'REASONS',      displayName: 'Reasons & Background', order: 3, prompt: REASONS,     requiredFields: ['emancipationReason', 'parentalStance'],                               optional: false },
  REVIEW:       { name: 'REVIEW',       displayName: 'Review & Confirm',    order: 4, prompt: REVIEW,       requiredFields: ['userConfirmedReview'],                                                 optional: false }
};

const PHASE_ORDER = ['INTAKE', 'INDEPENDENCE', 'REASONS', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name:    'petitionerFirstName',
  petitioner_last_name:     'petitionerLastName',
  petitioner_dob:           'petitionerDob',
  state:                    'state',
  county:                   'county',
  parent_names:             'parentNames',
  parent_1_name:            'parent1Name',
  parent_2_name:            'parent2Name',
  monthly_income:           'monthlyIncome',
  income_source:            'incomeSource',
  living_situation:         'livingSituation',
  financial_self_sufficient:'financialSelfSufficient', // boolean
  in_school:                'inSchool',
  emancipation_reason:      'emancipationReason',
  parental_stance:          'parentalStance',  // 'support' | 'oppose' | 'unknown'
  pending_court_cases:      'pendingCourtCases',
  user_confirmed_review:    'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract minor emancipation petition data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:               { type: 'string' },
          phase_complete:         { type: 'boolean' },
          petitioner_first_name:  { type: 'string' },
          petitioner_last_name:   { type: 'string' },
          petitioner_dob:         { type: 'string' },
          state:                  { type: 'string' },
          county:                 { type: 'string' },
          parent_names:           { type: 'string' },
          parent_1_name:          { type: 'string' },
          parent_2_name:          { type: 'string' },
          monthly_income:         { type: 'number', description: 'Minor\'s monthly income in dollars' },
          income_source:          { type: 'string' },
          living_situation:       { type: 'string' },
          financial_self_sufficient: { type: 'boolean' },
          in_school:              { type: 'boolean' },
          emancipation_reason:    { type: 'string' },
          parental_stance:        { type: 'string', enum: ['support', 'oppose', 'unknown', 'unavailable'] },
          pending_court_cases:    { type: 'boolean' },
          user_confirmed_review:  { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
