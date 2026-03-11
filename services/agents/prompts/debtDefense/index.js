'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about debt amounts, creditor names, and dates
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Remind the user they have a deadline to respond — always tell them to check the exact date on their summons (AZ/FL/TX: 20 days; UT: 21 days; CA/IL: 30 days; NY: 20 days personal service, 30 days other service)

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone defend against a debt collection lawsuit.

URGENT: If you've been sued, you typically have only 20–21 days to file your Answer (AZ/FL/TX: 20 days; UT: 21 days; CA/IL: 30 days; NY: 20 days if personally served, 30 days if served by mail/substituted service). Always check the exact deadline on your summons — missing it results in a default judgment against you.

COLLECT:
1. Your full legal name — you are the Defendant
2. The plaintiff's name (the creditor or debt collector suing you)
3. What state and county is the court case in?
4. The case number (from the summons)
5. What date were you served with the lawsuit?
6. What is the amount they are claiming you owe?

CANADIAN CONTEXT (if user is in a Canadian province):
- Debt collection is regulated by provincial consumer protection legislation:
  ON: Collection and Debt Settlement Services Act | BC: Business Practices and Consumer Protection Act | AB: Collection and Debt Collection Practices Regulation | QC: Consumer Protection Act
- Limitation periods: ON: 2 years (Limitations Act) | BC: 2 years (Limitation Act) | AB: 2 years (Limitations Act) | QC: 3 years (Civil Code) | Most other provinces: 2 or 6 years
- The limitation period starts from the date of last payment or written acknowledgment of debt
- If the limitation period has expired, the debt is "statute-barred" — not extinguished but unenforceable through courts
- Debt collectors must follow provincial rules: cannot call at unreasonable hours, must not harass, must provide written notice of the debt
- For bankruptcy: Canadian residents must consult a Licensed Insolvency Trustee (not a US bankruptcy attorney) — see ic.gc.ca/eic/site/bsf-osb.nsf
- Use "province" instead of "state"

OPENING (first message): "I'm here to help you respond to the debt collection lawsuit filed against you. Time is critical — let's get started right away. What is your full legal name and what court has sued you?"

REQUIRED FIELDS: defendant_first_name, defendant_last_name, plaintiff_name, state, county, case_number, service_date, claimed_amount

${SHARED_RULES}`;

const DEBT_DETAILS = `You are a legal document assistant helping someone defend against a debt collection lawsuit.

COLLECT details about the alleged debt:
1. "What type of debt is this? (credit card, medical bill, personal loan, auto loan, utility bill, rent, other)"
2. "Do you recognize this debt? Is it yours?"
3. "When did this account go into default (stop being paid)?"
4. "Has the statute of limitations expired?"
   - Credit card debt statutes of limitations: TX: 4 years, CA: 3 years for consumer credit accounts (CCP § 337(b), as amended by AB 1278 — applies to actions filed on or after Jan. 1, 2022; other written contracts remain 4 years under CCP § 337(a)), FL: 5 years for defaults before Oct. 1, 2023 / 4 years for defaults on/after Oct. 1, 2023 (Fla. Stat. § 95.11(2)(b)), IL: 5 years, NY: 3 years, AZ: 6 years, UT: 6 years
   - Count from the date of last payment or default, whichever is later
   - WARNING: In some states, making a payment or even acknowledging the debt in writing can restart the statute of limitations clock. Do NOT make a payment on a time-barred debt without first consulting an attorney.
5. "Did you ever receive a debt validation letter from this collector? Did you request validation in writing within 30 days?"

REQUIRED FIELDS: debt_type, debt_recognized, default_date

${SHARED_RULES}`;

const DEFENSES = `You are a legal document assistant helping someone defend against a debt collection lawsuit.

COLLECT possible defenses:
1. "Is the amount they're claiming correct? Do you dispute any portion of it?"
2. "Are you the right person? Is your identity correct in the lawsuit?"
3. "Do you believe this debt has already been paid, settled, or discharged in bankruptcy?"
4. "Has this debt been sold to a debt buyer? Can you verify the plaintiff actually owns this debt?"
5. "Have you received any communications from this collector that violated the Fair Debt Collection Practices Act (e.g., harassment, false statements, contacting you at work after being told not to)?"
6. "Did you ever agree to arbitration for this account? (Check your original credit card agreement)"

