'use strict';

/**
 * Affidavit Requirements Registry
 *
 * Each entry is a *symbolic* specification of what must be collected for a
 * given affidavit type.  The AffidavitRequirementsChecker evaluates the
 * current conversation state against these specs — independently of any LLM.
 *
 * Schema per requirement spec
 * ───────────────────────────
 * {
 *   id            : string   — matches AffidavitTypeRegistry id
 *   displayName   : string   — human-readable label
 *   description   : string   — one-line description
 *   minimumFacts  : number   — minimum fact count before phase can complete
 *   structuredFields : string[]  — top-level data fields that must be non-empty
 *   requiredTopics   : Topic[]   — semantic topics that must be covered by facts
 * }
 *
 * Topic schema
 * ────────────
 * {
 *   id         : string   — unique key within this type
 *   label      : string   — shown to LLM as "still needed" and to user as progress
 *   hint       : string   — extra context for LLM when this topic is missing
 *   categories : string[] — any fact whose .category OR .content contains one of
 *                           these strings (case-insensitive) satisfies this topic
 * }
 *
 * To add/change a legal requirement: edit the relevant spec here.
 * No prompts need touching.
 */

const REQUIREMENTS = {

  // ─── General ────────────────────────────────────────────────────────────────

  general_affidavit: {
    id:          'general_affidavit',
    displayName: 'General Affidavit',
    description: 'A sworn statement of facts for any legal purpose.',
    minimumFacts:    1,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'core_facts',
        label:      'The specific facts being sworn to',
        hint:       'Ask what the affiant personally knows or observed — dates, places, people involved.',
        categories: ['fact', 'event', 'statement', 'observation', 'witness'],
      },
      {
        id:         'purpose',
        label:      'The purpose or intended use of the affidavit',
        hint:       'Ask which court, agency, or institution requires this and why.',
        categories: ['purpose', 'use', 'reason', 'filing', 'court', 'agency'],
      },
    ],
  },

  // ─── Identity & Residency ────────────────────────────────────────────────────

  affidavit_of_residency: {
    id:          'affidavit_of_residency',
    displayName: 'Affidavit of Residency',
    description: 'Proves where the affiant currently lives.',
    minimumFacts:    2,
    structuredFields: ['affiantAddress'],
    requiredTopics: [
      {
        id:         'residency_duration',
        label:      'How long the affiant has lived at the current address',
        hint:       'Ask for the date they moved in or how many years/months they have resided there.',
        categories: ['residency', 'duration', 'since', 'lived', 'reside', 'moved'],
      },
      {
        id:         'proof_of_residence',
        label:      'What proof of residence the affiant possesses',
        hint:       'Ask about utility bills, lease agreement, voter registration, bank statements, etc.',
        categories: ['proof', 'evidence', 'documentation', 'bill', 'lease', 'registration', 'statement'],
      },
      {
        id:         'purpose',
        label:      'Why the affidavit is needed',
        hint:       'Ask which institution or requirement necessitates this (school, benefits, insurance, etc.).',
        categories: ['purpose', 'use', 'reason', 'school', 'benefit', 'insurance', 'enrollment'],
      },
    ],
  },

  affidavit_of_identity: {
    id:          'affidavit_of_identity',
    displayName: 'Affidavit of Identity',
    description: 'Confirms the affiant\'s legal name and identity.',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'legal_name',
        label:      'Full legal name and any other names previously used',
        hint:       'Ask for full current legal name, maiden name, prior names, or name variations on documents.',
        categories: ['name', 'identity', 'legal', 'maiden', 'alias', 'known as', 'formerly'],
      },
      {
        id:         'discrepancy_or_purpose',
        label:      'The specific discrepancy or reason for the identity affidavit',
        hint:       'Ask what name mismatch or situation prompted this, and which documents are affected.',
        categories: ['discrepancy', 'purpose', 'mismatch', 'document', 'spelling', 'error', 'difference'],
      },
    ],
  },

  // ─── Financial ───────────────────────────────────────────────────────────────

  financial_affidavit: {
    id:          'financial_affidavit',
    displayName: 'Financial Affidavit',
    description: 'Documents income, expenses, assets, and liabilities.',
    minimumFacts:    4,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'income',
        label:      'Monthly income (sources and amounts)',
        hint:       'Ask about employment wages, self-employment, government benefits, child/spousal support received, rental income.',
        categories: ['income', 'earn', 'salary', 'wage', 'employ', 'benefit', 'social security', 'unemployment', 'gross'],
      },
      {
        id:         'expenses',
        label:      'Monthly living expenses',
        hint:       'Ask about housing, utilities, food, transportation, healthcare, childcare, and debt payments.',
        categories: ['expense', 'cost', 'payment', 'rent', 'mortgage', 'utility', 'food', 'transport', 'healthcare', 'childcare'],
      },
      {
        id:         'assets',
        label:      'Assets (real property, vehicles, bank accounts, retirement)',
        hint:       'Ask about real estate, cars, checking/savings accounts, and retirement funds.',
        categories: ['asset', 'property', 'vehicle', 'account', 'retirement', 'bank', 'savings', 'investment', 'equity'],
      },
      {
        id:         'liabilities',
        label:      'Debts and liabilities',
        hint:       'Ask about credit card balances, personal loans, medical debt, and other obligations.',
        categories: ['liabilit', 'debt', 'loan', 'credit card', 'owe', 'balance', 'obligation', 'medical bill'],
      },
    ],
  },

  // ─── Support ──────────────────────────────────────────────────────────────────

  affidavit_of_support: {
    id:          'affidavit_of_support',
    displayName: 'Affidavit of Support',
    description: 'Vouches for another person (financial, housing, or character).',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'subject_identity',
        label:      'The person being supported — name and relationship to the affiant',
        hint:       'Ask for the full name, date of birth, and relationship (spouse, child, friend, etc.).',
        categories: ['support', 'subject', 'person', 'relationship', 'sponsor', 'beneficiary'],
      },
      {
        id:         'nature_of_support',
        label:      'The nature and extent of support being provided',
        hint:       'Ask whether this is financial, housing, immigration, or character support — and the specifics.',
        categories: ['financial', 'housing', 'character', 'amount', 'provide', 'assistance', 'sponsor', 'vouch', 'income'],
      },
    ],
  },

  // ─── Estate & Heirship ────────────────────────────────────────────────────────

  affidavit_of_heirship: {
    id:          'affidavit_of_heirship',
    displayName: 'Affidavit of Heirship',
    description: 'Establishes rightful heirs of a deceased person without probate.',
    minimumFacts:    3,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'decedent',
        label:      'Deceased person\'s full name, date of death, and state of residence at death',
        hint:       'Ask for full legal name, date of death, and where they lived when they died.',
        categories: ['decedent', 'deceased', 'died', 'death', 'passed', 'decease'],
      },
      {
        id:         'heirs',
        label:      'Surviving family members and rightful heirs',
        hint:       'Ask about the surviving spouse, children (biological/adopted/step), and any predeceased children\'s descendants.',
        categories: ['heir', 'family', 'survivor', 'spouse', 'child', 'daughter', 'son', 'inherit', 'next of kin'],
      },
      {
        id:         'estate_property',
        label:      'Property or assets to be transferred via this affidavit',
        hint:       'Ask for real estate address/legal description, vehicle VIN, or other personal property.',
        categories: ['property', 'estate', 'asset', 'real estate', 'transfer', 'title', 'land', 'vehicle', 'account'],
      },
    ],
  },

  small_estate_affidavit: {
    id:          'small_estate_affidavit',
    displayName: 'Small Estate Affidavit',
    description: 'Collects a deceased person\'s assets without formal probate.',
    minimumFacts:    3,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'decedent',
        label:      'Deceased person\'s name and date of death',
        hint:       'Ask for full legal name and exact date of death.',
        categories: ['decedent', 'deceased', 'died', 'death', 'passed'],
      },
      {
        id:         'claimed_asset',
        label:      'The specific asset being claimed',
        hint:       'Ask for the asset type (bank account, vehicle, personal property), institution holding it, and approximate value.',
        categories: ['asset', 'account', 'vehicle', 'property', 'claim', 'collect', 'bank', 'value'],
      },
      {
        id:         'entitlement',
        label:      'Why the affiant is entitled to claim this asset',
        hint:       'Ask about the claimant\'s relationship to the deceased and basis for entitlement (will, intestate succession).',
        categories: ['entitl', 'heir', 'inherit', 'beneficiar', 'will', 'successor', 'right', 'relationship'],
      },
    ],
  },

  affidavit_of_domicile: {
    id:          'affidavit_of_domicile',
    displayName: 'Affidavit of Domicile',
    description: 'Certifies a deceased person\'s state of legal residence at death.',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'decedent',
        label:      'Deceased person\'s name, date of death, and last address',
        hint:       'Ask for full legal name, date of death, and their last known home address.',
        categories: ['decedent', 'deceased', 'died', 'death', 'passed', 'address', 'residence'],
      },
      {
        id:         'domicile_evidence',
        label:      'Evidence establishing the state of legal domicile',
        hint:       'Ask how long they lived in that state, whether they voted there, held a driver\'s license there, or filed state taxes there.',
        categories: ['domicile', 'state', 'reside', 'voter', 'license', 'tax', 'lived', 'home', 'legal residence'],
      },
    ],
  },

  affidavit_of_survivorship: {
    id:          'affidavit_of_survivorship',
    displayName: 'Affidavit of Survivorship',
    description: 'Transfers real property to surviving joint tenant after co-owner\'s death.',
    minimumFacts:    3,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'decedent',
        label:      'Deceased co-owner\'s full name and date of death',
        hint:       'Ask for the full legal name and exact date of death of the person who died.',
        categories: ['decedent', 'deceased', 'died', 'death', 'passed', 'co-owner', 'joint'],
      },
      {
        id:         'property',
        label:      'Property address and legal description',
        hint:       'Ask for the street address and, if known, the legal description (lot/block/subdivision) from the deed.',
        categories: ['property', 'real estate', 'address', 'legal description', 'lot', 'parcel', 'land'],
      },
      {
        id:         'survivorship_right',
        label:      'Survivorship language in the deed (JTWROS or equivalent)',
        hint:       'Ask whether the deed contains "right of survivorship" or "JTWROS" language.',
        categories: ['survivorship', 'jtwros', 'joint tenant', 'right of survivorship', 'community property', 'deed'],
      },
    ],
  },

  // ─── Documents & Property ────────────────────────────────────────────────────

  affidavit_of_no_divorce: {
    id:          'affidavit_of_no_divorce',
    displayName: 'Affidavit of No Divorce',
    description: 'Certifies the affiant has never been divorced.',
    minimumFacts:    1,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'marital_status',
        label:      'Marital status and confirmation that no divorce has occurred or is pending',
        hint:       'Ask current marital status, marriage date/place, and explicit confirmation of no prior divorces or pending proceedings.',
        categories: ['marital', 'married', 'divorce', 'marriage', 'spouse', 'wed', 'status', 'never divorced', 'no divorce'],
      },
    ],
  },

  affidavit_of_lost_document: {
    id:          'affidavit_of_lost_document',
    displayName: 'Affidavit of Lost Document',
    description: 'Attests that an original document has been lost and requests a replacement.',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'document_description',
        label:      'Description of the lost document (type and what it pertained to)',
        hint:       'Ask what type of document was lost (title, deed, certificate, etc.) and what it related to.',
        categories: ['document', 'title', 'deed', 'certificate', 'contract', 'order', 'original', 'lost'],
      },
      {
        id:         'loss_circumstances',
        label:      'Circumstances of the loss and steps taken to locate it',
        hint:       'Ask when and where it was last seen, what happened, and what search efforts were made.',
        categories: ['lost', 'missing', 'circumstances', 'search', 'look', 'unable to find', 'fire', 'flood', 'theft', 'moved'],
      },
    ],
  },

  vehicle_transfer_affidavit: {
    id:          'vehicle_transfer_affidavit',
    displayName: 'Vehicle Transfer Affidavit',
    description: 'Transfers a vehicle title after death of owner or private-party sale.',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'vehicle_description',
        label:      'Vehicle description — year, make, model, and VIN',
        hint:       'Ask for the vehicle year, make, model, and VIN (Vehicle Identification Number).',
        categories: ['vehicle', 'car', 'truck', 'vin', 'make', 'model', 'year', 'auto', 'automobile'],
      },
      {
        id:         'transfer_basis',
        label:      'Basis for transfer — death of owner or private sale',
        hint:       'Ask whether this is an inheritance transfer (from a deceased owner) or a private sale, and collect the relevant details.',
        categories: ['transfer', 'death', 'sale', 'inherit', 'deceased', 'sold', 'purchase', 'ownership', 'title'],
      },
    ],
  },

  affidavit_of_no_lien: {
    id:          'affidavit_of_no_lien',
    displayName: 'Affidavit of No Lien',
    description: 'Certifies that a property is free and clear of liens.',
    minimumFacts:    2,
    structuredFields: [],
    requiredTopics: [
      {
        id:         'property_description',
        label:      'Property address and legal description',
        hint:       'Ask for the full street address and, if available, the legal description from the deed.',
        categories: ['property', 'address', 'legal description', 'parcel', 'lot', 'real estate', 'land', 'home'],
      },
      {
        id:         'lien_confirmation',
        label:      'Confirmation that no liens exist (mortgage, judgment, mechanic\'s, tax, HOA)',
        hint:       'Ask specifically about mortgages, court judgments, contractor work, property taxes, and HOA dues.',
        categories: ['lien', 'mortgage', 'judgment', 'mechanic', 'tax', 'hoa', 'encumbrance', 'debt', 'free and clear', 'no lien', 'paid'],
      },
    ],
  },

};

module.exports = REQUIREMENTS;
