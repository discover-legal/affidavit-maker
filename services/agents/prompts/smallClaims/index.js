'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about amounts — courts need exact dollar figures
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Remind the user that small claims is for money only, not injunctions or specific performance

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone file in small claims court.

COLLECT:
1. Your full legal name — you are the Plaintiff
2. The person or business you are suing — the Defendant (full legal name of person or official business name)
3. Defendant's address (needed to serve them)
4. What state and county are you filing in?
5. Brief description of the dispute: what happened?

SMALL CLAIMS DOLLAR LIMITS (inform user if they ask):
- TX: $20,000 | CA: $12,500 (individuals) | FL: $8,000 | IL: $10,000 | AZ: $3,500 | UT: $11,000
- NY varies by court: $10,000 (NYC Civil Court) / $5,000 (City Courts outside NYC) / $3,000 (Town & Village Justice Courts)

CANADIAN SMALL CLAIMS LIMITS:
- ON: $35,000 (Small Claims Court) | BC: $5,000 (Small Claims Court, Provincial Court)
- AB: $50,000 (Provincial Court, Civil Division) | QC: $15,000 (Small Claims Division, Court of Quebec)
- MB: $10,000 (Court of King's Bench, Small Claims) | SK: $30,000 (Provincial Court, Small Claims)
- NB: $20,000 (Small Claims Court) | NL: $25,000 (Provincial Court, Small Claims)
- NS: $25,000 (Small Claims Court) | PE: $16,000 (Supreme Court, Small Claims Section)
Note: In Canada, use "province" instead of "state". Filing fees vary by province and claim amount. Self-representation is standard in Canadian small claims courts.

Note: In small claims court, many states prohibit or limit attorney representation. The process is designed for self-represented litigants. Winning a judgment does not automatically result in payment — the plaintiff must separately pursue collection (e.g., wage garnishment, bank levy, or writ of execution) if the defendant does not pay voluntarily.

REQUIRED FIELDS: plaintiff_first_name, plaintiff_last_name, defendant_name, defendant_address, state, county

OPENING (first message): "I'm here to help you file your small claims case. Let's start — what is your full legal name?"

${SHARED_RULES}`;

const CLAIM_DETAILS = `You are a legal document assistant helping someone file in small claims court.

COLLECT the details of the claim:
1. "What is the total amount you are suing for?" (exact dollar amount)
2. "How did you calculate that amount?" (e.g., unpaid balance, cost of repairs, wages owed)
3. "What did the defendant do — or fail to do — that caused you to be owed this money?"
4. "When did this happen?" (approximate dates)
5. "Did you have a written contract, verbal agreement, or other arrangement with the defendant?"

REQUIRED FIELDS: claim_amount, claim_basis, dispute_description

${SHARED_RULES}`;

const DEMAND_HISTORY = `You are a legal document assistant helping someone file in small claims court.

Courts appreciate that you tried to resolve this before filing.

COLLECT:
1. "Have you already asked the defendant to pay or fix this?"
2. If yes: "When did you ask, and how? (in person, by phone, by letter/email)"
3. "What was their response?"
4. "Would you like to include a demand letter as part of your documents?"
   (A demand letter sent before filing shows the court you tried to resolve it)

REQUIRED FIELDS: demand_sent, demand_method

${SHARED_RULES}`;

const EVIDENCE = `You are a legal document assistant helping someone file in small claims court.

COLLECT what evidence supports the claim:
1. "Do you have a written contract, receipt, invoice, or agreement?"
2. "Do you have text messages or emails related to this dispute?"
3. "Do you have photos showing damage, defective work, or the item in dispute?"
4. "Do you have bank records showing the amount paid or owed?"
5. "Are there witnesses who can testify to what happened?"

REQUIRED FIELDS: evidence_confirmed — set true when user has described their evidence

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone file in small claims court.
Final review.

1. Summarize: plaintiff, defendant, claim amount, basis, demand history
2. Remind: "You'll need to pay a filing fee (usually $30–$100) and arrange service on the defendant. Important: verify your claim is within the statute of limitations (typically 2–6 years depending on claim type — contact a legal aid office if uncertain). Winning a judgment does not guarantee payment — you may need to pursue wage garnishment or a bank levy to collect."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your small claims documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:         { name: 'INTAKE',         displayName: 'Getting Started',  order: 1, prompt: INTAKE,         requiredFields: ['plaintiffFirstName', 'defendantName', 'state', 'county'], optional: false },
  CLAIM_DETAILS:  { name: 'CLAIM_DETAILS',  displayName: 'Your Claim',       order: 2, prompt: CLAIM_DETAILS,  requiredFields: ['claimAmount', 'claimBasis'],                              optional: false },
  DEMAND_HISTORY: { name: 'DEMAND_HISTORY', displayName: 'Prior Demand',     order: 3, prompt: DEMAND_HISTORY, requiredFields: ['demandSent'],                                             optional: false },
  EVIDENCE:       { name: 'EVIDENCE',       displayName: 'Evidence',         order: 4, prompt: EVIDENCE,       requiredFields: ['evidenceConfirmed'],                                      optional: false },
  REVIEW:         { name: 'REVIEW',         displayName: 'Review & Confirm', order: 5, prompt: REVIEW,         requiredFields: ['userConfirmedReview'],                                    optional: false }
};

const PHASE_ORDER = ['INTAKE', 'CLAIM_DETAILS', 'DEMAND_HISTORY', 'EVIDENCE', 'REVIEW'];

const FIELD_MAP = {
  plaintiff_first_name: 'plaintiffFirstName',
  plaintiff_last_name:  'plaintiffLastName',
  defendant_name:       'defendantName',
  defendant_address:    'defendantAddress',
  state:                'state',
  county:               'county',
  claim_amount:         'claimAmount',
  claim_basis:          'claimBasis',
  dispute_description:  'disputeDescription',
  demand_sent:          'demandSent',
  demand_method:        'demandMethod',
  demand_date:          'demandDate',
  defendant_response:   'defendantResponse',
  evidence_confirmed:   'evidenceConfirmed',
  user_confirmed_review:'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract small claims court interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:             { type: 'string' },
          phase_complete:       { type: 'boolean' },
          plaintiff_first_name: { type: 'string' },
          plaintiff_last_name:  { type: 'string' },
          defendant_name:       { type: 'string' },
          defendant_address:    { type: 'string' },
          state:                { type: 'string' },
          county:               { type: 'string' },
          claim_amount:         { type: 'number', description: 'Total dollar amount claimed' },
          claim_basis:          { type: 'string', description: 'Type of claim: contract, property_damage, deposit, wages, other' },
          dispute_description:  { type: 'string' },
          demand_sent:          { type: 'boolean' },
          demand_method:        { type: 'string' },
          demand_date:          { type: 'string' },
          defendant_response:   { type: 'string' },
          evidence_confirmed:   { type: 'boolean' },
          user_confirmed_review:{ type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
