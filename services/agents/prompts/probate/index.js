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
- CA: $184,500 (simplified transfer procedure)
- FL: $75,000 (summary administration) or $6,000 (disposition without administration)
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

REQUIRED FIELDS: executor_name, beneficiaries, heirs_agree

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
  INTAKE:        { name: 'INTAKE',        displayName: 'Getting Started',   order: 1, prompt: INTAKE,        requiredFields: ['petitionerFirstName', 'decedentName', 'dateOfDeath', 'state', 'county', 'hadWill', 'proceedingType'], optional: false },
  DECEDENT_INFO: { name: 'DECEDENT_INFO', displayName: 'Decedent Info',     order: 2, prompt: DECEDENT_INFO, requiredFields: ['decedentDob', 'decedentAddress', 'heirsIdentified'],                                                 optional: false },
  ESTATE_ASSETS: { name: 'ESTATE_ASSETS', displayName: 'Estate Assets',     order: 3, prompt: ESTATE_ASSETS, requiredFields: ['totalEstateValue'],                                                                                  optional: false },
  WILL_AND_HEIRS:{ name: 'WILL_AND_HEIRS',displayName: 'Will & Heirs',      order: 4, prompt: WILL_AND_HEIRS,requiredFields: ['executorName', 'heirsAgree'],                                                                       optional: false },
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
          indigency_requested:   { type: 'boolean' },
          user_confirmed_review: { type: 'boolean' },
          extracted_facts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' } }, required: ['content', 'category'] } }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
