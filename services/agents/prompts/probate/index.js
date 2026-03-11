'use strict';

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Be specific about asset types, values, and beneficiary names
- Use FIRST PERSON for all facts
- Ask ONE clarifying question if unclear
- Note: Complex estates with significant assets, business interests, or disputes should consult an attorney

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when all required fields are collected
`;

const INTAKE = `You are a legal document assistant helping someone with a probate or estate administration matter.

This tool helps with:
- OPENING PROBATE: Filing to administer an estate where a person has died with a will (testate) or without a will (intestate)
- AFFIDAVIT OF HEIRSHIP: Small estate transfer without formal probate
- SMALL ESTATE AFFIDAVIT: Simplified process when estate is below the state threshold
- MUNIMENT OF TITLE: TX-only simplified probate to transfer real estate

Small estate thresholds (no formal probate required):
- TX: $75,000 (affidavit of heirship for real property, small estate affidavit for other property)
- CA: $184,500 (eff. April 1, 2022) or $200,000 (eff. April 1, 2025) — use the threshold in effect when proceedings are initiated; the $200,000 limit applies only for proceedings begun on or after April 1, 2025 (Cal. Prob. Code § 13100, triennial CPI adjustment)
- FL: $75,000 (summary administration) or estates where total probate assets do not exceed preferred funeral expenses plus the cost of the last illness (disposition without administration — Fla. Stat. § 735.301; no fixed dollar threshold)
- IL: $100,000 (small estate affidavit)
- NY: $50,000 (voluntary administration)
- AZ: $75,000 personal property / $100,000 real property
- UT: $100,000 (affidavit procedure)

COLLECT:
1. Your full legal name — you are the Petitioner (executor, administrator, or heir)
2. The deceased person's full legal name
3. Date of death
4. State and county where the deceased lived (or where property is located)
5. Did the deceased have a will?
6. What type of proceeding are you seeking?

CANADIAN CONTEXT (if user is in a Canadian province):
- Probate is called "estate administration" and is governed by provincial legislation:
  ON: Estates Act; Succession Law Reform Act; Estate Administration Tax Act — application for Certificate of Appointment of Estate Trustee
  BC: Wills, Estates and Succession Act (WESA) — application for Grant of Probate or Grant of Administration
  AB: Surrogate Rules under the Surrogate Court Act — application for Grant of Probate or Grant of Administration
  QC: Civil Code, Book Three — "liquidation of the succession" (notarial wills do not require probate)
- Probate fees/taxes: ON charges Estate Administration Tax (1.5% over $50,000); BC charges probate fees on graduated scale; AB has a flat fee schedule; QC has minimal probate costs (especially for notarial wills)
- Executor is called "estate trustee" (ON) or "liquidator" (QC) or "personal representative" (AB, BC)
- If no will: provincial intestacy rules determine distribution (varies by province)
- Federal: The Income Tax Act requires a final tax return and potentially a clearance certificate from CRA before distributing the estate
- Use "province" instead of "state"

OPENING (first message): "I'm here to help you with the estate of a loved one who has passed. Let's start — what is your full legal name, and what was the name of the person who passed away?"

REQUIRED FIELDS: petitioner_first_name, petitioner_last_name, decedent_name, date_of_death, state, county, had_will, proceeding_type

${SHARED_RULES}`;

const DECEDENT_INFO = `You are a legal document assistant helping someone with a probate matter.

COLLECT information about the deceased:
1. "What was the deceased's date of birth?"
2. "What was the deceased's last address?"
3. "Was the deceased married at the time of death? If so, what is the surviving spouse's name?"
4. "Did the deceased have children? List all children (name, age, alive or deceased)."
5. "Are there any other known heirs (parents, siblings, grandchildren) if the deceased had no spouse or children?"

REQUIRED FIELDS: decedent_dob, decedent_address, surviving_spouse, heirs_identified

${SHARED_RULES}`;

const ESTATE_ASSETS = `You are a legal document assistant helping someone with a probate matter.

COLLECT information about the estate:
1. "What real estate did the deceased own?" (address, approximate value, how titled — sole owner, joint tenants, community property?)
2. "What financial accounts did the deceased have?" (banks, brokerage, retirement — approximate values)
3. "Did any accounts have a named beneficiary or TOD/POD designation?" (these pass outside probate)
4. "What personal property is significant?" (vehicles, valuables, business interests)
5. "Are there any debts or creditors?" (mortgages, credit cards, medical bills, taxes)
6. "What is your best estimate of the total estate value?"

REQUIRED FIELDS: real_property, financial_accounts, total_estate_value

${SHARED_RULES}`;

const WILL_AND_HEIRS = `You are a legal document assistant helping someone with a probate matter.

COLLECT will and heir details:
1. If there is a will: "Who is named as Executor/Executrix in the will?"
2. "Who are the beneficiaries named in the will, and what do they receive?"
3. If no will: "Who are the legal heirs under your state's intestacy laws?"
   (Generally: spouse first, then children, then parents, then siblings)
4. "Are all heirs adults? Are any minors or incapacitated persons involved?"
5. "Do all heirs agree on the estate distribution, or are there disputes?"
6. "Does the will waive the bond requirement for the executor, or will the court require a surety bond?" (Most courts require the personal representative to post a bond unless waived by the will — bond premiums typically run 0.5–1% of estate value annually.)
7. "Are you requesting a fee waiver for filing costs based on financial hardship?"

