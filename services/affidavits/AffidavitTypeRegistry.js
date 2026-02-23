'use strict';

/**
 * AffidavitTypeRegistry
 *
 * The authoritative affidavit bank for all supported states.
 *
 * Each entry describes one document product users can request:
 *   - Universal types work in all 7 states
 *   - State-specific types are only shown for the relevant states
 *   - Divorce package is registered here so the type list is one canonical source
 *
 * The GeneralAffidavitOrchestrator uses this to drive interviews.
 * The templates.js route exposes it via API for the frontend type-picker.
 * The DocumentSelectionAgent uses affidavitType to choose which docs to emit.
 *
 * ── Adding a new type ──────────────────────────────────────────────────────────
 *   1. Add an entry to AFFIDAVIT_TYPES below
 *   2. Add a handler in DocumentSelectionAgent for `*:TYPE_ID` (or per-state)
 *   3. Add a FACTS prompt in prompts/generalAffidavit/index.js under FACTS_BY_TYPE
 *   4. Add the document tab(s) in DocumentPreview DIVORCE_DOC_TABS if new doc types
 */

// ─── State codes supported by this platform ───────────────────────────────────
const ALL_STATES = ['TX', 'AZ', 'CA', 'FL', 'IL', 'NY', 'UT'];

// ─── Type definitions ──────────────────────────────────────────────────────────

const AFFIDAVIT_TYPES = {

  // ── Universal: available in every supported state ───────────────────────────

  general_affidavit: {
    id:          'general_affidavit',
    name:        'General Affidavit',
    description: 'A sworn statement of facts for any legal purpose — the most flexible option.',
    category:    'general',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'FileText',
    popular:     true,
  },

  affidavit_of_residency: {
    id:          'affidavit_of_residency',
    name:        'Affidavit of Residency',
    description: 'Proves where you currently live. Common for school enrollment, utilities, government benefits, and insurance.',
    category:    'identity',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'Home',
    popular:     true,
  },

  affidavit_of_identity: {
    id:          'affidavit_of_identity',
    name:        'Affidavit of Identity',
    description: 'Confirms your legal name and identity. Used to correct name discrepancies, support name-change requests, or verify you are who you claim to be.',
    category:    'identity',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'User',
  },

  financial_affidavit: {
    id:          'financial_affidavit',
    name:        'Financial Affidavit',
    description: 'Documents income, expenses, assets, and liabilities under oath. Required in support proceedings, fee-waiver applications, and benefits determinations.',
    category:    'financial',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'DollarSign',
  },

  affidavit_of_support: {
    id:          'affidavit_of_support',
    name:        'Affidavit of Support',
    description: 'A sworn statement vouching for another person — covering housing, financial support, or character. Used in immigration, housing, and court contexts.',
    category:    'general',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'Users',
  },

  affidavit_of_heirship: {
    id:          'affidavit_of_heirship',
    name:        'Affidavit of Heirship',
    description: 'Establishes who the rightful heirs of a deceased person are, without going through formal probate. Commonly used to transfer real estate or vehicles.',
    category:    'estate',
    states:      ALL_STATES,
    documentSet: ['affidavit_of_heirship'],
    statutes: {
      TX: 'Tex. Est. Code § 203.001',
      CA: 'Cal. Prob. Code §§ 13006, 13150',
      AZ: 'A.R.S. § 14-3971',
      FL: 'Fla. Stat. § 735.201',
      IL: '755 ILCS 5/9-8',
      NY: 'SCPA § 1310',
      UT: 'Utah Code § 75-3-1201',
    },
    icon:        'BookOpen',
    popular:     true,
  },

  small_estate_affidavit: {
    id:          'small_estate_affidavit',
    name:        'Small Estate Affidavit',
    description: 'Allows you to collect a deceased person\'s assets without formal probate when the estate is below your state\'s threshold.',
    category:    'estate',
    states:      ALL_STATES,
    documentSet: ['small_estate_affidavit'],
    estateLimits: {
      TX:  75000,    // Tex. Est. Code § 205.001 — $75,000 personal property
      CA:  184500,   // Cal. Prob. Code § 13100 (2024, adjusts with CPI)
      AZ:  75000,    // A.R.S. § 14-3971
      FL:  75000,    // Fla. Stat. § 735.201
      IL:  100000,   // 755 ILCS 5/25-1
      NY:  50000,    // SCPA § 1310 (voluntary administration)
      UT:  100000,   // Utah Code § 75-3-1201
    },
    statutes: {
      TX: 'Tex. Est. Code § 205.001',
      CA: 'Cal. Prob. Code § 13100',
      AZ: 'A.R.S. § 14-3971',
      FL: 'Fla. Stat. § 735.201',
      IL: '755 ILCS 5/25-1',
      NY: 'SCPA § 1310',
      UT: 'Utah Code § 75-3-1201',
    },
    icon:        'Archive',
    popular:     true,
  },

  affidavit_of_domicile: {
    id:          'affidavit_of_domicile',
    name:        'Affidavit of Domicile',
    description: 'Certifies the state of legal residence of a deceased person at the time of death. Required by financial institutions and transfer agents to transfer securities or accounts.',
    category:    'estate',
    states:      ['CA', 'FL', 'NY', 'TX', 'IL'],
    documentSet: ['affidavit'],
    icon:        'MapPin',
  },

  // ── Divorce package (family law) ─────────────────────────────────────────────
  // Registered here so the type bank is complete; routing goes to DivorceOrchestrators.

  divorce_package: {
    id:          'divorce_package',
    name:        'Divorce Package',
    description: 'Complete guided divorce document preparation — petition, decree, and all required companion documents based on your specific situation.',
    category:    'family',
    states:      ALL_STATES,
    documentSet: [], // determined dynamically by DocumentSelectionAgent
    icon:        'Scale',
    popular:     true,
    routesTo:    'divorce_orchestrator', // handled separately in chat.js
  },

  // ── State-specific types ─────────────────────────────────────────────────────

  affidavit_of_no_divorce: {
    id:          'affidavit_of_no_divorce',
    name:        'Affidavit of No Divorce',
    description: 'Certifies that you have never been divorced, or that no divorce proceedings are pending. Required for some marriages, visa applications, and insurance matters.',
    category:    'family',
    states:      ['NY', 'TX', 'CA', 'FL'],
    documentSet: ['affidavit'],
    icon:        'Heart',
  },

  affidavit_of_survivorship: {
    id:          'affidavit_of_survivorship',
    name:        'Affidavit of Survivorship',
    description: 'Used by a surviving joint tenant to transfer real property into their name alone after the other joint tenant dies, without probate.',
    category:    'estate',
    states:      ['TX', 'CA', 'AZ', 'UT', 'FL', 'IL', 'NY'],
    documentSet: ['affidavit'],
    statutes: {
      TX: 'Tex. Prop. Code § 111.001',
      CA: 'Cal. Prob. Code § 210',
    },
    icon:        'Home',
  },

  affidavit_of_lost_document: {
    id:          'affidavit_of_lost_document',
    name:        'Affidavit of Lost Document',
    description: 'Attests that an original document (title, deed, contract, certificate) has been lost and requests a replacement. Required by DMVs, courts, and financial institutions.',
    category:    'general',
    states:      ALL_STATES,
    documentSet: ['affidavit'],
    icon:        'Search',
  },

  vehicle_transfer_affidavit: {
    id:          'vehicle_transfer_affidavit',
    name:        'Vehicle Transfer Affidavit',
    description: 'Transfers a vehicle title after the owner\'s death to an heir without formal probate, or documents a private-party sale outside of normal dealer channels.',
    category:    'estate',
    states:      ['TX', 'AZ', 'UT'],
    documentSet: ['affidavit'],
    statutes: {
      TX: 'Tex. Transp. Code § 501.0234',
      AZ: 'A.R.S. § 28-2055',
      UT: 'Utah Code § 41-1a-222',
    },
    icon:        'Truck',
  },

  affidavit_of_no_lien: {
    id:          'affidavit_of_no_lien',
    name:        'Affidavit of No Lien',
    description: 'Certifies that a property is free and clear of liens. Often required during real estate closings.',
    category:    'property',
    states:      ['TX', 'FL', 'CA', 'NY'],
    documentSet: ['affidavit'],
    icon:        'Shield',
  },
};

