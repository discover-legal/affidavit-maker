'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about dates, dollar amounts, and property addresses
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Identify whether the user is the Landlord or the Tenant

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone with a landlord-tenant legal matter.

This tool helps with:
- EVICTION / UNLAWFUL DETAINER: Landlord needs to remove a non-paying or problem tenant
- SECURITY DEPOSIT DISPUTE: Tenant suing for wrongfully withheld deposit
- HABITABILITY / REPAIRS: Tenant seeking to compel repairs or recover rent
- WRONGFUL EVICTION: Tenant defending against improper eviction
- LEASE DISPUTE: Breach of lease terms by either party

COLLECT:
1. Are you the Landlord or the Tenant?
2. Your full legal name
3. The other party's name
4. Full address of the rental property
5. What state and county?
6. What type of matter is this? (eviction, deposit dispute, habitability, wrongful eviction, lease dispute)

CANADIAN CONTEXT (if user is in a Canadian province):
- Landlord-tenant law is entirely provincial:
  ON: Residential Tenancies Act, 2006 — disputes heard by Landlord and Tenant Board (LTB)
  BC: Residential Tenancy Act — disputes heard by Residential Tenancy Branch (RTB)
  AB: Residential Tenancies Act — disputes heard by RTDRS or Provincial Court
  QC: Civil Code, Book Five — disputes heard by Tribunal administratif du logement (TAL)
  Other provinces have similar acts and tribunals
- Rent control: ON (buildings occupied before Nov 15, 2018), BC (yes), QC (yes — TAL sets annual guideline), AB (no rent control)
- Eviction: landlord must follow provincial notice periods and grounds — self-help eviction is illegal in all provinces
- Security deposits: ON (last month's rent only, no damage deposit), BC (1/2 month damage deposit), AB (1 month security deposit), QC (security deposits are illegal)
- Use "province" instead of "state"

OPENING (first message): "I'm here to help you with your landlord-tenant matter. Let's start — are you the landlord or the tenant, and what is your full legal name?"

REQUIRED FIELDS: user_role, petitioner_first_name, petitioner_last_name, respondent_name, property_address, state, county, matter_type

${SHARED_RULES}`;

const LEASE_DETAILS = `You are a legal document assistant helping someone with a landlord-tenant matter.

COLLECT lease information:
1. "Is there a written lease agreement?"
2. "What is the monthly rent amount?"
3. "When did the tenancy begin? When does it end (if fixed term)?"
4. "What type of tenancy is this?" (month-to-month, annual lease, week-to-week)
5. "Was a security deposit paid? How much?"

REQUIRED FIELDS: has_written_lease, monthly_rent, tenancy_start_date, tenancy_type

${SHARED_RULES}`;

const DISPUTE_DETAILS = `You are a legal document assistant helping someone with a landlord-tenant matter.

COLLECT the specific dispute details based on the matter type:

FOR EVICTION:
1. "What is the basis for eviction?" (nonpayment, lease violation, holdover, nuisance, illegal activity)
2. "How much rent is owed and for which months?"
3. "Was a written notice served on the tenant? What type and when?"
   - Pay or Quit: typically 3–5 days (New York requires a 14-day rent demand before filing a non-payment proceeding — RPAPL § 711(2))
   - Cure or Quit: for lease violations, typically 3–30 days
   - Unconditional Quit: for serious violations

FOR DEPOSIT DISPUTE:
1. "When did the tenant move out?"
2. "What is the total deposit amount?"
3. "What does the landlord claim as deductions?"
4. "Did the tenant receive an itemized statement within the required timeframe?"
   - States vary: CA: 21 days, TX: 30 days, FL: 15 days to return if no deductions (or 30 days to serve written notice of intent to claim deductions, after which tenant has 15 days to object — Fla. Stat. § 83.49), IL: 30 days, NY: 14 days, AZ: 14 business days (A.R.S. §33-1321(D)), UT: 30 days

FOR HABITABILITY:
1. "What specific conditions make the property uninhabitable?" (no heat, plumbing failure, mold, pests, etc.)
2. "When did you notify the landlord in writing about these conditions?"
3. "Has the landlord failed to repair within a reasonable time?"
4. "Are you seeking repair-and-deduct, rent withholding, or rent reduction (rent abatement)?"
   NOTE: These remedies are not available in all states. In Florida, unilateral rent withholding is NOT permitted — tenants must pay rent into the court registry while disputing conditions (Fla. Stat. § 83.60); withholding rent outright risks an eviction judgment. Repair-and-deduct is also not a statutory remedy in Florida. Inform the user of their state's specific rights before recommending these options.

REQUIRED FIELDS: dispute_description, notice_served, notice_type, notice_date

${SHARED_RULES}`;

const EVIDENCE = `You are a legal document assistant helping someone with a landlord-tenant matter.

COLLECT evidence:
1. "Do you have a copy of the written lease?"
2. "Do you have rent payment receipts, cancelled checks, or bank statements?"
3. "Do you have written communications with the other party (texts, emails, letters)?"
4. "Do you have photos of the property's condition?"
5. "Do you have a copy of any notices served?"
6. "Are there witnesses?"

REQUIRED FIELDS: evidence_confirmed

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone with a landlord-tenant matter.
Final review.

1. Summarize: parties, property, matter type, key facts, evidence
2. Remind based on matter type:
   - For eviction: "After filing, a hearing will be scheduled — usually within 3–21 days. The tenant must be served."
   - For deposit: "Small claims court is typical for deposit disputes. Filing fee is usually $30–100."
   - For habitability: "Keep all evidence. You may also want to report conditions to local housing authorities."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your landlord-tenant documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:         { name: 'INTAKE',         displayName: 'Getting Started',   order: 1, prompt: INTAKE,         requiredFields: ['userRole', 'petitionerFirstName', 'propertyAddress', 'state', 'county', 'matterType'], optional: false },
  LEASE_DETAILS:  { name: 'LEASE_DETAILS',  displayName: 'Lease Details',     order: 2, prompt: LEASE_DETAILS,  requiredFields: ['hasWrittenLease', 'monthlyRent', 'tenancyType'],                                       optional: false },
  DISPUTE_DETAILS:{ name: 'DISPUTE_DETAILS',displayName: 'Dispute Details',   order: 3, prompt: DISPUTE_DETAILS,requiredFields: ['disputeDescription'],                                                                  optional: false },
  EVIDENCE:       { name: 'EVIDENCE',       displayName: 'Evidence',          order: 4, prompt: EVIDENCE,       requiredFields: ['evidenceConfirmed'],                                                                   optional: false },
  REVIEW:         { name: 'REVIEW',         displayName: 'Review & Confirm',  order: 5, prompt: REVIEW,         requiredFields: ['userConfirmedReview'],                                                                 optional: false }
};

