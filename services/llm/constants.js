// services/llm/constants.js - Legal categories for LLM function calling

const LEGAL_CATEGORIES = {
  financial: {
    name: 'Financial',
    subcategories: ['income', 'assets', 'debts', 'payments', 'support', 'expenses'],
    description: 'Money, assets, income, debts, financial obligations',
    validation_focus: 'specificity, amounts, documentation'
  },
  property: {
    name: 'Property',
    subcategories: ['real_estate', 'personal_property', 'vehicles', 'intellectual_property'],
    description: 'Real estate, personal property, vehicles, ownership',
    validation_focus: 'ownership clarity, specific descriptions, legal interest'
  },
  relational: {
    name: 'Relationships',
    subcategories: ['family', 'custody', 'visitation', 'marriage', 'divorce'],
    description: 'Family relationships, custody, marriage, divorce',
    validation_focus: 'avoid hearsay, personal knowledge only, formal language'
  },
  temporal: {
    name: 'Chronological',
    subcategories: ['dates', 'timelines', 'sequences', 'duration'],
    description: 'Dates, times, chronological sequences',
    validation_focus: 'specific dates, avoid approximations'
  },
  witness: {
    name: 'Witness Testimony',
    subcategories: ['observations', 'conversations', 'events', 'actions'],
    description: 'Direct observations, witnessed events',
    validation_focus: 'first-person observations only, no hearsay'
  },
  communication: {
    name: 'Communications',
    subcategories: ['verbal', 'written', 'electronic', 'legal_notices'],
    description: 'Conversations, emails, texts, legal notices',
    validation_focus: 'direct participation, avoid "I heard" statements'
  },
  parental: {
    name: 'Parental Care',
    subcategories: ['childcare', 'education', 'health', 'environment', 'routines'],
    description: 'Child care, education, health, living environment',
    validation_focus: 'specific examples, avoid emotional language, factual observations'
  }
};

// Divorce-specific categories for divorce package documents
const DIVORCE_CATEGORIES = {
  marriage: {
    name: 'Marriage Information',
    subcategories: ['marriage_date', 'marriage_location', 'marriage_duration', 'separation'],
    description: 'Date and place of marriage, separation details',
    validation_focus: 'exact dates, official records'
  },
  grounds: {
    name: 'Grounds for Divorce',
    subcategories: ['irreconcilable_differences', 'incompatibility', 'no_fault', 'fault_based'],
    description: 'Legal grounds for dissolution of marriage',
    validation_focus: 'state-specific requirements, factual basis'
  },
  children: {
    name: 'Children',
    subcategories: ['minor_children', 'custody', 'visitation', 'child_support', 'special_needs'],
    description: 'Minor children of the marriage, custody arrangements',
    validation_focus: 'names, ages, custody preferences, best interests'
  },
  property_division: {
    name: 'Property Division',
    subcategories: ['marital_property', 'separate_property', 'real_estate', 'vehicles', 'retirement', 'debts'],
    description: 'Division of marital assets and debts',
    validation_focus: 'ownership, valuation, proposed division'
  },
  spousal_support: {
    name: 'Spousal Support',
    subcategories: ['alimony', 'maintenance', 'duration', 'amount'],
    description: 'Spousal support/alimony requests',
    validation_focus: 'income disparity, duration of marriage, need'
  },
  residence: {
    name: 'Residency',
    subcategories: ['current_residence', 'residency_requirements', 'jurisdiction'],
    description: 'Residency information for jurisdiction',
    validation_focus: 'state residency requirements, duration'
  }
};

module.exports = { LEGAL_CATEGORIES, DIVORCE_CATEGORIES };