// ─── AffidavitTypeRegistry class ──────────────────────────────────────────────

class AffidavitTypeRegistry {
  /**
   * Get all available affidavit types, optionally filtered by state.
   * Excludes the divorce_package (handled separately) unless includeFamily is true.
   *
   * @param {string}  [stateCode]     - 2-letter state code to filter by
   * @param {boolean} [includeFamily] - Include divorce_package in results (default false)
   * @returns {Object[]} Array of type metadata objects
   */
  getTypes(stateCode, includeFamily = false) {
    const state = stateCode?.toUpperCase();
    return Object.values(AFFIDAVIT_TYPES).filter(t => {
      if (!includeFamily && t.routesTo === 'divorce_orchestrator') return false;
      if (!state) return true;
      return t.states === ALL_STATES || t.states.includes(state);
    });
  }

  /**
   * Get types grouped by category for display in the type-picker UI.
   */
  getTypesByCategory(stateCode) {
    const types = this.getTypes(stateCode, true);
    const grouped = {};
    for (const t of types) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    }
    return grouped;
  }

  /**
   * Look up a single type by ID.
   */
  getType(typeId) {
    return AFFIDAVIT_TYPES[typeId] || null;
  }

  /**
   * Check whether a given document type routes to the divorce orchestrator.
   */
  isDivorceType(typeId) {
    return AFFIDAVIT_TYPES[typeId]?.routesTo === 'divorce_orchestrator';
  }

  /**
   * Get the estate limit for a small estate affidavit in a given state.
   */
  getEstateLimit(stateCode) {
    return AFFIDAVIT_TYPES.small_estate_affidavit.estateLimits[stateCode?.toUpperCase()] || null;
  }

  /**
   * Get the relevant statute citation for a type in a given state.
   */
  getStatute(typeId, stateCode) {
    return AFFIDAVIT_TYPES[typeId]?.statutes?.[stateCode?.toUpperCase()] || null;
  }

  /** Expose the raw map for internal use. */
  get all() { return AFFIDAVIT_TYPES; }
}

module.exports = new AffidavitTypeRegistry();