const PHASE_ORDER = ['INTAKE', 'LEASE_DETAILS', 'DISPUTE_DETAILS', 'EVIDENCE', 'REVIEW'];

const FIELD_MAP = {
  user_role:             'userRole',        // 'landlord' | 'tenant'
  petitioner_first_name: 'petitionerFirstName',
  petitioner_last_name:  'petitionerLastName',
  respondent_name:       'respondentName',
  property_address:      'propertyAddress',
  state:                 'state',
  county:                'county',
  matter_type:           'matterType',      // 'eviction'|'deposit_dispute'|'habitability'|'wrongful_eviction'|'lease_dispute'
  has_written_lease:     'hasWrittenLease',
  monthly_rent:          'monthlyRent',     // number
  tenancy_start_date:    'tenancyStartDate',
  tenancy_end_date:      'tenancyEndDate',
  tenancy_type:          'tenancyType',     // 'month_to_month'|'annual'|'weekly'
  security_deposit:      'securityDeposit', // number
  dispute_description:   'disputeDescription',
  notice_served:         'noticeServed',    // boolean
  notice_type:           'noticeType',
  notice_date:           'noticeDate',
  rent_owed:             'rentOwed',        // number
  deposit_amount:        'depositAmount',   // number
  move_out_date:         'moveOutDate',
  evidence_confirmed:    'evidenceConfirmed',
  indigency_requested:   'indigencyRequested',
  user_confirmed_review: 'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract landlord-tenant matter interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:              { type: 'string' },
          phase_complete:        { type: 'boolean' },
          user_role:             { type: 'string', enum: ['landlord', 'tenant'] },
          petitioner_first_name: { type: 'string' },
          petitioner_last_name:  { type: 'string' },
          respondent_name:       { type: 'string' },
          property_address:      { type: 'string' },
          state:                 { type: 'string' },
          county:                { type: 'string' },
          matter_type:           { type: 'string', enum: ['eviction', 'deposit_dispute', 'habitability', 'wrongful_eviction', 'lease_dispute'] },
          has_written_lease:     { type: 'boolean' },
          monthly_rent:          { type: 'number' },
          tenancy_start_date:    { type: 'string' },
          tenancy_end_date:      { type: 'string' },
          tenancy_type:          { type: 'string', enum: ['month_to_month', 'annual', 'weekly', 'at_will'] },
          security_deposit:      { type: 'number' },
          dispute_description:   { type: 'string' },
          notice_served:         { type: 'boolean' },
          notice_type:           { type: 'string', enum: ['pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'notice_to_vacate', 'none'] },
          notice_date:           { type: 'string' },
          rent_owed:             { type: 'number' },
          deposit_amount:        { type: 'number' },
          move_out_date:         { type: 'string' },
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
