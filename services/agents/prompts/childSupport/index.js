'use strict';

/**
 * Child Support — Phase Prompts
 *
 * Handles three case types:
 *   1. Initial filing    — establishing a support order for the first time
 *   2. Modification      — requesting a change to an existing support order
 *                          (requires showing a "substantial change in circumstances")
 *   3. Enforcement       — the other parent has stopped paying or is in arrears
 *                          (contempt of court, wage garnishment, license suspension)
 *
 * Child support is calculated by statute in every state. The interview gathers
 * the inputs; the calculation happens during document generation.
 */

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

// ─── INTAKE ───────────────────────────────────────────────────────────────────
const INTAKE = `You are a document preparation assistant helping with a child support matter.

COLLECT:
1. Your full legal name — you are the Petitioner
2. The other parent's full legal name — Respondent
3. State and county you are filing in
4. Are you the parent who would pay support, or receive it?
5. Is this to:
   a) Establish support for the FIRST TIME (no court order exists)
   b) MODIFY an existing order (circumstances have changed substantially)
   c) ENFORCE an existing order (the other parent has not been paying)

   Set is_modification: true for (b), is_enforcement: true for (c), neither for (a).

CANADIAN CONTEXT (if user is in a Canadian province):
- Child support is governed by the Federal Child Support Guidelines (SOR/97-175) for divorce cases, or provincial guidelines for unmarried parents
- Support is calculated using income tables based on the payor's province of residence and number of children
- Section 7 expenses (special/extraordinary: childcare, medical, education, extracurriculars) are shared proportionally to income
- "Undue hardship" claims may adjust the table amount (s.10)
- Provincial enforcement: ON: Family Responsibility Office (FRO) | BC: Family Maintenance Enforcement Program | AB: Maintenance Enforcement Program | QC: Revenu Quebec
- Use "province" instead of "state"

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, state, county

OPENING (first message): "I'm here to help you prepare your child support documents. Let's start with your name and the other parent's name."

${SHARED_RULES}`;

// ─── EXISTING ORDER & CIRCUMSTANCES (modification or enforcement only) ─────────
const SUPPORT_CHANGES = `You are a document preparation assistant helping with a child support matter.
The user is here to modify or enforce a child support order. Base your questions on whether is_modification or is_enforcement was set during INTAKE.

COLLECT:
1. What is the current court-ordered support amount per month?
2. When was that order entered? What court issued it?
3. Do you have the case number from the existing order?

IF MODIFICATION — what has changed (courts require a "substantial change in circumstances"):
4. What specifically has changed since the order was set?
   Common reasons:
   - Significant change in either parent's income (job loss, raise, disability)
   - Change in custody/overnight schedule that affects the calculation
   - Child's needs have changed significantly (new medical condition, educational expenses)
   - Child has reached the age where an existing order expires
5. When did the change occur? Do you have documentation? (pay stubs, termination letter, medical records)
6. What amount of support do you believe should be ordered going forward?

IF ENFORCEMENT — document the non-payment:
4. When did the other parent stop paying, or how far behind are they?
5. What is the total amount of unpaid support (arrears)?
   - Approximate amount if exact figure unknown
6. Has the other parent made any partial payments? When was the last payment?
7. Have you contacted them about the missed payments? What did they say?
8. What enforcement action are you seeking?
   - Contempt of court (find them in contempt)
   - Wage garnishment (automatic payroll deduction)
   - License suspension (driver's, professional)
   - Seizure of tax refund or other assets
   - All of the above

REQUIRED FIELDS: existing_order_amount, existing_order_date, existing_order_court

${SHARED_RULES}`;