Common defenses:
- Statute of limitations expired
- Debt already paid or settled
- Wrong person / mistaken identity
- Amount incorrect
- Plaintiff lacks standing (doesn't own the debt)
- FDCPA violations
- Improper service

REQUIRED FIELDS: defenses_identified, amount_disputed

${SHARED_RULES}`;

const COUNTERCLAIMS = `You are a legal document assistant helping someone defend against a debt collection lawsuit.

COLLECT potential counterclaims:
1. "Has the debt collector violated the Fair Debt Collection Practices Act (FDCPA)?"
   FDCPA violations include: calling before 8am or after 9pm, calling your workplace after you asked them to stop, threatening actions they can't take, using abusive language, falsely claiming you'll be arrested
2. "Has the collector violated your state's Unfair Debt Collection Practices Act?"
3. "Did they fail to provide debt validation when you requested it in writing?"

If FDCPA violations exist, you may be entitled to actual damages for any real harm suffered, statutory damages of up to $1,000 per action, and attorney's fees and costs — 15 U.S.C. § 1692k(a).

REQUIRED FIELDS: fdcpa_violations, has_counterclaim

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone defend against a debt collection lawsuit.
Final review.

1. Summarize: defendant, plaintiff, court, case number, amount, defenses, counterclaims
2. URGENT REMINDER: "You must file your Answer before the deadline. Bring a copy to the courthouse clerk and ask for a file-stamped copy for your records. There is usually a filing fee of $30–100 (or you can request a fee waiver)."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your debt defense Answer is ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:       { name: 'INTAKE',       displayName: 'Case Information',    order: 1, prompt: INTAKE,       requiredFields: ['defendantFirstName', 'plaintiffName', 'state', 'county', 'caseNumber', 'serviceDate', 'claimedAmount'], optional: false },
  DEBT_DETAILS: { name: 'DEBT_DETAILS', displayName: 'The Debt',           order: 2, prompt: DEBT_DETAILS, requiredFields: ['debtType', 'debtRecognized'],                                                                        optional: false },
  DEFENSES:     { name: 'DEFENSES',     displayName: 'Your Defenses',      order: 3, prompt: DEFENSES,     requiredFields: ['defensesIdentified'],                                                                                optional: false },
  COUNTERCLAIMS:{ name: 'COUNTERCLAIMS',displayName: 'Counterclaims',      order: 4, prompt: COUNTERCLAIMS,requiredFields: ['fdcpaViolations'],                                                                                   optional: false },
  REVIEW:       { name: 'REVIEW',       displayName: 'Review & Confirm',   order: 5, prompt: REVIEW,       requiredFields: ['userConfirmedReview'],                                                                              optional: false }
};

const PHASE_ORDER = ['INTAKE', 'DEBT_DETAILS', 'DEFENSES', 'COUNTERCLAIMS', 'REVIEW'];

const FIELD_MAP = {
  defendant_first_name:  'defendantFirstName',
  defendant_last_name:   'defendantLastName',
  plaintiff_name:        'plaintiffName',
  state:                 'state',
  county:                'county',
  case_number:           'caseNumber',
  service_date:          'serviceDate',
  answer_deadline:       'answerDeadline',
  claimed_amount:        'claimedAmount',  // number
  debt_type:             'debtType',
  debt_recognized:       'debtRecognized', // boolean
  default_date:          'defaultDate',
  statute_expired:       'statuteExpired', // boolean
  defenses_identified:   'defensesIdentified',  // array of strings
  amount_disputed:       'amountDisputed',  // boolean
  amount_disputed_by:    'amountDisputedBy', // number
  fdcpa_violations:      'fdcpaViolations', // boolean
  fdcpa_details:         'fdcpaDetails',
  has_counterclaim:      'hasCounterclaim', // boolean
  indigency_requested:   'indigencyRequested',
  user_confirmed_review: 'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract debt defense lawsuit interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:              { type: 'string' },
          phase_complete:        { type: 'boolean' },
          defendant_first_name:  { type: 'string' },
          defendant_last_name:   { type: 'string' },
          plaintiff_name:        { type: 'string' },
          state:                 { type: 'string' },
          county:                { type: 'string' },
          case_number:           { type: 'string' },
          service_date:          { type: 'string' },
          answer_deadline:       { type: 'string' },
          claimed_amount:        { type: 'number', description: 'Amount plaintiff claims in dollars' },
          debt_type:             { type: 'string', enum: ['credit_card', 'medical', 'personal_loan', 'auto_loan', 'utility', 'rent', 'student_loan', 'other'] },
          debt_recognized:       { type: 'boolean' },
          default_date:          { type: 'string' },
          statute_expired:       { type: 'boolean' },
          defenses_identified:   { type: 'array', items: { type: 'string' } },
          amount_disputed:       { type: 'boolean' },
          amount_disputed_by:    { type: 'number' },
          fdcpa_violations:      { type: 'boolean' },
          fdcpa_details:         { type: 'string' },
          has_counterclaim:      { type: 'boolean' },
          indigency_requested:   { type: 'boolean' },
          user_confirmed_review: { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