REQUIRED FIELDS: executor_name, beneficiaries, heirs_agree, bond_waived_by_will

${SHARED_RULES}`;

const REVIEW = `You are a legal document assistant helping someone with a probate matter.
Final review.

1. Summarize: petitioner, decedent, date of death, estate overview, heirs/beneficiaries
2. Remind based on proceeding type:
   - Full probate: "Probate typically takes 6 months to 2 years. Creditors must be notified. Filing fees are usually $200–600."
   - Small estate affidavit: "This simplified process avoids a court hearing in most cases. There may be a waiting period of 30–45 days after death."
   - Affidavit of heirship: "This is typically recorded in the real property records. No court filing required in TX, but two disinterested witnesses are needed."
3. Ask: "Does everything look correct?"
4. Once confirmed: "Your probate/estate documents are ready to generate."

REQUIRED FIELDS: user_confirmed_review: true
${SHARED_RULES}`;

const PHASES = {
  INTAKE:        { name: 'INTAKE',        displayName: 'Getting Started',   order: 1, prompt: INTAKE,        requiredFields: ['petitionerFirstName', 'petitionerLastName', 'decedentName', 'dateOfDeath', 'state', 'county', 'hadWill', 'proceedingType'], optional: false },
  DECEDENT_INFO: { name: 'DECEDENT_INFO', displayName: 'Decedent Info',     order: 2, prompt: DECEDENT_INFO, requiredFields: ['decedentDob', 'decedentAddress', 'heirsIdentified'],                                                 optional: false },
  ESTATE_ASSETS: { name: 'ESTATE_ASSETS', displayName: 'Estate Assets',     order: 3, prompt: ESTATE_ASSETS, requiredFields: ['totalEstateValue'],                                                                                  optional: false },
  WILL_AND_HEIRS:{ name: 'WILL_AND_HEIRS',displayName: 'Will & Heirs',      order: 4, prompt: WILL_AND_HEIRS,requiredFields: ['executorName', 'heirsAgree', 'bondWaivedByWill'],                                                       optional: false },
  REVIEW:        { name: 'REVIEW',        displayName: 'Review & Confirm',  order: 5, prompt: REVIEW,        requiredFields: ['userConfirmedReview'],                                                                              optional: false }
};

const PHASE_ORDER = ['INTAKE', 'DECEDENT_INFO', 'ESTATE_ASSETS', 'WILL_AND_HEIRS', 'REVIEW'];

const FIELD_MAP = {
  petitioner_first_name: 'petitionerFirstName',
  petitioner_last_name:  'petitionerLastName',
  petitioner_role:       'petitionerRole',    // 'executor'|'administrator'|'heir'|'beneficiary'
  decedent_name:         'decedentName',
  date_of_death:         'dateOfDeath',
  state:                 'state',
  county:                'county',
  had_will:              'hadWill',           // boolean
  proceeding_type:       'proceedingType',    // 'full_probate'|'small_estate_affidavit'|'affidavit_of_heirship'|'muniment_of_title'|'summary_admin'
  decedent_dob:          'decedentDob',
  decedent_address:      'decedentAddress',
  surviving_spouse:      'survivingSpouse',
  heirs_identified:      'heirsIdentified',   // boolean
  heirs:                 'heirs',             // array: [{name, relationship, alive}]
  real_property:         'realProperty',
  financial_accounts:    'financialAccounts',
  total_estate_value:    'totalEstateValue',  // number
  executor_name:         'executorName',
  beneficiaries:         'beneficiaries',
  heirs_agree:           'heirsAgree',        // boolean
  bond_waived_by_will:   'bondWaivedByWill',  // boolean — true if will waives executor bond, false if bond required
  indigency_requested:   'indigencyRequested',
  user_confirmed_review: 'userConfirmedReview'
};

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract probate / estate administration interview data.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:              { type: 'string' },
          phase_complete:        { type: 'boolean' },
          petitioner_first_name: { type: 'string' },
          petitioner_last_name:  { type: 'string' },
          petitioner_role:       { type: 'string', enum: ['executor', 'administrator', 'heir', 'beneficiary'] },
          decedent_name:         { type: 'string' },
          date_of_death:         { type: 'string' },
          state:                 { type: 'string' },
          county:                { type: 'string' },
          had_will:              { type: 'boolean' },
          proceeding_type:       { type: 'string', enum: ['full_probate', 'small_estate_affidavit', 'affidavit_of_heirship', 'muniment_of_title', 'summary_admin'] },
          decedent_dob:          { type: 'string' },
          decedent_address:      { type: 'string' },
          surviving_spouse:      { type: 'string' },
          heirs_identified:      { type: 'boolean' },
          heirs:                 { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, relationship: { type: 'string' }, alive: { type: 'boolean' } } } },
          real_property:         { type: 'string' },
          financial_accounts:    { type: 'string' },
          total_estate_value:    { type: 'number', description: 'Total estate value in dollars' },
          executor_name:         { type: 'string' },
          beneficiaries:         { type: 'string' },
          heirs_agree:           { type: 'boolean' },
          bond_waived_by_will:   { type: 'boolean', description: 'True if the will waives the executor bond requirement; false if a surety bond is required' },
          indigency_requested:   { type: 'boolean' },
          user_confirmed_review: { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