// ─── CHILDREN ────────────────────────────────────────────────────────────────
const CHILDREN = `You are a document preparation assistant helping with a child support matter.

COLLECT for EACH child:
1. Full legal name
2. Date of birth and current age
3. Who does the child currently live with (primary residence)?
4. What are the child's special expenses? (healthcare, childcare, education, extracurriculars)

SUPPORT TERMINATION AGE NOTE: Child support typically terminates when the child turns 18, but this varies:
US states:
- New York: age 21
- California: age 18, or 19 if still in high school full-time
- Illinois: age 18, or 19 if still in high school
- Florida: age 18, or upon high school graduation (whichever is later), up to age 19
- Texas: age 18, or high school graduation, whichever is later
Canadian provinces (Federal Child Support Guidelines SOR/97-175):
- Generally age 18 (or age of majority in the province — 19 in BC, NB, NL, NS, NT, NU, YT)
- Post-secondary extension: support may continue past majority if child is in full-time post-secondary education and financially dependent — duration varies by province and agreement
If a child is approaching the age of majority, document their current school enrollment status.

REQUIRED FIELDS: children array

${SHARED_RULES}`;

// ─── FINANCES ────────────────────────────────────────────────────────────────
const FINANCES = `You are a document preparation assistant helping with a child support matter.
Child support is calculated using both parents' incomes. Collect financial information carefully.

FOR INITIAL FILINGS AND MODIFICATIONS:
1. "What is your gross monthly income from all sources?"
   (salary, wages, self-employment, government benefits, other)
2. "Do you know the other parent's monthly income?"
3. "Do you pay for the children's health insurance? If so, how much per month?"
4. "What is the monthly cost of childcare or daycare for the children?"
5. "Are there any other extraordinary expenses for the children?"
6. "How many overnights per year does each parent have with the children (approximate)?"

IMPORTANT — INCOME IMPUTATION: If either parent is voluntarily unemployed or underemployed, courts can "impute" income — meaning they may calculate support based on what that parent is capable of earning, not just what they actually earn. If the user mentions that the other parent quit their job, is working part-time without explanation, or refuses to work, document this — it may be relevant to the calculation.

FOR MODIFICATIONS — also ask:
7. "What was your income when the original order was set? What is it now?"
8. "What was the other parent's income when the order was set? Do you know what it is now?"

FOR ENFORCEMENT — income info is still needed for any modification of the enforcement order:
7. "What is your current gross monthly income?"
(Skip detailed income questions if the user only wants enforcement and not a modification)

REQUIRED FIELDS: petitioner_monthly_income

${SHARED_RULES}`;

// ─── HISTORY ─────────────────────────────────────────────────────────────────
const HISTORY = `You are a document preparation assistant helping with a child support matter.

FOR INITIAL FILINGS:
1. Has the other parent been providing any financial support voluntarily?
2. How long have you been the primary financial provider?
3. Are there any special expenses coming up (medical treatment, school enrollment)?

FOR MODIFICATIONS:
1. What was the support amount when the order was first set?
2. Have there been any modifications since the original order? What were they?
3. Document the timeline of changes in circumstances (job changes, custody changes, etc.)

FOR ENFORCEMENT:
1. Walk through the payment history:
   - When was the last payment made?
   - What is the total amount owed?
   - Are there any records of payments (bank statements, receipts, the other parent's acknowledgments)?
2. How has the non-payment affected you and the children?
   (Bills unpaid, borrowing money, children going without necessities)
3. Have you reported the arrears to the state child support agency? Do you have a case number?

REQUIRED FIELDS: payment_history_documented — set true when section complete

${SHARED_RULES}`;

// ─── REVIEW ──────────────────────────────────────────────────────────────────
const REVIEW = `You are a document preparation assistant helping with a child support matter.
Final review before generating documents.

1. Summarize based on case type:
   - INITIAL: parties, children, income figures, healthcare/childcare costs
   - MODIFICATION: existing order amount, what changed, new circumstances, requested new amount
   - ENFORCEMENT: existing order amount, total arrears, non-payment timeline, enforcement actions requested
2. Ask: "Does everything look correct? Is there anything you'd like to add or change?"
3. Once confirmed: "Your child support documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES = {
  INTAKE: {
    name: 'INTAKE', displayName: 'Getting Started', order: 1, prompt: INTAKE,
    requiredFields: ['petitionerFirstName', 'respondentFirstName', 'state', 'county'],
    optional: false
  },
  SUPPORT_CHANGES: {
    name: 'SUPPORT_CHANGES', displayName: 'Existing Order & Changes', order: 2, prompt: SUPPORT_CHANGES,
    requiredFields: ['existingOrderAmount', 'existingOrderDate', 'existingOrderCourt'],
    optional: true,
    // Only runs for modifications or enforcement — skipped for initial filings
    skipIf: (d) => !d.isModification && !d.isEnforcement
  },
  CHILDREN: {
    name: 'CHILDREN', displayName: 'About the Children', order: 3, prompt: CHILDREN,
    requiredFields: ['children'],
    optional: false
  },
  FINANCES: {
    name: 'FINANCES', displayName: 'Financial Information', order: 4, prompt: FINANCES,
    requiredFields: ['petitionerMonthlyIncome'],
    optional: false
  },
  HISTORY: {
    name: 'HISTORY', displayName: 'Support History', order: 5, prompt: HISTORY,
    requiredFields: ['paymentHistoryDocumented'],
    optional: false
  },
  REVIEW: {
    name: 'REVIEW', displayName: 'Review & Confirm', order: 6, prompt: REVIEW,
    requiredFields: ['userConfirmedReview'],
    optional: false
  }
};

const PHASE_ORDER = ['INTAKE', 'SUPPORT_CHANGES', 'CHILDREN', 'FINANCES', 'HISTORY', 'REVIEW'];

// ─── Field map (snake_case → camelCase) ───────────────────────────────────────

const FIELD_MAP = {
  petitioner_first_name:      'petitionerFirstName',
  petitioner_last_name:       'petitionerLastName',
  respondent_first_name:      'respondentFirstName',
  respondent_last_name:       'respondentLastName',
  state:                      'state',
  county:                     'county',
  children:                   'children',
  petitioner_monthly_income:  'petitionerMonthlyIncome',
  respondent_monthly_income:  'respondentMonthlyIncome',
  child_healthcare_cost:      'childHealthcareCost',
  child_childcare_cost:       'childChildcareCost',
  petitioner_overnights:      'petitionerOvernights',
  respondent_overnights:      'respondentOvernights',
  existing_order_amount:      'existingOrderAmount',
  existing_order_date:        'existingOrderDate',
  existing_order_court:       'existingOrderCourt',
  existing_order_case_number: 'existingOrderCaseNumber',
  arrears_amount:             'arrearsAmount',
  enforcement_actions:        'enforcementActions',
  change_in_circumstances:    'changeInCircumstances',
  payment_history_documented: 'paymentHistoryDocumented',
  is_modification:            'isModification',
  is_enforcement:             'isEnforcement',
  user_confirmed_review:      'userConfirmedReview'
};

// ─── Tool definition ──────────────────────────────────────────────────────────

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
          response:                   { type: 'string' },
          phase_complete:             { type: 'boolean' },
          petitioner_first_name:      { type: 'string' },
          petitioner_last_name:       { type: 'string' },
          respondent_first_name:      { type: 'string' },
          respondent_last_name:       { type: 'string' },
          state:                      { type: 'string' },
          county:                     { type: 'string' },
          is_modification:            { type: 'boolean', description: 'True if modifying an existing order' },
          is_enforcement:             { type: 'boolean', description: 'True if enforcing a violated/unpaid order' },
          existing_order_amount:      { type: 'number', description: 'Current monthly support amount in dollars' },
          existing_order_date:        { type: 'string', description: 'When the existing order was issued' },
          existing_order_court:       { type: 'string' },
          existing_order_case_number: { type: 'string' },
          arrears_amount:             { type: 'number', description: 'Total unpaid support owed (arrears) in dollars' },
          enforcement_actions:        { type: 'array', items: { type: 'string' }, description: 'contempt | wage_garnishment | license_suspension | tax_refund_seizure' },
          change_in_circumstances:    { type: 'string', description: 'Description of what changed to justify modification' },
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
          petitioner_monthly_income:  { type: 'number' },
          respondent_monthly_income:  { type: 'number' },
          child_healthcare_cost:      { type: 'number' },
          child_childcare_cost:       { type: 'number' },
          petitioner_overnights:      { type: 'number' },
          respondent_overnights:      { type: 'number' },
          payment_history_documented: { type: 'boolean' },
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
